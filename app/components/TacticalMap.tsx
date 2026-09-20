"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

interface TacticalMapProps {
  lat: number;
  lon: number;
  unitId: string;
  isAlert: boolean;
  trailCoords: [number, number][];
}

export default function TacticalMap({
  lat,
  lon,
  unitId,
  isAlert,
  trailCoords,
}: TacticalMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailPolylineRef = useRef<L.Polyline | null>(null);
  const radarCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Check if map already initialized
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat || 28.6139, lon || 77.2090],
        zoom: 14,
        zoomControl: true,
      });

      // Dark Tactical Tiles
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          maxZoom: 19,
          subdomains: "abcd",
        }
      ).addTo(map);

      // Tactical Custom Icon
      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="w-6 h-6 rounded-full ${
            isAlert ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"
          } opacity-75 absolute"></div>
          <div class="w-4 h-4 rounded-full ${
            isAlert ? "bg-red-600 border-2 border-white" : "bg-emerald-400 border-2 border-emerald-950"
          } relative z-10 shadow-lg"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "tactical-marker",
        html: iconHtml,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const marker = L.marker([lat || 28.6139, lon || 77.2090], {
        icon: customIcon,
      }).addTo(map);

      const circle = L.circle([lat || 28.6139, lon || 77.2090], {
        radius: 200,
        color: isAlert ? "#ef4444" : "#10b981",
        fillColor: isAlert ? "#ef4444" : "#10b981",
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: "4, 6",
      }).addTo(map);

      const polyline = L.polyline(trailCoords.length > 0 ? trailCoords : [[lat, lon]], {
        color: "#10b981",
        weight: 3,
        opacity: 0.8,
        dashArray: "3, 6",
      }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      radarCircleRef.current = circle;
      trailPolylineRef.current = polyline;
    } else {
      // Update existing map
      const map = mapInstanceRef.current;
      if (lat && lon && (lat !== 0 || lon !== 0)) {
        map.panTo([lat, lon], { animate: true, duration: 1 });

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lon]);

          const iconHtml = `
            <div class="relative flex items-center justify-center">
              <div class="w-6 h-6 rounded-full ${
                isAlert ? "bg-red-500 animate-ping" : "bg-emerald-500 animate-pulse"
              } opacity-75 absolute"></div>
              <div class="w-4 h-4 rounded-full ${
                isAlert ? "bg-red-600 border-2 border-white" : "bg-emerald-400 border-2 border-emerald-950"
              } relative z-10 shadow-lg"></div>
            </div>
          `;
          markerRef.current.setIcon(
            L.divIcon({
              className: "tactical-marker",
              html: iconHtml,
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })
          );
        }

        if (radarCircleRef.current) {
          radarCircleRef.current.setLatLng([lat, lon]);
          radarCircleRef.current.setStyle({
            color: isAlert ? "#ef4444" : "#10b981",
            fillColor: isAlert ? "#ef4444" : "#10b981",
          });
        }

        if (trailPolylineRef.current && trailCoords.length > 0) {
          trailPolylineRef.current.setLatLngs(trailCoords);
        }
      }
    }

    return () => {
      // Clean up on component unmount
    };
  }, [lat, lon, isAlert, trailCoords, unitId]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-lg overflow-hidden border border-slate-800">
      <div ref={mapContainerRef} className="w-full h-full min-h-[380px]" />
      
      {/* Tactical HUD Overlay Elements */}
      <div className="absolute top-3 left-3 z-[1000] bg-slate-950/85 backdrop-blur border border-slate-800 rounded px-3 py-1.5 text-xs font-mono text-slate-300 pointer-events-none shadow-md">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span className="text-emerald-400 font-bold tracking-wider">GEOSPATIAL RADAR: ACTIVE</span>
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">
          COORD: {lat ? lat.toFixed(5) : "--"}, {lon ? lon.toFixed(5) : "--"}
        </div>
      </div>

      <div className="absolute bottom-3 right-3 z-[1000] bg-slate-950/85 backdrop-blur border border-slate-800 rounded px-2.5 py-1 text-[11px] font-mono text-blue-400 hover:text-blue-300 shadow">
        <a
          href={`https://maps.google.com/?q=${lat},${lon}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 underline"
        >
          <span>Tactical Satellite View ↗</span>
        </a>
      </div>
    </div>
  );
}
