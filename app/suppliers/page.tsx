"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { createSupplier, listSuppliers } from "@/lib/supplier-repository";
import { supplierScore } from "@/lib/suppliers";
import { registerSupplierTest } from "@/lib/supplier-automation";

type SupplierRow = {
  id: string;
  name: string;
  status: "EM_TESTE" | "HOMOLOGADO" | "BLOQUEADO";
  channels: string[];
  ships_directly: boolean;
  invoice: boolean;
  invoice_mode: "A_VALIDAR" | "FORNECEDOR_EMITE" | "RL_PIN_EMITE";
  blind_shipping: boolean;
  delivery_days: number | null;
  returns_supported: boolean;
  source_url: string | null;
  tracking: boolean;
  dispatch_hours: number | null;
  stock_sync: boolean;
  tested_orders: number;
  notes: string | null;
};

export default function SuppliersPage() {
  const [rows,setRows] = useState<SupplierRow[]>([]);
  const [msg,setMsg] = useState("");
  const [form,setForm] = useState({
    name:"", sourceUrl:"", dispatchHours:"24", deliveryDays:"", shipsDirectly:true, invoice:true, invoiceMode:"A_VALIDAR" as "A_VALIDAR"|"FORNECEDOR_EMITE"|"RL_PIN_EMITE", blindShipping:false, returnsSupported:false, tracking:true, stockSync:false, notes:""
  });

  async function refresh(){
    try{ setRows(await listSuppliers() as SupplierRow[]); }
    catch(e){ setMsg(e instanceof Error ? e.message : "Falha ao carregar fornecedores."); }
  }

  useEffect(()=>{(async()=>{
    const supabase=getSupabaseBrowser();
    const {data}=await supabase.auth.getSession();
    if(!data.session){ window.location.href="/login"; return; }
    await refresh();
  })();},[]);

  async function testSupplier(id:string, passed:boolean){
    setMsg("");
    try{
      const updated:any = await registerSupplierTest(id, passed);
      await refresh();
      setMsg(passed
        ? `Teste registrado. Status atual: ${updated.status}.`
        : "Teste reprovado registrado. Fornecedor permanece em avaliação.");
    }catch(e){setMsg(e instanceof Error ? e.message : "Falha ao registrar teste.");}
  }

  async function add(e:React.FormEvent){
    e.preventDefault(); setMsg("");
    try{
      await createSupplier({
        name:form.name.trim(),
        status:"EM_TESTE",
        channels:[],
        shipsDirectly:form.shipsDirectly,
        invoice:form.invoice,
        invoiceMode:form.invoiceMode,
        blindShipping:form.blindShipping,
        deliveryDays:form.deliveryDays ? Number(form.deliveryDays) : undefined,
        returnsSupported:form.returnsSupported,
        sourceUrl:form.sourceUrl.trim() || undefined,
        tracking:form.tracking,
        dispatchHours:Number(form.dispatchHours||"0"),
        stockSync:form.stockSync,
        testedOrders:0,
        notes:form.notes
      });
      setForm({name:"",sourceUrl:"",dispatchHours:"24",deliveryDays:"",shipsDirectly:true,invoice:true,invoiceMode:"A_VALIDAR",blindShipping:false,returnsSupported:false,tracking:true,stockSync:false,notes:""});
      await refresh();
      setMsg("Fornecedor salvo como EM TESTE.");
    }catch(e){ setMsg(e instanceof Error ? e.message : "Falha ao salvar fornecedor."); }
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • FORNECEDORES</p><h1>Homologação <span>Premium</span></h1><p className="sub">Teste antes de confiar estoque, prazo e reputação da loja.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>

    {msg && <div className="notice">{msg}</div>}

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">NOVO FORNECEDOR</p><h2>Cadastro para teste</h2></div><span className="badge">Nunca homologar sem teste</span></div>
      <form className="supplierForm" onSubmit={add}>
        <input required placeholder="Nome do fornecedor" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <input placeholder="Site / origem do fornecedor" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/>
        <input placeholder="Despacho em horas" inputMode="numeric" value={form.dispatchHours} onChange={e=>setForm({...form,dispatchHours:e.target.value})}/>
        <input placeholder="Entrega estimada em dias" inputMode="numeric" value={form.deliveryDays} onChange={e=>setForm({...form,deliveryDays:e.target.value})}/>
        <select value={form.invoiceMode} onChange={e=>setForm({...form,invoiceMode:e.target.value as any})}><option value="A_VALIDAR">NF: a validar</option><option value="FORNECEDOR_EMITE">NF: fornecedor emite</option><option value="RL_PIN_EMITE">NF: RL PIN emite</option></select>
        <label><input type="checkbox" checked={form.shipsDirectly} onChange={e=>setForm({...form,shipsDirectly:e.target.checked})}/> Envia direto</label>
        <label><input type="checkbox" checked={form.invoice} onChange={e=>setForm({...form,invoice:e.target.checked})}/> Nota fiscal</label>
        <label><input type="checkbox" checked={form.blindShipping} onChange={e=>setForm({...form,blindShipping:e.target.checked})}/> Envio sem marca do fornecedor</label>
        <label><input type="checkbox" checked={form.returnsSupported} onChange={e=>setForm({...form,returnsSupported:e.target.checked})}/> Aceita devolução</label>
        <label><input type="checkbox" checked={form.tracking} onChange={e=>setForm({...form,tracking:e.target.checked})}/> Rastreio</label>
        <label><input type="checkbox" checked={form.stockSync} onChange={e=>setForm({...form,stockSync:e.target.checked})}/> Estoque sincronizado</label>
        <input placeholder="Observações" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
        <button className="primary" type="submit">Salvar fornecedor</button>
      </form>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">HOMOLOGAÇÃO</p><h2>Fornecedores cadastrados</h2></div><span className="badge">{rows.length} fornecedores</span></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Fornecedor</th><th>Status</th><th>Despacho</th><th>Entrega</th><th>NF</th><th>Envio neutro</th><th>Rastreio</th><th>Devolução</th><th>Sync</th><th>Testes</th><th>Score</th><th>Ações</th></tr></thead>
          <tbody>{rows.map(s=>{
            const score=supplierScore({
              id:s.id,name:s.name,status:s.status,channels:s.channels,shipsDirectly:s.ships_directly,invoice:s.invoice,tracking:s.tracking,dispatchHours:s.dispatch_hours ?? undefined,stockSync:s.stock_sync,testedOrders:s.tested_orders,notes:s.notes ?? undefined
            });
            return <tr key={s.id}><td>{s.name}</td><td><span className="status">{s.status}</span></td><td>{s.dispatch_hours ?? "-"}h</td><td>{s.delivery_days ?? "-"} dias</td><td>{s.invoice_mode==="FORNECEDOR_EMITE"?"Fornecedor":s.invoice_mode==="RL_PIN_EMITE"?"RL PIN":"A validar"}</td><td>{s.blind_shipping?"Sim":"Não"}</td><td>{s.tracking?"Sim":"Não"}</td><td>{s.returns_supported?"Sim":"Não"}</td><td>{s.stock_sync?"Sim":"Não"}</td><td>{s.tested_orders}</td><td>{score}</td><td className="actions"><button onClick={()=>testSupplier(s.id,true)}>Teste OK</button><button onClick={()=>testSupplier(s.id,false)}>Reprovou</button></td></tr>
          })}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
