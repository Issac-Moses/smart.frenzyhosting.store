'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MapMarker } from '@/components/MapPanel';
import { calculateDistanceKm, formatDistanceKm } from '@/lib/distance';

const MapPanel = dynamic(
  () => import('@/components/MapPanel').then((module) => module.MapPanel),
  { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-2xl bg-slate-100" /> },
);

type Team = {
  id: string;
  teamCode: string;
  name: string;
  baseLocation: string;
  membersCount: number;
  latitude: number;
  longitude: number;
  availabilityStatus: string;
  contactInfo: string;
  capabilities: string;
  availableEquipment: string;
  currentAssignment?: string | null;
};

type Emergency = {
  id: string;
  emergencyType: string;
  locationLabel: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  status: string;
  priority: string;
  createdAt: string;
  user?: { name: string; email: string } | null;
  resources?: Array<{ id: string; name: string; quantity: number }>;
};

type Assignment = { id: string; status: string; reason?: string | null; assignedAt: string };
type HistoryItem = { id: string; status: string; reason?: string | null; assignedAt: string; emergencyType: string; locationLabel: string };
type Notification = { id: string; type: string; message: string; createdAt: string };

const activeAssignmentStatuses = ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'ARRIVED'];
const statusColors: Record<string, string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-800', BUSY: 'bg-amber-100 text-amber-800', OFFLINE: 'bg-slate-200 text-slate-700',
};
const priorityColors: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700', MEDIUM: 'bg-sky-100 text-sky-800', HIGH: 'bg-amber-100 text-amber-900', CRITICAL: 'bg-rose-100 text-rose-900',
};

