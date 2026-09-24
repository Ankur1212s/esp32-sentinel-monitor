export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { TelemetryReading } from "@/app/api/readings/route";

export async function GET(req: NextRequest) {
  let alerts: TelemetryReading[] = [];
  let totalAlerts = 0;

  if (clientPromise) {
    try {
      const client = await clientPromise;
      const db = client.db("sentinel");
      const collection = db.collection<TelemetryReading>("readings");

      totalAlerts = await collection.countDocuments({ alert: true });
      alerts = await collection
        .find({ alert: true })
        .sort({ timestamp: -1 })
        .limit(20)
        .toArray();
    } catch (err) {
      console.error("MongoDB alerts error:", err);
    }
  }

  // Fallback to memory
  if (alerts.length === 0 && globalThis.__telemetry_store) {
    const memAlerts = globalThis.__telemetry_store.filter((r) => r.alert);
    totalAlerts = memAlerts.length;
    alerts = memAlerts.slice(-20).reverse();
  }

  return NextResponse.json({
    total_alerts: totalAlerts,
    alerts: alerts,
  });
}