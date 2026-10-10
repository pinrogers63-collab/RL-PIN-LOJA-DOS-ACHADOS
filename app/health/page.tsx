"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { getSystemHealth } from "@/lib/system-health-repository";
import { buildDailySnapshot, listDailySnapshots } from "@/lib/daily-report-repository";
import { downloadCsv } from "@/lib/csv";

export default function HealthPage(){
  const [health,setHealth]=useState<any|null>(null);
  const [snapshots,setSnapshots]=useState<any[]>([]);
  const [readiness,setReadiness]=useState<any|null>(null);
  const [liveConnectors,setLiveConnectors]=useState<any[]>([]);
  const [msg,setMsg]=useState("");

  async function refresh(){
    const [h,s,r,c]=await Promise.all([getSystemHealth(),listDailySnapshots(),fetch("/api/readiness",{cache:"no-store"}),fetch("/api/connectors",{cache:"no-store"})]);
    setHealth(h);setSnapshots(s);
    if(r.ok) setReadiness(await r.json());
    if(c.ok){ const data=await c.json(); setLiveConnectors(data.connectors??[]); }
  }

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      await refresh();
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao abrir saúde do sistema.");}
  })();},[]);

  async function snapshot(){
    try{
      await buildDailySnapshot();
      await refresh();
      setMsg("Snapshot diário atualizado.");
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao gerar snapshot.");}
  }

  function exportSnapshots(){
    downloadCsv("rl-pin-snapshots.csv", snapshots);
    setMsg("CSV de snapshots exportado.");
  }

  if(!health) return <main className="shell"><section className="card panel"><p>Carregando saúde do sistema...</p></section></main>;

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • SAÚDE DO SISTEMA</p><h1>Operação <span>Monitorada</span></h1><p className="sub">Banco, filas, Salão, conectores e snapshots diários.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="metrics">
      <article className="card metric"><small>Banco</small><strong>{health.database}</strong><span>Supabase</span></article>
      <article className="card metric"><small>Produtos</small><strong>{health.products}</strong><span>registros</span></article>
      <article className="card metric"><small>Fila pronta</small><strong>{health.publishReady}</strong><span>publicação</span></article>
      <article className="card metric"><small>Bloqueados</small><strong>{health.publishBlocked}</strong><span>Guardião</span></article>
    </section>

    <section className="card panel">
      <div className="panelTitle">
        <div><p className="eyebrow">PRONTIDÃO EXTERNA</p><h2>O que falta para operar 100%</h2></div>
        <span className="badge">{readiness ? readiness.requiredReady + "/" + readiness.requiredTotal + " essenciais" : "verificando"}</span>
      </div>
      <div className="platforms">
        {readiness?.checks?.map((c:any)=><div className="platform" key={c.id}>
          <div><strong>{c.label}</strong><small>{c.note}</small></div>
          <span className="status">{c.ready ? "PRONTO" : c.required ? "FALTA VOCÊ" : "OPCIONAL"}</span>
        </div>)}
      </div>
    </section>

    <section className="grid2">
      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">CONECTORES</p><h2>Estado atual</h2></div><span className="badge">{liveConnectors.length} fontes</span></div>
        <div className="platforms">{liveConnectors.map((c:any)=><div className="platform" key={c.id}><div><strong>{c.name}</strong><small>{c.notes??"Conector preparado"}</small></div><span className="status">{c.connected?"CONECTADO":"AGUARDANDO"}</span></div>)}</div>
      </article>

      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">RELATÓRIO DIÁRIO</p><h2>Snapshot operacional</h2></div><div className="actions"><button className="secondary" onClick={exportSnapshots}>Exportar CSV</button><button className="primary" onClick={snapshot}>Gerar agora</button></div></div>
        <p className="sub">Últimos registros consolidados da operação.</p>
        <div className="snapshotList">{snapshots.map((s:any)=><div className="snapshotItem" key={s.id}><strong>{new Date(s.snapshot_date+"T12:00:00").toLocaleDateString("pt-BR")}</strong><span>Ativos {s.total_products}</span><span>Válidos {s.valid_products}</span><span>Salão {s.salon_products}</span><span>Publicados {s.published_products}</span></div>)}</div>
      </article>
    </section>
  </main>;
}
