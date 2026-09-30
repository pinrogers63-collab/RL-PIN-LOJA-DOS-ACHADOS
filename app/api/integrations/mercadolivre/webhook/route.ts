const allowedTopics = new Set([
  "items",
  "orders_v2",
  "shipments",
  "questions",
  "payments",
  "messages"
]);

export async function POST(request: Request) {
  const payload = await request.json().catch(()=>null);

  if (!payload || typeof payload !== "object") {
    return Response.json({ ok:false }, { status:400 });
  }

  const topic = typeof (payload as any).topic === "string" ? (payload as any).topic : "";
  const resource = typeof (payload as any).resource === "string" ? (payload as any).resource : "";

  if (!allowedTopics.has(topic) || !resource.startsWith("/")) {
    return Response.json({ ok:true, ignored:true });
  }

  console.log("[RL PIN][Mercado Livre webhook]", { topic, resource });

  return Response.json({ ok:true });
}
