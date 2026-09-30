import { getSupabaseBrowser } from "./supabase-browser";
import { canHomologate, supplierScore } from "./suppliers";
import { getSettings } from "./settings-repository";

export async function registerSupplierTest(id: string, passed: boolean) {
  const supabase = getSupabaseBrowser();
  const [{ data: supplier, error }, settings] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id",id).single(),
    getSettings()
  ]);

  if (error) throw error;

  const testedOrders = Number(supplier.tested_orders ?? 0) + 1;
  const mapped = {
    id:supplier.id,
    name:supplier.name,
    status:supplier.status,
    channels:supplier.channels ?? [],
    shipsDirectly:Boolean(supplier.ships_directly),
    invoice:Boolean(supplier.invoice),
    tracking:Boolean(supplier.tracking),
    dispatchHours:supplier.dispatch_hours ?? undefined,
    stockSync:Boolean(supplier.stock_sync),
    testedOrders,
    notes:supplier.notes ?? undefined
  };

  let status = supplier.status;
  if (!passed) status = "EM_TESTE";
  else if (
    settings.auto_homologate_supplier &&
    testedOrders >= settings.min_supplier_tests &&
    supplierScore(mapped) >= 80 &&
    canHomologate({ ...mapped, testedOrders })
  ) {
    status = "HOMOLOGADO";
  }

  const { data, error:updateError } = await supabase
    .from("suppliers")
    .update({ tested_orders: testedOrders, status })
    .eq("id", id)
    .select()
    .single();

  if (updateError) throw updateError;
  return data;
}
