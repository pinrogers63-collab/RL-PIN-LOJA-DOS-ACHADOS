import { validateAndEnqueue } from "@/lib/publish-service";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.productId) {
    return Response.json({ ok:false, error:"productId obrigatório" }, { status:400 });
  }

  try {
    const result = await validateAndEnqueue(String(body.productId));
    return Response.json({ ok:true, ...result });
  } catch (error) {
    return Response.json({
      ok:false,
      error:error instanceof Error ? error.message : "Falha ao validar publicação."
    }, { status:500 });
  }
}
