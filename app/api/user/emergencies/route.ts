import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== 'USER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const emergencies = await prisma.emergency.findMany({
      where: { userId: session.id },
      include: { assignedTeam: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ emergencies }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch {
    return NextResponse.json({ error: 'Could not load emergency history' }, { status: 500 });
  }
}