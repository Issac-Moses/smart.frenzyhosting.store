import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminDashboardClient } from '@/components/AdminDashboardClient';

export default async function AdminDashboardPage() {
  await requireSession(['ADMIN']);

  const [emergencies, teams, resources] = await Promise.all([
    prisma.emergency.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: true, assignedTeam: true },
    }),
    prisma.rescueTeam.findMany({
      orderBy: { name: 'asc' },
    }),
    prisma.resource.findMany({
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-600">Admin portal</p>
            <h1 className="text-3xl font-bold text-slate-900">Emergency command dashboard</h1>
          </div>
          <form action="/api/logout" method="post">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Logout</button>
          </form>
        </div>

        <AdminDashboardClient
          emergencies={emergencies.map((emergency) => ({
            id: emergency.id,
            emergencyType: emergency.emergencyType,
            locationLabel: emergency.locationLabel ?? 'Tamil Nadu',
            status: emergency.status,
            priority: emergency.priority,
            latitude: emergency.latitude,
            longitude: emergency.longitude,
            createdAt: emergency.createdAt.toISOString(),
            user: emergency.user ? { name: emergency.user.name } : null,
            assignedTeam: emergency.assignedTeam ? { name: emergency.assignedTeam.name } : null,
          }))}
          teams={teams.map((team) => ({
            id: team.id,
            name: team.name,
            latitude: team.latitude,
            longitude: team.longitude,
            availabilityStatus: team.availabilityStatus,
            contactInfo: team.contactInfo,
            teamCode: team.teamCode,
            baseLocation: team.baseLocation,
            membersCount: team.membersCount,
            capabilities: team.capabilities,
          }))}
          resources={resources.map((resource) => ({
            id: resource.id,
            resourceId: resource.resourceId,
            name: resource.name,
            quantity: resource.quantity,
            availableQuantity: resource.availableQuantity,
            latitude: resource.latitude,
            longitude: resource.longitude,
            status: resource.status,
            category: resource.category,
          }))}
        />
      </div>
    </main>
  );
}
