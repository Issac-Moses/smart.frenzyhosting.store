import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const locationSchema = z.object({
  action: z.literal('LOCATION'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const availabilitySchema = z.object({
  action: z.literal('AVAILABILITY'),
  availabilityStatus: z.enum(['AVAILABLE', 'OFFLINE']),
});

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'RESCUE_TEAM') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const locationInput = locationSchema.safeParse(body);
  const availabilityInput = availabilitySchema.safeParse(body);

  if (locationInput.success) {
    const team = await prisma.rescueTeam.update({
      where: { id: session.id },
      data: {
        latitude: locationInput.data.latitude,
        longitude: locationInput.data.longitude,
      },
      select: { id: true, latitude: true, longitude: true, availabilityStatus: true },
    });
    return NextResponse.json({ ok: true, team });
  }

  if (availabilityInput.success) {
    const activeAssignment = await prisma.rescueAssignment.findFirst({
      where: {
        teamId: session.id,
        status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'] },
      },
    });
    if (activeAssignment) {
      return NextResponse.json({ error: 'Update availability after all active assignments are completed or declined.' }, { status: 409 });
    }

    const team = await prisma.rescueTeam.update({
      where: { id: session.id },
      data: { availabilityStatus: availabilityInput.data.availabilityStatus },
      select: { id: true, availabilityStatus: true },
    });
    return NextResponse.json({ ok: true, team });
  }

  return NextResponse.json({ error: 'Invalid profile update' }, { status: 400 });
}