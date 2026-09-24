export const dynamic = "force-dynamic";
export const revalidate = 0;

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

declare global {
  var __telemetry_store: TelemetryReading[] | undefined;
}

if (!globalThis.__telemetry_store) {
  globalThis.__telemetry_store = [];
}

const store = globalThis.__telemetry_store;

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const reading: TelemetryReading = {
      id: "tlm-" + Date.now(),
      timestamp: new Date().toISOString(),
      unit_id: String(data.unit_id || "UNIT-01"),
      dist: parseFloat(data.dist ?? 0),
      temp: parseFloat(data.temp ?? 0),
      hum: parseFloat(data.hum ?? 0),
      gas: parseFloat(data.gas ?? 0),
      lat: parseFloat(data.lat ?? 0),
      lon: parseFloat(data.lon ?? 0),
      alert: Boolean(data.alert === true || data.alert === "true" || data.alert === 1 || data.alert === "1"),
      battery_mv: data.battery_mv ? parseInt(data.battery_mv) : 3930,
      signal_rssi: data.signal_rssi ? parseInt(data.signal_rssi) : 22,
    };

    store.push(reading);
    if (store.length > 200) {
      store.shift();
    }

    return NextResponse.json({
      status: "success",
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
  const latest = store.length > 0 ? store[store.length - 1] : null;

  let isOnline = false;
  if (latest && latest.timestamp) {
    const diffSeconds = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;
    isOnline = diffSeconds < 45;
  }

  return NextResponse.json({
    is_online: isOnline,
    total_count: store.length,
    latest: latest,
    readings: store.slice(-30),
  });
}