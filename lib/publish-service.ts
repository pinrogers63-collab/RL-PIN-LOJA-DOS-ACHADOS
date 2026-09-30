import { getSupabaseBrowser } from "./supabase-browser";
import { enqueueForPublish } from "./publish-repository";
import { runGuardian } from "./guardian";
import type { Product } from "./types";

export async function validateAndEnqueue(productId: string) {
  const supabase = getSupabaseBrowser();

  const { data: row, error } = await supabase
    .from("products")
    .select("*, suppliers(status, dispatch_hours, invoice, tracking)")
    .eq("id", productId)
    .single();

  if (error) throw error;

  const product: Product = {
    id: row.id,
    title: row.title,
    platform: row.platform,
    externalId: row.external_id ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sku: row.sku ?? undefined,
    cost: Number(row.cost),
    marketPrice: Number(row.market_price),
    stock: Number(row.stock),
    score: Number(row.score),
    status: row.status,
    supplierId: row.supplier_id ?? undefined,
    updatedAt: row.updated_at
  };

  const guard = runGuardian({
    ...product,
    category: row.category ?? undefined,
    supplierStatus: row.suppliers?.status ?? undefined,
    supplierDispatchHours: row.suppliers?.dispatch_hours ?? undefined,
    hasInvoice: row.suppliers?.invoice ?? undefined,
    hasTracking: row.suppliers?.tracking ?? undefined,
    restrictedCategory: Boolean(row.metadata?.restrictedCategory),
    policyRisk: Number(row.metadata?.policyRisk ?? 0)
  });

  const queued = await enqueueForPublish(productId, row.platform, guard);

  const nextStatus = guard.approved ? "PRONTO" : "BLOQUEADO";
  const { data: finalRow, error: updateError } = await supabase
    .from("publish_queue")
    .update({ status: nextStatus, guard_result: guard })
    .eq("id", queued.id)
    .select()
    .single();

  if (updateError) throw updateError;

  return { guard, queue: finalRow };
}
