// src/components/dashboard/EarningsOptimization.tsx

import { useEffect, useState } from "react";
import { calculateRisk } from "../../lib/riskEngine";

interface TimeSlot {
  time: string;
  riskLevel: "Low" | "Medium" | "High";
  reason: string;
  earningsPotential: "High" | "Medium" | "Low";
}

interface HourlyForecast {
  hour: number;
  rainMm: number;
  tempCelsius: number;
  aqiIndex: number;
}

interface Props {
  city: string;
  forecastData?: HourlyForecast[];
}

export function EarningsOptimization({ city, forecastData = [] }: Props) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSlots = async () => {
      try {
        setLoading(true);

        // If no forecast provided, use static data
        if (!forecastData || forecastData.length === 0) {
          setSlots(generateStaticSlots());
          setLoading(false);
          return;
        }

        // Define candidate time windows
        const windows = [
          { label: "6:00 AM - 9:00 AM", startHour: 6, endHour: 9 },
          { label: "9:00 AM - 12:00 PM", startHour: 9, endHour: 12 },
          { label: "12:00 PM - 3:00 PM", startHour: 12, endHour: 15 },
          { label: "5:00 PM - 8:00 PM", startHour: 17, endHour: 20 },
        ];

        const dynamicSlots: TimeSlot[] = windows.map((window) => {
          // Average forecast data for the window
          const windowHours = forecastData.filter(
            (f) => f.hour >= window.startHour && f.hour < window.endHour
          );

          if (windowHours.length === 0) {
            // Fallback if no data for this window
            return {
              time: window.label,
              riskLevel: "Medium",
              reason: "Check conditions closer to time",
              earningsPotential: "Medium",
            };
          }

          const avgRain =
            windowHours.reduce((s, f) => s + f.rainMm, 0) /
            windowHours.length;
          const avgTemp =
            windowHours.reduce((s, f) => s + f.tempCelsius, 0) /
            windowHours.length;
          const avgAqi =
            windowHours.reduce((s, f) => s + f.aqiIndex, 0) /
            windowHours.length;

          const risk = calculateRisk({
            rainMm: avgRain,
            aqiIndex: avgAqi,
            tempCelsius: avgTemp,
            trafficDelayPercent: 30, // baseline
            hour: window.startHour,
            dayOfWeek: new Date().getDay(),
          });

          const topFactor = risk.explanation[0];

          return {
            time: window.label,
            riskLevel:
              risk.level === "HIGH"
                ? "High"
                : risk.level === "MEDIUM"
                ? "Medium"
                : "Low",
            reason:
              risk.level === "LOW"
                ? "Best slot for safer and stable work"
                : `Caution: ${topFactor.factor} expected (${topFactor.value})`,
            earningsPotential:
              risk.level === "LOW"
                ? "High"
                : risk.level === "MEDIUM"
                ? "Medium"
                : "Low",
          };
        });

        setSlots(dynamicSlots);
      } finally {
        setLoading(false);
      }
    };

    loadSlots();
  }, [forecastData]);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-white flex items-center gap-2">
        <span>📈</span> AI Earnings Optimization
        <span className="text-xs text-gray-400 font-normal ml-1">
          (Personalized for {city})
        </span>
      </h3>
      {loading ? (
        <div className="text-xs text-gray-400 py-4">Loading forecast...</div>
      ) : slots.length === 0 ? (
        <div className="text-xs text-gray-400 py-4">No forecast available</div>
      ) : (
        <div className="space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.time}
              className="flex items-center justify-between py-2 px-3 rounded border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition"
            >
              <div className="flex-1">
                <div className="text-sm text-white flex items-center gap-2 font-medium">
                  🕐 {slot.time}
                </div>
                <div className="text-xs text-gray-400 mt-1">{slot.reason}</div>
              </div>
              <div className="text-right ml-4">
                <span
                  className={`inline-block text-xs px-2.5 py-1 rounded font-semibold ${
                    slot.riskLevel === "Low"
                      ? "bg-green-900 text-green-300"
                      : slot.riskLevel === "Medium"
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {slot.riskLevel} Risk
                </span>
                <div className="text-xs text-gray-400 mt-1.5">
                  {slot.earningsPotential === "High"
                    ? "💰 High earnings"
                    : slot.earningsPotential === "Medium"
                    ? "💵 Medium earnings"
                    : "💸 Lower earnings"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function generateStaticSlots(): TimeSlot[] {
  return [
    {
      time: "6:00 AM - 9:00 AM",
      riskLevel: "Low",
      reason: "Early morning: best conditions for safe work",
      earningsPotential: "High",
    },
    {
      time: "9:00 AM - 12:00 PM",
      riskLevel: "Medium",
      reason: "Mid-morning: moderate traffic possible",
      earningsPotential: "Medium",
    },
    {
      time: "12:00 PM - 3:00 PM",
      riskLevel: "High",
      reason: "Peak heat hours: high disruption potential",
      earningsPotential: "Low",
    },
    {
      time: "5:00 PM - 8:00 PM",
      riskLevel: "Medium",
      reason: "Evening rush: traffic and weather variable",
      earningsPotential: "Medium",
    },
  ];
}
