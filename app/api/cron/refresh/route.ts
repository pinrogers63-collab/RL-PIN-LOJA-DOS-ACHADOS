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

  return Response.json({
    ok: true,
    mode: "DRY_RUN",
    at: new Date().toISOString(),
    tasks: connectors
      .filter((c) => c.id !== "pinterest")
      .map((c) => ({
        connector: c.id,
        connected: c.connected,
        refresh: ["price", "stock", "trend"]
      }))
  });
}
