import { getRunnableMarketplaceStatuses } from "@/lib/integration-status";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const connectors = await getRunnableMarketplaceStatuses();
  return Response.json({
    ok: true,
    mode: "SAFE_READY",
    at: new Date().toISOString(),
    tasks: connectors.map((c) => ({
      connector: c.id,
      configured: c.configured,
      connected: c.connected,
      action: c.connected ? "ready_to_refresh" : "skipped_not_connected",
      refresh: ["price", "stock", "trend"]
    }))
  });
}
