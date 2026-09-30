import { getSupabaseBrowser } from "./supabase-browser";

export async function getProductHistory(productId: string) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("product_history")
    .select("*")
    .eq("product_id", productId)
    .order("captured_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listAuditEvents(limit = 100) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("audit_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
