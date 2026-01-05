import React, { useState, useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import ProjectsModal from "./ProjectsModal";
import {
  MapPin,
  Search,
  Target,
  X,
  Zap,
  Activity,
  CircleDollarSign,
  LayoutGrid,
  Sparkles,
  Grid3X3,
  Cloud,
  MousePointer2,
  Download,
  Upload,
  CloudUpload,
  Undo2,
  Redo2,
  Sun,
  Moon,
  Coffee,
  Trash2,
  Play,
  Settings2,
  Navigation
} from "lucide-react";

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
    <div className="flex flex-col shrink-0 z-20 shadow-xl font-sans">
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 gap-4">

        {/* LEFT SECTION: Branding & Location */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mb-1">Grid Master v5.0</span>
              <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700 focus-within:border-blue-500 transition-all group relative">
                <MapPin size={14} className="text-blue-400 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col min-w-[120px]">
                  <div className="flex gap-1 items-center relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchTerm(e.target.value);
                      }}
                      onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                      placeholder="Search location..."
                      className="bg-transparent text-xs text-slate-200 outline-none w-full placeholder:text-slate-600"
                    />
                    {isSearching ? (
                      <div className="animate-spin h-3 w-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full" />
                    ) : (
                      <Search size={12} className="text-slate-600" />
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {showSearchResults && searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden backdrop-blur-md">
                      {searchResults.map((result, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSelectLocation(result)}
                          className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-blue-600/20 hover:text-white border-b border-slate-700/50 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium truncate">{result.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{result.formatted_address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-1 ml-2 border-l border-slate-700 pl-2">
                  <button onClick={handleAutoDetectLocation} className="text-slate-500 hover:text-blue-400 p-0.5" title="Auto-detect">
                    <Target size={14} />
                  </button>
                  <button onClick={() => { setSearchQuery(""); setSearchTerm(""); setShowSearchResults(false); }} className="text-slate-500 hover:text-red-400 p-0.5" title="Clear">
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CENTER SECTION: Stats Cards */}
        <div className="flex items-center gap-3 bg-slate-800/30 p-1 rounded-xl border border-slate-800/50 backdrop-blur-sm shadow-inner">
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
            <Zap size={18} className="text-yellow-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold leading-tight">DC Capacity</span>
              <span className="text-sm font-mono font-bold text-yellow-400 leading-none">{stats.dcCapacity.toFixed(2)} <span className="text-[10px] opacity-70">kWp</span></span>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700/50" />

          <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <Activity size={18} className="text-blue-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold leading-tight">AC Output</span>
              <span className="text-sm font-mono font-bold text-blue-400 leading-none">{stats.acOutput.toFixed(2)} <span className="text-[10px] opacity-70">kW</span></span>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700/50" />

          <div className="flex items-center gap-3 px-4 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <CircleDollarSign size={18} className="text-emerald-500" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold leading-tight">Est. Cost</span>
              <span className="text-sm font-mono font-bold text-emerald-400 leading-none">₹{stats.estimatedCost.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* RIGHT SECTION: Controls & Actions */}
        <div className="flex items-center gap-3 shrink-0">

          {/* Group 1: Modes & Views */}
          <div className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => window.location.href = '/operations'}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all"
              title="Operations Dashboard"
            >
              <LayoutGrid size={18} />
            </button>
            <button
              onClick={() => setAiImportMode(!aiImportMode)}
              className={`p-1.5 rounded-lg transition-all ${aiImportMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title="AI Map Import"
            >
              <Sparkles size={18} />
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-1.5 rounded-lg transition-all ${showGrid ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title="Toggle Grid"
            >
              <Grid3X3 size={18} />
            </button>
            <button
              onClick={() => setShowWeatherPanel(!showWeatherPanel)}
              className={`p-1.5 rounded-lg transition-all ${showWeatherPanel ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title="Weather Insight"
            >
              <Cloud size={18} />
            </button>
            <button
              onClick={() => setCableMode(cableMode === 'straight' ? 'ortho' : 'straight')}
              className={`p-1.5 rounded-lg transition-all flex items-center gap-1.5 px-2 ${cableMode === 'ortho' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
              title="Wiring Mode"
            >
              <Navigation size={14} className={cableMode === 'ortho' ? 'rotate-90' : ''} />
              <span className="text-[10px] font-bold uppercase">{cableMode === 'straight' ? 'Direct' : 'Ortho'}</span>
            </button>
          </div>

          {/* Group 2: Project Management */}
          <div className="flex items-center gap-1 bg-slate-800/40 p-1 rounded-xl border border-slate-800">
            <button onClick={handleSaveLocal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" title="Download Project">
              <Download size={18} />
            </button>
            <button onClick={() => document.getElementById('file-input')?.click()} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" title="Upload Project">
              <Upload size={18} />
            </button>
            <button onClick={() => setShowProjectsModal(true)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" title="Cloud Library">
              <CloudUpload size={18} />
            </button>
            <input type="file" id="file-input" hidden accept=".json" onChange={handleLoadLocal} />
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button onClick={undo} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" title="Undo">
              <Undo2 size={18} />
            </button>
            <button onClick={redo} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-700 hover:text-white transition-all" title="Redo">
              <Redo2 size={18} />
            </button>
          </div>

          {/* Group 3: Appearance & Actions */}
          <div className="flex items-center gap-2 ml-2">
            <div className="flex items-center bg-slate-800/40 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setTheme('dark')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 transition-all"
                title="Dark Theme"
              >
                <Moon size={16} />
              </button>
              <button
                onClick={() => setTheme('light')}
                className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 transition-all"
                title="Light Theme"
              >
                <Sun size={16} />
              </button>
            </div>

            <button
              onClick={() => { if (confirm("Proceed to reset the entire project canvas?")) clearProject(); }}
              className="p-2 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all border border-transparent hover:border-red-500/20"
              title="Clear Canvas"
            >
              <Trash2 size={18} />
            </button>

            <button
              onClick={() => runEvaluation(gridRate, baseLoad, systemCost, isCommercial)}
              className="h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 group border border-blue-400/20"
            >
              <Play size={16} className="group-hover:translate-x-0.5 transition-transform" />
              <span>Evaluate</span>
            </button>
          </div>
        </div>

        {/* Projects Modal */}
        <ProjectsModal isOpen={showProjectsModal} onClose={() => setShowProjectsModal(false)} />
      </div>

      {/* Shortcuts Bar */}
      <div className="bg-slate-800/50 border-b border-slate-800/80 px-4 py-1.5 flex items-center gap-6 overflow-x-auto whitespace-nowrap hide-scrollbar backdrop-blur-sm transition-all">
        <div className="flex items-center gap-2 shrink-0">
          <Settings2 size={12} className="text-slate-500" />
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Master Shortcuts</span>
        </div>
        <div className="flex gap-4 items-center">
          {[
            { k: 'V', l: 'Select' },
            { k: 'M', l: 'Measure' },
            { k: 'D', l: 'Delete' },
            { k: 'W', l: 'DC Wire' },
            { k: 'A', l: 'AC Wire' },
            { k: 'G', l: 'Earthing' },
            { k: 'R', l: 'Rotate' },
            { k: 'Ctrl+S', l: 'Save' }
          ].map(s => (
            <div key={s.k} className="flex items-center gap-1.5 group cursor-default">
              <span className="px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-400 text-[9px] font-mono group-hover:text-blue-400 transition-colors border border-slate-700">{s.k}</span>
              <span className="text-[9px] text-slate-600 group-hover:text-slate-400 transition-colors">{s.l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
