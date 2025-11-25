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
        const { query } = await req.json()
        const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

        if (!query) throw new Error('Query is required')
        if (!apiKey) throw new Error('Google Maps API Key is not configured')

        // Use Google Geocoding API
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`

        const response = await fetch(url)
        const data = await response.json()

        if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
            throw new Error(`Google API Error: ${data.status} - ${data.error_message || ''}`)
        }

        const results = data.results.map((p: any) => ({
            place_id: p.place_id,
            name: p.formatted_address.split(',')[0],
            formatted_address: p.formatted_address,
            location: p.geometry.location // { lat, lng }
        }))

        return new Response(
            JSON.stringify({ results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
