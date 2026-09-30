import { calculateProfit } from "./calculator";
import { getSupabaseBrowser } from "./supabase-browser";
import type { MarketplaceFees } from "./types";

export async function calculateWithActiveProfile(input: {
  platform: "shopee"|"mercado_livre"|"tiktok"|"pinterest";
  productCost: number;
  salePrice: number;
}) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("fee_profiles")
    .select("*")
    .eq("platform", input.platform)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Nenhum perfil de taxas ativo para esta plataforma.");

  const fees: MarketplaceFees = {
    percentageFee: Number(data.percentage_fee ?? 0),
    fixedFee: Number(data.fixed_fee ?? 0),
    estimatedShipping: Number(data.shipping_estimate ?? 0),
    reservePercentage: Number(data.reserve_percentage ?? 0),
    estimatedAdsPercentage: Number(data.ads_percentage ?? 0)
  };

  return {
    profile: data,
    result: calculateProfit(input.productCost, input.salePrice, fees)
  };
}
