import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notification';

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ emergencyId: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'USER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { emergencyId } = await context.params;
  const emergency = await prisma.emergency.findFirst({
    where: { id: emergencyId, userId: session.id },
  });
  if (!emergency) {
    return NextResponse.json({ error: 'Emergency request not found' }, { status: 404 });
  }
  if (emergency.assignedTeamId || !['NEW', 'ANALYZING'].includes(emergency.status)) {
    return NextResponse.json({ error: 'This request can no longer be cancelled. Contact the assigned rescue team or admin.' }, { status: 409 });
  }

  try {
    const updated = await prisma.emergency.update({
      where: { id: emergency.id },
      data: { status: 'CANCELLED' },
    });
    await createNotification({
      type: 'EMERGENCY_CANCELLED',
      message: `User cancelled their ${emergency.emergencyType.replaceAll('_', ' ')} request (${emergency.locationLabel ?? 'location not specified'}).`,
      userId: session.id,
      emergencyId: emergency.id,
    });
    const admin = await prisma.admin.findFirst();
    if (admin) {
      await createNotification({
        type: 'EMERGENCY_CANCELLED',
        message: `User cancelled emergency ${emergency.id}.`,
        adminId: admin.id,
        emergencyId: emergency.id,
      });
    }
    return NextResponse.json({ ok: true, emergency: updated });
  } catch {
    return NextResponse.json({ error: 'Could not cancel emergency request' }, { status: 500 });
  }
}