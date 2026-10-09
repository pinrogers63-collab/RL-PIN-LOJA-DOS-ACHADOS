export type IntegrationKind = "marketplace" | "distribution" | "creative";

export type IntegrationDefinition = {
  id: string;
  label: string;
  kind: IntegrationKind;
  required: boolean;
  credentialEnv: string[];
  note: string;
  future?: boolean;
};

export const integrationRegistry: IntegrationDefinition[] = [
  {
    id: "mercado_livre",
    label: "Mercado Livre",
    kind: "marketplace",
    required: true,
    credentialEnv: ["MERCADOLIVRE_CLIENT_ID", "MERCADOLIVRE_CLIENT_SECRET"],
    note: "OAuth oficial com token persistido e renovação automática."
  },
  {
    id: "shopee",
    label: "Shopee",
    kind: "marketplace",
    required: true,
    credentialEnv: ["SHOPEE_PARTNER_ID", "SHOPEE_PARTNER_KEY", "SHOPEE_SHOP_ID"],
    note: "Estrutura pronta para receber credenciais oficiais."
  },
  {
    id: "tiktok",
    label: "TikTok Shop",
    kind: "marketplace",
    required: true,
    credentialEnv: ["TIKTOK_SHOP_APP_KEY", "TIKTOK_SHOP_APP_SECRET"],
    note: "Estrutura pronta para autorização da conta."
  },
  {
    id: "pinterest",
    label: "Pinterest",
    kind: "distribution",
    required: false,
    credentialEnv: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
    note: "Canal opcional de distribuição."
  },
  {
    id: "amazon",
    label: "Amazon",
    kind: "marketplace",
    required: false,
    credentialEnv: ["AMAZON_SP_API_CLIENT_ID", "AMAZON_SP_API_CLIENT_SECRET"],
    note: "Conector preparado para ativação oficial quando as credenciais forem liberadas."
  },
  {
    id: "image_ai",
    label: "IA de imagens",
    kind: "creative",
    required: true,
    credentialEnv: ["IMAGE_PROVIDER_API_KEY"],
    note: "Provedor plugável para o Salão."
  },
  {
    id: "video_ai",
    label: "IA de vídeo",
    kind: "creative",
    required: true,
    credentialEnv: ["VIDEO_PROVIDER_API_KEY"],
    note: "Provedor plugável para Vitória."
  },
  {
    id: "voice_ai",
    label: "Voz",
    kind: "creative",
    required: false,
    credentialEnv: ["VOICE_PROVIDER_API_KEY"],
    note: "Provedor opcional de voz."
  }
];

export function credentialsPresent(definition: IntegrationDefinition) {
  return definition.credentialEnv.every((key) => Boolean(process.env[key]));
}

export function integrationById(id: string) {
  return integrationRegistry.find((item) => item.id === id);
}
