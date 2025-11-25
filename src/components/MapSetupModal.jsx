import React, { useState, useEffect, useRef } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function MapSetupModal() {
    const isOpen = useSolarStore((state) => state.isMapSetupOpen);
    const setOpen = useSolarStore((state) => state.setMapSetupOpen);
    const setMapSettings = useSolarStore((state) => state.setMapSettings);
    const mapSettings = useSolarStore((state) => state.mapSettings);
    const latitude = useSolarStore((state) => state.latitude);
    const longitude = useSolarStore((state) => state.longitude);
    const setLatitude = useSolarStore((state) => state.setLatitude);
    const setLongitude = useSolarStore((state) => state.setLongitude);

    const [googleApiKey, setGoogleApiKey] = useState(mapSettings?.googleApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "");
    const [geminiApiKey, setGeminiApiKey] = useState(mapSettings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY || "");
    const [zoom, setZoom] = useState(mapSettings?.zoom || 20);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const searchInputRef = useRef(null);
    const suggestionsRef = useRef(null);

    // Load Google Places API script
    useEffect(() => {
        if (!isOpen || !googleApiKey) return;

        // Check if script already loaded
        if (window.google?.maps?.places) return;

        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleApiKey}&libraries=places`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);

        return () => {
            // Cleanup script if needed
        };
    }, [isOpen, googleApiKey]);

    // Handle location search
    const handleSearchLocation = async (query) => {
        setSearchQuery(query);

        if (!query || query.length < 3 || !googleApiKey) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        try {
            // Use Google Places Autocomplete API
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${googleApiKey}`,
                { mode: 'cors' }
            );

            // Note: Direct fetch to Google Places API will fail due to CORS
            // We'll use the Google Maps JavaScript API instead
            if (window.google?.maps?.places) {
                const service = new window.google.maps.places.AutocompleteService();
                service.getPlacePredictions(
                    { input: query },
                    (predictions, status) => {
                        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                            setSuggestions(predictions);
                            setShowSuggestions(true);
                        } else {
                            setSuggestions([]);
                            setShowSuggestions(false);
                        }
                    }
                );
            }
        } catch (error) {
            console.error("Location search error:", error);
        }
    };

    // Handle suggestion selection
    const handleSelectSuggestion = (placeId, description) => {
        setSearchQuery(description);
        setShowSuggestions(false);

        if (window.google?.maps?.places) {
            const service = new window.google.maps.places.PlacesService(
                document.createElement('div')
            );

            service.getDetails(
                { placeId: placeId },
                (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK && place.geometry) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();
                        setLatitude(parseFloat(lat.toFixed(4)));
                        setLongitude(parseFloat(lng.toFixed(4)));
                    }
                }
            );
        }
    };

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target) &&
                searchInputRef.current &&
                !searchInputRef.current.contains(event.target)
            ) {
                setShowSuggestions(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLoadMap = async () => {
        if (!googleApiKey) {
            alert("Please enter a Google Maps API Key");
            return;
        }

        setLoading(true);
        try {
            // Construct Static Maps URL
            const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=800x800&maptype=satellite&key=${googleApiKey}`;

            // Verify image loads
            const img = new Image();
            img.onload = () => {
                setMapSettings({
                    googleApiKey,
                    geminiApiKey,
                    zoom,
                    mapImage: mapUrl,
                    mapOverlayActive: true
                });
                setLoading(false);
                setOpen(false);
            };
            img.onerror = () => {
                alert("Failed to load map image. Check API Key and billing.");
                setLoading(false);
            };
            img.src = mapUrl;

        } catch (error) {
            console.error("Map load error:", error);
            alert("Error loading map");
            setLoading(false);
        }
    };

    const addObject = useSolarStore((state) => state.addObject);

    const handleImportBuildings = async () => {
        if (!googleApiKey || !geminiApiKey) {
            alert("Please enter both Google Maps and Gemini API Keys");
            return;
        }

        setLoading(true);
        try {
            // 1. Fetch the map image as base64
            const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=800x800&maptype=satellite&key=${googleApiKey}`;

            // We need to fetch it through a proxy or allow CORS if possible, but for now we'll try fetching directly.
            // Note: Fetching Google Maps image directly from browser might fail due to CORS.
            // In a real app, this should be done via a backend proxy.
            // For this demo, we'll assume the user might have a way to bypass CORS or we use a trick.
            // Actually, we can't easily fetch the image data due to CORS on the client side.
            // WORKAROUND: We will pass the URL to Gemini if it supports it, OR we just simulate it for now if CORS fails.
            // Gemini 1.5 Flash supports image URLs? No, usually base64.

            // Let's try to fetch it. If it fails, we'll alert the user.
            let base64Image;
            try {
                const response = await fetch(mapUrl);
                const blob = await response.blob();
                base64Image = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result.split(',')[1]);
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.warn("CORS blocked image fetch. Using placeholder logic or alerting user.");
                // Fallback: We can't do true AI import without a backend proxy for the image.
                // However, we can try to use the user's provided keys.
                throw new Error("Cannot fetch map image due to browser CORS restrictions. A backend is required for this feature.");
            }

            // 2. Call Gemini API
            const prompt = `Analyze this satellite image. Identify the roof of the main building in the center. Return a JSON object with a 'polygon' key containing an array of {x, y} coordinates for the roof corners. The coordinates should be normalized (0 to 1), where (0,0) is top-left and (1,1) is bottom-right. Only return the JSON.`;

            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

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
            });

            const data = await geminiResponse.json();

            if (data.error) {
                throw new Error(data.error.message);
            }

            // 3. Parse response
            const text = data.candidates[0].content.parts[0].text;
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Invalid response from AI");

            const result = JSON.parse(jsonMatch[0]);

            if (result.polygon && result.polygon.length > 2) {
                // 4. Convert to canvas coordinates
                // Map size is 800x800 pixels
                // Meters per pixel calculation
                const metersPerPixel = 156543.03392 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
                const mapWidthMeters = 800 * metersPerPixel;
                const mapHeightMeters = 800 * metersPerPixel;

                // Convert normalized (0-1) to local meters (centered at 0,0)
                const points = result.polygon.map(p => ({
                    x: (p.x - 0.5) * mapWidthMeters,
                    y: (p.y - 0.5) * mapHeightMeters
                }));

                // Create polygon object
                const newObject = {
                    id: Math.random().toString(36).slice(2),
                    type: "polygon",
                    x: points[0].x, // Position is relative to the first point for polygons usually, or we use absolute points
                    y: points[0].y,
                    points: points, // Store relative points
                    h_z: 3, // Default height 3m
                    cost: 0,
                    color: "#6b7280", // Roof color
                    label: "AI Roof",
                };

                addObject(newObject);
                setMapSettings({
                    googleApiKey,
                    geminiApiKey,
                    zoom,
                    mapImage: mapUrl,
                    mapOverlayActive: true
                });
                setOpen(false);
                alert("Building imported successfully!");
            } else {
                throw new Error("No building polygon found");
            }

        } catch (error) {
            console.error("Import error:", error);
            alert("Error importing building: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-96 p-6 text-gray-800">
                <h2 className="text-lg font-bold mb-4 border-b pb-2">Google Maps Setup</h2>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500">API Key (Static Maps)</label>
                        <input
                            type="password"
                            value={googleApiKey}
                            onChange={(e) => setGoogleApiKey(e.target.value)}
                            className="w-full border p-2 rounded text-sm"
                            placeholder="AIzaSy..."
                        />
                        <div className="text-[10px] text-gray-400 mt-1">
                            Required for fetching satellite imagery and location search.
                        </div>
                    </div>

                    {/* Location Search */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">Search Location</label>
                        <div className="relative">
                            <div className="relative">
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchLocation(e.target.value)}
                                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                                    className="w-full border p-2 rounded text-sm pr-8"
                                    placeholder="Search for a location..."
                                    disabled={!googleApiKey}
                                />
                                <i className="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                            </div>

                            {/* Suggestions Dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div
                                    ref={suggestionsRef}
                                    className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
                                >
                                    {suggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.place_id}
                                            onClick={() => handleSelectSuggestion(suggestion.place_id, suggestion.description)}
                                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b border-gray-100 last:border-b-0"
                                        >
                                            <div className="flex items-start gap-2">
                                                <i className="fas fa-map-marker-alt text-red-500 mt-1"></i>
                                                <div>
                                                    <div className="font-medium text-gray-800">
                                                        {suggestion.structured_formatting?.main_text || suggestion.description}
                                                    </div>
                                                    {suggestion.structured_formatting?.secondary_text && (
                                                        <div className="text-xs text-gray-500">
                                                            {suggestion.structured_formatting.secondary_text}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {!googleApiKey && (
                            <div className="text-[10px] text-orange-500 mt-1">
                                Enter API key above to enable location search
                            </div>
                        )}
                    </div>

                    {/* Current Location Display */}
                    <div className="bg-gray-50 p-2 rounded border border-gray-200">
                        <div className="text-[10px] font-bold text-gray-500 uppercase mb-1">Current Location</div>
                        <div className="flex items-center gap-2 text-sm font-mono">
                            <i className="fas fa-location-dot text-red-500"></i>
                            <span className="text-gray-700">
                                {latitude.toFixed(4)}, {longitude.toFixed(4)}
                            </span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500">Gemini API Key (AI Import)</label>
                        <input
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            className="w-full border p-2 rounded text-sm"
                            placeholder="AIzaSy..."
                        />
                        <div className="text-[10px] text-gray-400 mt-1">
                            Required for AI-powered building extraction.
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500">Zoom Level</label>
                        <input
                            type="number"
                            value={zoom}
                            onChange={(e) => setZoom(parseInt(e.target.value))}
                            className="w-full border p-2 rounded text-sm"
                            min="15"
                            max="22"
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleLoadMap}
                            disabled={loading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-bold text-sm disabled:opacity-50"
                        >
                            {loading ? "Loading..." : "Load Map"}
                        </button>
                        <button
                            onClick={handleImportBuildings}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded font-bold text-sm"
                        >
                            Import Buildings
                        </button>
                        <button
                            onClick={() => setOpen(false)}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 rounded font-bold text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
