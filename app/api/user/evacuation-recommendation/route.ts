import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { getNearbyCandidateShelters } from '@/lib/evacuation-locations';
import { getGeminiEvacuationRecommendation } from '@/lib/gemini';

const schema = z.object({
  emergencyType: z.string().min(2),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  locationLabel: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const safe = schema.parse(body);

    const candidates = getNearbyCandidateShelters(
      safe.emergencyType,
      safe.latitude,
      safe.longitude,
      safe.locationLabel
    );

    const recommendation = await getGeminiEvacuationRecommendation({
      emergencyType: safe.emergencyType,
      userCoordinates: { latitude: safe.latitude, longitude: safe.longitude },
      locationLabel: safe.locationLabel,
      nearbyCandidates: candidates,
    });

    return NextResponse.json({
      ok: true,
      recommendation,
      candidates,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 400 }
    );
  }
}
