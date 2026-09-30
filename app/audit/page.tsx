"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { listAuditEvents } from "@/lib/history-repository";

type EventRow = {
  id:string;
  actor:string;
  action:string;
  entity_type:string;
  reason:string|null;
  created_at:string;
};

export default function AuditPage(){
  const [rows,setRows]=useState<EventRow[]>([]);
  const [msg,setMsg]=useState("");

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      setRows(await listAuditEvents(100) as EventRow[]);
    }catch(e){setMsg(e instanceof Error ? e.message : "Falha ao carregar auditoria.");}
  })();},[]);

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • AUDITORIA</p><h1>Histórico <span>Operacional</span></h1><p className="sub">Quem mudou, o que mudou e quando mudou.</p></div>
      <a className="secondary linkBtn" href="/">Voltar ao painel</a>
    </header>
    {msg && <div className="notice">{msg}</div>}
    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">ÚLTIMOS EVENTOS</p><h2>Trilha de auditoria</h2></div><span className="badge">{rows.length} eventos</span></div>
      <div className="tableWrap">
        <table>
          <thead><tr><th>Data</th><th>Ator</th><th>Ação</th><th>Entidade</th><th>Motivo</th></tr></thead>
          <tbody>{rows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString("pt-BR")}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.entity_type}</td><td>{r.reason ?? "-"}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  </main>;
}
