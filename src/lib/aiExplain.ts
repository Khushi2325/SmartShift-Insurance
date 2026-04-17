// src/lib/aiExplain.ts
// Calls backend endpoint to generate AI risk narratives
// (Backend handles Claude API calls securely)

import type { RiskFactors, RiskResult } from "./riskEngine";

export async function getAIRiskNarrative(
  factors: RiskFactors,
  riskResult: RiskResult,
  workerCity: string,
  deliveryPlatform: string
): Promise<string> {
  try {
    // Call backend endpoint instead of Claude API directly
    const response = await fetch("/api/ai/risk/narrative", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        factors,
        riskResult,
        workerCity,
        deliveryPlatform,
      }),
    });

    if (!response.ok) {
      console.warn("Backend narrative generation failed, using fallback");
      return riskResult.recommendation;
    }

    const data = await response.json();
    return data.narrative || riskResult.recommendation;
  } catch (error) {
    console.error("AI narrative error:", error);
    // Fallback to rule-based recommendation if API fails
    return riskResult.recommendation;
  }
}
