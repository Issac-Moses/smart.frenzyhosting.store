'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MapMarker } from '@/components/MapPanel';
import { tamilNaduLocations } from '@/lib/tamil-nadu-locations';

const MapPanel = dynamic(
  () => import('@/components/MapPanel').then((module) => module.MapPanel),
  {
    ssr: false,
    loading: () => <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />,
  },
);

type Emergency = {
  id: string;
  emergencyType: string;
  status: string;
  priority: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  createdAt: string;
  description?: string | null;
  assignedTeam?: { name?: string } | null;
};

type Notification = { id: string; type: string; message: string; createdAt: string };
type MatchingResult = { recommendation?: { reason?: string; estimatedDistance?: string } } | null;

const emergencyTypes = [
  'Flood', 'Earthquake', 'Landslide', 'Fire', 'Accident', 'Cyclone',
  'Building Collapse', 'Medical Emergency', 'Other',
];

const statusStyle: Record<string, string> = {
  NEW: 'bg-sky-100 text-sky-800',
  ANALYZING: 'bg-amber-100 text-amber-800',
  TEAM_ASSIGNED: 'bg-indigo-100 text-indigo-800',
  RESCUE_IN_PROGRESS: 'bg-rose-100 text-rose-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-slate-200 text-slate-700',
};

