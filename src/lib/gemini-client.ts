import { GoogleGenAI } from "@google/genai";

export interface AutopsyModelOutput {
  summaryText: string;
  actionableTip: string;
  isFallback: boolean;
}

/**
 * SINGLE CALL SITE FOR GEMINI SDK (Requirement 8)
 *
 * Encapsulates Google Gemini 3.6 Flash API calls into a single server-side function.
 * Enforces token efficiency, supportive non-clinical tone, and graceful fallbacks.
 */
export async function callAutopsyModel(
  structuredInputJson: string
): Promise<AutopsyModelOutput> {
  const apiKey = process.env.GEMINI_API_KEY;

  // 1. Check if API key is configured
  if (!apiKey) {
    console.warn("[Gemini] GEMINI_API_KEY not configured — returning graceful fallback");
    return getFallbackAutopsy();
  }

  const systemInstruction = `You are a supportive, concise habit coach in the Anvil habit tracking system.
Your job is to analyze habit friction from structured JSON metrics and output a focused, token-efficient response.

STRICT FORMAT RULES:
1. Output MUST be valid JSON with exactly two keys: "summaryText" and "actionableTip".
2. "summaryText": 2-3 sentences explaining WHY the habit is experiencing friction based on the metrics. Concise, zero fluff/small-talk, on-point.
3. "actionableTip": Exactly 1 concrete, encouraging action the user can take (1-2 sentences max).
4. TONE: Supportive, empowering, non-judgmental. NO medical/clinical/diagnostic jargon. NO shaming.
5. TOKEN EFFICIENCY: Keep explanation direct and under 100 words total.`;

  const userPrompt = `Analyze this habit performance data and output JSON with keys "summaryText" and "actionableTip":\n${structuredInputJson}`;

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Target Gemini model (gemini-3.6-flash)
    const targetModel = "gemini-3.6-flash";
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${userPrompt}` }]
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      }
    });

    const rawText = response.text || "";
    if (!rawText) {
      throw new Error("Empty response from Gemini API");
    }

    // Clean and parse JSON response
    let cleanText = rawText.trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanText = jsonMatch[0];
    }
    const parsed = JSON.parse(cleanText);

    return {
      summaryText: parsed.summaryText || "Habit friction detected during peak tracking periods.",
      actionableTip: parsed.actionableTip || "Try adjusting your habit schedule by 1-2 hours.",
      isFallback: false,
    };
  } catch (error: any) {
    console.error("[Gemini API Error]:", error?.message || error);
    return getFallbackAutopsy();
  }
}

/**
 * Clean, supportive fallback output when Gemini is unavailable or errors
 */
function getFallbackAutopsy(): AutopsyModelOutput {
  return {
    summaryText:
      "We observed friction with this habit based on your recent execution timing and completion volatility.",
    actionableTip:
      "Try shifting this habit to a different time bucket (like afternoon) to reduce end-of-day rush.",
    isFallback: true,
  };
}