export function RescueTeamDashboardClient({
  team: initialTeam,
  emergency,
  assignment,
  assignmentHistory,
}: {
  team: Team;
  emergency: Emergency | null;
  assignment: Assignment | null;
  assignmentHistory: HistoryItem[];
}) {
  const router = useRouter();
  const [team, setTeam] = useState(initialTeam);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [locationBusy, setLocationBusy] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('ALL');

  const loadNotifications = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const nextNotifications = (data.notifications ?? []) as Notification[];
      setNotifications((current) => current.length === nextNotifications.length && current.every((item, index) => item.id === nextNotifications[index]?.id)
        ? current
        : nextNotifications);
    } catch {
      // Preserve the last notifications while the network is unavailable.
    }
  }, []);

  useEffect(() => {
    const firstLoad = window.setTimeout(() => void loadNotifications(), 0);
    const notificationsTimer = window.setInterval(loadNotifications, 8000);
    const refreshTimer = window.setInterval(() => router.refresh(), 15000);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(notificationsTimer);
      window.clearInterval(refreshTimer);
    };
  }, [loadNotifications, router]);

  const distance = useMemo(() => emergency
    ? formatDistanceKm(calculateDistanceKm(team.latitude, team.longitude, emergency.latitude, emergency.longitude))
    : 'No active destination', [emergency, team.latitude, team.longitude]);

  const navigationUrl = emergency
    ? `https://www.google.com/maps/dir/?api=1&origin=${team.latitude},${team.longitude}&destination=${emergency.latitude},${emergency.longitude}&travelmode=driving`
    : '#';

  const mapMarkers = useMemo<MapMarker[]>(() => {
    const markers: MapMarker[] = [{
      id: 'team-location', lat: team.latitude, lng: team.longitude, label: team.name,
      color: '#2563eb', details: `${team.availabilityStatus} · ${team.baseLocation}`,
    }];
    if (emergency) {
      markers.push({
        id: emergency.id, lat: emergency.latitude, lng: emergency.longitude,
        label: `${emergency.emergencyType.replaceAll('_', ' ')} · ${emergency.priority}`,
        color: '#f43f5e', details: `${emergency.locationLabel} · ${emergency.status.replaceAll('_', ' ')}`,
      });
    }
    return markers;
  }, [emergency, team]);

  const route = emergency
    ? [[team.latitude, team.longitude], [emergency.latitude, emergency.longitude]] as [[number, number], [number, number]]
    : null;

  async function assignmentAction(action: 'ACCEPT' | 'START' | 'ARRIVE' | 'COMPLETE' | 'REJECT', reason?: string) {
    if (!assignment) return;
    setBusyAction(action);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/rescue-team/assignments/${assignment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'REJECT' ? { action, reason } : { action }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not update assignment.');
        return;
      }
      if (data.team) {
        setTeam((current) => ({ ...current, ...data.team }));
      }
      setMessage(data.message ?? 'Assignment updated.');
      setRejectOpen(false);
      setRejectReason('');
      await loadNotifications();
      router.refresh();
    } catch {
      setError('Network error while updating the assignment. Try again.');
    } finally {
      setBusyAction('');
    }
  }

  async function updateAvailability() {
    const nextStatus = team.availabilityStatus === 'OFFLINE' ? 'AVAILABLE' : 'OFFLINE';
    setBusyAction('AVAILABILITY');
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/rescue-team/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'AVAILABILITY', availabilityStatus: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'Could not update availability.');
        return;
      }
      setTeam((current) => ({ ...current, availabilityStatus: data.team.availabilityStatus }));
      setMessage(`Team status changed to ${data.team.availabilityStatus}.`);
      router.refresh();
    } catch {
      setError('Network error while updating team status.');
    } finally {
      setBusyAction('');
    }
  }

  function updateTeamGps() {
    setError('');
    setMessage('');
    if (!navigator.geolocation) {
      setError('This browser does not support GPS location.');
      return;
    }
    setLocationBusy(true);
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await fetch('/api/rescue-team/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'LOCATION', latitude: position.coords.latitude, longitude: position.coords.longitude }),
        });
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? 'Could not update team location.');
          return;
        }
        setTeam((current) => ({ ...current, latitude: data.team.latitude, longitude: data.team.longitude }));
        setMessage('Team location updated from GPS.');
        router.refresh();
      } catch {
        setError('Network error while updating GPS location.');
      } finally {
        setLocationBusy(false);
      }
    }, (positionError) => {
      setError(positionError.code === positionError.PERMISSION_DENIED
        ? 'Location permission was denied. Allow it in browser settings, then retry.'
        : 'Could not get GPS location. Move outdoors and try again.');
      setLocationBusy(false);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }

  const filteredHistory = historyFilter === 'ALL'
    ? assignmentHistory
    : assignmentHistory.filter((item) => item.status === historyFilter);
  const completedCount = assignmentHistory.filter((item) => item.status === 'COMPLETED').length;
  const declinedCount = assignmentHistory.filter((item) => item.status === 'REJECTED').length;
  const isActive = Boolean(assignment && activeAssignmentStatuses.includes(assignment.status));
  const displayedAvailability = isActive ? 'BUSY' : team.availabilityStatus;
  const actionButton = (action: 'START' | 'ARRIVE' | 'COMPLETE', label: string, style: string) => (
    <button type="button" onClick={() => assignmentAction(action)} disabled={busyAction !== ''} className={`rounded-xl px-4 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${style}`}>
      {busyAction === action ? 'Updating…' : label}
    </button>
  );

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">Rescue operations</p><span className="rounded-full border border-white/20 px-2 py-0.5 text-[11px] font-bold text-slate-200">{team.teamCode}</span></div>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">{team.name}</h2>
            <p className="mt-2 text-sm text-slate-300">{team.baseLocation} · {team.membersCount} responders</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-2 text-xs font-black uppercase tracking-wide ${statusColors[displayedAvailability] ?? statusColors.OFFLINE}`}>{displayedAvailability}</span>
            <button type="button" onClick={updateAvailability} disabled={busyAction !== '' || isActive || (team.availabilityStatus !== 'OFFLINE' && team.availabilityStatus !== 'AVAILABLE')} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15 disabled:opacity-50">
              {isActive ? 'Finish active assignment first' : busyAction === 'AVAILABILITY' ? 'Updating…' : team.availabilityStatus === 'OFFLINE' ? 'Go available' : 'Go offline'}
            </button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Current assignment" value={isActive ? '1 active' : 'None'} color="rose" />
        <Metric label="Completed rescues" value={String(completedCount)} color="emerald" />
        <Metric label="Declined requests" value={String(declinedCount)} color="amber" />
        <Metric label="Dispatch distance" value={distance} color="sky" />
      </div>

      {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}

      {emergency && assignment && isActive ? (
        <section className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${emergency.priority === 'CRITICAL' ? 'border-rose-300 ring-2 ring-rose-100' : 'border-rose-200'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-rose-700 to-red-600 px-5 py-4 text-white md:px-6">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-100">Live dispatch · {assignment.status.replaceAll('_', ' ')}</p><h3 className="mt-1 text-xl font-black">Rescue request assigned to your team</h3></div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase ${priorityColors[emergency.priority] ?? priorityColors.MEDIUM}`}>{emergency.priority} priority</span>
          </div>
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_0.9fr] md:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-black uppercase text-rose-800">{emergency.emergencyType.replaceAll('_', ' ')}</span><span className="text-xs text-slate-500">Request {emergency.id.slice(-8)}</span></div>
              <h4 className="mt-3 text-2xl font-black text-slate-950">{emergency.locationLabel}</h4>
              <p className="mt-1 font-mono text-sm text-slate-500">{emergency.latitude.toFixed(5)}, {emergency.longitude.toFixed(5)}</p>
              <p className="mt-3 text-sm leading-6 text-slate-700">{emergency.description || 'No additional caller details were provided.'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoTile label="Caller" value={emergency.user?.name ?? 'Caller details unavailable'} />
                <InfoTile label="Distance from team" value={distance} />
                <InfoTile label="Dispatch time" value={new Date(assignment.assignedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} />
                <InfoTile label="Recommended equipment" value={team.availableEquipment} />
              </div>
              {emergency.resources?.length ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-800">Equipment allocated to this incident</p><div className="mt-2 flex flex-wrap gap-2">{emergency.resources.map((resource) => <span key={resource.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-950">{resource.name} × {resource.quantity}</span>)}</div></div> : null}
              {assignment.reason ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"><strong>Dispatch note:</strong> {assignment.reason}</p> : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <a href={navigationUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white hover:bg-blue-700">Open navigation ↗</a>
                {emergency.user?.email ? <a href={`mailto:${emergency.user.email}`} className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50">Contact caller</a> : null}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {assignment.status === 'PENDING' ? <>
                  <button type="button" onClick={() => assignmentAction('ACCEPT')} disabled={busyAction !== ''} className="rounded-xl bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{busyAction === 'ACCEPT' ? 'Accepting…' : 'Accept dispatch'}</button>
                  <button type="button" onClick={() => setRejectOpen(true)} disabled={busyAction !== ''} className="rounded-xl border border-rose-200 bg-white px-4 py-3 font-bold text-rose-700 hover:bg-rose-50">Decline with reason</button>
                </> : null}
                {assignment.status === 'ACCEPTED' ? actionButton('START', 'Start rescue', 'bg-emerald-600 text-white hover:bg-emerald-700') : null}
                {assignment.status === 'IN_PROGRESS' ? actionButton('ARRIVE', 'Mark arrived', 'bg-blue-600 text-white hover:bg-blue-700') : null}
                {assignment.status === 'ARRIVED' ? actionButton('COMPLETE', 'Complete rescue', 'bg-emerald-600 text-white hover:bg-emerald-700') : null}
              </div>
              <ProgressSteps status={assignment.status} />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Live map</p><p className="font-bold text-slate-900">Team to emergency location</p></div><a href={navigationUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-blue-700 hover:underline">Navigate ↗</a></div>
              <MapPanel center={[team.latitude, team.longitude]} zoom={8} emergencyMarkers={mapMarkers} teamMarkers={[]} resourceMarkers={[]} route={route} />
              <p className="mt-2 text-xs text-slate-500">Blue marker: team base/current GPS · Red marker: emergency location. Route line is approximate; follow official navigation and local instructions.</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✓</span><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Standby status</p><h3 className="mt-1 text-xl font-bold text-slate-950">{team.availabilityStatus === 'OFFLINE' ? 'Your team is offline' : 'No active dispatch right now'}</h3><p className="mt-1 text-sm text-slate-600">Dispatch alerts appear here automatically. Keep your availability and location current.</p></div></div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-700">Team readiness</p><h3 className="mt-1 text-xl font-bold text-slate-950">Location & capabilities</h3></div><button type="button" onClick={updateTeamGps} disabled={locationBusy} className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-50">{locationBusy ? 'Updating GPS…' : '◎ Update GPS location'}</button></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoTile label="Current position" value={`${team.latitude.toFixed(5)}, ${team.longitude.toFixed(5)}`} />
            <InfoTile label="Base station" value={team.baseLocation} />
            <InfoTile label="Team contact" value={team.contactInfo} />
            <InfoTile label="Team members" value={`${team.membersCount} responders`} />
          </div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Capabilities</p><p className="mt-1 text-sm leading-6 text-slate-800">{team.capabilities}</p></div>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Equipment on team</p><p className="mt-1 text-sm leading-6 text-slate-800">{team.availableEquipment}</p></div>
          {team.availabilityStatus === 'BUSY' && !isActive ? <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This team is marked busy by another active assignment.</p> : null}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-live="polite">
          <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">Dispatch channel</p><h3 className="mt-1 text-xl font-bold text-slate-950">Team alerts</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Live · 8 sec refresh</span></div>
          {notifications.length ? <div className="max-h-[440px] space-y-2 overflow-auto">{notifications.map((notification) => <article key={notification.id} className={`rounded-xl border p-3 text-sm ${notification.type.includes('DECLINED') ? 'border-amber-200 bg-amber-50' : 'border-rose-100 bg-rose-50/70'}`}><div className="flex items-center justify-between gap-2"><p className="font-bold text-slate-900">{notification.type.replaceAll('_', ' ')}</p><time className="shrink-0 text-[11px] text-slate-500">{new Date(notification.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</time></div><p className="mt-1 text-slate-700">{notification.message}</p></article>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-800">No new dispatch alerts</p><p className="mt-1 text-sm text-slate-500">New assignments and coordination updates will show here.</p></div>}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Operations log</p><h3 className="mt-1 text-xl font-bold text-slate-950">Assignment history</h3></div><select aria-label="Filter assignment history" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"><option value="ALL">All assignments</option><option value="PENDING">Pending</option><option value="ACCEPTED">Accepted</option><option value="IN_PROGRESS">In progress</option><option value="ARRIVED">Arrived</option><option value="COMPLETED">Completed</option><option value="REJECTED">Declined</option></select></div>
        {filteredHistory.length ? <div className="space-y-2">{filteredHistory.slice(0, 30).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3"><div><p className="font-semibold text-slate-900">{item.emergencyType.replaceAll('_', ' ')} · {item.locationLabel}</p><p className="mt-1 text-xs text-slate-500">{new Date(item.assignedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p>{item.reason ? <p className="mt-1 text-xs text-slate-600">{item.reason}</p> : null}</div><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : item.status === 'REJECTED' ? 'bg-slate-200 text-slate-700' : 'bg-sky-100 text-sky-800'}`}>{item.status.replaceAll('_', ' ')}</span></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No assignments match this filter.</p>}
      </section>

      {rejectOpen ? <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busyAction) setRejectOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="reject-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-700">Dispatch response</p><h3 id="reject-title" className="mt-1 text-2xl font-black text-slate-950">Decline this assignment?</h3><p className="mt-2 text-sm text-slate-600">A reason is required so the control room can find another suitable team.</p><label htmlFor="reject-reason" className="mt-4 block text-sm font-semibold text-slate-700">Reason</label><textarea id="reject-reason" rows={4} maxLength={500} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="For example: team is outside operational area or required capability unavailable" className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100"/><p className="mt-1 text-right text-xs text-slate-400">{rejectReason.length}/500</p><div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setRejectOpen(false)} disabled={Boolean(busyAction)} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700">Keep assignment</button><button type="button" onClick={() => assignmentAction('REJECT', rejectReason)} disabled={rejectReason.trim().length < 3 || Boolean(busyAction)} className="rounded-xl bg-rose-600 px-4 py-3 font-bold text-white disabled:opacity-50">{busyAction === 'REJECT' ? 'Declining…' : 'Decline and notify control room'}</button></div></section></div> : null}
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color: 'rose' | 'emerald' | 'amber' | 'sky' }) {
  const colors = { rose: 'bg-rose-50 text-rose-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', sky: 'bg-sky-50 text-sky-800' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${colors[color]}`}>{label}</span><p className="mt-3 text-xl font-black text-slate-950">{value}</p></div>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-slate-50 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p></div>;
}

function ProgressSteps({ status }: { status: string }) {
  const steps = ['ACCEPTED', 'IN_PROGRESS', 'ARRIVED', 'COMPLETED'];
  const activeIndex = status === 'PENDING' ? -1 : steps.indexOf(status);
  return <div className="mt-6"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Response progress</p><div className="grid grid-cols-4 gap-1">{steps.map((step, index) => <div key={step} className="text-center"><div className={`h-1.5 rounded-full ${index <= activeIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} /><p className={`mt-2 text-[9px] font-bold uppercase sm:text-[10px] ${index <= activeIndex ? 'text-emerald-800' : 'text-slate-400'}`}>{step.replaceAll('_', ' ')}</p></div>)}</div></div>;
}
