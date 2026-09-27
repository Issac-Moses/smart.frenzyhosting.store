import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserDashboardClient } from '@/components/UserDashboardClient';

export default async function UserDashboardPage() {
  const session = await requireSession(['USER']);

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: {
      emergencies: {
        orderBy: { createdAt: 'desc' },
        include: { assignedTeam: true },
      },
    },
  });

  if (!user) {
    return <div className="p-8 text-red-600">User not found.</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-rose-600">Dashboard</p>
            <h1 className="text-3xl font-bold text-slate-900">User emergency portal</h1>
          </div>
          <form action="/api/logout" method="post">
            <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50">Logout</button>
          </form>
        </div>

        <UserDashboardClient
          initialUser={{ id: user.id, name: user.name, email: user.email }}
          initialEmergencies={user.emergencies.map((emergency) => ({
            id: emergency.id,
            emergencyType: emergency.emergencyType,
            locationLabel: emergency.locationLabel ?? 'Location not specified',
            status: emergency.status,
            latitude: emergency.latitude,
            longitude: emergency.longitude,
            createdAt: emergency.createdAt.toISOString(),
            description: emergency.description,
            assignedTeam: emergency.assignedTeam ? { name: emergency.assignedTeam.name } : null,
            priority: emergency.priority,
          }))}
        />
      </div>
    </main>
  );
}
