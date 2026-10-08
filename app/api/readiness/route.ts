import { getStoredMercadoLivreToken } from "@/lib/mercadolivre";

export async function GET() {
  let mercadoLivreAuthorized = false;
  try {
    mercadoLivreAuthorized = Boolean(await getStoredMercadoLivreToken());
  } catch {
    mercadoLivreAuthorized = false;
  }

  const checks = [
    { id: "supabase", label: "Supabase", ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), required: false, note: "Banco e autenticação configurados." },
    { id: "cron", label: "Automação Vercel", ready: Boolean(process.env.CRON_SECRET), required: true, note: "Rotinas 06h, 10h e 15h configuradas." },
    { id: "mercado_livre", label: "Mercado Livre", ready: mercadoLivreAuthorized, required: true, note: mercadoLivreAuthorized ? "OAuth persistido e renovação preparada." : "Falta concluir a autorização OAuth persistente." },
    { id: "shopee", label: "Shopee", ready: Boolean(process.env.SHOPEE_PARTNER_ID && process.env.SHOPEE_PARTNER_KEY && process.env.SHOPEE_SHOP_ID), required: true, note: "Partner ID + Partner Key + Shop ID." },
    { id: "tiktok", label: "TikTok Shop", ready: Boolean(process.env.TIKTOK_SHOP_APP_KEY && process.env.TIKTOK_SHOP_APP_SECRET), required: true, note: "App Key + App Secret." },
    { id: "pinterest", label: "Pinterest", ready: Boolean(process.env.PINTEREST_APP_ID && process.env.PINTEREST_APP_SECRET), required: false, note: "App ID + App Secret para distribuição automatizada." },
    { id: "image_ai", label: "IA de imagens", ready: Boolean(process.env.IMAGE_PROVIDER_API_KEY), required: true, note: "Chave do provedor escolhido para o Salão." },
    { id: "video_ai", label: "IA de vídeo", ready: Boolean(process.env.VIDEO_PROVIDER_API_KEY), required: true, note: "Chave do provedor escolhido para Vitória." },
    { id: "voice_ai", label: "Voz", ready: Boolean(process.env.VOICE_PROVIDER_API_KEY), required: false, note: "Opcional até ativarmos voz automática." }
  ];

  const required = checks.filter(c => c.required);
  const readyCount = required.filter(c => c.ready).length;

  return Response.json({
    ok: true,
    requiredReady: readyCount,
    requiredTotal: required.length,
    operationalPercent: Math.round((readyCount / Math.max(required.length, 1)) * 100),
    checks
  });
}
