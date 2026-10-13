import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notification';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACCEPT') }),
  z.object({ action: z.literal('REJECT'), reason: z.string().trim().min(3).max(500) }),
  z.object({ action: z.literal('START') }),
  z.object({ action: z.literal('ARRIVE') }),
  z.object({ action: z.literal('COMPLETE') }),
]);

const validTransitions = {
  ACCEPT: ['PENDING'],
  REJECT: ['PENDING'],
  START: ['ACCEPTED'],
  ARRIVE: ['IN_PROGRESS'],
  COMPLETE: ['ARRIVED', 'IN_PROGRESS'],
} as const;

export async function PATCH(
  request: Request,
  context: { params: Promise<{ assignmentId: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== 'RESCUE_TEAM') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { assignmentId } = await context.params;
  let input: z.infer<typeof actionSchema>;
  try {
    input = actionSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid action' }, { status: 400 });
  }

  const assignment = await prisma.rescueAssignment.findFirst({
    where: { id: assignmentId, teamId: session.id },
    include: { emergency: true, team: true },
  });
  if (!assignment) {
    return NextResponse.json({ error: 'Assignment not found for this rescue team' }, { status: 404 });
  }
  if (!(validTransitions[input.action] as readonly string[]).includes(assignment.status)) {
    return NextResponse.json({ error: `Cannot ${input.action.toLowerCase()} an assignment in ${assignment.status} status` }, { status: 409 });
  }

  const nextAssignmentStatus = {
    ACCEPT: 'ACCEPTED',
    REJECT: 'REJECTED',
    START: 'IN_PROGRESS',
    ARRIVE: 'ARRIVED',
    COMPLETE: 'COMPLETED',
  } as const;
  const action = input.action;
  const nextStatus = nextAssignmentStatus[action];
  const message = action === 'REJECT'
    ? `${assignment.team.name} declined the ${assignment.emergency.emergencyType.replaceAll('_', ' ')} assignment. Reason: ${input.reason}`
    : `${assignment.team.name} updated ${assignment.emergency.emergencyType.replaceAll('_', ' ')} rescue to ${nextStatus.replaceAll('_', ' ')}.`;

  try {
    const updatedAssignment = await prisma.$transaction(async (transaction) => {
      const transition = await transaction.rescueAssignment.updateMany({
        where: { id: assignment.id, teamId: session.id, status: assignment.status },
        data: {
          status: nextStatus,
          ...(action === 'REJECT' ? { reason: input.reason } : {}),
          ...(action === 'ACCEPT' ? { acceptedAt: new Date() } : {}),
          ...(action === 'COMPLETE' ? { completedAt: new Date() } : {}),
        },
      });
      if (transition.count !== 1) {
        throw new Error('ASSIGNMENT_STATE_CHANGED');
      }
      const updated = await transaction.rescueAssignment.findUniqueOrThrow({ where: { id: assignment.id } });

      if (action === 'REJECT') {
        await transaction.emergency.update({
          where: { id: assignment.emergencyId },
          data: { status: 'ANALYZING', assignedTeamId: null },
        });
        const otherActiveAssignment = await transaction.rescueAssignment.findFirst({
          where: {
            teamId: assignment.teamId,
            id: { not: assignment.id },
            status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'] },
          },
        });
        await transaction.rescueTeam.update({
          where: { id: assignment.teamId },
          data: {
            availabilityStatus: otherActiveAssignment ? 'BUSY' : 'AVAILABLE',
            currentAssignment: otherActiveAssignment ? 'Active rescue assignment' : null,
          },
        });
      } else if (action === 'ACCEPT') {
        await transaction.rescueTeam.update({
          where: { id: assignment.teamId },
          data: {
            availabilityStatus: 'BUSY',
            currentAssignment: `${assignment.emergency.emergencyType.replaceAll('_', ' ')} · ${assignment.emergency.locationLabel ?? 'emergency location'}`,
          },
        });
      } else if (action === 'START') {
        await transaction.emergency.update({
          where: { id: assignment.emergencyId },
          data: { status: 'RESCUE_IN_PROGRESS' },
        });
      } else if (action === 'COMPLETE') {
        await transaction.emergency.update({
          where: { id: assignment.emergencyId },
          data: { status: 'RESOLVED' },
        });
        const otherActiveAssignment = await transaction.rescueAssignment.findFirst({
          where: {
            teamId: assignment.teamId,
            id: { not: assignment.id },
            status: { in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'] },
          },
        });
        await transaction.rescueTeam.update({
          where: { id: assignment.teamId },
          data: {
            availabilityStatus: otherActiveAssignment ? 'BUSY' : 'AVAILABLE',
            currentAssignment: otherActiveAssignment ? 'Active rescue assignment' : null,
          },
        });
      }
      return updated;
    });

    if (assignment.emergency.userId) {
      await createNotification({
        type: action === 'REJECT' ? 'TEAM_DECLINED_ASSIGNMENT' : `RESCUE_${nextStatus}`,
        message,
        userId: assignment.emergency.userId,
        emergencyId: assignment.emergencyId,
      });
    }
    const admin = await prisma.admin.findFirst();
    if (admin) {
      await createNotification({
        type: action === 'REJECT' ? 'TEAM_DECLINED_ASSIGNMENT' : `RESCUE_${nextStatus}`,
        message,
        adminId: admin.id,
        emergencyId: assignment.emergencyId,
      });
    }

    const updatedTeam = await prisma.rescueTeam.findUnique({
      where: { id: assignment.teamId },
      select: { id: true, availabilityStatus: true, currentAssignment: true },
    });

    return NextResponse.json({ ok: true, assignment: updatedAssignment, team: updatedTeam, message });
  } catch (error) {
    if (error instanceof Error && error.message === 'ASSIGNMENT_STATE_CHANGED') {
      return NextResponse.json({ error: 'Another update changed this assignment. Refresh and try again.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Could not update rescue assignment' }, { status: 500 });
  }
}