"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  Crosshair,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  BatteryCharging,
  Signal,
  MapPin,
  RefreshCw,
  Bell,
  Clock,
  Terminal,
  Activity,
  Layers,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dynamic import of Leaflet map (client-only to avoid SSR window errors)
const TacticalMap = dynamic(() => import("./components/TacticalMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[380px] bg-slate-900/60 rounded-lg flex items-center justify-center border border-slate-800 text-slate-400 font-mono text-sm">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
        <span>INITIALIZING GEOSPATIAL RADAR...</span>
      </div>
    </div>
  ),
});

interface Reading {
  id: string;
  timestamp: string;
  unit_id: string;
  dist: number;
  temp: number;
  hum: number;
  gas: number;
  lat: number;
  lon: number;
  alert: boolean;
  battery_mv?: number;
  signal_rssi?: number;
}

export default function TacticalOperationsDashboard() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Connecting...");
  const [isArmActive, setIsArmActive] = useState<boolean>(true);
  const [audioAlertEnabled, setAudioAlertEnabled] = useState<boolean>(true);

  // Fetch telemetry from serverless 24/7 API
  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/readings");
      if (!res.ok) return;
      const data = await res.json();
      if (data.readings && data.readings.length > 0) {
        setReadings(data.readings);
        setLatest(data.latest || data.readings[data.readings.length - 1]);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Telemetry sync error:", err);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000); // Poll cloud API every 3s
    return () => clearInterval(interval);
  }, []);

  // Compute Trail Coordinates for Map
  const trailCoords = useMemo(() => {
    return readings
      .filter((r) => r.lat && r.lon && (r.lat !== 0 || r.lon !== 0))
      .map((r) => [r.lat, r.lon] as [number, number]);
  }, [readings]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    const slice = readings.slice(-15);
    return {
      labels: slice.map((r) =>
        r.timestamp ? r.timestamp.split("T")[1]?.slice(0, 8) || "..." : "..."
      ),
      datasets: [
        {
          label: "Gas Concentration (PPM)",
          data: slice.map((r) => r.gas),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.3,
          yAxisID: "y1",
        },
        {
          label: "Temperature (°C)",
          data: slice.map((r) => r.temp),
          borderColor: "#f59e0b",
          backgroundColor: "transparent",
          tension: 0.3,
          yAxisID: "y",
        },
        {
          label: "Humidity (%)",
          data: slice.map((r) => r.hum),
          borderColor: "#38bdf8",
          backgroundColor: "transparent",
          tension: 0.3,
          yAxisID: "y",
        },
      ],
    };
  }, [readings]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: "#94a3b8",
          font: { family: "monospace", size: 11 },
        },
      },
      tooltip: {
        backgroundColor: "#0c121d",
        borderColor: "#1e293b",
        borderWidth: 1,
        titleColor: "#f8fafc",
        bodyColor: "#cbd5e1",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(30, 41, 59, 0.5)" },
        ticks: { color: "#64748b", font: { family: "monospace", size: 10 } },
      },
      y: {
        type: "linear" as const,
        display: true,
        position: "left" as const,
        grid: { color: "rgba(30, 41, 59, 0.5)" },
        ticks: { color: "#94a3b8", font: { family: "monospace", size: 10 } },
      },
      y1: {
        type: "linear" as const,
        display: true,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        ticks: { color: "#10b981", font: { family: "monospace", size: 10 } },
      },
    },
  };

  const isBreached = latest?.alert || false;

  return (
    <div className="min-h-screen bg-[#06090e] text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black">
      {/* Tactical Top Bar */}
      <header className="border-b border-slate-800/80 bg-[#0c121d]/90 backdrop-blur sticky top-0 z-50 px-4 lg:px-8 py-3.5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
              <Crosshair className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black tracking-wider text-white">
                  SENTINEL-4G
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  MIL-SPEC C2
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  ASSET: ALPHA-01
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                <span>TACTICAL ASSET SURVEILLANCE & TELEMETRY</span>
                <span className="text-slate-600">|</span>
                <span className="text-emerald-500 font-semibold">24/7 CLOUD ACTIVE</span>
              </p>
            </div>
          </div>

          {/* Operational Status / Threat Assessment */}
          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1.5 rounded-lg border font-mono text-xs flex items-center gap-2 ${
                isBreached
                  ? "bg-red-950/80 border-red-600 text-red-300 glow-danger"
                  : "bg-emerald-950/50 border-emerald-700/60 text-emerald-300"
              }`}
            >
              {isBreached ? (
                <>
                  <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce" />
                  <span className="font-bold tracking-wider">DEFCON 1: INTRUSION ACTIVE</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold tracking-wider">DEFCON 5: PERIMETER SECURE</span>
                </>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded border border-slate-800">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>SYNC: {lastSyncTime}</span>
            </div>

            <button
              onClick={() => setIsArmActive(!isArmActive)}
              className={`text-xs font-mono font-bold px-3 py-1.5 rounded border transition-colors ${
                isArmActive
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700"
              }`}
            >
              {isArmActive ? "PERIMETER: ARMED" : "PERIMETER: STANDBY"}
            </button>
          </div>
        </div>
      </header>

      {/* Critical Intrusion Alert Banner */}
      {isBreached && (
        <div className="bg-red-600 text-white font-mono text-xs font-bold px-6 py-2.5 flex items-center justify-between animate-pulse border-b border-red-400 shadow-xl">
          <div className="flex items-center gap-3 max-w-[1600px] mx-auto w-full">
            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
            <span className="tracking-wide">
              TACTICAL THREAT ALERT: MOTION DETECTED WITHIN PERIMETER! PROXIMITY:{" "}
              {latest?.dist?.toFixed(1) || "--"} CM. SMS DISPATCHED.
            </span>
            <a
              href={`https://maps.google.com/?q=${latest?.lat},${latest?.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto underline text-[11px] bg-red-950 px-2 py-0.5 rounded border border-red-400 hover:bg-red-900"
            >
              LOCK COORDINATES ↗
            </a>
          </div>
        </div>
      )}

      {/* Main Tactical Dashboard Body */}
      <main className="max-w-[1600px] mx-auto w-full p-4 lg:p-8 space-y-6 flex-1">
        {/* Top KPI Telemetry Grid (Like Harvest Link / Modern Defense Ops) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {/* 1. Proximity Radar */}
          <div className="bg-[#0c121d] border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>PROXIMITY RADAR</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tracking-tight text-white">
                {latest?.dist !== undefined ? latest.dist.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-slate-400 font-mono">CM</span>
            </div>
            <div className="mt-2 text-[11px] font-mono flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  (latest?.dist || 0) < 35 && (latest?.dist || 0) > 0
                    ? "bg-red-500 animate-ping"
                    : "bg-emerald-500"
                }`}
              ></span>
              <span className="text-slate-300">
                {(latest?.dist || 0) < 35 && (latest?.dist || 0) > 0
                  ? "BREACH DETECTED"
                  : "SECTOR CLEAR"}
              </span>
            </div>
          </div>

          {/* 2. NBC Hazardous Gas */}
          <div className="bg-[#0c121d] border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>NBC AIR QUALITY</span>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tracking-tight text-emerald-400">
                {latest?.gas !== undefined ? Math.round(latest.gas) : "--"}
              </span>
              <span className="text-xs text-slate-400 font-mono">RAW PPM</span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>
                {(latest?.gas || 0) > 800
                  ? "ELEVATED HAZARD"
                  : "SAFE OPERATIONAL"}
              </span>
            </div>
          </div>

          {/* 3. Ambient Thermal */}
          <div className="bg-[#0c121d] border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>THERMAL STATUS</span>
              <Thermometer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tracking-tight text-amber-400">
                {latest?.temp !== undefined ? latest.temp.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-slate-400 font-mono">°C</span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-300">
              NOMINAL OPERATING RANGE
            </div>
          </div>

          {/* 4. Moisture / Humidity */}
          <div className="bg-[#0c121d] border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>REL. HUMIDITY</span>
              <Droplets className="w-4 h-4 text-sky-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-3xl font-black font-mono tracking-tight text-sky-400">
                {latest?.hum !== undefined ? latest.hum.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-slate-400 font-mono">% RH</span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-300">
              ATMOSPHERIC READINGS
            </div>
          </div>

          {/* 5. Comms & Power Vitality */}
          <div className="bg-[#0c121d] border border-slate-800/80 rounded-xl p-4 shadow-lg hover:border-slate-700 transition col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-slate-400 text-xs font-mono">
              <span>COMMS & POWER</span>
              <Signal className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2.5 flex items-baseline justify-between">
              <span className="text-2xl font-black font-mono tracking-tight text-white">
                3.93 <span className="text-xs font-normal text-slate-400">V</span>
              </span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                LTE Cat-1
              </span>
            </div>
            <div className="mt-2 text-[11px] font-mono text-slate-300 flex items-center justify-between">
              <span>AIRTEL 4G</span>
              <span className="text-emerald-400 font-bold">RSSI: -72 dBm</span>
            </div>
          </div>
        </div>

        {/* Central Operations Section: Map + Live Telemetry Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Geospatial Tactical Map (7 cols) */}
          <div className="lg:col-span-7 bg-[#0c121d] border border-slate-800 rounded-xl p-4 lg:p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold font-mono tracking-wide text-slate-200 uppercase">
                  Geospatial Asset Tracking & Patrol Trail
                </h2>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                LIVE GPS STREAM (NEO-6M)
              </span>
            </div>
            <div className="flex-1 w-full min-h-[380px]">
              <TacticalMap
                lat={latest?.lat || 28.6139}
                lon={latest?.lon || 77.2090}
                unitId={latest?.unit_id || "UNIT-ALPHA-01"}
                isAlert={isBreached}
                trailCoords={trailCoords}
              />
            </div>
          </div>

          {/* Environmental Telemetry Charts (5 cols) */}
          <div className="lg:col-span-5 bg-[#0c121d] border border-slate-800 rounded-xl p-4 lg:p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold font-mono tracking-wide text-slate-200 uppercase">
                  Multi-Sensor Environmental Telemetry
                </h2>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                RECENT 15 SAMPLES
              </span>
            </div>
            <div className="relative flex-1 w-full min-h-[350px]">
              <Line data={chartData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Tactical Mission Event & Intrusion Audit Log */}
        <div className="bg-[#0c121d] border border-slate-800 rounded-xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h3 className="font-mono text-sm font-bold tracking-wide uppercase text-slate-200">
                Tactical Mission Audit Log // Security Event Telemetry
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {readings.length} TELEMETRY RECORDS STORED
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="text-slate-500 uppercase border-b border-slate-800/60 bg-slate-950/40">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Unit ID</th>
                  <th className="py-2.5 px-3">Proximity</th>
                  <th className="py-2.5 px-3">Air Quality</th>
                  <th className="py-2.5 px-3">Thermal / Hum</th>
                  <th className="py-2.5 px-3">GPS Coordinates</th>
                  <th className="py-2.5 px-3 text-right">Defense Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-slate-300">
                {readings.slice(-8).reverse().map((r, i) => (
                  <tr
                    key={r.id || i}
                    className={`hover:bg-slate-900/60 transition ${
                      r.alert ? "bg-red-950/30 text-red-200" : ""
                    }`}
                  >
                    <td className="py-2.5 px-3 text-slate-400">
                      {r.timestamp ? r.timestamp.replace("T", " ").slice(0, 19) : "--"}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {r.unit_id || "ALPHA-01"}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {r.dist ? r.dist.toFixed(1) : "--"} cm
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400">
                      {Math.round(r.gas || 0)}
                    </td>
                    <td className="py-2.5 px-3 font-mono">
                      {r.temp?.toFixed(1) || "--"}°C / {r.hum?.toFixed(1) || "--"}%
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">
                      {r.lat ? `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}` : "ACQUIRING..."}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {r.alert ? (
                        <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 border border-red-700 font-bold">
                          BREACH
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          CLEAR
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Tactical Footer */}
      <footer className="border-t border-slate-800/80 bg-[#0c121d] py-3.5 px-6 text-center text-xs font-mono text-slate-500">
        SENTINEL-4G MILITARY ASSET TRACKING SYSTEM &copy; 2026 // 24/7 CLOUD HOSTED ARCHITECTURE
      </footer>
    </div>
  );
}
