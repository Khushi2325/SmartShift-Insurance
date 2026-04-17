// src/lib/weatherApi.ts
// Frontend weather data structures
// All actual API calls are handled by the backend (/api/ai/risk/assess)
// This file provides type definitions and fallback data

export interface LiveWeather {
  tempCelsius: number;
  rainMm: number;
  description: string;
  humidity: number;
  windSpeed: number;
  source: "OpenWeatherMap";
  fetchedAt: string;
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

// Fallback data used when backend call fails
export function getDefaultWeather(): LiveWeather {
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

export function getDefaultAQI(): LiveAQI {
  return {
    aqi: 75,
    category: "Moderate",
    dominantPollutant: "PM2.5",
    source: "WAQI",
    fetchedAt: new Date().toISOString(),
  };
}

// Fetch hourly forecast from backend
export async function fetchHourlyForecast(
  city: string
): Promise<HourlyForecast[]> {
  try {
    // Backend endpoint handles external API calls
    const res = await fetch("/api/ai/risk/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return data.forecast || [];
  } catch (error) {
    console.error("Forecast fetch error:", error);
    return [];
  }
}

