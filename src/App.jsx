import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { useSolarStore } from "./stores/solarStore";
import { equipmentService } from "./lib/supabase";
import TopBar from "./components/TopBar";
import LeftSidebar from "./components/LeftSidebar";
import RightPanel from "./components/RightPanel";
import Canvas from "./components/Canvas";
import EvaluationModal from "./components/EvaluationModal";
import CustomComponentModal from "./components/CustomComponentModal";
import MapSetupModal from "./components/MapSetupModal";
import WeatherPanel from "./components/WeatherPanel";
import SimulationControls from "./components/SimulationControls";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import AdminPage from "./pages/AdminPage";
import OperationsPage from "./pages/OperationsPage";
import "./styles/index.css";

function SolarApp() {
  // ... existing SolarApp code ...

  // State Hooks for Auto-Save
  const activeCustomerId = useSolarStore(state => state.activeCustomerId);
  const objects = useSolarStore(state => state.objects);
  const wires = useSolarStore(state => state.wires);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const setEquipmentTypes = useSolarStore(
    (state) => state.setEquipmentTypes
  );
  const setEquipmentLibrary = useSolarStore(
    (state) => state.setEquipmentLibrary
  );

  // Store Actions
  const saveProject = useSolarStore((state) => state.saveProject);
  const loadProject = useSolarStore((state) => state.loadProject);
  const showToast = useSolarStore((state) => state.showToast);

  // Load Equipment
  useEffect(() => {
    const loadEquipment = async () => {
      try {
        const types = await equipmentService.getEquipmentTypes();
        setEquipmentTypes(types);

        // Load equipment for each type using lowercase name as key
        const library = {};
        for (const type of types) {
          const equipment = await equipmentService.getEquipmentByType(
            type.id
          );
          // Use lowercase name as key for easier access in components
          const key = type.name.toLowerCase().replace(/\s+/g, '_');
          library[key] = equipment;
        }
        setEquipmentLibrary(library);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load equipment:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadEquipment();
  }, [setEquipmentTypes, setEquipmentLibrary]);

  // Load from LocalStorage on mount
  useEffect(() => {
    const savedProject = localStorage.getItem('solar_project_autosave');
    if (savedProject) {
      try {
        const projectData = JSON.parse(savedProject);
        loadProject(projectData);
        showToast("Restored last session from auto-save", "info");
      } catch (e) {
        console.error("Failed to load auto-save", e);
      }
    }
  }, []);

  // Auto-save effect per customer
  useEffect(() => {
    if (!activeCustomerId) return;

    // Debounce save
    const timeoutId = setTimeout(() => {
      const data = {
        objects: useSolarStore.getState().objects,
        wires: useSolarStore.getState().wires,
        settings: {
          scale: useSolarStore.getState().scale,
          offsetX: useSolarStore.getState().offsetX,
          offsetY: useSolarStore.getState().offsetY,
          showGrid: useSolarStore.getState().showGrid,
          cableMode: useSolarStore.getState().cableMode
        }
      };
      localStorage.setItem(`solar_project_autosave_${activeCustomerId}`, JSON.stringify(data));
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [objects, wires, activeCustomerId]);



  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p>Loading Solar Architect...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-red-400">
          <p className="text-xl font-bold mb-2">Error Loading Application</p>
          <p>{error}</p>
          <p className="text-sm mt-4">
            Please check your Supabase configuration
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full bg-gray-900 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <div className="relative flex-1 flex overflow-hidden">
          <Canvas />
          <WeatherPanel />
          <SimulationControls />
          <RightPanel />
        </div>
      </div>
      <EvaluationModal />
      <CustomComponentModal />
      <MapSetupModal />
    </div>
  );
}

import BatteryAnalysis from "./pages/BatteryAnalysis";
import CustomerManagementPage from "./pages/CustomerManagementPage";
import MainLayout from "./pages/MainLayout";

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-900">
        <div className="text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/" /> : <LoginPage />}
        />
        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        {/* Protect all main routes */}
        {isAuthenticated ? (
          <Route element={<MainLayout />}>
            <Route path="/" element={<SolarApp />} />
            <Route path="/battery-analysis" element={<BatteryAnalysis />} />
            <Route path="/operations" element={<OperationsPage />} />
            <Route path="/customers" element={<CustomerManagementPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        ) : (
          <Route path="*" element={<Navigate to="/login" />} />
        )}
      </Routes>
    </Router>
  );
}

export default App;
