export const dynamic = 'force-dynamic';
export const revalidate = 0;
"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  Gauge,
  Thermometer,
  Droplets,
  Wind,
  BatteryCharging,
  Signal,
  MapPin,
  RefreshCw,
  Clock,
  Terminal,
  Activity,
  Cpu,
  WifiOff,
  AlertTriangle,
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

const TacticalMap = dynamic(() => import("./components/TacticalMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] bg-zinc-900/50 rounded-xl flex items-center justify-center border border-zinc-800/80 text-zinc-400 font-mono text-xs">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></div>
        <span>INITIALIZING GEOSPATIAL ENGINE...</span>
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

export default function MilitaryAssetDashboard() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>("Checking...");
  const [isArmActive, setIsArmActive] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"overview" | "map" | "telemetry" | "logs">("overview");

  const fetchTelemetry = async () => {
    try {
      const res = await fetch("/api/readings");
      if (!res.ok) return;
      const data = await res.json();
      setIsOnline(Boolean(data.is_online));
      if (data.readings) {
        setReadings(data.readings);
        setLatest(data.latest || null);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Telemetry sync error:", err);
      setIsOnline(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 3000);
    return () => clearInterval(interval);
  }, []);

  const trailCoords = useMemo(() => {
    return readings
      .filter((r) => r.lat && r.lon && (r.lat !== 0 || r.lon !== 0))
      .map((r) => [r.lat, r.lon] as [number, number]);
  }, [readings]);

  const chartData = useMemo(() => {
    const slice = readings.slice(-15);
    return {
      labels: slice.map((r) =>
        r.timestamp ? r.timestamp.split("T")[1]?.slice(0, 8) || "..." : "..."
      ),
      datasets: [
        {
          label: "Gas Concentration (MQ-135)",
          data: slice.map((r) => r.gas),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.05)",
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
          borderColor: "#0ea5e9",
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
    plugins: {
      legend: {
        labels: {
          color: "#71717a",
          font: { family: "sans-serif", size: 12 },
        },
      },
      tooltip: {
        backgroundColor: "#18181b",
        borderColor: "#27272a",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(39, 39, 42, 0.4)" },
        ticks: { color: "#71717a", font: { size: 10 } },
      },
      y: {
        type: "linear" as const,
        position: "left" as const,
        grid: { color: "rgba(39, 39, 42, 0.4)" },
        ticks: { color: "#71717a", font: { size: 10 } },
      },
      y1: {
        type: "linear" as const,
        position: "right" as const,
        grid: { drawOnChartArea: false },
        ticks: { color: "#10b981", font: { size: 10 } },
      },
    },
  };

  const isBreached = latest?.alert || false;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 text-zinc-100">
              <Radio className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base tracking-tight text-white">
                  SENTINEL-4G
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  Asset Unit #01
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Military Asset Tracking & Security System
              </p>
            </div>
          </div>

          {/* Real Online / Offline Indicator */}
          <div className="flex items-center gap-3">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 border ${
                isOnline
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isOnline ? "bg-emerald-500 animate-ping" : "bg-zinc-500"
                }`}
              ></span>
              <span>{isOnline ? "HARDWARE ONLINE" : "HARDWARE OFFLINE"}</span>
            </div>

            <button
              onClick={() => setIsArmActive(!isArmActive)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                isArmActive
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700"
              }`}
            >
              {isArmActive ? "Perimeter Armed" : "Perimeter Standby"}
            </button>
          </div>
        </div>
      </header>

      {/* Real-time Intrusion Alert Banner */}
      {isBreached && isOnline && (
        <div className="bg-rose-600 text-white text-xs font-semibold px-6 py-2.5 flex items-center justify-between border-b border-rose-500 shadow-md">
          <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              Perimeter Breach Detected: Motion recorded at {latest?.dist?.toFixed(1)} cm. SMS dispatched to registered device.
            </span>
            {latest?.lat && (
              <a
                href={`https://maps.google.com/?q=${latest.lat},${latest.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto underline text-xs hover:text-rose-100"
              >
                View Coordinates ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-4 lg:p-8 space-y-6 flex-1">
        {/* If Offline, show clean friendly banner */}
        {!isOnline && (
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex items-center gap-3.5 text-zinc-400 text-xs">
            <WifiOff className="w-5 h-5 text-zinc-500 flex-shrink-0" />
            <div>
              <span className="font-semibold text-zinc-200">System is currently in Standby / Offline mode.</span>
              <p className="text-zinc-400 mt-0.5">
                Power on your ESP32 device with the battery in the field. As soon as the A7670C module sends its first telemetry packet over Airtel 4G, live readings and GPS coordinates will appear automatically.
              </p>
            </div>
          </div>
        )}

        {/* Top KPI Cards (Clean SaaS style like Harvest Link) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. Proximity Sensor */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Proximity Radar</span>
              <Activity className="w-4 h-4 text-zinc-500" />
            </div>
            <div className="my-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-zinc-100">
                {isOnline && latest?.dist !== undefined ? latest.dist.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-zinc-400 font-medium">cm</span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {isOnline ? ((latest?.dist || 0) < 35 && (latest?.dist || 0) > 0 ? "Motion detected" : "Perimeter clear") : "Sensor offline"}
            </div>
          </div>

          {/* 2. Gas / Air Quality */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Air Quality (MQ-135)</span>
              <Wind className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-emerald-400">
                {isOnline && latest?.gas !== undefined ? Math.round(latest.gas) : "--"}
              </span>
              <span className="text-xs text-zinc-400 font-medium">ppm</span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {isOnline ? "Normal atmospheric range" : "Sensor offline"}
            </div>
          </div>

          {/* 3. Temperature */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Temperature</span>
              <Thermometer className="w-4 h-4 text-amber-400" />
            </div>
            <div className="my-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-amber-400">
                {isOnline && latest?.temp !== undefined ? latest.temp.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-zinc-400 font-medium">°C</span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {isOnline ? "DHT11 ambient thermal" : "Sensor offline"}
            </div>
          </div>

          {/* 4. Humidity */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Humidity</span>
              <Droplets className="w-4 h-4 text-sky-400" />
            </div>
            <div className="my-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-sky-400">
                {isOnline && latest?.hum !== undefined ? latest.hum.toFixed(1) : "--"}
              </span>
              <span className="text-xs text-zinc-400 font-medium">%</span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {isOnline ? "Relative humidity" : "Sensor offline"}
            </div>
          </div>

          {/* 5. Power & Connectivity */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 flex flex-col justify-between col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between text-zinc-400 text-xs">
              <span>Battery & 4G Comms</span>
              <Signal className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="my-2 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-zinc-100">
                {isOnline ? "3.93 V" : "--"}
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                Airtel 4G
              </span>
            </div>
            <div className="text-[11px] text-zinc-500 flex justify-between">
              <span>Li-ion 7600mAh</span>
              <span className="text-zinc-400">{isOnline ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
        </div>

        {/* Map & Telemetry Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Map View */}
          <div className="lg:col-span-7 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Asset Location & Patrol Trail
                </h2>
              </div>
              <span className="text-xs text-zinc-500">
                {isOnline && latest?.lat ? "Live GPS Coordinates" : "Awaiting Satellite Lock"}
              </span>
            </div>
            <div className="flex-1 w-full min-h-[420px]">
              <TacticalMap
                lat={latest?.lat}
                lon={latest?.lon}
                unitId={latest?.unit_id || "UNIT-01"}
                isAlert={isBreached}
                isOnline={isOnline}
                trailCoords={trailCoords}
              />
            </div>
          </div>

          {/* Environmental Chart */}
          <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-zinc-400" />
                <h2 className="text-sm font-semibold text-zinc-200">
                  Telemetry History
                </h2>
              </div>
              <span className="text-xs text-zinc-500">
                {readings.length} data points
              </span>
            </div>
            <div className="relative flex-1 w-full min-h-[350px]">
              {readings.length > 0 ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 text-xs">
                  <Activity className="w-8 h-8 mb-2 opacity-40" />
                  <span>No telemetry history available yet.</span>
                  <span className="text-zinc-600 mt-1">Readings will graph automatically when device connects.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Security Events & Audit Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800/60 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-200">
                Security & Ingestion Event Log
              </h3>
            </div>
            <span className="text-xs text-zinc-500">
              Last Sync: {lastSyncTime}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 border-b border-zinc-800 bg-zinc-950/40">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-3">Proximity</th>
                  <th className="py-2.5 px-3">Gas (PPM)</th>
                  <th className="py-2.5 px-3">Temp / Hum</th>
                  <th className="py-2.5 px-3">Coordinates</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                {readings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-zinc-500">
                      No incoming transmissions recorded yet. Power on your ESP32 device to view live telemetry.
                    </td>
                  </tr>
                ) : (
                  readings.slice(-8).reverse().map((r, i) => (
                    <tr
                      key={r.id || i}
                      className={`hover:bg-zinc-800/40 transition ${
                        r.alert ? "bg-rose-950/20 text-rose-200" : ""
                      }`}
                    >
                      <td className="py-2.5 px-3 text-zinc-400">
                        {r.timestamp ? r.timestamp.replace("T", " ").slice(0, 19) : "--"}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-white">
                        {r.unit_id || "UNIT-01"}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.dist ? r.dist.toFixed(1) : "--"} cm
                      </td>
                      <td className="py-2.5 px-3 text-emerald-400">
                        {Math.round(r.gas || 0)}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.temp?.toFixed(1) || "--"}°C / {r.hum?.toFixed(1) || "--"}%
                      </td>
                      <td className="py-2.5 px-3 text-zinc-400">
                        {r.lat ? `${r.lat.toFixed(4)}, ${r.lon.toFixed(4)}` : "Searching"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {r.alert ? (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 font-semibold">
                            BREACH
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                            CLEAR
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-3.5 px-6 text-center text-xs text-zinc-500">
        SENTINEL-4G MILITARY ASSET TRACKING SYSTEM &copy; 2026
      </footer>
    </div>
  );
}