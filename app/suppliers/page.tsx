"use client";

import Link from "next/link";
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
  monthly_fee: number | null;
  setup_fee: number | null;
  api_fee: number | null;
  per_order_fee: number | null;
  minimum_balance: number | null;
  lockin_months: number | null;
  cancellation_terms: string | null;
  evidence_url: string | null;
  api_access_verified: boolean;
  tracking: boolean;
  dispatch_hours: number | null;
  stock_sync: boolean;
  tested_orders: number;
  passed_tests: number;
  failed_tests: number;
  notes: string | null;
};

type ResearchRow = {
  id:string;name:string;category:string;modality:string;priority:string;
  status:string;public_price:string;invoice_notes:string;api_notes:string;
  requirements:string;risks:string;evidence_url:string;researched_at:string;
};

export default function SuppliersPage() {
  const [rows,setRows] = useState<SupplierRow[]>([]);
  const [research,setResearch] = useState<ResearchRow[]>([]);
  const [msg,setMsg] = useState("");
  const [form,setForm] = useState({
    name:"", sourceUrl:"", monthlyFee:"", setupFee:"", apiFee:"", perOrderFee:"", minimumBalance:"", lockinMonths:"", cancellationTerms:"", evidenceUrl:"", apiAccessVerified:false, dispatchHours:"", deliveryDays:"", shipsDirectly:false, invoice:false, invoiceMode:"A_VALIDAR" as "A_VALIDAR"|"FORNECEDOR_EMITE"|"RL_PIN_EMITE", blindShipping:false, returnsSupported:false, tracking:false, stockSync:false, notes:""
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
    const {data:radar,error:radarError}=await supabase.from("supplier_research").select("*").order("name");
    if(radarError) setMsg("Pesquisa de fornecedores temporariamente indisponível.");
    else setResearch((radar??[]) as ResearchRow[]);
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

  function money(value:string){
    if(!value.trim()) return undefined;
    const normalized=value.trim().replace(",",".");
    const parsed=Number(normalized);
    if(!Number.isFinite(parsed) || parsed<0) throw new Error("Custo inválido. Use valores como 189,90.");
    return parsed;
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
        monthlyFee:money(form.monthlyFee),
        setupFee:money(form.setupFee),
        apiFee:money(form.apiFee),
        perOrderFee:money(form.perOrderFee),
        minimumBalance:money(form.minimumBalance),
        lockinMonths:form.lockinMonths.trim() ? Number(form.lockinMonths) : undefined,
        cancellationTerms:form.cancellationTerms.trim() || undefined,
        evidenceUrl:form.evidenceUrl.trim() || undefined,
        apiAccessVerified:form.apiAccessVerified,
        tracking:form.tracking,
        dispatchHours:form.dispatchHours.trim() ? Number(form.dispatchHours) : undefined,
        stockSync:form.stockSync,
        testedOrders:0,
        notes:form.notes
      });
      setForm({name:"",sourceUrl:"",monthlyFee:"",setupFee:"",apiFee:"",perOrderFee:"",minimumBalance:"",lockinMonths:"",cancellationTerms:"",evidenceUrl:"",apiAccessVerified:false,dispatchHours:"",deliveryDays:"",shipsDirectly:false,invoice:false,invoiceMode:"A_VALIDAR",blindShipping:false,returnsSupported:false,tracking:false,stockSync:false,notes:""});
      await refresh();
      setMsg("Fornecedor salvo como EM TESTE.");
    }catch(e){ setMsg(e instanceof Error ? e.message : "Falha ao salvar fornecedor."); }
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • FORNECEDORES</p><h1>Homologação <span>Premium</span></h1><p className="sub">Teste antes de confiar estoque, prazo e reputação da loja.</p></div>
      <Link className="secondary linkBtn backBtn" href="/">← Voltar ao painel</Link>
    </header>

    {msg && <div className="notice">{msg}</div>}

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">TRAVA FISCAL</p><h2>Antes da primeira venda</h2></div><span className="status">PENDENTE DE VALIDAÇÃO</span></div>
      <p className="sub">Mercado Livre exige documentação fiscal adequada ao tipo de vendedor e logística. Para NF-e, conferir valor da venda, estado de coleta, emissão e XML. Envio direto por fornecedor em outra cidade/estado requer análise fiscal específica. Não publicar sem validação contábil e logística.</p>
      <a href="https://vendedores.mercadolivre.com.br/nota/como-informar-as-notas-fiscais-no-mercado-livre" target="_blank" rel="noopener noreferrer">Regras oficiais do Mercado Livre sobre NF-e ↗</a>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">PESQUISA INDEPENDENTE</p><h2>Radar de fornecedores e intermediários</h2></div><span className="badge">{research.length} candidatos • 0 aprovados por esta pesquisa</span></div>
      <p className="sub">Informações públicas verificadas em 13/10/2026. Não são propostas comerciais nem contratos. Nenhum fornecedor é homologado automaticamente.</p>
      <div className="platforms">
        {research.map(r=><div className="platform" key={r.id} style={{alignItems:"flex-start"}}>
          <div style={{maxWidth:"100%"}}>
            <strong>{r.name} — {r.category==="FORNECEDOR_DIRETO"?"Fornecedor direto":"Intermediário"}</strong>
            <p><small><b>Modalidade:</b> {r.modality} · <b>Prioridade:</b> {r.priority.replaceAll("_"," ")}</small></p>
            <p><small><b>Custos publicados:</b> {r.public_price}</small></p>
            <p><small><b>Nota fiscal:</b> {r.invoice_notes}</small></p>
            <p><small><b>API:</b> {r.api_notes}</small></p>
            <p><small><b>Requisitos:</b> {r.requirements}</small></p>
            <p><small><b>Riscos e pendências:</b> {r.risks}</small></p>
            <a href={r.evidence_url} target="_blank" rel="noopener noreferrer">Consultar fonte oficial ↗</a>
          </div>
          <span className="status">{r.status.replaceAll("_"," ")}</span>
        </div>)}
      </div>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">NOVO FORNECEDOR</p><h2>Cadastro para teste</h2></div><span className="badge">Nunca homologar sem teste</span></div>
      <form className="supplierForm" onSubmit={add}>
        <input required placeholder="Nome do fornecedor" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <input placeholder="Site / origem do fornecedor" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})}/>
        <div className="panelTitle"><div><p className="eyebrow">CUSTOS E CONTRATO</p><h2>Valores comprovados ou deixar em branco</h2></div></div>
        <input placeholder="Mensalidade (R$)" inputMode="decimal" value={form.monthlyFee} onChange={e=>setForm({...form,monthlyFee:e.target.value})}/>
        <input placeholder="Adesão / instalação (R$)" inputMode="decimal" value={form.setupFee} onChange={e=>setForm({...form,setupFee:e.target.value})}/>
        <input placeholder="Custo de API / integração (R$)" inputMode="decimal" value={form.apiFee} onChange={e=>setForm({...form,apiFee:e.target.value})}/>
        <input placeholder="Taxa por pedido (R$)" inputMode="decimal" value={form.perOrderFee} onChange={e=>setForm({...form,perOrderFee:e.target.value})}/>
        <input placeholder="Recarga / saldo mínimo (R$)" inputMode="decimal" value={form.minimumBalance} onChange={e=>setForm({...form,minimumBalance:e.target.value})}/>
        <input placeholder="Fidelidade em meses" inputMode="numeric" value={form.lockinMonths} onChange={e=>setForm({...form,lockinMonths:e.target.value})}/>
        <input placeholder="Multa e cancelamento (texto)" value={form.cancellationTerms} onChange={e=>setForm({...form,cancellationTerms:e.target.value})}/>
        <input placeholder="Link da fonte / contrato" value={form.evidenceUrl} onChange={e=>setForm({...form,evidenceUrl:e.target.value})}/>
        <label><input type="checkbox" checked={form.apiAccessVerified} onChange={e=>setForm({...form,apiAccessVerified:e.target.checked})}/> API confirmada com evidência</label>
        <p className="sub">Campo vazio significa custo desconhecido, nunca custo zero. Não contratar antes de verificar todos os custos.</p>
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
          <thead><tr><th>Fornecedor</th><th>Status</th><th>Mensalidade</th><th>API</th><th>Fidelidade</th><th>Despacho</th><th>Entrega</th><th>NF</th><th>Envio neutro</th><th>Rastreio</th><th>Devolução</th><th>Sync</th><th>Testes OK</th><th>Falhas</th><th>Score</th><th>Ações</th></tr></thead>
          <tbody>{rows.map(s=>{
            const score=supplierScore({
              id:s.id,name:s.name,status:s.status,channels:s.channels,shipsDirectly:s.ships_directly,invoice:s.invoice,invoiceMode:s.invoice_mode,blindShipping:s.blind_shipping,returnsSupported:s.returns_supported,tracking:s.tracking,dispatchHours:s.dispatch_hours ?? undefined,stockSync:s.stock_sync,testedOrders:s.tested_orders,passedTests:s.passed_tests,failedTests:s.failed_tests,notes:s.notes ?? undefined
            });
            return <tr key={s.id}><td>{s.name}</td><td><span className="status">{s.status}</span></td><td>{s.monthly_fee==null?"A apurar":Number(s.monthly_fee).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td>{s.api_access_verified?"Confirmada":"Não verificada"}</td><td>{s.lockin_months==null?"A apurar":s.lockin_months+" meses"}</td><td>{s.dispatch_hours ?? "-"}h</td><td>{s.delivery_days ?? "-"} dias</td><td>{s.invoice_mode==="FORNECEDOR_EMITE"?"Fornecedor":s.invoice_mode==="RL_PIN_EMITE"?"RL PIN":"A validar"}</td><td>{s.blind_shipping?"Sim":"Não"}</td><td>{s.tracking?"Sim":"Não"}</td><td>{s.returns_supported?"Sim":"Não"}</td><td>{s.stock_sync?"Sim":"Não"}</td><td>{s.passed_tests ?? 0}</td><td>{s.failed_tests ?? 0}</td><td>{score}</td><td className="actions"><button onClick={()=>testSupplier(s.id,true)}>Teste OK</button><button onClick={()=>testSupplier(s.id,false)}>Reprovou</button></td></tr>
          })}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
