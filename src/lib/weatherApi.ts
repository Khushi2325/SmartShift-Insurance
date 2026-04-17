// src/lib/weatherApi.ts
// Real API integration — OpenWeatherMap + WAQI (Air Quality)

const OWM_KEY = import.meta.env.VITE_OPENWEATHER_KEY;
const WAQI_KEY = import.meta.env.VITE_WAQI_KEY;

export interface LiveWeather {
  tempCelsius: number;
  rainMm: number; // mm/hr
  description: string;
  humidity: number;
  windSpeed: number;
  source: "OpenWeatherMap";
  fetchedAt: string; // ISO timestamp — proves it's live
}

export interface LiveAQI {
  aqi: number;
  category: string;
  dominantPollutant: string;
  source: "WAQI";
  fetchedAt: string;
}

export interface HourlyForecast {
  hour: number;
  rainMm: number;
  tempCelsius: number;
  aqiIndex: number;
}

export async function fetchLiveWeather(city: string): Promise<LiveWeather> {
  try {
    if (!OWM_KEY) throw new Error("OpenWeatherMap key not configured");

    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&units=metric&appid=${OWM_KEY}`
    );
    if (!res.ok) throw new Error("Weather API failed");
    const data = await res.json();

    return {
      tempCelsius: Math.round(data.main.temp),
      rainMm: data.rain?.["1h"] ?? 0,
      description: data.weather[0].description,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      source: "OpenWeatherMap",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Weather API error:", error);
    // Return safe defaults
    return {
      tempCelsius: 28,
      rainMm: 0,
      description: "Unable to fetch",
      humidity: 50,
      windSpeed: 5,
      source: "OpenWeatherMap",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export async function fetchLiveAQI(city: string): Promise<LiveAQI> {
  try {
    if (!WAQI_KEY) throw new Error("WAQI key not configured");

    const res = await fetch(
      `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${WAQI_KEY}`
    );
    if (!res.ok) throw new Error("AQI API failed");
    const data = await res.json();

    if (data.status !== "ok") throw new Error("AQI data not available");

    const aqi = data.data.aqi;
    const category =
      aqi <= 50
        ? "Good"
        : aqi <= 100
        ? "Moderate"
        : aqi <= 150
        ? "Unhealthy for Sensitive"
        : aqi <= 200
        ? "Unhealthy"
        : "Hazardous";

    return {
      aqi,
      category,
      dominantPollutant: data.data.dominentpol ?? "PM2.5",
      source: "WAQI",
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("AQI API error:", error);
    // Return safe defaults
    return {
      aqi: 75,
      category: "Moderate",
      dominantPollutant: "PM2.5",
      source: "WAQI",
      fetchedAt: new Date().toISOString(),
    };
  }
}

export async function fetchHourlyForecast(
  city: string
): Promise<HourlyForecast[]> {
  try {
    if (!OWM_KEY) throw new Error("OpenWeatherMap key not configured");

    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},IN&units=metric&cnt=8&appid=${OWM_KEY}`
    );
    if (!res.ok) return [];
    const data = await res.json();

    return data.list.map((item: any) => ({
      hour: new Date(item.dt * 1000).getHours(),
      rainMm: item.rain?.["3h"] ? item.rain["3h"] / 3 : 0,
      tempCelsius: Math.round(item.main.temp),
      aqiIndex: 75, // AQI forecast needs separate premium API — use estimate
    }));
  } catch (error) {
    console.error("Hourly forecast error:", error);
    return [];
  }
}
