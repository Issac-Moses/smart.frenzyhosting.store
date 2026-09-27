import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const recommendationSchema = z.object({
  recommendedTeamId: z.string().nullable(),
  emergencyPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  reason: z.string().min(1),
  estimatedDistance: z.string().min(1),
  requiredResources: z.array(z.string()),
  recommendedResources: z.array(z.string()),
  userMessage: z.string().min(1),
  rescueTeamMessage: z.string().min(1),
  confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

export type GeminiRecommendation = z.infer<typeof recommendationSchema> & {
  usedAI: boolean;
  error?: string;
};

function unavailableRecommendation(message: string): GeminiRecommendation {
  return {
    recommendedTeamId: null,
    emergencyPriority: 'HIGH',
    reason: message,
    estimatedDistance: 'N/A',
    requiredResources: [],
    recommendedResources: [],
    userMessage: message,
    rescueTeamMessage: message,
    confidence: 'LOW',
    usedAI: false,
    error: message,
  };
}

export async function testGeminiConnection(): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, message: 'GEMINI_API_KEY is empty in the server environment.' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: 'Reply with exactly the text GEMINI_CONNECTION_OK.',
      config: { maxOutputTokens: 20 },
    });

    if (!response.text?.trim()) {
      return { ok: false, message: 'Gemini responded, but returned an empty response.' };
    }

    return { ok: true, message: 'Gemini API is reachable and returned a response.' };
  } catch (error) {
    const apiError = error as { status?: number; code?: number; name?: string };
    const status = apiError.status ?? apiError.code;
    console.error('Gemini connectivity check failed', {
      name: apiError.name ?? 'Error',
      status,
    });
    return {
      ok: false,
      message: status
        ? `Gemini API request failed with status ${status}. Check key validity, API access, and quota.`
        : 'Gemini API request failed. Check server logs, network access, and key validity.',
    };
  }
}

export async function getGeminiRecommendation(payload: unknown): Promise<GeminiRecommendation> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    return unavailableRecommendation('Gemini API key is missing. Admin review required.');
  }

  const systemPrompt = `You are an Emergency Rescue Coordination AI. Your responsibility is to analyze an emergency request and available rescue resources and teams. Your objective is to identify the most suitable available rescue team based on: 1. Distance from the emergency location 2. Team availability 3. Team capabilities 4. Emergency type 5. Required resources 6. Resource availability 7. Response suitability. Do not invent rescue teams, resources, locations, distances, or capabilities. Use only the data provided in the input. Prioritize factual matching and operational suitability. Return structured JSON only. The response must contain: recommendedTeamId, emergencyPriority, reason, estimatedDistance, requiredResources, recommendedResources, userMessage, rescueTeamMessage, confidence. emergencyPriority MUST be one of 'LOW', 'MEDIUM', 'HIGH', or 'CRITICAL'. confidence MUST be one of 'LOW', 'MEDIUM', or 'HIGH' (do not return a number). If no suitable team is available, return recommendedTeamId as null and clearly explain why. Do not make medical diagnoses. Do not make decisions outside the provided operational data. The final response must be machine-readable JSON.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    let text = '';
    
    // Add a simple retry loop for 503s
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash', // More stable
          contents: JSON.stringify(payload),
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });
        text = response.text?.trim() || '';
        break; // Success
      } catch (err: any) {
        if (err?.status === 503 && attempt < 3) {
          console.warn(`Gemini 503 error, retrying attempt ${attempt}...`);
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }

    if (!text) {
      return unavailableRecommendation('Gemini returned an empty response. Admin review required.');
    }

    const parsedJson = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as unknown;
    const parsed = recommendationSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error('Zod schema validation failed:', parsed.error);
      require('fs').appendFileSync('gemini-error.log', new Date().toISOString() + ': Zod Error: ' + JSON.stringify(parsed.error.issues) + '\nJSON received: ' + JSON.stringify(parsedJson) + '\n');
      return unavailableRecommendation('Gemini returned an invalid response. Admin review required.');
    }

    return { ...parsed.data, usedAI: true };
  } catch (error) {
    const message = error instanceof Error ? error.stack : 'Unknown Gemini API error';
    console.error('Gemini matching failed completely:', message, error);
    require('fs').appendFileSync('gemini-error.log', new Date().toISOString() + ': ' + String(message) + '\n');
    return unavailableRecommendation('Gemini matching failed. Check the server logs and API key; admin review required.');
  }
}
