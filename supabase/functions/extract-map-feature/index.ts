import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()

        // Support multiple input formats for coordinates
        let lat = body.lat
        let lng = body.lng
        const buildingName = body.buildingName || body.name || 'Building'

        // Handle legacy format: center as "lat,lng" string
        if (!lat && !lng && body.center) {
            const [centerLat, centerLng] = body.center.split(',').map(Number)
            lat = centerLat
            lng = centerLng
        }

        // Handle alternative format: centerLat, centerLng
        if (!lat && !lng && body.centerLat && body.centerLng) {
            lat = Number(body.centerLat)
            lng = Number(body.centerLng)
        }

        // Handle format: latitude, longitude
        if (!lat && !lng && body.latitude && body.longitude) {
            lat = Number(body.latitude)
            lng = Number(body.longitude)
        }

        // Validate coordinates
        if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
            throw new Error('Coordinates are required. Send as: {lat, lng} or {center: "lat,lng"} or {centerLat, centerLng} or {latitude, longitude}')
        }

        const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!googleApiKey || !geminiApiKey) {
            throw new Error('API Keys not configured')
        }

        // 1. Fetch Static Map Image at zoom 20 (highest detail for buildings)
        const zoom = 20
        const imageSize = 640 // Max size for free tier
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=${imageSize}x${imageSize}&maptype=satellite&key=${googleApiKey}`

        console.log('Fetching map image...')
        const mapResponse = await fetch(mapUrl)
        if (!mapResponse.ok) {
            throw new Error(`Failed to fetch map image: ${mapResponse.statusText}`)
        }

        const mapBlob = await mapResponse.blob()
        const mapBuffer = await mapBlob.arrayBuffer()

        // Convert to base64
        const bytes = new Uint8Array(mapBuffer)
        let binary = ''
        const chunkSize = 0x8000
        for (let i = 0; i < bytes.byteLength; i += chunkSize) {
            binary += String.fromCharCode.apply(null, [...bytes.subarray(i, Math.min(i + chunkSize, bytes.byteLength))])
        }
        const satelliteImageBase64 = btoa(binary)

        // 2. Use Gemini to generate an isolated PNG of the building
        // Then extract polygon from the generated image's non-transparent pixels
        console.log('Generating isolated building image...')

        const isolationPrompt = `Edit this satellite image.

TASK: Create a cutout of ONLY the building roof at the center.

REMOVE completely (make transparent):
- All trees and vegetation
- All ground, pavement, and roads
- The green sports field
- All shadows on the ground
- All other buildings except the center one
- Everything that is not the center building's roof

KEEP only:
- The single building roof located at the exact center of the image
- Preserve its original colors and texture

