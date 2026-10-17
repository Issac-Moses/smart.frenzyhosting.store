import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const teamSchema = z.object({
  name: z.string().min(2),
  teamCode: z.string().min(2),
  baseLocation: z.string().min(2),
  membersCount: z.number().int().min(1),
  contactInfo: z.string().min(5),
  capabilities: z.string().min(3),
  availableEquipment: z.string().default('Rescue Kits, Radios, First Aid'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  availabilityStatus: z.enum(['AVAILABLE', 'BUSY', 'OFFLINE']).default('AVAILABLE'),
  accountEmail: z.string().email().optional(),
  accountPassword: z.string().min(6).optional(),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = teamSchema.parse(body);

    const existingCode = await prisma.rescueTeam.findUnique({
      where: { teamCode: data.teamCode },
    });
    if (existingCode) {
      return NextResponse.json({ error: 'Team Code already exists. Please use a unique code.' }, { status: 400 });
    }

    const team = await prisma.rescueTeam.create({
      data: {
        name: data.name,
        teamCode: data.teamCode,
        baseLocation: data.baseLocation,
        membersCount: data.membersCount,
        contactInfo: data.contactInfo,
        capabilities: data.capabilities,
        availableEquipment: data.availableEquipment,
        latitude: data.latitude,
        longitude: data.longitude,
        availabilityStatus: data.availabilityStatus,
      },
    });

    if (data.accountEmail && data.accountPassword) {
      const passwordHash = await bcrypt.hash(data.accountPassword, 10);
      await prisma.rescueTeamAccount.create({
        data: {
          email: data.accountEmail,
          passwordHash,
          teamId: team.id,
        },
      });
    }

    return NextResponse.json({ ok: true, team });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to register rescue team' }, { status: 400 });
  }
}
