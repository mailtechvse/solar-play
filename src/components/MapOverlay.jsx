import React, { useCallback, useState, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { useSolarStore } from '../stores/solarStore';

const containerStyle = {
    width: '100%',
    height: '100%',
};

export default function MapOverlay({ onMapClick }) {
    const mapSettings = useSolarStore(state => state.mapSettings);
    const latitude = useSolarStore(state => state.latitude);
    const longitude = useSolarStore(state => state.longitude);

    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: mapSettings.googleApiKey || import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    });

    const [map, setMap] = useState(null);
    const [selectedPoints, setSelectedPoints] = useState([]);
    const [isImporting, setIsImporting] = useState(false);

    const center = useMemo(() => ({
        lat: latitude || 20.5937,
        lng: longitude || 78.9629
    }), [latitude, longitude]);

    const onLoad = useCallback(function callback(map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map) {
        setMap(null);
    }, []);

    const handleMapClick = (e) => {
        if (isImporting) return;
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        setSelectedPoints(prev => [...prev, { lat, lng }]);
    };

    const handleImport = async () => {
        if (onMapClick && selectedPoints.length > 0) {
            setIsImporting(true);
            try {
                await onMapClick(selectedPoints);
            } finally {
                setIsImporting(false);
                setSelectedPoints([]);
            }
        }
    };

    const handleClear = () => {
        setSelectedPoints([]);
    };

    if (!isLoaded) return <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">Loading Google Maps...</div>;

    return (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 }}>
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={mapSettings.zoom || 19}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={handleMapClick}
                mapTypeId="satellite"
                options={{
                    disableDefaultUI: false,
                    tilt: 0,
                    mapTypeId: 'satellite',
                    streetViewControl: false,
                    fullscreenControl: false,
                    mapTypeControl: true,
                }}
            >
                {selectedPoints.map((pt, i) => (
                    <Marker key={i} position={pt} label={`${i + 1}`} />
                ))}
            </GoogleMap>

            {/* Control Panel */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800/90 p-2 rounded shadow-lg flex gap-3 items-center border border-gray-600">
                <span className="text-white text-xs font-bold">{selectedPoints.length} Selected</span>
                <button
                    onClick={handleImport}
                    disabled={selectedPoints.length === 0 || isImporting}
                    className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-2 ${selectedPoints.length > 0 && !isImporting ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                >
                    {isImporting && <i className="fas fa-spinner fa-spin"></i>}
                    {isImporting ? 'Importing...' : 'Import Buildings'}
                </button>
                <button
                    onClick={handleClear}
                    disabled={selectedPoints.length === 0 || isImporting}
                    className="text-gray-400 hover:text-white text-xs"
                >
                    Clear
                </button>
            </div>

            {/* Right Panel - Selected Buildings */}
            {selectedPoints.length > 0 && (
                <div className="absolute top-20 right-4 w-64 bg-gray-900/90 p-4 rounded shadow-lg border border-gray-700 text-white max-h-[80vh] overflow-y-auto">
                    <h3 className="font-bold mb-3 text-sm border-b border-gray-700 pb-2">Selected Buildings</h3>
                    <div className="space-y-2">
                        {selectedPoints.map((pt, i) => (
                            <div key={i} className="flex items-center justify-between bg-gray-800 p-2 rounded text-xs">
                                <div>
                                    <div className="font-bold text-blue-400">Building {i + 1}</div>
                                    <div className="text-gray-400">{pt.lat.toFixed(6)}, {pt.lng.toFixed(6)}</div>
                                </div>
                                <button
                                    onClick={() => setSelectedPoints(prev => prev.filter((_, idx) => idx !== i))}
                                    className="text-red-400 hover:text-red-300 p-1"
                                    disabled={isImporting}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
