"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

interface TacticalMapProps {
  lat?: number;
  lon?: number;
  unitId: string;
  isAlert: boolean;
  isOnline: boolean;
  trailCoords: [number, number][];
}

export default function TacticalMap({
  lat,
  lon,
  unitId,
  isAlert,
  isOnline,
  trailCoords,
}: TacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);

  const hasCoords = Boolean(lat && lon && (lat !== 0 || lon !== 0));
  const centerLat = hasCoords ? lat! : 20.5937; // Center of India default
  const centerLon = hasCoords ? lon! : 78.9629;
  const zoomLevel = hasCoords ? 14 : 5;

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLon],
        zoom: zoomLevel,
        zoomControl: true,
      });

      // Professional Dark CartoDB Tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      if (hasCoords) {
        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full ${
              isAlert ? "bg-rose-500 animate-ping" : isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"
            } opacity-75 absolute"></div>
            <div class="w-3.5 h-3.5 rounded-full ${
              isAlert ? "bg-rose-600 border-2 border-white" : isOnline ? "bg-emerald-500 border-2 border-zinc-900" : "bg-zinc-600 border-2 border-zinc-800"
            } relative z-10 shadow-lg"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: "custom-marker",
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([lat!, lon!], { icon: customIcon }).addTo(map);
        marker.bindPopup(`<b>${unitId}</b><br>Lat: ${lat?.toFixed(5)}<br>Lon: ${lon?.toFixed(5)}`);

        const polyline = L.polyline(trailCoords.length > 0 ? trailCoords : [[lat!, lon!]], {
          color: isAlert ? "#f43f5e" : "#10b981",
          weight: 2.5,
          opacity: 0.8,
        }).addTo(map);

        markerRef.current = marker;
        trailPolylineRef.current = polyline;
      }

      mapInstanceRef.current = map;
    } else {
      const map = mapInstanceRef.current;
      if (hasCoords) {
        map.setView([lat!, lon!], 14, { animate: true });

        const iconHtml = `
          <div class="relative flex items-center justify-center">
            <div class="w-6 h-6 rounded-full ${
              isAlert ? "bg-rose-500 animate-ping" : isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"
            } opacity-75 absolute"></div>
            <div class="w-3.5 h-3.5 rounded-full ${
              isAlert ? "bg-rose-600 border-2 border-white" : isOnline ? "bg-emerald-500 border-2 border-zinc-900" : "bg-zinc-600 border-2 border-zinc-800"
            } relative z-10 shadow-lg"></div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: "custom-marker",
          html: iconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat!, lon!]);
          markerRef.current.setIcon(customIcon);
        } else {
          markerRef.current = L.marker([lat!, lon!], { icon: customIcon }).addTo(map);
        }

        if (trailPolylineRef.current && trailCoords.length > 0) {
          trailPolylineRef.current.setLatLngs(trailCoords);
        }
      }
    }
  }, [lat, lon, hasCoords, isAlert, isOnline, trailCoords, unitId]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950">
      <div ref={mapContainerRef} className="w-full h-full min-h-[420px]" />
      
      {/* Map Overlay Badge */}
      <div className="absolute top-3 left-3 z-[1000] bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono shadow-md">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${hasCoords && isOnline ? "bg-emerald-500 animate-ping" : "bg-zinc-500"}`}></span>
          <span className="font-semibold text-zinc-200">
            {hasCoords ? "GPS FIX ACQUIRED" : "AWAITING GPS TELEMETRY"}
          </span>
        </div>
        {hasCoords ? (
          <div className="text-[11px] text-zinc-400 mt-0.5">
            {lat?.toFixed(5)}, {lon?.toFixed(5)}
          </div>
        ) : (
          <div className="text-[10px] text-zinc-500 mt-0.5">
            Unit powered off or searching for satellites
          </div>
        )}
      </div>

      {hasCoords && (
        <div className="absolute bottom-3 right-3 z-[1000] bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-sky-400 hover:text-sky-300 shadow">
          <a
            href={`https://maps.google.com/?q=${lat},${lon}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-medium"
          >
            <span>Open in Google Maps ↗</span>
          </a>
        </div>
      )}
    </div>
  );
}