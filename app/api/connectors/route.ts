import { connectors } from "@/lib/connectors";

export async function GET() {
  return Response.json({
    ok: true,
    count: connectors.length,
    connectors
  });
}
