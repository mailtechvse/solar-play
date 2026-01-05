import React from "react";
import { useSolarStore } from "../stores/solarStore";
import { Cloud, X, Loader2, Sunrise, Sunset, Info } from 'lucide-react';

export default function WeatherPanel() {
  const weather = useSolarStore((state) => state.weather);
  const showWeatherPanel = useSolarStore((state) => state.showWeatherPanel);
  const isLoadingWeather = useSolarStore((state) => state.isLoadingWeather);
  const setShowWeatherPanel = useSolarStore((state) => state.setShowWeatherPanel);

  if (!showWeatherPanel) return null;

  return (
    <div className="absolute top-20 right-6 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-40">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Cloud className="w-5 h-5 text-blue-400" /> Weather Information
        </h3>
        <button
          onClick={() => setShowWeatherPanel(false)}
          className="text-gray-400 hover:text-white transition"
          title="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {isLoadingWeather ? (
          <div className="text-center py-4">
            <div className="text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading weather...</span>
            </div>
          </div>
        ) : weather ? (
          <>
            {/* Current Weather */}
            {weather.current && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Temperature</span>
                    <span className="text-white font-semibold">
                      {weather.current.temperature_2m}°C
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Cloud Cover</span>
                    <span className="text-white font-semibold">
                      {weather.current.cloudcover}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Humidity</span>
                    <span className="text-white font-semibold">
                      {weather.current.relative_humidity_2m}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Wind Speed</span>
                    <span className="text-white font-semibold">
                      {weather.current.wind_speed_10m} km/h
                    </span>
                  </div>
                </div>

                {/* Cloud Cover Visualization */}
                <div className="pt-2 border-t border-gray-700">
                  <div className="text-gray-400 text-xs mb-2">Cloud Cover</div>
                  <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-gray-400 transition-all"
                      style={{
                        width: `${weather.current.cloudcover}%`,
                      }}
                    />
                  </div>
                  <div className="text-gray-400 text-xs mt-1">
                    {weather.current.cloudcover === 0
                      ? "Clear Sky"
                      : weather.current.cloudcover < 25
                        ? "Mostly Clear"
                        : weather.current.cloudcover < 50
                          ? "Partly Cloudy"
                          : weather.current.cloudcover < 75
                            ? "Mostly Cloudy"
                            : "Overcast"}
                  </div>
                </div>
              </>
            )}

            {/* Daily Forecast */}
            {weather.daily && (
              <div className="pt-2 border-t border-gray-700">
                <div className="text-gray-400 text-xs mb-2">Sunrise & Sunset</div>
                {weather.daily.sunrise && weather.daily.sunrise[0] && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Sunrise className="w-4 h-4 text-orange-400" /> Sunrise
                    </span>
                    <span className="text-white">
                      {new Date(weather.daily.sunrise[0]).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
                {weather.daily.sunset && weather.daily.sunset[0] && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-400 flex items-center gap-1">
                      <Sunset className="w-4 h-4 text-amber-500" /> Sunset
                    </span>
                    <span className="text-white">
                      {new Date(weather.daily.sunset[0]).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Impact Note */}
            <div className="pt-2 border-t border-gray-700 bg-gray-850 p-2 rounded text-xs text-gray-300 flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 shrink-0" />
              <span>
                {weather.current?.cloudcover < 25
                  ? "Excellent conditions for solar generation"
                  : weather.current?.cloudcover < 50
                    ? "Good solar potential with some clouds"
                    : "Cloud cover may reduce panel output"}
              </span>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">Failed to load weather data</p>
            <p className="text-gray-500 text-xs mt-1">Check your location settings</p>
          </div>
        )}
      </div>
    </div>
  );
}
