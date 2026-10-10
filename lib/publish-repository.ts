import { getSupabaseBrowser } from "./supabase-browser";

export async function listPublishQueue() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("publish_queue")
    .select("*, products(title, score, status)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function enqueueForPublish(productId: string, platform: "shopee"|"mercado_livre"|"tiktok"|"pinterest"|"amazon"|"outros", guardResult: unknown) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("publish_queue")
    .upsert({
      product_id: productId,
      platform,
      status: "VALIDANDO",
      guard_result: guardResult
    }, { onConflict: "product_id,platform" })
    .select()
    .single();

  if (error) throw error;
  return data;
}
