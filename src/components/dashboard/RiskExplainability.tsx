import type { RiskResult } from "../../lib/riskEngine";

interface Props {
  result: RiskResult;
  aiNarrative?: string;
}

export function RiskExplainability({ result, aiNarrative }: Props) {
  const riskLevel = result.level || "LOW";
  
  const levelConfig = {
    LOW: { color: "from-green-500 to-emerald-500", text: "Safe", icon: "✓", bg: "bg-gradient-to-br from-green-500/20 to-emerald-500/10" },
    MEDIUM: { color: "from-amber-500 to-orange-500", text: "Caution", icon: "⚠", bg: "bg-gradient-to-br from-amber-500/20 to-orange-500/10" },
    HIGH: { color: "from-red-500 to-rose-500", text: "Alert", icon: "🚨", bg: "bg-gradient-to-br from-red-500/20 to-rose-500/10" },
  };

  const config = levelConfig[riskLevel];

  return (
    <div className={`rounded-xl p-6 border border-white/10 backdrop-blur-sm ${config.bg}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <span className={`text-2xl font-bold bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
            {config.text}
          </span>
        </div>
      </div>

      {aiNarrative && (
        <p className="text-sm text-gray-200 leading-relaxed">
          {aiNarrative}
        </p>
      )}
    </div>
  );
}
