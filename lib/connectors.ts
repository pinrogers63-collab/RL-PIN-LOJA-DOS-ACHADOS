import type { PlatformId } from "./types";

export type ConnectorState = {
  id: PlatformId;
  name: string;
  connected: boolean;
  mode: "API" | "FEED" | "DISTRIBUICAO";
  primaryWindow: string;
  refreshWindows: string[];
  notes: string;
};

export const connectors: ConnectorState[] = [
  {
    id: "shopee",
    name: "Shopee",
    connected: false,
    mode: "API",
    primaryWindow: "06:00",
    refreshWindows: ["10:00", "15:00"],
    notes: "Aguardando credenciais e validação oficial da integração."
  },
  {
    id: "mercado_livre",
    name: "Mercado Livre",
    connected: false,
    mode: "API",
    primaryWindow: "06:05",
    refreshWindows: ["10:00", "15:00"],
    notes: "Estrutura preparada para itens, preços, estoque e publicação."
  },
  {
    id: "tiktok",
    name: "TikTok Shop",
    connected: false,
    mode: "API",
    primaryWindow: "06:12",
    refreshWindows: ["10:00", "15:00"],
    notes: "Dependente de acesso e permissões da conta."
  },
  {
    id: "amazon",
    name: "Amazon",
    connected: false,
    mode: "API",
    primaryWindow: "06:18",
    refreshWindows: ["10:00", "15:00"],
    notes: "Conector preparado para ativação via Amazon Selling Partner API."
  },
  {
    id: "pinterest",
    name: "Pinterest",
    connected: false,
    mode: "DISTRIBUICAO",
    primaryWindow: "Após aprovação",
    refreshWindows: [],
    notes: "Usado como canal de distribuição/catálogo, não como fonte principal de garimpo."
  }
];
