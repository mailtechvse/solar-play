import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AnalysisRequest {
  spec_sheet_id: string;
  equipment_type: string;
  file_content: string; // Base64 encoded file content
  file_type: string; // 'pdf' or 'image'
  equipment_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const requestData = (await req.json()) as AnalysisRequest;

    const {
      spec_sheet_id,
      equipment_type,
      file_content,
      file_type,
      equipment_id,
    } = requestData;

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Gemini API key from environment
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      throw new Error("Gemini API key not configured");
    }

    // Prepare the file data for Gemini
    const fileData = {
      inlineData: {
        data: file_content, // Base64 encoded
        mimeType:
          file_type === "pdf"
            ? "application/pdf"
            : "image/jpeg", // Adjust as needed
      },
    };

    // Get equipment type key specs
    const { data: typeData } = await supabase
      .from("equipment_types")
      .select("key_specs")
      .eq("name", equipment_type)
      .single();

    const keySpecs = typeData?.key_specs || {};
    const specKeys = Object.keys(keySpecs);

    // Prepare the prompt based on equipment type
    const prompt = `
You are an expert in analyzing solar equipment specification sheets.
Analyze the provided specification sheet for a ${equipment_type} and extract the following information:

Required specifications for ${equipment_type}: ${specKeys.join(", ")}

Please extract and return ONLY a valid JSON object with the following structure:
{
  "extracted_data": {
    "name": "string",
    "manufacturer": "string",
    "model_number": "string",
    "specifications": {
      ${specKeys.map((key) => `"${key}": "value or number"`).join(",\n      ")}
    },
    "additional_specs": {}
  },
  "confidence": 0.0-1.0,
  "missing_data": ["list of missing specifications"],
  "notes": "any important notes or observations"
}

If you cannot extract the information, still return the JSON structure with empty/null values.
`;

    // Call Gemini API
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
                fileData,
              ],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const error = await geminiResponse.text();
      console.error("Gemini API error:", error);
      throw new Error(`Gemini API failed: ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();

    // Extract the text response
    let extractedSpecs = {};
    let confidence = 0;
    let missingData = [];
    let notes = "";

    if (geminiData.candidates && geminiData.candidates[0]) {
      const responseText =
        geminiData.candidates[0].content.parts[0].text || "";

      // Parse JSON from response
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          extractedSpecs = parsed.extracted_data?.specifications || {};
          confidence = parsed.confidence || 0.5;
          missingData = parsed.missing_data || [];
          notes = parsed.notes || "";
        }
      } catch (e) {
        console.error("Error parsing Gemini response:", e);
        notes = "Error parsing response: " + responseText.substring(0, 200);
      }
    }

    // Update spec_sheets table
    const { error: updateError } = await supabase
      .from("spec_sheets")
      .update({
        extracted_specs: extractedSpecs,
        extraction_status: "completed",
        gemini_response: geminiData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", spec_sheet_id);

    if (updateError) {
      console.error("Error updating spec sheet:", updateError);
    }

    // Update equipment specifications if equipment_id provided
    if (equipment_id) {
      const { data: currentEquipment } = await supabase
        .from("equipment")
        .select("specifications")
        .eq("id", equipment_id)
        .single();

      const updatedSpecs = {
        ...(currentEquipment?.specifications || {}),
        ...extractedSpecs,
        extraction_confidence: confidence,
        extraction_notes: notes,
      };

      const { error: equipmentUpdateError } = await supabase
        .from("equipment")
        .update({
          specifications: updatedSpecs,
          updated_at: new Date().toISOString(),
        })
        .eq("id", equipment_id);

      if (equipmentUpdateError) {
        console.error("Error updating equipment:", equipmentUpdateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        extracted_specs: extractedSpecs,
        confidence,
        missing_data: missingData,
        notes,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in analyze-spec-sheet:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
