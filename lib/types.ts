export type PlatformId = "shopee" | "mercado_livre" | "tiktok" | "pinterest" | "amazon";

export type ProductStatus =
  | "NOVO"
  | "EM_ALTA"
  | "OBSERVAR"
  | "APROVADO"
  | "SALAO"
  | "PUBLICADO"
  | "DESCARTADO";

export type SupplierStatus = "EM_TESTE" | "HOMOLOGADO" | "BLOQUEADO";

export type Product = {
  id: string;
  externalId?: string;
  title: string;
  platform: PlatformId;
  sourceUrl?: string;
  sku?: string;
  cost: number;
  marketPrice: number;
  stock?: number;
  score?: number;
  status: ProductStatus;
  supplierId?: string;
  updatedAt: string;
};

export type MarketplaceFees = {
  percentageFee: number;
  fixedFee?: number;
  estimatedShipping?: number;
  reservePercentage?: number;
  estimatedAdsPercentage?: number;
};

export type ProfitResult = {
  grossRevenue: number;
  marketplaceFees: number;
  shipping: number;
  reserve: number;
  ads: number;
  productCost: number;
  totalCost: number;
  profit: number;
  marginPercentage: number;
  minimumPrice: number;
  suggestedPrice: number;
  verdict: "EXCELENTE" | "VIAVEL" | "APERTADO" | "AGUARDAR" | "DESCARTAR";
};
