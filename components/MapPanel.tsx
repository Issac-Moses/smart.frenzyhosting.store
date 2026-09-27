'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  details?: string;
};

function markerIcon(color: string) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:9999px;border:3px solid white;box-shadow:0 8px 20px rgba(15,23,42,.25)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

function popupContent(marker: MapMarker) {
  const content = document.createElement('div');
  content.className = 'text-sm';

  const title = document.createElement('strong');
  title.textContent = marker.label;
  content.append(title);

  if (marker.details) {
    const details = document.createElement('div');
    details.className = 'mt-1';
    details.textContent = marker.details;
    content.append(details);
  }

  return content;
}

export function MapPanel({
  center,
  zoom = 10,
  emergencyMarkers,
  teamMarkers,
  resourceMarkers,
  onMapClick,
  route,
}: {
  center: [number, number];
  zoom?: number;
  emergencyMarkers: MapMarker[];
  teamMarkers: MapMarker[];
  resourceMarkers: MapMarker[];
  onMapClick?: (latitude: number, longitude: number) => void;
  route?: [[number, number], [number, number]] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const onMapClickRef = useRef(onMapClick);
  const centerLatitude = center[0];
  const centerLongitude = center[1];
  const initialViewRef = useRef({ centerLatitude, centerLongitude, zoom });

  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const initialView = initialViewRef.current;
    const map = L.map(container, { scrollWheelZoom: true }).setView(
      [initialView.centerLatitude, initialView.centerLongitude],
      initialView.zoom,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (onMapClickRef.current) {
      map.on('click', (event: L.LeafletMouseEvent) => {
        onMapClickRef.current?.(event.latlng.lat, event.latlng.lng);
      });
    }

    mapRef.current = map;
    markerLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      markerLayerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
  }, []);

  useEffect(() => {
    mapRef.current?.setView([centerLatitude, centerLongitude], zoom);
  }, [centerLatitude, centerLongitude, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !route) return;
    const routeLine = L.polyline(route, {
      color: '#2563eb',
      weight: 4,
      opacity: 0.8,
      dashArray: '10 10',
    }).addTo(map);
    return () => {
      routeLine.remove();
    };
  }, [route]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();
    for (const marker of [...emergencyMarkers, ...teamMarkers, ...resourceMarkers]) {
      if (!Number.isFinite(marker.lat) || !Number.isFinite(marker.lng)) continue;
      L.marker([marker.lat, marker.lng], { icon: markerIcon(marker.color) })
        .bindPopup(popupContent(marker))
        .addTo(markerLayer);
    }
  }, [emergencyMarkers, resourceMarkers, teamMarkers]);

  return (
    <div className="h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div ref={containerRef} className="h-full w-full" aria-label="Operational map" />
    </div>
  );
}
