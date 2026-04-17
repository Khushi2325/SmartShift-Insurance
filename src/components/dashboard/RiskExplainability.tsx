// src/components/dashboard/RiskExplainability.tsx

import type { RiskResult } from "../../lib/riskEngine";

interface Props {
  result: RiskResult;
  aiNarrative?: string; // From Claude API
}

export function RiskExplainability({ result, aiNarrative }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          🤖 AI Risk Breakdown
        </h4>
        <span className="text-xs text-gray-400">
          Weighted model · 5 factors
        </span>
      </div>

      {/* AI Narrative from Claude */}
      {aiNarrative && (
        <div className="bg-blue-950 border border-blue-700 rounded p-3 text-xs text-blue-200 leading-relaxed">
          <span className="font-semibold text-blue-400">Claude AI says: </span>
          {aiNarrative}
        </div>
      )}

      {/* Factor breakdown bars */}
      <div className="space-y-3">
        {result.explanation.map((factor) => (
          <div key={factor.factor} className="space-y-1">
            <div className="flex justify-between text-xs items-center">
              <span className="text-gray-300 font-medium">{factor.factor}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">{factor.value}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    factor.status === "SAFE"
                      ? "bg-green-900 text-green-300"
                      : factor.status === "WARNING"
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-red-900 text-red-300"
                  }`}
                >
                  {factor.status}
                </span>
              </div>
            </div>
            {/* Contribution bar */}
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  factor.status === "SAFE"
                    ? "bg-green-400"
                    : factor.status === "WARNING"
                    ? "bg-yellow-400"
                    : "bg-red-400"
                }`}
                style={{
                  width: `${Math.min(factor.contribution * 200, 100)}%`,
                }}
              />
            </div>
            <div className="text-right text-xs text-gray-500">
              {(factor.contribution * 100).toFixed(1)}% contribution ({(factor.weight).toFixed(0)}% weight)
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="pt-2 mt-3 border-t border-gray-700">
        <p className="text-xs text-gray-300 leading-relaxed">
          <span className="font-semibold text-white">Recommendation: </span>
          {result.recommendation}
        </p>
      </div>
    </div>
  );
}
