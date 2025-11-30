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

        // 2. Use Gemini to extract building polygon vertices directly
        console.log('Extracting building polygon...')
        const extractionPrompt = `
You are an expert GIS analyst. Analyze this ${imageSize}x${imageSize} satellite image.

The building is located at the CENTER of the image (coordinates: ${lat}, ${lng}).
${buildingName ? `Building name: "${buildingName}"` : ''}

Your task:
1. Identify the roof of the building at the exact center of the image.
2. Trace the PRECISE outline of this roof polygon. Include ALL corners if the building is L-shaped, U-shaped, or has a complex footprint.
3. Do NOT include shadows, trees, or adjacent structures in the polygon.
4. Estimate the building height in meters based on shadow length and context.

Return ONLY a valid JSON object:
{
  "name": "${buildingName || 'Building'}",
  "vertices": [{"x": number, "y": number}, ...],
  "height": number,
  "type": "residential" | "commercial" | "industrial" | "mixed",
  "roofType": "flat" | "sloped" | "complex"
}

The vertices should be pixel coordinates (0-${imageSize}) tracing the building outline clockwise.
`

        // Use gemini-1.5-pro for better vision capabilities
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiApiKey}`

        const extractionResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: extractionPrompt },
                        { inline_data: { mime_type: "image/png", data: satelliteImageBase64 } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json"
                },
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        })

        const extractionData = await extractionResponse.json()

        if (extractionData.error) {
            throw new Error(`Gemini extraction error: ${extractionData.error.message}`)
        }

        console.log('Gemini raw response:', JSON.stringify(extractionData).substring(0, 500))

        const extractionText = extractionData.candidates?.[0]?.content?.parts?.[0]?.text
        if (!extractionText) {
            console.error('Full Gemini response:', JSON.stringify(extractionData))
            throw new Error('No response from AI for polygon extraction')
        }

        // Parse JSON from response
        let buildingData;
        try {
            buildingData = JSON.parse(extractionText);
        } catch (e) {
            // Try to find JSON block if mixed with text
            const match = extractionText.match(/\{[\s\S]*\}/);
            if (match) {
                buildingData = JSON.parse(match[0]);
            } else {
                throw new Error('Failed to parse AI response');
            }
        }

        // Use original satellite image as texture
        const buildingTexture = `data:image/png;base64,${satelliteImageBase64}`
        const maskImage = null; // No mask needed

        // Ensure extractPolygonFromImage is false
        buildingData.extractPolygonFromImage = false;

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
