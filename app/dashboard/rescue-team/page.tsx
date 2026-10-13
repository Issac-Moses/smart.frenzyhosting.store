import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RescueTeamDashboardClient } from '@/components/RescueTeamDashboardClient';

export default async function RescueTeamDashboardPage() {
  const session = await requireSession(['RESCUE_TEAM']);

  const team = await prisma.rescueTeam.findUnique({
    where: { id: session.id },
    include: {
      rescueAssignments: {
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          emergency: {
            include: {
              user: { select: { name: true, email: true } },
              resourceAssignments: { include: { resource: { select: { name: true, resourceId: true } } } },
            },
          },
        },
      },
    },
  });

  if (!team) {
    return <div className="p-8 text-red-600">Rescue team not found.</div>;
  }

  const activeAssignment = team.rescueAssignments.find((assignment) => ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'].includes(assignment.status));
  const emergency = activeAssignment ? activeAssignment.emergency : null;

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-600">Command</p>
            <h1 className="text-3xl font-bold text-slate-900">Rescue team operations</h1>
          </div>
          <form action="/api/logout" method="post">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Logout</button>
          </form>
        </div>

        <RescueTeamDashboardClient
          team={{
            id: team.id,
            teamCode: team.teamCode,
            name: team.name,
            baseLocation: team.baseLocation,
            membersCount: team.membersCount,
            latitude: team.latitude,
            longitude: team.longitude,
            availabilityStatus: team.availabilityStatus,
            contactInfo: team.contactInfo,
            capabilities: team.capabilities,
            availableEquipment: team.availableEquipment,
            currentAssignment: team.currentAssignment,
          }}
          emergency={emergency ? {
            id: emergency.id,
            emergencyType: emergency.emergencyType,
            locationLabel: emergency.locationLabel ?? 'Location not specified',
            latitude: emergency.latitude,
            longitude: emergency.longitude,
            description: emergency.description,
            status: emergency.status,
            priority: emergency.priority,
            createdAt: emergency.createdAt.toISOString(),
            user: emergency.user ? { name: emergency.user.name, email: emergency.user.email } : null,
            resources: emergency.resourceAssignments.map((item) => ({ id: item.resource.resourceId, name: item.resource.name, quantity: item.quantity })),
          } : null}
          assignment={activeAssignment ? { id: activeAssignment.id, status: activeAssignment.status, reason: activeAssignment.reason, assignedAt: activeAssignment.assignedAt.toISOString() } : null}
          assignmentHistory={team.rescueAssignments.map((item) => ({
            id: item.id,
            status: item.status,
            reason: item.reason,
            assignedAt: item.assignedAt.toISOString(),
            emergencyType: item.emergency.emergencyType,
            locationLabel: item.emergency.locationLabel ?? 'Location not specified',
          }))}
        />
      </div>
    </main>
  );
}
