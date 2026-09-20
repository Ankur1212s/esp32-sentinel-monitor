import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const store = globalThis.__telemetry_store || [];
  const alerts = store.filter((r) => r.alert);

  return NextResponse.json({
    total_alerts: alerts.length,
    alerts: alerts.slice(-20).reverse(), // Last 20 alerts, newest first
  });
}
