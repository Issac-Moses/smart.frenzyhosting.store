'use client';

import { FormEvent, useState } from 'react';

export function LoginForm() {
  const [role, setRole] = useState<'USER' | 'ADMIN' | 'RESCUE_TEAM'>('USER');
  const [email, setEmail] = useState('user@example.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, email, password }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Login failed');
      return;
    }

    window.location.href = data.redirect;
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-600">Emergency access</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900">Sign in to the dashboard</h2>
      </div>
      <form className="space-y-5" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as 'USER' | 'ADMIN' | 'RESCUE_TEAM')}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none ring-0 transition focus:border-rose-500"
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            <option value="RESCUE_TEAM">Rescue Team</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-rose-500"
            placeholder="name@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none transition focus:border-rose-500"
            placeholder="••••••••"
          />
        </div>

        {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-rose-600 px-4 py-3 font-semibold text-white shadow hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-slate-900">Demo accounts</p>
        <ul className="mt-2 space-y-1">
          <li>USER: user@example.com / password123</li>
          <li>ADMIN: admin@rescue.com / admin123</li>
          <li>RESCUE TEAM: team-a@rescue.com / team123</li>
        </ul>
      </div>
    </div>
  );
}
