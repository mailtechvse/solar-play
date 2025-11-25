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
        let { center, zoom, point } = body

        // Handle legacy/alternative params
        if (!center && body.centerLat && body.centerLng) {
            center = `${body.centerLat},${body.centerLng}`;
        }

        const clickX = point?.x ?? body.clickX ?? 400;
        const clickY = point?.y ?? body.clickY ?? 400;

        const googleApiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

        if (!googleApiKey || !geminiApiKey) throw new Error('API Keys not configured')

        // 1. Fetch Static Map Image
        const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=800x800&maptype=satellite&key=${googleApiKey}`

        const mapResponse = await fetch(mapUrl)
        if (!mapResponse.ok) throw new Error(`Failed to fetch map image: ${mapResponse.statusText}`)

        const mapBlob = await mapResponse.blob()
        const mapBuffer = await mapBlob.arrayBuffer()

        // Convert to base64 in chunks
        let binary = '';
        const bytes = new Uint8Array(mapBuffer);
        const len = bytes.byteLength;
        const chunkSize = 0x8000;
        for (let i = 0; i < len; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
        }
        const base64Image = btoa(binary)

        // 2. Call Gemini
        const prompt = `
      You are an expert GIS analyst. Analyze this 800x800 satellite image.
      The user has selected a building located at the EXACT CENTER of the image (pixel coordinates ${Math.round(clickX)}, ${Math.round(clickY)}).
      
      Your task:
      1. Identify the roof of the building at the center (${Math.round(clickX)}, ${Math.round(clickY)}).
      2. Trace the EXACT outline of this roof. Do NOT include shadows, adjacent trees, or other buildings.
      3. Be precise with corners. If the building is L-shaped or has a complex footprint, capture all corners. Do not over-simplify to a rectangle unless it is one.
      4. Estimate the building height in meters based on shadows and context.

      Return a JSON object with:
      - 'vertices': An array of {x, y} pixel coordinates (0-800) representing the roof polygon.
      - 'height': Estimated height in meters (number).
      
      Only return the valid JSON.
    `

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`

        const geminiResponse = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inline_data: { mime_type: "image/png", data: base64Image } }
                    ]
                }]
            })
        })

        const geminiData = await geminiResponse.json()

        if (geminiData.error) throw new Error(geminiData.error.message)

        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) throw new Error('No response from AI')

        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('Invalid JSON from AI')

        const result = JSON.parse(jsonMatch[0])

        return new Response(
            JSON.stringify({ feature: result }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
