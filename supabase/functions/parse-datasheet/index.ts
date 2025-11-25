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
        const { file, mimeType } = await req.json()

        if (!file) {
            throw new Error('No file provided')
        }

        const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
        if (!GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY not set')
        }

        // Call Gemini API
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: "Extract technical specifications for ALL models found in this datasheet. Return a JSON object with a key 'models' which is an array of objects. Each object should have keys: manufacturer, model_number, watts (number), voc (number), isc (number), efficiency (number), width_mm (number), height_mm (number), weight_kg (number), capacity_kw (number), capacity_kwh (number), voltage (number), type (Solar Panel, Inverter, or Battery). If a value is not found, use null. Return ONLY the JSON." },
                            {
                                inline_data: {
                                    mime_type: mimeType,
                                    data: file // base64 string
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        response_mime_type: "application/json"
                    }
                })
            }
        )

        const data = await response.json()

        if (!data.candidates || !data.candidates[0].content) {
            console.error('Gemini Error:', JSON.stringify(data))
            throw new Error('Failed to parse document with Gemini')
        }

        const text = data.candidates[0].content.parts[0].text
        const specs = JSON.parse(text)

        return new Response(JSON.stringify(specs), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
