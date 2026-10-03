"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { listConnectorRuns } from "@/lib/connector-run-repository";
import { listPublishQueue } from "@/lib/publish-repository";

export default function OperationsPage(){
  const [runs,setRuns]=useState<any[]>([]);
  const [queue,setQueue]=useState<any[]>([]);
  const [msg,setMsg]=useState("");

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      const [r,q]=await Promise.all([listConnectorRuns(50),listPublishQueue()]);
      setRuns(r);setQueue(q);
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao carregar operações.");}
  })();},[]);

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • OPERAÇÕES</p><h1>Execuções & <span>Publicação</span></h1><p className="sub">Monitoramento das coletas, atualizações e fila de publicação.</p></div>
      <a className="secondary linkBtn backBtn" href="/">← Voltar ao painel</a>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="grid2">
      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">JANELAS</p><h2>Agenda operacional</h2></div><span className="badge">BRT</span></div>
        <div className="platforms">
          <div className="platform"><div><strong>06:00</strong><small>Coleta principal</small></div><span className="status">PREPARADO</span></div>
          <div className="platform"><div><strong>10:00</strong><small>Preço, estoque e tendência</small></div><span className="status">PREPARADO</span></div>
          <div className="platform"><div><strong>15:00</strong><small>Última atualização do dia</small></div><span className="status">PREPARADO</span></div>
        </div>
      </article>

      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">PUBLICAÇÃO</p><h2>Fila segura</h2></div><span className="badge">{queue.length} itens</span></div>
        <div className="platforms">{queue.map(q=><div className="platform" key={q.id}><div><strong>{q.products?.title??"Produto"}</strong><small>{q.platform}</small></div><span className="status">{q.status}</span></div>)}
        {!queue.length&&<p className="empty">Nenhum produto aguardando publicação.</p>}</div>
      </article>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">EXECUÇÕES</p><h2>Últimos jobs</h2></div><span className="badge">{runs.length} registros</span></div>
      <div className="tableWrap"><table><thead><tr><th>Data</th><th>Conector</th><th>Tipo</th><th>Status</th><th>Encontrados</th><th>Criados</th><th>Atualizados</th><th>Ignorados</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString("pt-BR")}</td><td>{r.connector_id}</td><td>{r.run_type}</td><td><span className="status">{r.status}</span></td><td>{r.items_found}</td><td>{r.items_created}</td><td>{r.items_updated}</td><td>{r.items_skipped}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
