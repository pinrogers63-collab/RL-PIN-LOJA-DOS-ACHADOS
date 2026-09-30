import { getSupabaseBrowser } from "./supabase-browser";
import type { Supplier } from "./suppliers";

export async function listSuppliers() {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("suppliers")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSupplier(input: Omit<Supplier, "id">) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("suppliers")
    .insert({
      name: input.name,
      status: input.status,
      channels: input.channels,
      ships_directly: input.shipsDirectly,
      invoice: input.invoice,
      tracking: input.tracking,
      dispatch_hours: input.dispatchHours ?? null,
      stock_sync: input.stockSync,
      tested_orders: input.testedOrders,
      notes: input.notes ?? null
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}


export async function updateSupplierTest(id: string, testedOrders: number) {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("suppliers")
    .update({ tested_orders: testedOrders })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSupplierStatus(id: string, status: "EM_TESTE" | "HOMOLOGADO" | "BLOQUEADO") {
  const supabase = getSupabaseBrowser();
  const { data, error } = await supabase
    .from("suppliers")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
