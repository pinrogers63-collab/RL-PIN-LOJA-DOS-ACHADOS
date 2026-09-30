import { getSupabaseBrowser } from "./supabase-browser";

export async function listFeeProfiles() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("fee_profiles")
    .select("*")
    .eq("active", true)
    .order("platform", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function upsertFeeProfile(input: {
  id?: string;
  platform: "shopee"|"mercado_livre"|"tiktok"|"pinterest";
  name: string;
  percentageFee: number;
  fixedFee: number;
  shippingEstimate: number;
  reservePercentage: number;
  adsPercentage: number;
  notes?: string;
}) {
  const supabase = getSupabaseBrowser();
  const payload = {
    id: input.id,
    platform: input.platform,
    name: input.name,
    percentage_fee: input.percentageFee,
    fixed_fee: input.fixedFee,
    shipping_estimate: input.shippingEstimate,
    reserve_percentage: input.reservePercentage,
    ads_percentage: input.adsPercentage,
    notes: input.notes ?? null,
    active: true
  };
  const { data, error } = await supabase
    .from("fee_profiles")
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data;
}
