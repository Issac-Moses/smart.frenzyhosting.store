import { NextResponse } from 'next/server';
import { EmergencyType } from '@prisma/client';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { matchEmergencyToTeam } from '@/lib/matching';
import { createNotification } from '@/lib/notification';

const emergencyTypeMap: Record<string, string> = {
  FLOOD: 'FLOOD',
  EARTHQUAKE: 'EARTHQUAKE',
  LANDSLIDE: 'LANDSLIDE',
  FIRE: 'FIRE',
  ACCIDENT: 'ACCIDENT',
  CYCLONE: 'CYCLONE',
  BUILDING_COLLAPSE: 'BUILDING_COLLAPSE',
  MEDICAL_EMERGENCY: 'MEDICAL_EMERGENCY',
  OTHER: 'OTHER',
  'MEDICAL EMERGENCY': 'MEDICAL_EMERGENCY',
  'BUILDING COLLAPSE': 'BUILDING_COLLAPSE',
};

const schema = z.object({
  emergencyType: z.string().min(2),
  description: z.string().optional().default(''),
  locationLabel: z.string().max(160).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'USER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const safe = schema.parse(body);

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const normalizedType = emergencyTypeMap[safe.emergencyType.trim().toUpperCase()] ??
      safe.emergencyType.trim().toUpperCase().replace(/\s+/g, '_');

    const emergency = await prisma.emergency.create({
      data: {
        userId: user.id,
        emergencyType: normalizedType as EmergencyType,
        locationLabel: safe.locationLabel?.trim() || null,
        latitude: safe.latitude,
        longitude: safe.longitude,
        description: safe.description,
        status: 'NEW',
        priority: 'HIGH',
      },
      include: { user: true },
    });

    await createNotification({
      type: 'EMERGENCY_CREATED',
      message: `New ${safe.emergencyType} emergency received from ${user.name}.`,
      userId: user.id,
      emergencyId: emergency.id,
    });

    const admin = await prisma.admin.findFirst();

    await createNotification({
      type: 'ADMIN_ALERT',
      message: `Emergency: ${safe.emergencyType} has been reported and requires review.`,
      adminId: admin?.id,
      emergencyId: emergency.id,
    });

    const matchingResult = await matchEmergencyToTeam(emergency.id);
    const finalEmergency = matchingResult?.emergency ?? await prisma.emergency.findUnique({
      where: { id: emergency.id },
      include: { assignedTeam: true },
    });

    return NextResponse.json({
      ok: true,
      emergency: finalEmergency,
      matching: matchingResult,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 });
  }
}
