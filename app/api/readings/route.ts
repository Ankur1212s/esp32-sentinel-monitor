import { NextRequest, NextResponse } from "next/server";

export interface TelemetryReading {
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

// In-memory persistent global store across warm serverless invocations
declare global {
  var __telemetry_store: TelemetryReading[] | undefined;
}

if (!globalThis.__telemetry_store) {
  globalThis.__telemetry_store = [
    {
      id: "init-01",
      timestamp: new Date().toISOString(),
      unit_id: "SENTINEL-ALPHA",
      dist: 120.0,
      temp: 26.5,
      hum: 54.0,
      gas: 380,
      lat: 28.6139,
      lon: 77.2090,
      alert: false,
      battery_mv: 3930,
      signal_rssi: 22,
    },
  ];
}

const store = globalThis.__telemetry_store;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const reading: TelemetryReading = {
      id: "tlm-" + Date.now(),
      timestamp: new Date().toISOString(),
      unit_id: String(data.unit_id || "UNIT-ALPHA-01"),
      dist: parseFloat(data.dist ?? 0),
      temp: parseFloat(data.temp ?? 0),
      hum: parseFloat(data.hum ?? 0),
      gas: parseFloat(data.gas ?? 0),
      lat: parseFloat(data.lat ?? 0),
      lon: parseFloat(data.lon ?? 0),
      alert: Boolean(data.alert === true || data.alert === "true" || data.alert === 1 || data.alert === "1"),
      battery_mv: data.battery_mv ? parseInt(data.battery_mv) : 3930,
      signal_rssi: data.signal_rssi ? parseInt(data.signal_rssi) : 24,
    };

    // Keep up to 100 recent entries in buffer
    store.push(reading);
    if (store.length > 100) {
      store.shift();
    }

    return NextResponse.json({
      status: "success",
      message: "Tactical telemetry ingested successfully",
      timestamp: reading.timestamp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Invalid payload" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const latestOnly = searchParams.get("latest") === "true";

  if (latestOnly) {
    const latest = store.length > 0 ? store[store.length - 1] : null;
    return NextResponse.json({ latest });
  }

  return NextResponse.json({
    count: store.length,
    readings: store,
    latest: store.length > 0 ? store[store.length - 1] : null,
  });
}
