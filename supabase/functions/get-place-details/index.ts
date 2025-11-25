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
        const { place_id } = await req.json()
        const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')

        if (!place_id) throw new Error('Place ID is required')
        if (!apiKey) throw new Error('Google Maps API Key is not configured')

        // Use Places API (New)
        const url = `https://places.googleapis.com/v1/places/${place_id}`

        const response = await fetch(url, {
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': 'location'
            }
        })

        const data = await response.json()

        if (data.error) {
            throw new Error(`Google API Error: ${data.error.message}`)
        }

        const location = {
            lat: data.location.latitude,
            lng: data.location.longitude
        }

        return new Response(
            JSON.stringify({ location }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
