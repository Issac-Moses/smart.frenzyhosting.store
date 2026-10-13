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

export const evacuationRecommendationSchema = z.object({
  emergencyType: z.string(),
  recommendedLocationName: z.string(),
  locationType: z.string(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  distanceKm: z.number().optional(),
  reason: z.string().min(1),
  safetyInstructions: z.array(z.string()).min(1),
  shortUserMessage: z.string().min(1),
  isSimulated: z.boolean().default(true),
});

export type EvacuationRecommendation = z.infer<typeof evacuationRecommendationSchema> & {
  usedAI: boolean;
  error?: string;
};

export async function getGeminiEvacuationRecommendation(payload: {
  emergencyType: string;
  userCoordinates: { latitude: number; longitude: number };
  locationLabel?: string;
  nearbyCandidates: Array<{
    id: string;
    name: string;
    locationType: string;
    latitude: number;
    longitude: number;
    elevationMeters: number;
    distanceKm: number;
    district: string;
    isSimulated: boolean;
    notes: string;
  }>;
}): Promise<EvacuationRecommendation> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const fallbackCandidate = payload.nearbyCandidates[0] ?? {
    name: 'Designated Public Assembly Area',
    locationType: 'OPEN_GROUND',
    latitude: payload.userCoordinates.latitude,
    longitude: payload.userCoordinates.longitude,
    distanceKm: 1.0,
  };

  const defaultFallback: EvacuationRecommendation = {
    emergencyType: payload.emergencyType,
    recommendedLocationName: fallbackCandidate.name,
    locationType: fallbackCandidate.locationType,
    latitude: fallbackCandidate.latitude,
    longitude: fallbackCandidate.longitude,
    distanceKm: fallbackCandidate.distanceKm,
    reason: `Selected nearest available safe area (${fallbackCandidate.name}) for ${payload.emergencyType}.`,
    safetyInstructions: [
      'Follow official local emergency services broadcast instructions.',
      'Move carefully away from damaged structures or floodwaters.',
      'Keep your communication devices charged and monitor alerts.',
    ],
    shortUserMessage: `Move safely towards ${fallbackCandidate.name}. Stay alert and avoid hazardous paths.`,
    isSimulated: true,
    usedAI: false,
  };

  if (!apiKey) {
    return { ...defaultFallback, error: 'GEMINI_API_KEY is not configured.' };
  }

  const systemPrompt = `You are an AI Disaster Emergency Evacuation Advisor.
Given an emergency type, user coordinates, and a list of candidate safe locations/shelters with their elevations, distances, and hazard notes:
1. Select the single best recommended evacuation location strictly from the supplied nearbyCandidates list.
2. DO NOT hallucinate or invent real-world locations or place names outside the provided candidate list.
3. Apply disaster-specific evacuation logic:
   - EARTHQUAKE: Recommend open areas (e.g. sports grounds, open parks) away from high-rise buildings and power lines.
   - FLOOD: Recommend higher elevation ground or sturdy multi-story evacuation shelters. NEVER recommend low-lying areas or water pathways.
   - LANDSLIDE: Recommend moving away from steep slopes, hill drainage channels, and debris paths towards safe flat ground.
   - CYCLONE / STORM: Recommend reinforced cyclone shelters or sturdy storm refuges away from coastal storm surge areas.
4. Output must be STRICT JSON matching:
{
  "emergencyType": string,
  "recommendedLocationName": string (must match chosen candidate name),
  "locationType": string,
  "latitude": number,
  "longitude": number,
  "distanceKm": number,
  "reason": string (explain why this location is safe and suitable for this specific hazard),
  "safetyInstructions": string[] (3-4 bullet-point life safety instructions),
  "shortUserMessage": string (crisp message directing the user towards this safe location),
  "isSimulated": boolean (set true)
}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    let text = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.7-flash',
          contents: JSON.stringify(payload),
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
          },
        });
        text = response.text?.trim() || '';
        break;
      } catch (err: any) {
        if (err?.status === 503 && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw err;
      }
    }

    if (!text) {
      return defaultFallback;
    }

    const parsedJson = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as unknown;
    const parsed = evacuationRecommendationSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.warn('Evacuation schema parse warning:', parsed.error);
      return defaultFallback;
    }

    return { ...parsed.data, usedAI: true };
  } catch (error) {
    console.error('Gemini evacuation recommendation failed:', error);
    return defaultFallback;
  }
}
