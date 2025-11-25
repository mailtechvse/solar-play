import React, { useEffect } from "react";
import { useSolarStore } from "../stores/solarStore";

export default function SimulationControls() {
    const sunTime = useSolarStore((state) => state.sunTime);
    const setSunTime = useSolarStore((state) => state.setSunTime);
    const orientation = useSolarStore((state) => state.orientation);
    const setOrientation = useSolarStore((state) => state.setOrientation);
    const setMapSetupOpen = useSolarStore((state) => state.setMapSetupOpen);
    const mapSettings = useSolarStore((state) => state.mapSettings);

    const isAnimating = useSolarStore((state) => state.isAnimating);
    const setIsAnimating = useSolarStore((state) => state.setIsAnimating);
    const animationSpeed = useSolarStore((state) => state.animationSpeed);
    const setAnimationSpeed = useSolarStore((state) => state.setAnimationSpeed);
    const showSun = useSolarStore((state) => state.showSun);
    const setShowSun = useSolarStore((state) => state.setShowSun);

    const formatTime = (decimalTime) => {
        const hours = Math.floor(decimalTime);
        const minutes = Math.floor((decimalTime - hours) * 60);
        const ampm = hours >= 12 ? "PM" : "AM";
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    };

    useEffect(() => {
        let interval;
        if (isAnimating) {
            interval = setInterval(() => {
                const state = useSolarStore.getState();
                let nextTime = state.sunTime + (0.05 * state.animationSpeed);

                if (nextTime > 18) {
                    nextTime = 6; // Loop
                }

                state.setSunTime(nextTime);

                // Calculate generation
                const hour = nextTime;
                let generationFactor = 0;
                if (hour > 6 && hour < 18) {
                    const angle = ((hour - 6) / 12) * Math.PI;
                    generationFactor = Math.sin(angle);
                }

                let totalGenKw = 0;
                state.objects.filter(o => o.type === 'panel').forEach(p => {
                    totalGenKw += (p.watts || 550) / 1000 * generationFactor;
                });

                // Accumulate on meters
                const dt = 0.05 * state.animationSpeed; // hours
                const energyKwh = totalGenKw * dt;

                state.objects.forEach(obj => {
                    if (obj.type === 'net_meter' || obj.type === 'gross_meter') {
                        const currentReading = obj.reading || 0;
                        state.updateObject(obj.id, { reading: currentReading + energyKwh });
                    }
                });

            }, 100);
        }
        return () => clearInterval(interval);
    }, [isAnimating]);

    return (
        <div className="absolute bottom-6 left-6 flex flex-col gap-3 z-40">
            {/* Sun Control Panel */}
            <div className="bg-gray-900 bg-opacity-90 p-3 rounded-lg border border-gray-600 w-64 backdrop-blur-sm shadow-xl">
                <div className="flex justify-between items-center text-xs text-gray-300 mb-2 font-bold uppercase">
                    <span className="flex items-center gap-2">
                        <i className="fas fa-sun text-yellow-500 text-lg"></i> Sun Position
                    </span>
                    <span className="font-mono text-yellow-400">{formatTime(sunTime)}</span>
                </div>

                <input
                    type="range"
                    min="6"
                    max="18"
                    step="0.1"
                    value={sunTime}
                    onChange={(e) => setSunTime(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />

                <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Sunrise</span>
                    <span>Noon</span>
                    <span>Sunset</span>
                </div>

                {/* Orientation Control */}
                <div className="border-t border-gray-700 mt-3 pt-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">Orientation (North)</label>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={orientation}
                        onChange={(e) => setOrientation(parseFloat(e.target.value))}
                        className="w-full mt-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] text-gray-500">
                        <span>0° (Up)</span>
                        <span>{parseInt(orientation)}°</span>
                        <span>360°</span>
                    </div>
                </div>

                {/* Simulation Controls */}
                <div className="mt-3 pt-2 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-gray-400 uppercase font-bold">Simulation</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowSun(!showSun)}
                                className={`text-[10px] ${showSun ? 'text-yellow-400' : 'text-gray-500'} hover:text-yellow-300`}
                                title={showSun ? "Hide Sun" : "Show Sun"}
                            >
                                <i className={`fas fa-eye${showSun ? '' : '-slash'}`}></i>
                            </button>
                            <button
                                onClick={() => {
                                    setSunTime(12);
                                    // Reset meters
                                    const state = useSolarStore.getState();
                                    state.objects.forEach(obj => {
                                        if (obj.type === 'net_meter' || obj.type === 'gross_meter') {
                                            state.updateObject(obj.id, { reading: 0 });
                                        }
                                    });
                                }}
                                className="text-[10px] text-blue-400 hover:text-blue-300"
                            >
                                <i className="fas fa-rotate-right"></i> Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                        <button
                            onClick={() => setIsAnimating(!isAnimating)}
                            className={`bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs w-8 transition ${isAnimating ? 'bg-red-600 hover:bg-red-500' : ''}`}
                            title={isAnimating ? "Pause" : "Play"}
                        >
                            <i className={`fas fa-${isAnimating ? 'pause' : 'play'}`}></i>
                        </button>
                        <input
                            type="range"
                            min="0.1"
                            max="5"
                            step="0.1"
                            value={animationSpeed}
                            onChange={(e) => setAnimationSpeed(parseFloat(e.target.value))}
                            className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                            title="Speed"
                        />
                    </div>
                </div>

                {/* Map Overlay Button */}
                <div className="mt-2 pt-2 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-gray-400 uppercase">Map Overlay</span>
                        <button
                            onClick={() => setMapSetupOpen(true)}
                            className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded transition flex items-center gap-1"
                        >
                            <i className="fas fa-map"></i>
                            {mapSettings.mapOverlayActive ? "Configure" : "Setup"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
