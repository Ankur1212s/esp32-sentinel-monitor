export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

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

// In-memory fallback ring buffer (active when MongoDB is not connected)
declare global {
  var __telemetry_store: TelemetryReading[] | undefined;
}

if (!globalThis.__telemetry_store) {
  globalThis.__telemetry_store = [];
}

const memoryStore = globalThis.__telemetry_store;

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

    // 1. Save to in-memory buffer
    memoryStore.push(reading);
    if (memoryStore.length > 200) {
      memoryStore.shift();
    }

    // 2. Save permanently to MongoDB (if configured)
    let mongoSaved = false;
    if (clientPromise) {
      try {
        const client = await clientPromise;
        const db = client.db("sentinel");
        await db.collection("readings").insertOne(reading);
        mongoSaved = true;
      } catch (mongoErr) {
        console.error("MongoDB insert error (falling back to memory):", mongoErr);
      }
    }

    return NextResponse.json({
      status: "success",
      timestamp: reading.timestamp,
      storage: mongoSaved ? "mongodb" : "memory",
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: "error", message: error?.message || "Invalid payload" },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  let latest: TelemetryReading | null = null;
  let readings: TelemetryReading[] = [];
  let totalCount = 0;

  // 1. Try querying MongoDB first
  if (clientPromise) {
    try {
      const client = await clientPromise;
      const db = client.db("sentinel");
      const collection = db.collection<TelemetryReading>("readings");

      totalCount = await collection.countDocuments();
      const mongoDocs = await collection
        .find()
        .sort({ timestamp: -1 })
        .limit(30)
        .toArray();

      if (mongoDocs.length > 0) {
        latest = mongoDocs[0];
        readings = mongoDocs.reverse(); // Return chronological for charts
      }
    } catch (mongoErr) {
      console.error("MongoDB query error (falling back to memory):", mongoErr);
    }
  }

  // 2. Fallback to in-memory store if MongoDB returned nothing or was not configured
  if (!latest && memoryStore.length > 0) {
    latest = memoryStore[memoryStore.length - 1];
    readings = memoryStore.slice(-30);
    totalCount = memoryStore.length;
  }

  // Calculate live online status (active if latest arrived within last 45 seconds)
  let isOnline = false;
  if (latest && latest.timestamp) {
    const diffSeconds = (Date.now() - new Date(latest.timestamp).getTime()) / 1000;
    isOnline = diffSeconds < 45;
  }

  return NextResponse.json({
    is_online: isOnline,
    total_count: totalCount,
    latest: latest,
    readings: readings,
  });
}