The output must be a PNG with the center building roof on a fully transparent background. Nothing else should be visible.`

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:streamGenerateContent?key=${geminiApiKey}`

        let isolatedBuildingBase64: string | null = null
        let buildingHeight = 10 // Default height

        try {
            console.log('Calling Gemini for image isolation...')
            const isolationResponse = await fetch(geminiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: isolationPrompt },
                            { inlineData: { mimeType: "image/png", data: satelliteImageBase64 } }
                        ]
                    }],
                    generationConfig: {
                        responseModalities: ["IMAGE", "TEXT"]
                    }
                })
            })

            console.log('Gemini response status:', isolationResponse.status)
            const responseText = await isolationResponse.text()
            console.log('Gemini response length:', responseText.length)

            // Parse response - handle streaming format
            let chunks: any[] = []
            if (responseText.startsWith('[')) {
                // JSON array format
                chunks = JSON.parse(responseText)
            } else {
                // Newline-delimited JSON format
                const lines = responseText.split('\n').filter(line => line.trim())
                for (const line of lines) {
                    try {
                        chunks.push(JSON.parse(line))
                    } catch { }
                }
            }

            console.log('Parsed chunks count:', chunks.length)

            // Extract image from response
            for (const chunk of chunks) {
                const parts = chunk?.candidates?.[0]?.content?.parts || []
                for (const part of parts) {
                    if (part.inlineData?.mimeType?.startsWith('image/')) {
                        isolatedBuildingBase64 = part.inlineData.data
                        console.log('Isolated building image generated, size:', isolatedBuildingBase64.length)
                        break
                    }
                    // Also look for height estimate in text
                    if (part.text) {
                        console.log('Gemini text response:', part.text.substring(0, 200))
                        const heightMatch = part.text.match(/(\d+)\s*(?:meters?|m)\s*(?:tall|high|height)/i)
                        if (heightMatch) {
                            buildingHeight = parseInt(heightMatch[1])
                        }
                    }
                }
                if (isolatedBuildingBase64) break
            }

            if (!isolatedBuildingBase64) {
                console.log('No image in Gemini response, raw response preview:', responseText.substring(0, 500))
            }
        } catch (err) {
            console.error('Image isolation failed:', err)
        }

        // 3. Get building metadata (height, type) with a simple text query
        console.log('Getting building metadata...')
        const metadataPrompt = `
Look at the building at the center of this satellite image.
Estimate:
1. Building height in meters (based on shadow length)
2. Building type (residential/commercial/industrial)
3. Roof type (flat/sloped)

Reply with ONLY JSON: {"height":number,"type":"string","roofType":"string"}
`
        const metadataUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

        try {
            const metadataResponse = await fetch(metadataUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: metadataPrompt },
                            { inline_data: { mime_type: "image/png", data: satelliteImageBase64 } }
                        ]
                    }]
                })
            })

            const metadataData = await metadataResponse.json()
            const metadataText = metadataData.candidates?.[0]?.content?.parts?.[0]?.text || ''
            const metadataMatch = metadataText.match(/\{[\s\S]*\}/)
            if (metadataMatch) {
                const metadata = JSON.parse(metadataMatch[0])
                buildingHeight = metadata.height || buildingHeight
            }
        } catch (err) {
            console.error('Metadata extraction failed:', err)
        }

        // 4. Build polygon data - will be extracted from image on frontend
        // For now, create a simple centered rectangle as placeholder
        // The frontend will use the actual image bounds
        const buildingData = {
            name: buildingName || 'Building',
            vertices: [
                { x: imageSize * 0.2, y: imageSize * 0.2 },
                { x: imageSize * 0.8, y: imageSize * 0.2 },
                { x: imageSize * 0.8, y: imageSize * 0.8 },
                { x: imageSize * 0.2, y: imageSize * 0.8 }
            ],
            height: buildingHeight,
            type: 'commercial',
            roofType: 'flat',
            estimatedArea: 0,
            // Flag to tell frontend to extract polygon from image
            extractPolygonFromImage: true
        }

        const buildingTexture = isolatedBuildingBase64
            ? `data:image/png;base64,${isolatedBuildingBase64}`
            : `data:image/png;base64,${satelliteImageBase64}`

        // 4. Convert pixel coordinates to meters (approximate)
        // At zoom 20, 1 pixel ≈ 0.15 meters at equator (varies by latitude)
        const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)

        // Normalize vertices to meters relative to center
        const centerPixel = imageSize / 2
        const verticesInMeters = buildingData.vertices.map((v: { x: number, y: number }) => ({
            x: (v.x - centerPixel) * metersPerPixel,
            y: (v.y - centerPixel) * metersPerPixel
        }))

        // Calculate bounding box
        const xs = verticesInMeters.map((v: { x: number, y: number }) => v.x)
        const ys = verticesInMeters.map((v: { x: number, y: number }) => v.y)
        const minX = Math.min(...xs)
        const minY = Math.min(...ys)
        const maxX = Math.max(...xs)
        const maxY = Math.max(...ys)

        // Normalize vertices relative to bounding box origin
        const normalizedVertices = verticesInMeters.map((v: { x: number, y: number }) => ({
            x: v.x - minX,
            y: v.y - minY
        }))

        // 5. Build the canvas object
        const canvasObject = {
            id: `building_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            type: "structure",
            name: buildingData.name || buildingName || "Building",
            label: buildingData.name || buildingName || "Building",
            x: 0, // Will be set by canvas when placing
            y: 0,
            w: maxX - minX,
            h: maxY - minY,
            h_z: buildingData.height || 3,
            relative_h: 0,
            rotation: 0,
            color: "#475569",
            isPolygon: true,
            vertices: normalizedVertices,
            texture: buildingTexture || `data:image/png;base64,${satelliteImageBase64}`,
            metadata: {
                coordinates: { lat, lng },
                buildingType: buildingData.type,
                roofType: buildingData.roofType,
                estimatedArea: buildingData.estimatedArea,
                sourceZoom: zoom,
                metersPerPixel
            }
        }

        console.log('Building extraction complete:', canvasObject.name)

        return new Response(
            JSON.stringify({
                success: true,
                building: canvasObject,
                rawPolygon: buildingData,
                satelliteImage: `data:image/png;base64,${satelliteImageBase64}`
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        console.error('Extract map feature error:', error)
        return new Response(
            JSON.stringify({
                success: false,
                error: error.message
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
