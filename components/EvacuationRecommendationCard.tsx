'use client';

import React from 'react';

export type EvacuationRecommendationData = {
  emergencyType: string;
  recommendedLocationName: string;
  locationType: string;
  latitude?: number;
  longitude?: number;
  distanceKm?: number;
  reason: string;
  safetyInstructions: string[];
  shortUserMessage: string;
  isSimulated?: boolean;
  usedAI?: boolean;
  error?: string;
};

interface EvacuationRecommendationCardProps {
  recommendation: EvacuationRecommendationData | null;
  loading?: boolean;
  onRefresh?: () => void;
}

export function EvacuationRecommendationCard({
  recommendation,
  loading = false,
  onRefresh,
}: EvacuationRecommendationCardProps) {
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-50/90 to-orange-50/50 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 animate-spin items-center justify-center rounded-xl bg-amber-500/20 text-xl">
            🧭
          </span>
          <div>
            <h4 className="font-bold text-amber-950">AI Analyzing Safe Evacuation Paths…</h4>
            <p className="text-xs text-amber-700">Evaluating topography, elevations, distances, and hazard zones with Gemini.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!recommendation) {
    return null;
  }

  const locationTypeBadge = {
    OPEN_GROUND: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    HIGH_GROUND: 'bg-blue-100 text-blue-800 border-blue-300',
    EVACUATION_SHELTER: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    CYCLONE_SHELTER: 'bg-teal-100 text-teal-800 border-teal-300',
    COMMUNITY_HALL: 'bg-purple-100 text-purple-800 border-purple-300',
  }[recommendation.locationType] || 'bg-slate-100 text-slate-800 border-slate-300';

  return (
    <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/30 bg-gradient-to-br from-white via-emerald-50/20 to-teal-50/30 p-5 shadow-lg shadow-emerald-500/5 md:p-6">
      {/* Simulation & Prototype Notice Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-base font-bold text-white shadow-sm">
            🛡️
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-800">
                AI Safe Zone Recommendation
              </span>
              {recommendation.usedAI ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  ✨ Gemini Verified
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-500">Based on your coordinates &amp; hazard risk</p>
          </div>
        </div>
        {recommendation.isSimulated ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-800">
            ⚠ Demonstration Prototype (Simulated Safe Zone)
          </span>
        ) : null}
      </div>

      {/* Main Alert Message */}
      <div className="mt-4 rounded-2xl bg-emerald-600/10 border border-emerald-500/20 p-3.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-900">
          Immediate User Direction:
        </p>
        <p className="mt-1 text-base font-black text-emerald-950 leading-snug">
          {recommendation.shortUserMessage}
        </p>
      </div>

      {/* Recommended Location Card */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Recommended Safe Area
          </p>
          <h4 className="mt-1 text-lg font-black text-slate-950">
            {recommendation.recommendedLocationName}
          </h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${locationTypeBadge}`}>
              {recommendation.locationType.replaceAll('_', ' ')}
            </span>
            {recommendation.distanceKm ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                ≈ {recommendation.distanceKm} km away
              </span>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Reason &amp; Topographical Safety
          </p>
          <p className="mt-1 text-xs text-slate-700 leading-relaxed">
            {recommendation.reason}
          </p>
        </div>
      </div>

      {/* Safety Instructions */}
      {recommendation.safetyInstructions?.length ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Critical Action Steps:
          </p>
          <ul className="space-y-1.5">
            {recommendation.safetyInstructions.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-slate-750">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                  {idx + 1}
                </span>
                <span className="text-slate-700 font-medium">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Safety Warning Disclaimer */}
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-slate-500 border-t border-slate-100 pt-3">
        <p>
          <strong className="text-rose-600">⚠ Safety Warning:</strong> Always prioritize verified instructions from local emergency authorities, police, and civil defense. Do not enter hazardous flooded or collapsing terrain.
        </p>
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            className="shrink-0 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            Refresh
          </button>
        ) : null}
      </div>
    </div>
  );
}
