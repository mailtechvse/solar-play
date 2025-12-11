import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

serve(async (req) => {
    try {
        console.log("Starting Fetch Manufacturer Data Cron...")

        // 1. Get Active Integrations
        const { data: integrations, error: intError } = await supabase
            .from('customer_integrations')
            .select('*, customers(name)')
            .eq('is_active', true)

        if (intError) throw intError
        console.log(`Found ${integrations.length} active integrations`)

        const results = []

        for (const integration of integrations) {
            try {
                // In a real scenario, we would retrieve secrets using Vault here
                // const { data: apiKey } = await supabase.rpc('read_secret', { secret_id: integration.api_key_secret_id })

                console.log(`Processing ${integration.manufacturer} for ${integration.customers?.name}`)

                // Mock API Fetch depending on manufacturer
                const data = await fetchManufacturerData(integration)

                // Upsert Devices
                for (const device of data.devices) {
                    // 1. Ensure Device Exists
                    const { data: dbDevice, error: devError } = await supabase
                        .from('devices')
                        .select('id')
                        .eq('integration_id', integration.id)
                        .eq('external_id', device.sn)
                        .single()

                    let deviceId = dbDevice?.id

                    if (!deviceId) {
                        const { data: newDevice, error: newDevError } = await supabase
                            .from('devices')
                            .insert({
                                customer_id: integration.customer_id,
                                integration_id: integration.id,
                                external_id: device.sn,
                                name: device.name || `${integration.manufacturer} Device`,
                                type: device.type || 'Inverter',
                                status: 'online'
                            })
                            .select()
                            .single()
                        if (newDevError) {
                            console.error("Error creating device", newDevError)
                            continue
                        }
                        deviceId = newDevice.id
                    }

                    // 2. Insert Reading
                    await supabase.from('device_readings').insert({
                        device_id: deviceId,
                        timestamp: new Date().toISOString(),
                        power_watts: device.currentPower,
                        energy_day_wh: device.dailyEnergy,
                        battery_soc: device.batterySoC,
                        raw_data: device
                    })
                }

                // Update Integration Status
                await supabase.from('customer_integrations').update({
                    last_sync_at: new Date().toISOString(),
                    sync_status: 'success'
                }).eq('id', integration.id)

                results.push({ integration: integration.id, status: 'success' })

            } catch (err) {
                console.error(`Failed to process integration ${integration.id}:`, err)
                await supabase.from('customer_integrations').update({
                    last_sync_at: new Date().toISOString(),
                    sync_status: 'error'
                }).eq('id', integration.id)
                results.push({ integration: integration.id, status: 'error', message: err.message })
            }
        }

        return new Response(JSON.stringify({ success: true, results }), {
            headers: { "Content-Type": "application/json" },
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})

// --- Mock/Real Adapters ---

async function fetchManufacturerData(integration) {
    // Real Endpoint Bases
    // Growatt: https://openapi.growatt.com (Token based)
    // GoodWe: https://www.semsportal.com/api (Token based)
    // DEYE: https://api.deyecloud.com (OAuth2)
    // SunGrow: https://api.isolarcloud.com (AppKey/Sign)

    // For this implementation, we will SIMULATE the API call with realistic data 
    // because we don't have valid credentials.
    // In production, these blocks would use 'fetch()' with the 'integration.api_endpoint' and secrets.

    // Simulate network latency
    await new Promise(r => setTimeout(r, 500))

    // Random fluctuation
    const randomPower = 3000 + Math.random() * 2000 // 3-5kW
    const randomSoc = 50 + Math.random() * 50 // 50-100%

    return {
        devices: [
            {
                sn: `MOCK-${integration.manufacturer.toUpperCase()}-001`,
                name: `${integration.manufacturer} Hybrid Inverter`,
                type: 'Inverter',
                currentPower: randomPower,
                dailyEnergy: randomPower * 5, // Approximate
                batterySoC: randomSoc,
                status: 'Normal'
            }
        ]
    }
}
