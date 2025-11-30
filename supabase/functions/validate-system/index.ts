import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { objects, wires, systemStats } = await req.json()

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
        if (!geminiApiKey) {
            throw new Error('Gemini API Key not configured')
        }

        // Construct prompt for Gemini
        const prompt = `
You are an expert Solar PV System Design Engineer. Review the following solar system design and provide a validation report.

System Overview:
- DC Capacity: ${systemStats.dcCapacity} kWp
- AC Capacity: ${systemStats.acCapacity} kW
- Battery Capacity: ${systemStats.batteryCapacity} kWh
- System Cost: ₹${systemStats.systemCost}

Components:
${objects.map((o: any) => `- ${o.label || o.type} (Type: ${o.type}, Subtype: ${o.subtype || 'N/A'}, Specs: ${JSON.stringify(o.specifications || {})})`).join('\n')}

Connections (Wires):
${wires.map((w: any) => `- From ${w.from} to ${w.to} (Type: ${w.type})`).join('\n')}

Validation Rules to Check:
1. **VCB/ACB Requirement**: For systems > 100 kW, check if VCB (Vacuum Circuit Breaker) or ACB (Air Circuit Breaker) are present to manage voltage spikes. If missing, flag as a critical warning.
2. **BESS Configuration**: If a BESS (Battery Energy Storage System) is present, check if PCS, STS, and Battery capacity are reasonably matched.
3. **Inverter Sizing**: Check DC:AC ratio (should be between 1.1 and 1.4).
4. **Battery Compatibility**: Ensure batteries are connected to Hybrid Inverters or BESS.
5. **General Safety**: Check for Lightning Arrestors (LA) and Earthing.

Output Format:
Return a JSON object with the following structure:
{
  "valid": boolean,
  "score": number (0-100),
  "summary": "Short summary of the review",
  "issues": ["List of critical issues"],
  "warnings": ["List of warnings/suggestions"],
  "recommendations": ["Detailed technical recommendations"]
}

Return ONLY the JSON object.
`

        // Call Gemini API
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`

        const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }]
            })
        })

        const data = await response.json()

        if (data.error) {
            throw new Error(data.error.message)
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text

        // Parse JSON from text
        let validationResult
        try {
            // Find JSON block
            const match = text.match(/\{[\s\S]*\}/)
            if (match) {
                validationResult = JSON.parse(match[0])
            } else {
                validationResult = {
                    valid: false,
                    score: 0,
                    summary: "Failed to parse AI response",
                    issues: ["AI response format error"],
                    warnings: [],
                    recommendations: [text]
                }
            }
        } catch (e) {
            validationResult = {
                valid: false,
                score: 0,
                summary: "Failed to parse AI response",
                issues: ["AI response parsing error"],
                warnings: [],
                recommendations: [text]
            }
        }

        return new Response(
            JSON.stringify(validationResult),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
