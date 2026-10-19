"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { listConnectorRuns } from "@/lib/connector-run-repository";
import { listPublishQueue } from "@/lib/publish-repository";

export default function OperationsPage(){
  const [runs,setRuns]=useState<any[]>([]);
  const [queue,setQueue]=useState<any[]>([]);
  const [msg,setMsg]=useState("");
  const [mlStatus,setMlStatus]=useState<any|null>(null);
  const [trends,setTrends]=useState<{keyword:string;url:string|null}[]>([]);
  const [trendLoading,setTrendLoading]=useState(false);
  const [trendFetched,setTrendFetched]=useState(false);
  const [savedTrends,setSavedTrends]=useState<any[]>([]);
  const [trendRuns,setTrendRuns]=useState<any[]>([]);
  const [listingQuery,setListingQuery]=useState("");
  const [listingResults,setListingResults]=useState<any[]>([]);
  const [listingLoading,setListingLoading]=useState(false);
  const [listingChecked,setListingChecked]=useState(false);

  useEffect(()=>{(async()=>{
    try{
      const supabase=getSupabaseBrowser();
      const {data}=await supabase.auth.getSession();
      if(!data.session){window.location.href="/login";return;}
      const [r,q,mlRes]=await Promise.all([listConnectorRuns(50),listPublishQueue(),fetch("/api/integrations/mercadolivre/status",{cache:"no-store"})]);
      setRuns(r);setQueue(q);
      const [saved,history]=await Promise.all([
        supabase.from("marketplace_trends").select("*").eq("platform","mercado_livre").order("last_seen_at",{ascending:false}).limit(50),
        supabase.from("marketplace_trend_runs").select("*").eq("platform","mercado_livre").order("created_at",{ascending:false}).limit(10)
      ]);
      if(!saved.error) setSavedTrends(saved.data??[]);
      if(!history.error) setTrendRuns(history.data??[]);
      if(mlRes.ok) setMlStatus(await mlRes.json());
    }catch(e){setMsg(e instanceof Error?e.message:"Falha ao carregar operações.");}
  })();},[]);

  async function loadTrends(){
    setTrendLoading(true);setMsg("");
    try {
      const {data:sessionData}=await getSupabaseBrowser().auth.getSession();
      if(!sessionData.session) throw new Error("Entre novamente na sua conta.");
      const response=await fetch("/api/integrations/mercadolivre/trends",{cache:"no-store",headers:{authorization:`Bearer ${sessionData.session.access_token}`}});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error??"Falha ao consultar tendências.");
      setTrends(data.trends??[]);setTrendFetched(true);
    }catch(e){setMsg(e instanceof Error?e.message:"Não foi possível consultar tendências.");}
    finally{setTrendLoading(false);}
  }

  async function searchListings(keyword:string){
    setListingQuery(keyword);setListingResults([]);setListingLoading(true);setListingChecked(false);setMsg("");
    try{
      const {data}=await getSupabaseBrowser().auth.getSession();
      if(!data.session) throw new Error("Entre novamente na sua conta.");
      const response=await fetch("/api/integrations/mercadolivre/listing-search?q="+encodeURIComponent(keyword),{
        cache:"no-store",headers:{Authorization:`Bearer ${data.session.access_token}`}
      });
      const result=await response.json();
      if(!response.ok) throw new Error(result.error??"Pesquisa indisponível.");
      setListingResults(result.results??[]);setListingChecked(true);
    }catch(e){setMsg(e instanceof Error?e.message:"Não foi possível pesquisar anúncios.");}
    finally{setListingLoading(false);}
  }

  return <main className="shell">
    <header className="topbar">
      <div><p className="eyebrow">RL PIN • OPERAÇÕES</p><h1>Execuções & <span>Publicação</span></h1><p className="sub">Monitoramento das coletas, atualizações e fila de publicação.</p></div>
      <Link className="secondary linkBtn backBtn" href="/">← Voltar ao painel</Link>
    </header>
    {msg&&<div className="notice">{msg}</div>}

    <section className="grid2">
      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">JANELAS</p><h2>Agenda operacional</h2></div><span className="badge">Horário de Brasília</span></div>
        <div className="platforms">
          <div className="platform"><div><strong>09:00</strong><small>Coleta principal (integração em desenvolvimento)</small></div><span className="status">AGENDADO</span></div>
          <div className="platform"><div><strong>15:00</strong><small>Preço, estoque e tendência (integração em desenvolvimento)</small></div><span className="status">AGENDADO</span></div>
        </div>
      </article>

      <article className="card panel">
        <div className="panelTitle"><div><p className="eyebrow">PUBLICAÇÃO</p><h2>Fila segura</h2></div><span className="badge">{queue.length} itens</span></div>
        <div className="platforms">{queue.map(q=><div className="platform" key={q.id}><div><strong>{q.products?.title??"Produto"}</strong><small>{q.platform}</small></div><span className="status">{q.status}</span></div>)}
        {!queue.length&&<p className="empty">Nenhum produto aguardando publicação.</p>}</div>
      </article>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">MERCADO LIVRE</p><h2>Conector oficial</h2></div><span className="badge">{mlStatus?.connected?"CONECTADO":"AGUARDANDO AUTORIZAÇÃO"}</span></div>
      <div className="platforms">
        <div className="platform"><div><strong>OAuth</strong><small>{mlStatus?.connected?"Conta autorizada e token persistido":"Autorização OAuth necessária"}</small></div>{mlStatus?.connected?<span className="status">CONECTADO</span>:<a className="primary linkBtn" href="/api/integrations/mercadolivre/start">Conectar Mercado Livre</a>}</div>
        <div className="platform"><div><strong>Callback</strong><small>Endpoint OAuth seguro</small></div><span className="status">PRONTO</span></div>
        <div className="platform"><div><strong>Webhook</strong><small>Endpoint disponível; recebimento real ainda não validado</small></div><span className="status">AGUARDA TESTE</span></div>
      </div>
    </section>

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">GARIMPO • MERCADO LIVRE</p><h2>Tendências reais do Brasil</h2></div><button className="primary" disabled={!mlStatus?.connected || trendLoading} onClick={loadTrends}>{trendLoading?"Consultando...":"Buscar tendências"}</button></div>
      <p className="sub">Dados da API oficial. São buscas em alta, não produtos de fornecedores nem garantia de vendas. Nenhum item será publicado automaticamente.</p>
      {savedTrends.length>0 && <p className="sub"><b>{savedTrends.length} termos salvos automaticamente.</b> Última coleta: {new Date(savedTrends[0].last_seen_at).toLocaleString("pt-BR")}.</p>}
      {trendRuns.length>0 && <p className="sub">Última rotina: {trendRuns[0].status==="SUCCESS"?"SUCESSO":"FALHA"} em {new Date(trendRuns[0].created_at).toLocaleString("pt-BR")} ({trendRuns[0].items_found} termos).</p>}
      {trendFetched && <span className="badge">{trends.length} tendências consultadas agora</span>}
      {!trendFetched && savedTrends.map((t,i)=><div className="platform" key={t.keyword_key}><div><strong>{i+1}. {t.keyword}</strong><small>Visto {t.observations} vez(es) na coleta • última: {new Date(t.last_seen_at).toLocaleDateString("pt-BR")}</small></div><div className="actions"><button disabled={listingLoading} onClick={()=>searchListings(t.keyword)}>Ver anúncios</button>{t.source_url?<a className="secondary linkBtn" href={t.source_url} target="_blank" rel="noopener noreferrer">Abrir busca ↗</a>:null}</div></div>)}
      <div className="platforms">{trends.map((t,i)=><div className="platform" key={t.keyword+"-"+i}><div><strong>{i+1}. {t.keyword}</strong><small>Pesquisa em destaque no Mercado Livre</small></div>{t.url?<a className="secondary linkBtn" href={t.url} target="_blank" rel="noopener noreferrer">Ver busca ↗</a>:null}</div>)}</div>
    </section>

    {(listingLoading || listingChecked) && <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">PESQUISA DE PRODUTOS</p><h2>{listingQuery}</h2></div><span className="badge">{listingLoading?"Consultando...":listingResults.length+" anúncios"}</span></div>
      <p className="sub">Resultados da API oficial do Mercado Livre. Preço anunciado não é custo de fornecedor. Antes de vender: localizar fornecedor autorizado, NF, estoque e margem real.</p>
      <div className="platforms">{listingResults.map(p=><div className="platform" key={p.id}><div><strong>{p.title}</strong><small>{p.id} • {p.price==null?"Preço indisponível":Number(p.price).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} • estoque anunciado: {p.stock??"não informado"}</small></div>{p.url?<a className="secondary linkBtn" href={p.url} target="_blank" rel="noopener noreferrer">Ver anúncio ↗</a>:null}</div>)}</div>
      {!listingLoading && listingResults.length===0 && <p className="empty">Nenhum anúncio retornado pela API para este termo.</p>}
    </section>}

    <section className="card panel">
      <div className="panelTitle"><div><p className="eyebrow">EXECUÇÕES</p><h2>Últimos jobs</h2></div><span className="badge">{runs.length} registros</span></div>
      <div className="tableWrap"><table><thead><tr><th>Data</th><th>Conector</th><th>Tipo</th><th>Status</th><th>Encontrados</th><th>Criados</th><th>Atualizados</th><th>Ignorados</th></tr></thead><tbody>{runs.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString("pt-BR")}</td><td>{r.connector_id}</td><td>{r.run_type}</td><td><span className="status">{r.status}</span></td><td>{r.items_found}</td><td>{r.items_created}</td><td>{r.items_updated}</td><td>{r.items_skipped}</td></tr>)}</tbody></table></div>
    </section>
  </main>;
}
