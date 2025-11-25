/**
 * Weather Service
 * Fetches weather data from Open-Meteo API (free, no API key required)
 * Provides irradiance, cloud cover, temperature, sunrise/sunset times
 */
export class WeatherService {
  constructor() {
    this.cache = {};
    this.cacheExpiry = 1800000; // 30 minutes
  }

  /**
   * Get current weather data for a specific location
   * Returns temperature, cloud cover, humidity, and more
   */
  async getCurrentWeather(lat, lon) {
    const key = `current_${lat},${lon}`;

    // Check cache
    if (this.cache[key] && Date.now() - this.cache[key].time < this.cacheExpiry) {
      return this.cache[key].data;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloudcover,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,cloudcover&daily=sunrise,sunset&timezone=auto`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();

      const weatherData = {
        current: data.current || {},
        daily: data.daily || {},
        timezone: data.timezone,
      };

      // Cache the result
      this.cache[key] = {
        data: weatherData,
        time: Date.now(),
      };

      return weatherData;
    } catch (error) {
      console.warn("Weather fetch failed:", error);
      return null;
    }
  }

  /**
   * Get weather data for a specific location and date
   * Returns hourly direct normal irradiance, diffuse radiation, and cloud cover
   */
  async getWeather(lat, lon, date) {
    const dateStr = date.toISOString().split("T")[0];
    const key = `${lat},${lon},${dateStr}`;

    // Check cache
    if (this.cache[key] && Date.now() - this.cache[key].time < this.cacheExpiry) {
      return this.cache[key].data;
    }

    try {
      // Open-Meteo API - Free tier, no key required
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=direct_normal_irradiance,diffuse_radiation,cloudcover,temperature_2m,relative_humidity_2m&daily=sunrise,sunset,cloudcover_max&timezone=auto&start_date=${dateStr}&end_date=${dateStr}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error(`API returned ${response.status}`);

      const data = await response.json();

      if (!data.hourly) {
        throw new Error("No hourly data in response");
      }

      // Cache the result
      this.cache[key] = {
        data: {
          hourly: data.hourly,
          daily: data.daily,
        },
        time: Date.now(),
      };

      return this.cache[key].data;
    } catch (error) {
      console.warn("Weather fetch failed, using fallback clear sky model:", error);
      return null; // Caller should use fallback
    }
  }

  /**
   * Calculate plane of array (POA) irradiance from direct and diffuse components
   * Takes into account sun position and panel orientation
   */
  calculatePOA(sunAltitude, dni, diffuse, panelTilt = 0, panelAzimuth = 0) {
    // Simplified POA calculation
    // In reality this would be more complex with angle of incidence calculations
    const sinElevation = Math.sin(sunAltitude);

    if (sinElevation < 0) {
      return 0; // Sun below horizon
    }

    // Simple model: direct component reduces with angle, diffuse adds
    const directComponent = Math.max(0, Math.abs(dni * sinElevation));
    const diffuseComponent = diffuse; // Assume diffuse is incident on horizontal

    return directComponent + diffuseComponent;
  }

  /**
   * Get irradiance at a specific hour of the day
   */
  getHourlyIrradiance(weatherData, hour) {
    if (!weatherData) return this.getFallbackIrradiance(hour);

    const hourlyData = weatherData.hourly || weatherData;
    const index = Math.floor(hour);
    if (index < 0 || index >= 24) return 0;

    const dni = hourlyData.direct_normal_irradiance?.[index] || 0;
    const diffuse = hourlyData.diffuse_radiation?.[index] || 0;

    return Math.max(0, (dni || 0) + (diffuse || 0));
  }

  /**
   * Fallback clear-sky model when weather data is unavailable
   */
  getFallbackIrradiance(hour, cloudCover = 0) {
    // Simplified clear sky model
    const elevation = Math.sin(((hour - 6) / 12) * Math.PI);

    if (elevation < 0) {
      return 0;
    }

    // Maximum 1000 W/m2 at sea level, adjusted for sun angle
    const clearSkyIrradiance = 1000 * elevation;

    // Apply cloud cover effect (cloud cover 0-100%)
    const cloudFactor = 1 - cloudCover / 100;

    return clearSkyIrradiance * cloudFactor;
  }

  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache = {};
  }
}

// Export singleton instance
export const weatherService = new WeatherService();
