import { getSupabaseBrowser } from "./supabase-browser";

export async function buildDailySnapshot() {
  const supabase = getSupabaseBrowser();

  const [
    { data: products, error: productsError },
    { data: suppliers, error: suppliersError },
    { data: queue, error: queueError }
  ] = await Promise.all([
    supabase.from("products").select("status,score"),
    supabase.from("suppliers").select("status"),
    supabase.from("publish_queue").select("status")
  ]);

  if (productsError) throw productsError;
  if (suppliersError) throw suppliersError;
  if (queueError) throw queueError;

  const snapshot = {
    snapshot_date: new Date().toISOString().slice(0,10),
    total_products: products?.filter((p:any)=>p.status!=="DESCARTADO").length ?? 0,
    valid_products: products?.filter((p:any)=>Number(p.score)>=75 && p.status!=="DESCARTADO").length ?? 0,
    salon_products: products?.filter((p:any)=>p.status==="SALAO").length ?? 0,
    published_products: products?.filter((p:any)=>p.status==="PUBLICADO").length ?? 0,
    discarded_products: products?.filter((p:any)=>p.status==="DESCARTADO").length ?? 0,
    supplier_count: suppliers?.length ?? 0,
    homologated_suppliers: suppliers?.filter((s:any)=>s.status==="HOMOLOGADO").length ?? 0,
    blocked_publish_items: queue?.filter((q:any)=>q.status==="BLOQUEADO").length ?? 0,
    ready_publish_items: queue?.filter((q:any)=>q.status==="PRONTO").length ?? 0
  };

  const { data, error } = await supabase
    .from("daily_snapshots")
    .upsert(snapshot, { onConflict: "owner_id,snapshot_date" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listDailySnapshots(limit=14) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("daily_snapshots")
    .select("*")
    .order("snapshot_date", { ascending:false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
