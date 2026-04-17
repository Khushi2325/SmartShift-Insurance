// src/lib/aiExplain.ts
// Calls Claude API to generate natural language risk explanation

import type { RiskFactors, RiskResult } from "./riskEngine";

export async function getAIRiskNarrative(
  factors: RiskFactors,
  riskResult: RiskResult,
  workerCity: string,
  deliveryPlatform: string
): Promise<string> {
  try {
    const apiKey = import.meta.env.VITE_CLAUDE_API_KEY;
    if (!apiKey) {
      console.warn("Claude API key not configured, using fallback");
      return riskResult.recommendation;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: `You are a risk advisor for gig delivery workers in India. 
Analyze this worker's situation and give a 2-sentence plain-English explanation of their risk today.
Be specific and actionable. Use simple language.

Worker: ${deliveryPlatform} rider in ${workerCity}
Current conditions:
- Rain: ${factors.rainMm}mm/hr
- AQI: ${factors.aqiIndex}
- Temperature: ${factors.tempCelsius}°C  
- Traffic delay: ${factors.trafficDelayPercent}%
- Time: ${factors.hour}:00

Risk score: ${riskResult.score} (${riskResult.level})
Top risk factor: ${riskResult.explanation[0].factor}

Give only the 2-sentence explanation, nothing else.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("Claude API error, using fallback");
      return riskResult.recommendation;
    }

    const data = await response.json();
    return data.content?.[0]?.text || riskResult.recommendation;
  } catch (error) {
    console.error("Claude API error:", error);
    // Fallback to rule-based recommendation if API fails
    return riskResult.recommendation;
  }
}
