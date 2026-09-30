import { channelFormats, salonConcepts, victoryWardrobe } from "@/lib/salon";

export async function POST(request: Request) {
  const body = await request.json();
  const category = String(body.category ?? "geral");
  const channels = Array.isArray(body.channels) && body.channels.length
    ? body.channels
    : ["SHOPEE", "MERCADO_LIVRE", "TIKTOK", "PINTEREST"];

  const formats = Object.fromEntries(
    channels
      .filter((c: string) => c in channelFormats)
      .map((c: string) => [c, channelFormats[c as keyof typeof channelFormats]])
  );

  return Response.json({
    ok: true,
    concepts: salonConcepts,
    victoryWardrobe: victoryWardrobe(category),
    formats,
    generationConnected: false,
    note: "Estrutura pronta. Geração real será habilitada somente após conexão do provedor de IA."
  });
}
