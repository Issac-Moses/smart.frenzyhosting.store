import { LoginForm } from '@/components/LoginForm';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-rose-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-rose-300">Smart RO</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Emergency Rescue Coordination Dashboard</h1>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Active alerts" value="24" accent="rose" />
              <Stat label="Teams online" value="11" accent="sky" />
              <Stat label="Critical events" value="3" accent="amber" />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
              <p className="text-lg font-semibold">Mission overview</p>
              <p className="mt-3 text-slate-200">
                Coordinate rescue requests, validate emergency data, assign nearby teams, and track response status across user, admin, and rescue operations.
              </p>
            </div>
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'rose' | 'sky' | 'amber' }) {
  const palette = {
    rose: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
    sky: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  };

  return (
    <div className={`rounded-2xl border p-4 ${palette[accent]}`}>
      <div className="text-xs uppercase tracking-[0.18em] opacity-80">{label}</div>
      <div className="mt-3 text-3xl font-bold">{value}</div>
    </div>
  );
}
