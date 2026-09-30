import { getSupabaseBrowser } from "./supabase-browser";
import { salonConcepts, victoryWardrobe } from "./salon";

export async function listSalonEligibleProducts() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .in("status", ["APROVADO", "SALAO"])
    .order("score", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listSalonJobs() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("salon_jobs")
    .select("*, products(title, platform, score)")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSalonJob(product: { id: string; category?: string | null }) {
  const supabase = getSupabaseBrowser();
  const category = product.category ?? "geral";
  const { data, error } = await supabase
    .from("salon_jobs")
    .insert({
      product_id: product.id,
      category,
      selected_concept: salonConcepts[0].id,
      victory_wardrobe: victoryWardrobe(category),
      channels: ["SHOPEE", "MERCADO_LIVRE", "TIKTOK", "PINTEREST"],
      status: "PLANEJADO",
      outputs: {
        concepts: salonConcepts,
        generationConnected: false
      }
    })
    .select()
    .single();

  if (error) throw error;

  const { error: statusError } = await supabase
    .from("products")
    .update({ status: "SALAO" })
    .eq("id", product.id);

  if (statusError) throw statusError;
  return data;
}
