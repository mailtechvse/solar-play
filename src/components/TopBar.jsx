import React, { useState, useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ProjectsModal from "./ProjectsModal";

export default function TopBar() {
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [stats, setStats] = useState({
    dcCapacity: 0,
    acOutput: 0,
    estimatedCost: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const objects = useSolarStore((state) => state.objects);
  const wires = useSolarStore((state) => state.wires);
  const showGrid = useSolarStore((state) => state.showGrid);
  const setShowGrid = useSolarStore((state) => state.setShowGrid);
  const cableMode = useSolarStore((state) => state.cableMode);
  const setCableMode = useSolarStore((state) => state.setCableMode);
  const undo = useSolarStore((state) => state.undo);
  const redo = useSolarStore((state) => state.redo);
  const clearProject = useSolarStore((state) => state.clearProject);
  const runEvaluation = useSolarStore((state) => state.runEvaluation);
  const loadProject = useSolarStore((state) => state.loadProject);
  const setTheme = useSolarStore((state) => state.setTheme);
  const mapSettings = useSolarStore((state) => state.mapSettings);
  const setMapSettings = useSolarStore((state) => state.setMapSettings);
  const aiImportMode = useSolarStore((state) => state.aiImportMode);
  const setAiImportMode = useSolarStore((state) => state.setAiImportMode);

  // Location State
  const latitude = useSolarStore((state) => state.latitude);
  const longitude = useSolarStore((state) => state.longitude);
  const setLatitude = useSolarStore((state) => state.setLatitude);
  const setLongitude = useSolarStore((state) => state.setLongitude);

  // Financial State for Evaluation
  const gridRate = useSolarStore((state) => state.gridRate);
  const baseLoad = useSolarStore((state) => state.baseLoad);
  const systemCost = useSolarStore((state) => state.systemCost);
  const isCommercial = useSolarStore((state) => state.isCommercial);
  const showWeatherPanel = useSolarStore((state) => state.showWeatherPanel);
  const setShowWeatherPanel = useSolarStore((state) => state.setShowWeatherPanel);

  // Calculate stats
  useEffect(() => {
    let dcCapacity = 0;
    let estimatedCost = 0;

    objects.forEach((obj) => {
      if (obj.type === "panel" && obj.watts) {
        dcCapacity += obj.watts;
      }
      if (obj.cost && obj.type !== 'structure' && obj.type !== 'obstacle') {
        estimatedCost += obj.cost;
      }
    });

    setStats({
      dcCapacity: dcCapacity / 1000, // Convert to kW
      acOutput: (dcCapacity / 1000) * 0.85, // 85% efficiency
      estimatedCost,
    });
  }, [objects]);

  const handleAutoDetectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(parseFloat(position.coords.latitude.toFixed(4)));
          setLongitude(parseFloat(position.coords.longitude.toFixed(4)));
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Unable to detect location.");
        }
      );
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.length >= 3) {
        performSearch(searchTerm);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke('search-places', {
        body: { query }
      });

      if (error) throw error;

      if (data.results) {
        setSearchResults(data.results);
        setShowSearchResults(true);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectLocation = async (result) => {
    setSearchQuery(result.formatted_address || result.name);
    setSearchTerm("");
    setSearchResults([]);
    setShowSearchResults(false);

    let lat, lng;

    // Check if location is already present (from Text Search)
    if (result.location) {
      lat = result.location.lat;
      lng = result.location.lng;
    } else if (result.place_id) {
      // Fallback to details fetch if needed
      try {
        const { data, error } = await supabase.functions.invoke('get-place-details', {
          body: { place_id: result.place_id }
        });
        if (error) throw error;
        if (data.location) {
          lat = data.location.lat;
          lng = data.location.lng;
        }
      } catch (err) {
        console.error("Details error:", err);
      }
    }

    if (lat && lng) {
      setLatitude(lat);
      setLongitude(lng);

      // Center view
      const canvas = useSolarStore.getState().canvas;
      if (canvas) {
        useSolarStore.getState().setOffset(canvas.width / 2, canvas.height / 2);
      }

      // Fetch map via Edge Function
      try {
        const { data, error } = await supabase.functions.invoke('get-static-map', {
          body: {
            center: `${lat},${lng}`,
            zoom: mapSettings?.zoom || 20
          }
        });

        if (error) throw error;

        if (data.image) {
          setMapSettings({
            ...mapSettings,
            mapImage: data.image,
            mapOverlayActive: true
          });
        }
      } catch (err) {
        console.error("Failed to fetch map:", err);

        // Fallback to client-side if env key exists
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          const zoom = mapSettings?.zoom || 20;
          const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${zoom}&size=800x800&maptype=satellite&key=${apiKey}`;
          setMapSettings({
            ...mapSettings,
            googleApiKey: apiKey,
            mapImage: mapUrl,
            mapOverlayActive: true
          });
        } else {
          // No fallback available, show error
          alert(`Failed to load map. Please ensure GOOGLE_MAPS_API_KEY is set in Supabase secrets. Error: ${err.message}`);
        }
      }
    }
  };

  const handleSaveLocal = () => {
    const project = {
      objects,
      wires,
      name: "Solar Project",
      timestamp: new Date().toISOString(),
    };
    const json = JSON.stringify(project);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solar-project-${Date.now()}.json`;
    a.click();
  };

  const handleLoadLocal = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const project = JSON.parse(event.target.result);
        loadProject(project);
        // Reset file input
        e.target.value = '';
      } catch (error) {
        console.error("Failed to load project:", error);
        alert("Invalid project file");
      }
    };
    reader.readAsText(file);
  };

  const { profile } = useAuth();

  return (
    <div className="flex flex-col shrink-0 z-20 shadow-md font-sans">
      <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="bg-yellow-500 p-1.5 rounded text-gray-900">
            <i className="fas fa-solar-panel text-lg"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none text-white">Solar Architect</h1>
            <div className="text-xs text-gray-400">Grid Master v5.0</div>
          </div>
        </div>

        {/* Location Settings with Search */}
        <div className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded border border-gray-600 relative">
          <i className="fas fa-location-dot text-red-400 text-xs"></i>
          <div className="flex flex-col">
            <span className="text-[8px] text-gray-400 uppercase font-bold">Location</span>
            <div className="flex gap-1 items-center">
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchTerm(e.target.value);
                  }}
                  onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                  placeholder="Search place..."
                  className="w-32 bg-gray-600 text-xs text-white border-b border-gray-500 focus:border-blue-400 outline-none px-1 py-0.5 rounded"
                />
                {isSearching && (
                  <i className="fas fa-spinner fa-spin absolute right-1 top-1.5 text-blue-400 text-xs"></i>
                )}

                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded max-h-48 overflow-y-auto z-50">
                    {searchResults.map((result, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectLocation(result)}
                        className="w-full text-left px-2 py-1 text-xs text-gray-300 hover:bg-blue-600 hover:text-white border-b border-gray-700 last:border-b-0 transition"
                        title={result.formatted_address || result.name}
                      >
                        <div className="truncate">{result.name}</div>
                        <div className="text-[10px] text-gray-500 truncate">{result.formatted_address}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Coordinates Display/Edit */}
              <input
                type="number"
                value={latitude}
                onChange={(e) => setLatitude(parseFloat(e.target.value))}
                className="w-12 bg-transparent text-xs text-white font-mono border-b border-gray-500 focus:border-blue-400 outline-none"
                placeholder="Lat"
                title="Latitude"
              />
              <input
                type="number"
                value={longitude}
                onChange={(e) => setLongitude(parseFloat(e.target.value))}
                className="w-12 bg-transparent text-xs text-white font-mono border-b border-gray-500 focus:border-blue-400 outline-none"
                placeholder="Lon"
                title="Longitude"
              />

              {/* Action Buttons */}
              <button
                onClick={handleAutoDetectLocation}
                className="text-blue-400 hover:text-blue-300 ml-1"
                title="Detect My Location"
              >
                <i className="fas fa-crosshairs"></i>
              </button>
              <button
                onClick={() => setShowSearchResults(false)}
                className="text-gray-400 hover:text-gray-300 text-[10px]"
                title="Close search"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-sm font-mono bg-gray-900/50 px-4 py-1 rounded-lg border border-gray-700">
          <div className="flex flex-col items-center w-24">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">DC Capacity</span>
            <span className="text-yellow-400 font-bold">{stats.dcCapacity.toFixed(2)} kWp</span>
          </div>
          <div className="w-px bg-gray-700 h-8"></div>
          <div className="flex flex-col items-center w-24">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">AC Output</span>
            <span className="text-blue-400 font-bold">{stats.acOutput.toFixed(2)} kW</span>
          </div>
          <div className="w-px bg-gray-700 h-8"></div>
          <div className="flex flex-col items-center w-24">
            <span className="text-gray-500 text-[10px] uppercase tracking-wider">Est. Cost</span>
            <span className="text-green-400 font-bold">₹{(stats.estimatedCost).toLocaleString()}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 items-center">


          {/* Grid & Cable */}
          <div className="flex items-center gap-2 mr-2">
            <button
              onClick={() => setAiImportMode(!aiImportMode)}
              className={`text-xs px-2 py-1 rounded text-white border border-gray-600 flex items-center gap-2 ${aiImportMode ? 'bg-purple-600 hover:bg-purple-500' : 'bg-gray-700 hover:bg-gray-600'}`}
              title="Click on a building on the map to import it"
            >
              <i className="fas fa-magic"></i> AI Import
            </button>
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`text-xs px-2 py-1 rounded text-white border border-gray-600 flex items-center gap-2 ${showGrid ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <i className="fas fa-border-all"></i> Grid
            </button>
            <button
              onClick={() => setShowWeatherPanel(!showWeatherPanel)}
              className={`text-xs px-2 py-1 rounded text-white border border-gray-600 flex items-center gap-2 ${showWeatherPanel ? 'bg-blue-600 hover:bg-blue-500' : 'bg-gray-700 hover:bg-gray-600'}`}
            >
              <i className="fas fa-cloud"></i> Weather
            </button>
            <button
              onClick={() => setCableMode(cableMode === 'straight' ? 'ortho' : 'straight')}
              className="text-xs bg-gray-700 px-2 py-1 rounded text-white border border-gray-600 hover:bg-gray-600 flex items-center gap-2"
            >
              <i className="fas fa-bezier-curve"></i> {cableMode === 'straight' ? 'Straight' : 'Ortho'}
            </button>
          </div>

          {/* File Operations */}
          <div className="flex bg-gray-700 rounded border border-gray-600 mr-2">
            <button onClick={handleSaveLocal} className="px-3 py-1 hover:bg-gray-600 border-r border-gray-600 transition text-white" title="Save JSON">
              <i className="fas fa-download"></i>
            </button>
            <button onClick={() => document.getElementById('file-input')?.click()} className="px-3 py-1 hover:bg-gray-600 border-r border-gray-600 transition text-white" title="Load JSON">
              <i className="fas fa-upload"></i>
            </button>
            <button onClick={() => setShowProjectsModal(true)} className="px-3 py-1 hover:bg-gray-600 transition text-white" title="Cloud Projects">
              <i className="fas fa-cloud"></i>
            </button>
            <input type="file" id="file-input" hidden accept=".json" onChange={handleLoadLocal} />
          </div>

          {/* Undo/Redo */}
          <div className="flex bg-gray-700 rounded border border-gray-600 mr-2">
            <button onClick={undo} className="px-3 py-1 hover:bg-gray-600 border-r border-gray-600 transition text-white" title="Undo">
              <i className="fas fa-rotate-left"></i>
            </button>
            <button onClick={redo} className="px-3 py-1 hover:bg-gray-600 transition text-white" title="Redo">
              <i className="fas fa-rotate-right"></i>
            </button>
          </div>

          {/* Themes */}
          <div className="flex bg-gray-700 rounded border border-gray-600 mr-2">
            <button onClick={() => setTheme('dark')} className="px-3 py-1 hover:bg-gray-600 border-r border-gray-600 transition text-white" title="Dark Mode">
              <i className="fas fa-moon"></i>
            </button>
            <button onClick={() => setTheme('light')} className="px-3 py-1 hover:bg-gray-600 border-r border-gray-600 transition text-white" title="Light Mode">
              <i className="fas fa-sun"></i>
            </button>
            <button onClick={() => setTheme('sepia')} className="px-3 py-1 hover:bg-gray-600 transition text-white" title="Sepia Mode">
              <i className="fas fa-mug-hot"></i>
            </button>
          </div>

          {/* Actions */}
          <button
            onClick={() => { if (confirm("Clear project?")) clearProject(); }}
            className="bg-gray-700 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition border border-gray-600"
          >
            <i className="fas fa-trash"></i> Clear
          </button>
          <button
            onClick={() => runEvaluation(gridRate, baseLoad, systemCost, isCommercial)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-1 rounded text-sm font-bold shadow-lg shadow-green-900/50 transition flex items-center gap-2 border border-green-500"
          >
            <i className="fas fa-play"></i> Evaluate
          </button>
        </div>

        {/* Projects Modal */}
        <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />
      </div>

      {/* Shortcuts Bar */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-1 flex gap-4 text-[10px] text-gray-400 font-mono overflow-x-auto whitespace-nowrap shrink-0">
        <span className="font-bold text-gray-500 uppercase">Shortcuts:</span>
        <span><span className="text-yellow-500">[V]</span> Select</span>
        <span><span className="text-yellow-500">[M]</span> Measure</span>
        <span><span className="text-yellow-500">[D]</span> Delete</span>
        <span><span className="text-yellow-500">[W]</span> DC Wire</span>
        <span><span className="text-yellow-500">[A]</span> AC Wire</span>
        <span><span className="text-yellow-500">[G]</span> Earthing</span>
        <span><span className="text-yellow-500">[R]</span> Rotate</span>
        <span><span className="text-yellow-500">[Ctrl+S]</span> Save</span>
        <span><span className="text-yellow-500">[Del]</span> Remove Item</span>
      </div>
    </div>
  );
}
