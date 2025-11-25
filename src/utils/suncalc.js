/**
 * Advanced Sun Position Algorithm (Simplified NOAA/SunCalc)
 * Calculates solar position (azimuth and altitude) for given date, time, and location
 */
export class SunCalc {
  static getPosition(date, lat, lon) {
    const rad = Math.PI / 180;
    const dayMs = 1000 * 60 * 60 * 24;
    const J1970 = 2440588;
    const J2000 = 2451545;

    const J = date.valueOf() / dayMs - 0.5 + J1970;
    const d = J - J2000;

    // Solar longitude calculation
    const L = (280.16 + 0.9856235 * d) % 360;
    const g = (357.5291 + 0.98560028 * d) % 360;
    const l =
      (L +
        1.9148 * Math.sin(g * rad) +
        0.02 * Math.sin(2 * g * rad) +
        0.0003 * Math.sin(3 * g * rad)) *
      rad;
    const eps = (23.4393 - 0.0000004 * d) * rad;

    // Right ascension
    const ra = Math.atan2(Math.cos(eps) * Math.sin(l), Math.cos(l));
    const dec = Math.asin(Math.sin(eps) * Math.sin(l));

    // Greenwich Mean Sidereal Time
    const h =
      (6.697375 +
        0.0657098242 * d +
        1.0027379 * date.getUTCHours() +
        (date.getUTCMinutes() / 60) * 1.0027379) *
      15 *
      rad;
    const H = h + lon * rad - ra;

    // Azimuth and Altitude
    const az = Math.atan2(
      Math.sin(H),
      Math.cos(H) * Math.sin(lat * rad) - Math.tan(dec) * Math.cos(lat * rad)
    );
    const alt = Math.asin(
      Math.sin(lat * rad) * Math.sin(dec) +
        Math.cos(lat * rad) * Math.cos(dec) * Math.cos(H)
    );

    return {
      azimuth: az + Math.PI, // 0 is South, adjust for North-up canvas
      altitude: alt, // Radians
    };
  }

  /**
   * Get sunrise and sunset times for a given date and location
   */
  static getTimes(date, lat, lon) {
    const rad = Math.PI / 180;
    const dayMs = 1000 * 60 * 60 * 24;
    const J1970 = 2440588;
    const J2000 = 2451545;

    const J = date.valueOf() / dayMs - 0.5 + J1970;
    const d = J - J2000;

    const L = (280.16 + 0.9856235 * d) % 360;
    const g = (357.5291 + 0.98560028 * d) % 360;
    const l =
      (L +
        1.9148 * Math.sin(g * rad) +
        0.02 * Math.sin(2 * g * rad) +
        0.0003 * Math.sin(3 * g * rad)) *
      rad;
    const eps = (23.4393 - 0.0000004 * d) * rad;

    const dec = Math.asin(Math.sin(eps) * Math.sin(l));

    // Hour angle at sunrise/sunset (sun at horizon, altitude = -0.833°)
    const cosH = -Math.tan(lat * rad) * Math.tan(dec);
    if (cosH > 1) {
      return { sunrise: null, sunset: null }; // Sun never rises
    }
    if (cosH < -1) {
      return { sunrise: date, sunset: date }; // Sun never sets
    }

    const H = Math.acos(cosH);
    const h =
      (6.697375 +
        0.0657098242 * d +
        12 +
        ((-H / Math.PI) * 12) / 1.0027379) *
      15;
    const h_sr = h;
    const h_ss = h + 2 * (H / Math.PI) * 12 / 1.0027379;

    const sunrise = new Date(date);
    sunrise.setUTCHours(Math.floor(h_sr), Math.round((h_sr % 1) * 60));

    const sunset = new Date(date);
    sunset.setUTCHours(Math.floor(h_ss), Math.round((h_ss % 1) * 60));

    return { sunrise, sunset };
  }
}
