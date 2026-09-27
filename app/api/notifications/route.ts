import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const where = session.role === 'USER'
    ? { userId: session.id }
    : session.role === 'RESCUE_TEAM'
      ? { teamId: session.id }
      : { adminId: session.id };

  try {
    const notifications = await prisma.notification.findMany({
      where,
      include: {
        emergency: {
          include: { assignedTeam: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json(
      { notifications },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    );
  } catch {
    return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 });
  }
}