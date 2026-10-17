'use client';

import dynamic from 'next/dynamic';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MapMarker } from '@/components/MapPanel';
import { tamilNaduLocations } from '@/lib/tamil-nadu-locations';

const MapPanel = dynamic(
  () => import('@/components/MapPanel').then((module) => module.MapPanel),
  {
    ssr: false,
    loading: () => <div className="h-[360px] animate-pulse rounded-2xl bg-slate-100" />,
  },
);

function districtFromLocation(label: string) {
  const districtPart = label.split(',')[1]?.trim();
  return districtPart?.replace(/\s+district$/i, '') || 'Tamil Nadu';
}

export function AdminDashboardClient({
  emergencies,
  teams,
  resources,
}: {
  emergencies: Array<{ id: string; emergencyType: string; locationLabel: string; status: string; priority: string; latitude: number; longitude: number; createdAt: string; user?: { name?: string | null } | null; assignedTeam?: { name?: string | null } | null; }>; 
  teams: Array<{ id: string; name: string; teamCode: string; baseLocation: string; membersCount: number; capabilities: string; latitude: number; longitude: number; availabilityStatus: string; contactInfo: string; }>; 
  resources: Array<{ id: string; resourceId: string; name: string; quantity: number; availableQuantity: number; latitude: number; longitude: number; status: string; category: string; }>;
}) {
  const router = useRouter();
  // --- Enhanced Add Dataset/Resource/Team State ---
  const [addMode, setAddMode] = useState<'resource' | 'team'>('resource');
  const [resourceName, setResourceName] = useState('');
  const [category, setCategory] = useState('Water Rescue');
  const [quantity, setQuantity] = useState(10);
  const [availableQuantity, setAvailableQuantity] = useState(10);
  const [resourceStatus, setResourceStatus] = useState('AVAILABLE');
  const [resourceLocationCity, setResourceLocationCity] = useState('Chennai');
  const [resourceDesc, setResourceDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Team Fields
  const [teamName, setTeamName] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [teamMembers, setTeamMembers] = useState(6);
  const [teamBaseCity, setTeamBaseCity] = useState('Chennai');
  const [teamContact, setTeamContact] = useState('+91 ');
  const [teamCapabilities, setCapabilities] = useState('Flood rescue, boat operations, medical triage');
  const [teamEquipment, setTeamEquipment] = useState('Rescue Boats, Life Jackets, Satellite Comms, First Aid');
  const [teamAccountEmail, setTeamAccountEmail] = useState('');
  const [teamAccountPassword, setTeamAccountPassword] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [geminiCheck, setGeminiCheck] = useState<{ ok: boolean; message: string } | null>(null);
  const [checkingGemini, setCheckingGemini] = useState(false);
  const [matchingEmergencyId, setMatchingEmergencyId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message: string }>>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [districtFilter, setDistrictFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Preset templates for quick selection
  const resourcePresets = [
    { name: 'Inflatable Motorized Rescue Boat', category: 'Water Rescue', qty: 5 },
    { name: 'Heavy Duty Life Jackets (50 pk)', category: 'Water Safety', qty: 50 },
    { name: 'Disaster Relief Ambulance 4x4', category: 'Medical', qty: 2 },
    { name: 'Emergency Surgical First Aid Pack', category: 'Medical', qty: 25 },
    { name: 'Thermal Imaging Recon Drone', category: 'Aerial Support', qty: 4 },
    { name: 'Multi-Channel Tactical Radio', category: 'Communications', qty: 15 },
    { name: 'High-Power Diesel Water Evacuation Pump', category: 'Water Rescue', qty: 6 },
    { name: 'High-Tension Structural Rescue Rope Kit', category: 'Structural Rescue', qty: 20 },
  ];

  function applyResourcePreset(preset: typeof resourcePresets[0]) {
    setResourceName(preset.name);
    setCategory(preset.category);
    setQuantity(preset.qty);
    setAvailableQuantity(preset.qty);
    setResourceDesc(`Emergency deployment ready: ${preset.name} assigned for immediate disaster response.`);
  }

  async function handleAddResource(event: FormEvent) {
    event.preventDefault();
    if (!resourceName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a valid resource name' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    const matchedLoc = tamilNaduLocations.find((l) => l.city === resourceLocationCity) || tamilNaduLocations[0];

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceId: `RES-${Date.now().toString().slice(-6)}`,
          name: resourceName.trim(),
          category,
          quantity: Number(quantity),
          availableQuantity: Number(availableQuantity),
          status: resourceStatus,
          latitude: matchedLoc.latitude,
          longitude: matchedLoc.longitude,
          description: resourceDesc.trim() || `Stationed at ${matchedLoc.city}, ${matchedLoc.district} District`,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Resource "${resourceName}" successfully added and synced into operational inventory!` });
        setResourceName('');
        setResourceDesc('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Resource could not be added' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Connection failed while adding resource.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAddTeam(event: FormEvent) {
    event.preventDefault();
    if (!teamName.trim() || !teamCode.trim()) {
      setMessage({ type: 'error', text: 'Team Name and Unique Team Code are required' });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);

    const matchedLoc = tamilNaduLocations.find((l) => l.city === teamBaseCity) || tamilNaduLocations[0];

    try {
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: teamName.trim(),
          teamCode: teamCode.trim().toUpperCase(),
          baseLocation: `${matchedLoc.city}, Tamil Nadu`,
          membersCount: Number(teamMembers),
          contactInfo: teamContact.trim(),
          capabilities: teamCapabilities.trim(),
          availableEquipment: teamEquipment.trim(),
          latitude: matchedLoc.latitude,
          longitude: matchedLoc.longitude,
          availabilityStatus: 'AVAILABLE',
          accountEmail: teamAccountEmail.trim() || undefined,
          accountPassword: teamAccountPassword || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: `Rescue Team "${teamName}" registered and added to active roster!` });
        setTeamName('');
        setTeamCode('');
        setTeamAccountEmail('');
        setTeamAccountPassword('');
        router.refresh();
      } else {
        setMessage({ type: 'error', text: data.error ?? 'Could not register team' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error while registering rescue team.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function checkGemini() {
    setCheckingGemini(true);
    setGeminiCheck(null);
    try {
      const response = await fetch('/api/admin/gemini-check', { method: 'POST' });
      const result = await response.json();
      setGeminiCheck({
        ok: response.ok && Boolean(result.ok),
        message: result.message ?? result.error ?? 'Gemini check failed.',
      });
    } catch {
      setGeminiCheck({ ok: false, message: 'Could not reach the local Gemini test endpoint.' });
    } finally {
      setCheckingGemini(false);
    }
  }

  async function retryMatching(emergencyId: string) {
    setMatchingEmergencyId(emergencyId);
    setMessage('');
    try {
      const response = await fetch(`/api/admin/emergencies/${emergencyId}/match`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? 'Could not retry emergency matching.');
        return;
      }
      const teamName = result.result?.emergency?.assignedTeam?.name;
      setMessage(teamName ? `Matching complete. Assigned to ${teamName}.` : result.result?.recommendation?.reason ?? 'No team assigned; admin review required.');
      router.refresh();
    } catch {
      setMessage('Network error while retrying emergency matching.');
    } finally {
      setMatchingEmergencyId(null);
    }
  }

  const districts = useMemo(() => Array.from(new Set(emergencies.map((item) => districtFromLocation(item.locationLabel)))).sort(), [emergencies]);

  const filteredEmergencies = useMemo(() => emergencies.filter((emergency) => {
    const district = districtFromLocation(emergency.locationLabel);
    const matchesSearch = `${emergency.id} ${emergency.user?.name ?? ''} ${emergency.locationLabel} ${emergency.assignedTeam?.name ?? ''}`
      .toLowerCase()
      .includes(search.trim().toLowerCase());
    return matchesSearch &&
      (typeFilter === 'ALL' || emergency.emergencyType === typeFilter) &&
      (statusFilter === 'ALL' || emergency.status === statusFilter) &&
      (districtFilter === 'ALL' || district === districtFilter);
  }), [districtFilter, emergencies, search, statusFilter, typeFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredEmergencies.length / pageSize));
  const pageEmergencies = filteredEmergencies.slice((page - 1) * pageSize, page * pageSize);
  const typeBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const emergency of emergencies) {
      counts.set(emergency.emergencyType, (counts.get(emergency.emergencyType) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  }, [emergencies]);

  const mapEmergencyMarkers = useMemo<MapMarker[]>(() => filteredEmergencies.slice(0, 250).map((emergency) => ({
    id: emergency.id,
    lat: emergency.latitude,
    lng: emergency.longitude,
    label: `${emergency.emergencyType} / ${emergency.status}`,
    color: '#ef4444',
    details: `User: ${emergency.user?.name ?? 'Unknown'} / Priority: ${emergency.priority}`,
  })), [filteredEmergencies]);

  const mapTeamMarkers = useMemo<MapMarker[]>(() => teams.map((team) => ({
    id: team.id,
    lat: team.latitude,
    lng: team.longitude,
    label: team.name,
    color: team.availabilityStatus === 'AVAILABLE' ? '#22c55e' : '#f59e0b',
    details: `${team.availabilityStatus} · ${team.contactInfo}`,
  })), [teams]);

  const mapResourceMarkers = useMemo<MapMarker[]>(() => resources.map((resource) => ({
    id: resource.id,
    lat: resource.latitude,
    lng: resource.longitude,
    label: `${resource.name} (${resource.availableQuantity})`,
    color: '#8b5cf6',
    details: `${resource.category} / ${resource.status}`,
  })), [resources]);

  const stats = {
    activeEmergencies: emergencies.filter((item) => item.status !== 'RESOLVED' && item.status !== 'CANCELLED').length,
    availableTeams: teams.filter((team) => team.availabilityStatus === 'AVAILABLE').length,
    busyTeams: teams.filter((team) => team.availabilityStatus === 'BUSY').length,
    availableResources: resources.filter((item) => item.status === 'AVAILABLE').length,
    resourcesInUse: resources.filter((item) => item.status === 'IN_USE').length,
    resolvedEmergencies: emergencies.filter((item) => item.status === 'RESOLVED').length,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Active Emergencies" value={String(stats.activeEmergencies)} accent="rose" />
        <StatCard label="Available Teams" value={String(stats.availableTeams)} accent="green" />
        <StatCard label="Busy Teams" value={String(stats.busyTeams)} accent="amber" />
        <StatCard label="Available Resources" value={String(stats.availableResources)} accent="sky" />
        <StatCard label="Resources in Use" value={String(stats.resourcesInUse)} accent="violet" />
        <StatCard label="Resolved Emergencies" value={String(stats.resolvedEmergencies)} accent="emerald" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Tamil Nadu coverage</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">{emergencies.length.toLocaleString()} recorded emergency events</h3>
            <p className="mt-1 text-sm text-slate-500">{teams.length} response teams · {resources.length} resource entries · {districts.length} districts represented</p>
          </div>
          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
            <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Filtered results</div>
            <div className="mt-1 text-2xl font-bold text-sky-950">{filteredEmergencies.length.toLocaleString()}</div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {districts.slice(0, 8).map((district) => {
            const count = emergencies.filter((item) => districtFromLocation(item.locationLabel) === district).length;
            return (
              <button key={district} type="button" onClick={() => { setDistrictFilter(district); setPage(1); }} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-sky-300">
                <span className="text-sm font-medium text-slate-700">{district}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-800">{count}</span>
              </button>
            );
          })}
        </div>
        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-800">View all {districts.length} districts and emergency-type totals</summary>
          <div className="mt-4 grid gap-5 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">District coverage</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {districts.map((district) => {
                  const count = emergencies.filter((item) => districtFromLocation(item.locationLabel) === district).length;
                  return <button key={district} type="button" onClick={() => { setDistrictFilter(district); setPage(1); }} className="flex justify-between rounded-lg bg-white px-3 py-2 text-left text-sm hover:ring-1 hover:ring-sky-300"><span>{district}</span><strong>{count}</strong></button>;
                })}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Emergency types</h4>
              <div className="space-y-2">
                {typeBreakdown.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 text-slate-700">{type.replaceAll('_', ' ')}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.max(2, (count / emergencies.length) * 100)}%` }} /></div>
                    <strong className="w-10 text-right text-slate-800">{count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </details>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">Emergency requests</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">Showing {pageEmergencies.length} of {filteredEmergencies.length}</span>
          </div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <input aria-label="Search emergencies" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search ID, user, team, location" className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
            <select aria-label="Filter emergency type" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value="ALL">All emergency types</option>
              {Array.from(new Set(emergencies.map((item) => item.emergencyType))).sort().map((type) => <option key={type}>{type}</option>)}
            </select>
            <select aria-label="Filter emergency status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value="ALL">All statuses</option>
              {Array.from(new Set(emergencies.map((item) => item.status))).sort().map((status) => <option key={status}>{status}</option>)}
            </select>
            <select aria-label="Filter district" value={districtFilter} onChange={(event) => { setDistrictFilter(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
              <option value="ALL">All Tamil Nadu districts</option>
              {districts.map((district) => <option key={district}>{district}</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {pageEmergencies.map((emergency) => (
              <div key={emergency.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900">{emergency.user?.name ?? 'Unknown user'}</div>
                    <div className="text-sm text-slate-600">{emergency.emergencyType}</div>
                  </div>
                  <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-medium text-rose-700">{emergency.status}</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                  <div>Location: {emergency.locationLabel} · {emergency.latitude.toFixed(4)}, {emergency.longitude.toFixed(4)}</div>
                  <div>Priority: {emergency.priority}</div>
                  <div>Assigned: {emergency.assignedTeam?.name ?? 'Unassigned'}</div>
                </div>
                {!emergency.assignedTeam && emergency.status !== 'RESOLVED' && emergency.status !== 'CANCELLED' ? (
                  <button
                    type="button"
                    onClick={() => retryMatching(emergency.id)}
                    disabled={matchingEmergencyId !== null}
                    className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-60"
                  >
                    {matchingEmergencyId === emergency.id ? 'Matching...' : 'Retry team matching'}
                  </button>
                ) : null}
              </div>
            ))}
            {!pageEmergencies.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No emergencies match those filters.</p> : null}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500">Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40">Previous</button>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page >= pageCount} className="rounded-lg border border-slate-200 px-3 py-1.5 font-medium disabled:opacity-40">Next</button>
            </div>
          </div>
        </div>

        {/* --- PREMIUM ADD DATASET & RESOURCE/TEAM MANAGEMENT PANEL --- */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <span className="inline-block rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800 uppercase tracking-wider">
                Admin Command Provisioning
              </span>
              <h3 className="text-xl font-bold text-slate-900 mt-1">Add Operational Data</h3>
              <p className="text-xs text-slate-500">Deploy rescue equipment or commission new rapid response teams.</p>
            </div>
            
            {/* Toggle Modes */}
            <div className="flex rounded-xl bg-slate-100 p-1 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => { setAddMode('resource'); setMessage(null); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  addMode === 'resource' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📦 Add Resource</span>
              </button>
              <button
                type="button"
                onClick={() => { setAddMode('team'); setMessage(null); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  addMode === 'team' ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>👥 Add Rescue Team</span>
              </button>
            </div>
          </div>

          {/* Quick presets for Resources */}
          {addMode === 'resource' && (
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quick Preset Templates</label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {resourcePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyResourcePreset(preset)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-sky-300 hover:bg-sky-50 transition"
                  >
                    + {preset.name.split(' ')[0]} {preset.name.split(' ')[1] || ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* FORM: Add Resource */}
          {addMode === 'resource' && (
            <form className="mt-5 space-y-4" onSubmit={handleAddResource}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Resource Name *</label>
                <input
                  value={resourceName}
                  onChange={(event) => setResourceName(event.target.value)}
                  placeholder="e.g., Inflatable Motorized Rescue Boat"
                  required
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium focus:border-sky-500 focus:bg-white focus:outline-none transition"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  >
                    <option value="Water Rescue">Water Rescue</option>
                    <option value="Water Safety">Water Safety</option>
                    <option value="Medical">Medical / Health</option>
                    <option value="Aerial Support">Aerial Support / Drones</option>
                    <option value="Structural Rescue">Structural Rescue</option>
                    <option value="Communications">Communications & Radio</option>
                    <option value="Transport">Emergency Transport</option>
                    <option value="Fire Response">Fire Response</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deploy Station / District</label>
                  <select
                    value={resourceLocationCity}
                    onChange={(event) => setResourceLocationCity(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  >
                    {tamilNaduLocations.map((loc) => (
                      <option key={loc.city} value={loc.city}>
                        {loc.city} ({loc.district})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Total Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) => {
                      const val = Number(event.target.value);
                      setQuantity(val);
                      if (availableQuantity > val) setAvailableQuantity(val);
                    }}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Available Quantity</label>
                  <input
                    type="number"
                    min={0}
                    max={quantity}
                    value={availableQuantity}
                    onChange={(event) => setAvailableQuantity(Number(event.target.value))}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={resourceStatus}
                    onChange={(event) => setResourceStatus(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  >
                    <option value="AVAILABLE">AVAILABLE</option>
                    <option value="IN_USE">IN USE</option>
                    <option value="MAINTENANCE">MAINTENANCE</option>
                    <option value="UNAVAILABLE">UNAVAILABLE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Description / Notes</label>
                <input
                  value={resourceDesc}
                  onChange={(event) => setResourceDesc(event.target.value)}
                  placeholder="Optional operational details or storage specifications"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                />
              </div>

              {message && (
                <div className={`rounded-xl p-3 text-sm font-medium ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Syncing resource...</span>
                ) : (
                  <>
                    <span>+ Add Resource to Inventory</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORM: Add Rescue Team */}
          {addMode === 'team' && (
            <form className="mt-5 space-y-4" onSubmit={handleAddTeam}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Team Name *</label>
                  <input
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                    placeholder="e.g., Chennai Rapid Flood Rescue Unit"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Team Code *</label>
                  <input
                    value={teamCode}
                    onChange={(event) => setTeamCode(event.target.value)}
                    placeholder="e.g., TN-TEAM-099"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2.5 text-sm font-medium uppercase focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Base Headquarters</label>
                  <select
                    value={teamBaseCity}
                    onChange={(event) => setTeamBaseCity(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2.5 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  >
                    {tamilNaduLocations.map((loc) => (
                      <option key={loc.city} value={loc.city}>
                        {loc.city} ({loc.district})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Active Responders Count</label>
                  <input
                    type="number"
                    min={1}
                    value={teamMembers}
                    onChange={(event) => setTeamMembers(Number(event.target.value))}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hotline / Contact</label>
                  <input
                    value={teamContact}
                    onChange={(event) => setTeamContact(event.target.value)}
                    placeholder="+91 9840000000"
                    required
                    className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Capabilities</label>
                <input
                  value={teamCapabilities}
                  onChange={(event) => setCapabilities(event.target.value)}
                  placeholder="e.g., Water Rescue, Medical First Aid, High-rise rope extraction"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-3.5 py-2 text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition"
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                <p className="text-xs font-semibold text-slate-700">Optional: Rescue Team Portal Login Credentials</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <input
                    type="email"
                    value={teamAccountEmail}
                    onChange={(event) => setTeamAccountEmail(event.target.value)}
                    placeholder="Login email (e.g., team99@rescue.com)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                  />
                  <input
                    type="password"
                    value={teamAccountPassword}
                    onChange={(event) => setTeamAccountPassword(event.target.value)}
                    placeholder="Login password (min 6 chars)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              {message && (
                <div className={`rounded-xl p-3 text-sm font-medium ${
                  message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-sm hover:bg-sky-500 active:scale-[0.99] transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Registering team...</span>
                ) : (
                  <>
                    <span>+ Enlist Rescue Team</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-slate-900">Rescue team roster ({teams.length})</summary>
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Team</th><th className="p-2">Base</th><th className="p-2">Members</th><th className="p-2">Status</th></tr></thead>
              <tbody>{teams.map((team) => <tr key={team.id} className="border-t border-slate-100"><td className="p-2"><div className="font-semibold">{team.name}</div><div className="text-xs text-slate-500">{team.teamCode} · {team.contactInfo}</div></td><td className="p-2">{team.baseLocation}</td><td className="p-2">{team.membersCount}</td><td className="p-2">{team.availabilityStatus}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
        <details className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <summary className="cursor-pointer text-lg font-bold text-slate-900">Resource inventory ({resources.length})</summary>
          <div className="mt-4 max-h-96 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-2">Resource</th><th className="p-2">Category</th><th className="p-2">Qty available</th><th className="p-2">Status</th></tr></thead>
              <tbody>{resources.map((resource) => <tr key={resource.id} className="border-t border-slate-100"><td className="p-2"><div className="font-semibold">{resource.name}</div><div className="text-xs text-slate-500">{resource.resourceId}</div></td><td className="p-2">{resource.category}</td><td className="p-2">{resource.availableQuantity} / {resource.quantity}</td><td className="p-2">{resource.status}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
      </div>

      <section className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-sky-700">Live coordination feed</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">AI and emergency notifications</h3>
          </div>
          <button
            type="button"
            onClick={checkGemini}
            disabled={checkingGemini}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {checkingGemini ? 'Testing Gemini...' : 'Test Gemini API'}
          </button>
        </div>
        {geminiCheck ? (
          <p className={`mt-3 rounded-xl p-3 text-sm ${geminiCheck.ok ? 'border border-emerald-200 bg-emerald-50 text-emerald-900' : 'border border-amber-200 bg-amber-50 text-amber-900'}`}>
            {geminiCheck.message}
          </p>
        ) : null}
        {notifications.length ? (
          <div className="mt-4 space-y-2">
            {notifications.map((notification) => (
              <div key={notification.id} className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-slate-800">
                <div className="font-semibold">{notification.type.replaceAll('_', ' ')}</div>
                <p className="mt-1">{notification.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-500">No coordination updates yet.</p>
        )}
      </section>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-xl font-bold text-slate-900">Operational map</h3>
        <MapPanel
          center={[10.8505, 78.6500]}
          zoom={6}
          emergencyMarkers={mapEmergencyMarkers}
          teamMarkers={mapTeamMarkers}
          resourceMarkers={mapResourceMarkers}
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'rose' | 'green' | 'amber' | 'sky' | 'violet' | 'emerald' }) {
  const colors = {
    rose: 'bg-rose-50 text-rose-700',
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
    emerald: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[accent]}`}>{label}</div>
      <div className="mt-4 text-3xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
