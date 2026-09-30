import { connectors } from "@/lib/connectors";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const now = new Date().toISOString();
  return Response.json({
    ok: true,
    mode: "DRY_RUN",
    at: now,
    connectors: connectors.map((c) => ({
      id: c.id,
      connected: c.connected,
      action: c.connected ? "ready_to_collect" : "skipped_not_connected"
    })),
    note: "Cron operacional preparado sem inventar coleta externa enquanto as APIs não estiverem conectadas."
  });
}
