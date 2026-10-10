import { getStoredMercadoLivreToken } from "@/lib/mercadolivre";
import { credentialsPresent, integrationRegistry } from "@/lib/integration-registry";

export async function GET() {
  let mercadoLivreAuthorized = false;
  try {
    mercadoLivreAuthorized = Boolean(await getStoredMercadoLivreToken());
  } catch {}

  const checks = [
    {
      id: "supabase",
      label: "Supabase",
      ready: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      required: false,
      note: "Banco e autenticação configurados."
    },
    {
      id: "cron",
      label: "Automação Vercel",
      ready: Boolean(process.env.CRON_SECRET),
      required: true,
      note: "Rotinas 09h e 15h configuradas."
    },
    ...integrationRegistry.map((item) => ({
      id: item.id,
      label: item.label,
      ready: item.id === "mercado_livre" ? mercadoLivreAuthorized : credentialsPresent(item),
      required: item.required,
      future: Boolean(item.future),
      kind: item.kind,
      note:
        item.id === "mercado_livre"
          ? mercadoLivreAuthorized
            ? "OAuth persistido e renovação preparada."
            : "Estrutura pronta; falta somente autorização OAuth."
          : credentialsPresent(item)
            ? "Credenciais presentes; pronto para validação do provedor."
            : item.note
    }))
  ];

  const required = checks.filter((c) => c.required);
  const readyCount = required.filter((c) => c.ready).length;

  return Response.json({
    ok: true,
    requiredReady: readyCount,
    requiredTotal: required.length,
    operationalPercent: Math.round((readyCount / Math.max(required.length, 1)) * 100),
    architecture: "PLUGGABLE_CONNECTORS",
    checks
  });
}
