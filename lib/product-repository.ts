import { getSupabaseBrowser } from "./supabase-browser";
import { productFingerprint } from "./scoring";
import type { Product, ProductStatus } from "./types";

export async function listProducts() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("score", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createProduct(input: Omit<Product, "id" | "updatedAt">) {
  const supabase = getSupabaseBrowser();
  const fingerprint = productFingerprint(input);

  const { data, error } = await supabase
    .from("products")
    .insert({
      platform: input.platform,
      external_id: input.externalId ?? null,
      sku: input.sku ?? null,
      source_url: input.sourceUrl ?? null,
      title: input.title,
      cost: input.cost,
      market_price: input.marketPrice,
      stock: input.stock ?? 0,
      score: input.score ?? 0,
      status: input.status,
      supplier_id: input.supplierId ?? null,
      fingerprint
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProductStatus(id: string, status: ProductStatus) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("products")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateProductSnapshot(
  id: string,
  patch: { marketPrice?: number; cost?: number; stock?: number; score?: number; status?: ProductStatus }
) {
  const supabase = getSupabaseBrowser();

  const payload: Record<string, unknown> = {};
  if (patch.marketPrice !== undefined) payload.market_price = patch.marketPrice;
  if (patch.cost !== undefined) payload.cost = patch.cost;
  if (patch.stock !== undefined) payload.stock = patch.stock;
  if (patch.score !== undefined) payload.score = patch.score;
  if (patch.status !== undefined) payload.status = patch.status;

  const { data, error } = await supabase
    .from("products")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