export function UserDashboardClient({
  initialUser,
  initialEmergencies,
}: {
  initialUser: { id: string; name: string; email: string };
  initialEmergencies: Emergency[];
}) {
  const router = useRouter();
  const [emergencies, setEmergencies] = useState(initialEmergencies);
  const [emergencyType, setEmergencyType] = useState('Flood');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submittedEmergency, setSubmittedEmergency] = useState<Emergency | null>(null);
  const [matching, setMatching] = useState<MatchingResult>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState('ALL');

  const loadLiveData = useCallback(async () => {
    try {
      const [notificationResponse, emergencyResponse] = await Promise.all([
        fetch('/api/notifications', { cache: 'no-store' }),
        fetch('/api/user/emergencies', { cache: 'no-store' }),
      ]);
      if (notificationResponse.ok) {
        const data = await notificationResponse.json();
        const nextNotifications = (data.notifications ?? []) as Notification[];
        setNotifications((current) => current.length === nextNotifications.length && current.every((item, index) => item.id === nextNotifications[index]?.id)
          ? current
          : nextNotifications);
      }
      if (emergencyResponse.ok) {
        const data = await emergencyResponse.json();
        const nextEmergencies = (data.emergencies ?? []) as Emergency[];
        setEmergencies((current) => current.length === nextEmergencies.length && current.every((item, index) => {
          const next = nextEmergencies[index];
          return item.id === next?.id && item.status === next.status && item.priority === next.priority &&
            item.assignedTeam?.name === next.assignedTeam?.name;
        }) ? current : nextEmergencies);
      }
    } catch {
      // Keep last successful dashboard data while offline.
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadLiveData(), 0);
    const intervalId = window.setInterval(loadLiveData, 10000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(intervalId);
    };
  }, [loadLiveData]);

  const activeCount = emergencies.filter((item) => !['RESOLVED', 'CANCELLED'].includes(item.status)).length;
  const resolvedCount = emergencies.filter((item) => item.status === 'RESOLVED').length;
  const currentEmergency = emergencies.find((item) => !['RESOLVED', 'CANCELLED'].includes(item.status));

  const emergencyMarkers = useMemo<MapMarker[]>(() => {
    const past = emergencies.slice(0, 30).map((item) => ({
      id: item.id,
      lat: item.latitude,
      lng: item.longitude,
      label: `${item.emergencyType.replaceAll('_', ' ')} · ${item.status.replaceAll('_', ' ')}`,
      color: item.status === 'RESOLVED' ? '#10b981' : '#f43f5e',
      details: `${item.locationLabel}${item.assignedTeam ? ` · ${item.assignedTeam.name}` : ''}`,
    }));
    if (location) {
      past.unshift({
        id: 'selected-location',
        lat: location.latitude,
        lng: location.longitude,
        label: 'Selected SOS location',
        color: '#2563eb',
        details: locationLabel || 'Selected map point',
      });
    }
    return past;
  }, [emergencies, location, locationLabel]);

  function useCurrentLocation() {
    setError('');
    setInfo('');
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser. Select a city or tap the map instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationLabel('Current GPS location');
        setLocating(false);
      },
      (positionError) => {
        setError(positionError.code === positionError.PERMISSION_DENIED
          ? 'Location permission was denied. Choose a Tamil Nadu city or click the map to select a location.'
          : 'Could not get your location. Choose a city or click the map to select a location.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  function selectCity(value: string) {
    const place = tamilNaduLocations[Number(value)];
    if (!place) return;
    setLocation({ latitude: place.latitude, longitude: place.longitude });
    setLocationLabel(`${place.city}, ${place.district} district`);
    setError('');
  }

  const selectMapLocation = useCallback((latitude: number, longitude: number) => {
    setLocation({ latitude, longitude });
    setLocationLabel('Pinned map location');
    setError('');
    setInfo('Map pin selected. You can move it again before submitting.');
  }, []);

  function requestSosConfirmation(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!location) {
      setError('Choose a location using GPS, a Tamil Nadu city, or the map before sending SOS.');
      return;
    }
    setConfirmOpen(true);
  }

  async function submitSos() {
    if (!location) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergencyType,
          description,
          latitude: location.latitude,
          longitude: location.longitude,
          locationLabel: `${locationLabel || 'Selected location'}, Tamil Nadu`,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'SOS request failed. Please try again.');
        setConfirmOpen(false);
        return;
      }

      const created = data.emergency as Emergency;
      setSubmittedEmergency(created);
      setMatching(data.matching);
      setEmergencies((previous) => [created, ...previous.filter((item) => item.id !== created.id)]);
      setDescription('');
      setInfo('SOS submitted. Your request status will update automatically.');
      setConfirmOpen(false);
      await loadLiveData();
      router.refresh();
    } catch {
      setError('Network error while sending SOS. Check your connection and try again.');
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  }

  async function cancelEmergency(emergencyId: string) {
    setCancellingId(emergencyId);
    setError('');
    setInfo('');
    try {
      const response = await fetch(`/api/user/emergencies/${emergencyId}`, { method: 'PATCH' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? 'This request can no longer be cancelled.');
        return;
      }
      setInfo('Emergency request cancelled.');
      await loadLiveData();
      router.refresh();
    } catch {
      setError('Network error while cancelling. Please try again.');
    } finally {
      setCancellingId(null);
    }
  }

  const filteredHistory = historyFilter === 'ALL'
    ? emergencies
    : emergencies.filter((item) => item.status === historyFilter);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-slate-950 via-slate-900 to-rose-950 p-6 text-white shadow-xl md:p-8">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-rose-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-rose-300">Personal safety center</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Hello, {initialUser.name.split(' ')[0]}</h2>
            <p className="mt-2 max-w-xl text-sm text-slate-300">Share an emergency location, send a verified SOS, and follow response updates from one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard label="Active requests" value={activeCount} />
            <SummaryCard label="Resolved" value={resolvedCount} />
          </div>
        </div>
      </section>

      {currentEmergency ? (
        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">!</span>
            <div><p className="font-bold">You have an active request</p><p className="mt-1 text-sm">{currentEmergency.emergencyType.replaceAll('_', ' ')} · {currentEmergency.locationLabel} · {currentEmergency.status.replaceAll('_', ' ')}</p></div>
          </div>
          <a href="#request-history" className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold hover:bg-amber-100">View request</a>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">New emergency</p>
              <h3 className="mt-1 text-2xl font-bold text-slate-950">Request rescue support</h3>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Secure SOS</span>
          </div>

          <form className="space-y-5" onSubmit={requestSosConfirmation}>
            <div>
              <label htmlFor="emergency-type" className="mb-1.5 block text-sm font-semibold text-slate-700">What kind of emergency?</label>
              <select id="emergency-type" value={emergencyType} onChange={(event) => setEmergencyType(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100">
                {emergencyTypes.map((type) => <option key={type}>{type}</option>)}
              </select>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="city-location" className="text-sm font-semibold text-slate-700">Where do you need help?</label>
                <button type="button" onClick={useCurrentLocation} disabled={locating} className="text-xs font-bold text-sky-700 hover:text-sky-900 disabled:opacity-60">
                  {locating ? 'Locating…' : '◎ Use my GPS'}
                </button>
              </div>
              <select id="city-location" defaultValue="" onChange={(event) => selectCity(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100">
                <option value="" disabled>Select a Tamil Nadu town or district</option>
                {tamilNaduLocations.map((place, index) => <option key={`${place.city}-${place.district}`} value={index}>{place.city} — {place.district} district</option>)}
              </select>
              <p className="mt-2 text-xs text-slate-500">Or tap anywhere on the map to place a more precise pin.</p>
            </div>

            <div className={`rounded-2xl border p-4 ${location ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Selected location</p>
                  <p className="mt-1 font-semibold text-slate-900">{location ? locationLabel : 'Choose GPS, a town, or tap the map'}</p>
                  {location ? <p className="mt-1 font-mono text-xs text-slate-600">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</p> : null}
                </div>
                {location ? <button type="button" onClick={() => { setLocation(null); setLocationLabel(''); }} className="text-xs font-semibold text-slate-500 hover:text-rose-700">Clear</button> : null}
              </div>
            </div>

            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-semibold text-slate-700">Helpful details <span className="font-normal text-slate-400">(optional)</span></label>
              <textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={500} placeholder="Landmark, people who need help, or other useful details…" className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />
              <p className="mt-1 text-right text-xs text-slate-400">{description.length}/500</p>
            </div>

            {error ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">{error}</p> : null}
            {info ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">{info}</p> : null}

            <button type="submit" disabled={loading} className="group flex w-full items-center justify-center gap-3 rounded-xl bg-rose-600 px-5 py-4 font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700 focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white/50 text-lg">SOS</span>
              <span>Review emergency request</span>
            </button>
            <p className="text-center text-xs text-slate-500">You’ll review your details before the request is sent.</p>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">Tamil Nadu map</p><h3 className="mt-1 text-xl font-bold text-slate-950">Choose your location</h3></div>
            <div className="flex items-center gap-2 text-xs text-slate-600"><span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Selected <span className="ml-2 h-2.5 w-2.5 rounded-full bg-rose-500" /> My requests</div>
          </div>
          <MapPanel
            center={location ? [location.latitude, location.longitude] : [10.8505, 78.6500]}
            zoom={location ? 10 : 6}
            emergencyMarkers={emergencyMarkers}
            teamMarkers={[]}
            resourceMarkers={[]}
            onMapClick={selectMapLocation}
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Click the map to move the blue SOS pin.</span><span>Map tiles © OpenStreetMap</span></div>
        </section>
      </div>

      {submittedEmergency ? (
        <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Request received</p><h3 className="mt-1 text-2xl font-bold text-emerald-950">Your safety request is in the system</h3></div>
            <StatusBadge status={submittedEmergency.status} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DetailCard label="Emergency" value={submittedEmergency.emergencyType.replaceAll('_', ' ')} />
            <DetailCard label="Location" value={submittedEmergency.locationLabel} />
            <DetailCard label="Coordinates" value={`${submittedEmergency.latitude.toFixed(4)}, ${submittedEmergency.longitude.toFixed(4)}`} />
            <DetailCard label="Rescue team" value={submittedEmergency.assignedTeam?.name ?? 'Awaiting coordination'} />
          </div>
          {matching?.recommendation?.reason ? <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm text-slate-700">{matching.recommendation.reason}</p> : null}
        </section>
      ) : null}

      <section id="request-history" className="scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Your activity</p><h3 className="mt-1 text-xl font-bold text-slate-950">Emergency request history</h3></div>
          <select aria-label="Filter request history" value={historyFilter} onChange={(event) => setHistoryFilter(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="ALL">All requests</option>
            <option value="NEW">New</option><option value="ANALYZING">Analyzing</option><option value="TEAM_ASSIGNED">Team assigned</option><option value="RESCUE_IN_PROGRESS">In progress</option><option value="RESOLVED">Resolved</option><option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {filteredHistory.length ? (
          <div className="space-y-3">
            {filteredHistory.slice(0, 50).map((item) => (
              <article key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-rose-600 shadow-sm">⌖</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-900">{item.emergencyType.replaceAll('_', ' ')}</h4><StatusBadge status={item.status} /><span className="text-xs font-semibold text-slate-500">{item.priority}</span></div>
                    <p className="mt-1 text-sm text-slate-600">{item.locationLabel} · {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</p>
                    <p className="mt-1 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })} · {item.assignedTeam?.name ?? 'No team assigned'}</p>
                  </div>
                </div>
                {['NEW', 'ANALYZING'].includes(item.status) ? (
                  <button type="button" onClick={() => cancelEmergency(item.id)} disabled={cancellingId !== null} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                    {cancellingId === item.id ? 'Cancelling…' : 'Cancel request'}
                  </button>
                ) : null}
              </article>
            ))}
            {filteredHistory.length > 50 ? <p className="text-center text-xs text-slate-500">Showing the latest 50 of {filteredHistory.length} requests.</p> : null}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center"><p className="font-semibold text-slate-800">No requests in this view</p><p className="mt-1 text-sm text-slate-500">Your SOS requests will appear here, with status updates as they progress.</p></div>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-live="polite">
        <div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Live dispatch</p><h3 className="mt-1 text-xl font-bold text-slate-950">Notifications</h3></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">Updates every 10 seconds</span></div>
        {notifications.length ? <div className="grid gap-2 md:grid-cols-2">{notifications.map((notification) => <div key={notification.id} className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm"><p className="font-bold text-emerald-950">{notification.type.replaceAll('_', ' ')}</p><p className="mt-1 text-emerald-900">{notification.message}</p><p className="mt-2 text-xs text-emerald-700">{new Date(notification.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' })}</p></div>)}</div> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No notifications yet.</p>}
      </section>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) setConfirmOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 font-black text-rose-700">SOS</div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-rose-600">Final confirmation</p>
            <h3 id="confirm-title" className="mt-1 text-2xl font-black text-slate-950">Send this emergency request?</h3>
            <p className="mt-2 text-sm text-slate-600">This will notify the coordination team and start rescue matching.</p>
            <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Emergency</dt><dd className="text-right font-bold text-slate-900">{emergencyType}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Location</dt><dd className="text-right font-bold text-slate-900">{locationLabel}</dd></div>
              {location ? <div className="flex justify-between gap-4"><dt className="text-slate-500">Coordinates</dt><dd className="text-right font-mono text-xs text-slate-800">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</dd></div> : null}
              {description ? <div><dt className="text-slate-500">Details</dt><dd className="mt-1 font-medium text-slate-900">{description}</dd></div> : null}
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" disabled={loading} onClick={() => setConfirmOpen(false)} className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50">Go back</button>
              <button type="button" disabled={loading} onClick={submitSos} className="rounded-xl bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:opacity-60">{loading ? 'Sending request…' : 'Confirm and send SOS'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return <div className="min-w-32 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xs text-slate-300">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusStyle[status] ?? 'bg-slate-100 text-slate-700'}`}>{status.replaceAll('_', ' ')}</span>;
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-emerald-100 bg-white p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>;
}
