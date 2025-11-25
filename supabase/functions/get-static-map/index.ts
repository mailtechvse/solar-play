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
        const { center, zoom = 20, size = '800x800', maptype = 'satellite' } = await req.json()
        const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

        if (!apiKey) throw new Error('Google Maps API Key not configured')
        if (!center) throw new Error('Center is required')

        const url = `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&maptype=${maptype}&key=${apiKey}`

        const response = await fetch(url)

        if (!response.ok) {
            throw new Error(`Google API Error: ${response.statusText}`)
        }

        const blob = await response.blob()
        const arrayBuffer = await blob.arrayBuffer()

        // Convert to base64 in chunks to avoid stack overflow
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        const chunkSize = 0x8000; // 32KB chunks
        for (let i = 0; i < len; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, len)));
        }
        const base64 = btoa(binary);

        const dataUrl = `data:${blob.type};base64,${base64}`

        return new Response(
            JSON.stringify({ image: dataUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
