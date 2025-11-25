import React, { useState } from "react";
import { equipmentService, specSheetService } from "../lib/supabase";
import { useSolarStore } from "../stores/solarStore";

export default function SpecSheetUpload() {
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [extractedData, setExtractedData] = useState(null);
  const equipmentLibrary = useSolarStore(
    (state) => state.equipmentLibrary
  );
  const equipmentTypes = useSolarStore((state) => state.equipmentTypes);

  // Flatten all equipment for selection
  const allEquipment = Object.values(equipmentLibrary).flat();

  const handleFileSelect = (e) => {
    setFile(e.target.files[0]);
    setExtractedData(null);
    setUploadStatus("");
  };

  const handleUpload = async () => {
    if (!selectedEquipment || !file) {
      alert("Please select equipment and a file");
      return;
    }

    setUploading(true);
    setUploadStatus("Uploading and analyzing spec sheet...");

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Content = reader.result.split(",")[1];
        const fileType = file.type === "application/pdf" ? "pdf" : "image";

        // Get equipment type name
        const equipmentType =
          selectedEquipment.equipment_types?.name || "Unknown";

        // Create spec sheet record
        const specSheet = await specSheetService.createSpecSheet({
          equipment_id: selectedEquipment.id,
          file_url: "", // Will be updated when file is stored
          file_name: file.name,
          file_type: fileType,
        });

        setUploadStatus("Analyzing with Gemini...");

        // Call Edge Function for Gemini analysis
        const result = await specSheetService.analyzeSpecSheet(
          specSheet.id,
          equipmentType,
          base64Content,
          fileType,
          selectedEquipment.id
        );

        if (result.success) {
          setUploadStatus("Analysis complete!");
          setExtractedData(result);

          // Show extracted data
          setTimeout(() => {
            setUploadStatus("");
            setFile(null);
            setSelectedEquipment(null);
          }, 2000);
        } else {
          setUploadStatus("Error: " + result.error);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      setUploadStatus("Error: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-white font-bold text-sm">Upload Spec Sheet</h3>

      {/* Equipment Selection */}
      <div>
        <label className="block text-gray-300 text-xs font-medium mb-2">
          Select Equipment
        </label>
        <select
          value={selectedEquipment?.id || ""}
          onChange={(e) => {
            const equipment = allEquipment.find((eq) => eq.id === e.target.value);
            setSelectedEquipment(equipment || null);
            setExtractedData(null);
          }}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white text-sm rounded hover:border-gray-500 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Choose equipment...</option>
          {allEquipment.map((equipment) => (
            <option key={equipment.id} value={equipment.id}>
              {equipment.name} ({equipment.model_number})
            </option>
          ))}
        </select>
      </div>

      {/* File Input */}
      <div>
        <label className="block text-gray-300 text-xs font-medium mb-2">
          Upload PDF or Image
        </label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileSelect}
          disabled={!selectedEquipment}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white text-sm rounded disabled:opacity-50"
        />
        <div className="text-gray-400 text-xs mt-1">
          Supported: PDF, JPG, PNG (Max 10MB)
        </div>
      </div>

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        disabled={!selectedEquipment || !file || uploading}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded transition"
      >
        {uploading ? (
          <>
            <i className="fas fa-spinner fa-spin mr-2"></i>
            Analyzing...
          </>
        ) : (
          <>
            <i className="fas fa-cloud-upload-alt mr-2"></i>
            Upload & Analyze
          </>
        )}
      </button>

      {/* Status */}
      {uploadStatus && (
        <div className={`px-3 py-2 rounded text-sm ${
          uploadStatus.includes("Error")
            ? "bg-red-900 text-red-200"
            : "bg-blue-900 text-blue-200"
        }`}>
          {uploadStatus}
        </div>
      )}

      {/* Extracted Data Display */}
      {extractedData && (
        <div className="bg-gray-700 p-3 rounded space-y-2">
          <h4 className="text-white font-bold text-xs">Extracted Data</h4>
          <div className="space-y-1 text-xs">
            <div className="text-gray-300">
              <span className="font-medium">Confidence:</span>{" "}
              {(extractedData.confidence * 100).toFixed(0)}%
            </div>
            {extractedData.extracted_specs &&
              Object.entries(extractedData.extracted_specs)
                .slice(0, 5)
                .map(([key, value]) => (
                  <div key={key} className="text-gray-300">
                    <span className="font-medium">{key}:</span> {String(value)}
                  </div>
                ))}
            {extractedData.missing_data?.length > 0 && (
              <div className="text-yellow-400 mt-2">
                <span className="font-medium">Missing:</span>{" "}
                {extractedData.missing_data.join(", ")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
