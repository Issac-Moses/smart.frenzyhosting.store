import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { matchEmergencyToTeam } from '@/lib/matching';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ emergencyId: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { emergencyId } = await context.params;
  const emergency = await prisma.emergency.findUnique({ where: { id: emergencyId } });
  if (!emergency) {
    return NextResponse.json({ error: 'Emergency not found' }, { status: 404 });
  }
  if (emergency.assignedTeamId) {
    return NextResponse.json({ error: 'Emergency already has an assigned team' }, { status: 409 });
  }

  try {
    const result = await matchEmergencyToTeam(emergencyId);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error('Admin emergency matching retry failed:', error instanceof Error ? error.name : 'UnknownError');
    return NextResponse.json({ error: 'Matching failed. Check server logs and Gemini connectivity.' }, { status: 500 });
  }
}