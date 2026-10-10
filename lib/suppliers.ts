export type Supplier = {
  id: string;
  name: string;
  status: "EM_TESTE" | "HOMOLOGADO" | "BLOQUEADO";
  channels: string[];
  shipsDirectly: boolean;
  invoice: boolean;
  invoiceMode?: "A_VALIDAR" | "FORNECEDOR_EMITE" | "RL_PIN_EMITE";
  blindShipping?: boolean;
  deliveryDays?: number;
  returnsSupported?: boolean;
  sourceUrl?: string;
  tracking: boolean;
  dispatchHours?: number;
  stockSync: boolean;
  testedOrders: number;
  notes?: string;
};

export function supplierScore(s: Supplier) {
  let score = 0;
  if (s.shipsDirectly) score += 20;
  if (s.invoice) score += 15;
  if (s.blindShipping) score += 5;
  if (s.tracking) score += 15;
  if (s.stockSync) score += 20;
  if ((s.dispatchHours ?? 999) <= 24) score += 15;
  else if ((s.dispatchHours ?? 999) <= 48) score += 8;
  if (s.returnsSupported) score += 5;
  if (s.testedOrders >= 3) score += 5;
  return Math.min(100, score);
}

export function canHomologate(s: Supplier) {
  return supplierScore(s) >= 80 && s.testedOrders >= 3 && s.status !== "BLOQUEADO";
}
