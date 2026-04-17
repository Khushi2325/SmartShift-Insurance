import { useEffect, useState } from "react";
import { calculateRisk } from "../../lib/riskEngine";

interface TimeSlot {
  time: string;
  riskLevel: "Low" | "Medium" | "High";
}

export function EarningsOptimization() {
  const [slots, setSlots] = useState<TimeSlot[]>([
    { time: "6:00 - 9:00 AM", riskLevel: "Low" },
    { time: "9:00 - 12:00 PM", riskLevel: "Medium" },
    { time: "12:00 - 3:00 PM", riskLevel: "High" },
    { time: "5:00 - 8:00 PM", riskLevel: "Medium" },
  ]);

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-white text-sm">Best Hours to Work</h3>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => (
          <div
            key={slot.time}
            className={`p-3 rounded-lg text-sm font-medium text-center transition ${
              slot.riskLevel === "Low"
                ? "bg-green-500/20 text-green-300 border border-green-500/30"
                : slot.riskLevel === "Medium"
                ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30"
                : "bg-red-500/20 text-red-300 border border-red-500/30"
            }`}
          >
            <div>{slot.time}</div>
            <div className="text-xs mt-1">{slot.riskLevel}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
