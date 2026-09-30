"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { createProduct, listProducts, updateProductStatus } from "@/lib/product-repository";
import { getProductHistory } from "@/lib/history-repository";

type Status = "NOVO" | "EM_ALTA" | "OBSERVAR" | "APROVADO" | "SALAO" | "PUBLICADO" | "DESCARTADO";
type PlatformId = "shopee" | "mercado_livre" | "tiktok" | "pinterest";

type CloudProduct = {
  id: string;
  title: string;
  platform: PlatformId;
  cost: number;
  market_price: number;
  stock: number;
  score: number;
  status: Status;
  updated_at?: string;
};

const platformLabel: Record<PlatformId,string> = {
  shopee: "Shopee",
  mercado_livre: "Mercado Livre",
  tiktok: "TikTok Shop",
  pinterest: "Pinterest"
};

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function margin(p: CloudProduct) {
  if (!p.market_price) return 0;
  return Math.round(((p.market_price - p.cost) / p.market_price) * 100);
}

export default function Dashboard() {
  const [products, setProducts] = useState<CloudProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloudReady, setCloudReady] = useState(false);
  const [message, setMessage] = useState("");
  const [historyTitle, setHistoryTitle] = useState("");
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    platform: "shopee" as PlatformId,
    cost: "",
    marketPrice: "",
    stock: ""
  });

  async function refresh() {
    try {
      const rows = await listProducts();
      setProducts(rows as CloudProduct[]);
      setCloudReady(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao carregar a esteira em nuvem.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseBrowser();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          window.location.href = "/login";
          return;
        }
        await refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Falha ao iniciar a RL PIN.");
        setLoading(false);
      }
    })();
  }, []);

  const active = useMemo(() => products.filter((p) => p.status !== "DESCARTADO"), [products]);
  const champion = useMemo(() => [...active].sort((a,b) => b.score-a.score)[0], [active]);

  const metrics = {
    total: active.length,
    valid: active.filter((p) => p.score >= 75).length,
    salon: active.filter((p) => p.status === "SALAO").length,
    publish: active.filter((p) => p.status === "APROVADO" || p.status === "PUBLICADO").length,
    discarded: products.filter((p) => p.status === "DESCARTADO").length
  };

  async function addProduct(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    const cost = Number(form.cost.replace(",", "."));
    const marketPrice = Number(form.marketPrice.replace(",", "."));
    const stock = Number(form.stock || "0");

    if (!form.title.trim() || !Number.isFinite(cost) || !Number.isFinite(marketPrice)) {
      setMessage("Preencha nome, custo e preço de mercado corretamente.");
      return;
    }

    const rawMargin = marketPrice > 0 ? ((marketPrice - cost) / marketPrice) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(rawMargin * 2 + (stock > 0 ? 20 : 0))));
    const status: Status = score >= 80 ? "EM_ALTA" : score >= 65 ? "OBSERVAR" : "NOVO";

    try {
      await createProduct({
        title: form.title.trim(),
        platform: form.platform,
        cost,
        marketPrice,
        stock,
        score,
        status
      });
      setForm({ title: "", platform: "shopee", cost: "", marketPrice: "", stock: "" });
      await refresh();
      setMessage("Produto salvo no banco real da RL PIN.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "Falha ao salvar produto.";
      setMessage(text.includes("duplicate") ? "Este produto já existe na esteira." : text);
    }
  }

  async function changeStatus(id: string, status: Status) {
    setMessage("");
    try {
      await updateProductStatus(id, status);
      await refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao atualizar status.");
    }
  }

  async function openHistory(p: CloudProduct) {
    try {
      setHistoryTitle(p.title);
      setHistoryRows(await getProductHistory(p.id));
      setHistoryOpen(true);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao carregar histórico.");
    }
  }

  async function signOut() {
    const supabase = getSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return <main className="shell"><section className="card panel"><p>Carregando RL PIN V5 Premium...</p></section></main>;
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">RL PIN • CENTRAL DE OPERAÇÕES</p>
          <h1>Loja dos Achados <span>V5 Premium</span></h1>
          <p className="sub">Garimpo → Guardião → Margem → Salão → Vitória → Publicação</p>
        </div>
        <div className="topActions">
          <div className="sync">
            <span className={cloudReady ? "dot online" : "dot"} />
            <div>
              <strong>{cloudReady ? "Banco em nuvem conectado" : "Banco não conectado"}</strong>
              <small>Coletas planejadas: 06:00 • 10:00 • 15:00</small>
            </div>
          </div>
          <a className="secondary linkBtn" href="/suppliers">Fornecedores</a>
          <a className="secondary linkBtn" href="/salon">Salão</a>
          <a className="secondary linkBtn" href="/audit">Auditoria</a>
          <button className="secondary" onClick={signOut}>Sair</button>
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      <section className="metrics">
        <article className="card metric"><small>Na esteira</small><strong>{metrics.total}</strong><span>produtos ativos</span></article>
        <article className="card metric"><small>Válidos</small><strong>{metrics.valid}</strong><span>score ≥ 75</span></article>
        <article className="card metric"><small>No Salão</small><strong>{metrics.salon}</strong><span>em criação premium</span></article>
        <article className="card metric"><small>Descartados</small><strong>{metrics.discarded}</strong><span>fora da operação</span></article>
      </section>

      <section className="card panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">IMPORTADOR CLOUD</p>
            <h2>Adicionar produto à esteira real</h2>
          </div>
          <span className="badge">Supabase ativo</span>
        </div>

        <form className="productForm" onSubmit={addProduct}>
          <input placeholder="Nome do produto" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as PlatformId })}>
            <option value="shopee">Shopee</option>
            <option value="mercado_livre">Mercado Livre</option>
            <option value="tiktok">TikTok Shop</option>
            <option value="pinterest">Pinterest</option>
          </select>
          <input placeholder="Custo R$" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <input placeholder="Preço mercado R$" inputMode="decimal" value={form.marketPrice} onChange={(e) => setForm({ ...form, marketPrice: e.target.value })} />
          <input placeholder="Estoque" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <button className="primary" type="submit">+ Salvar na nuvem</button>
        </form>
      </section>

      <section className="grid2">
        <article className="card panel">
          <div className="panelTitle">
            <div><p className="eyebrow">FONTES</p><h2>Plataformas</h2></div>
            <span className="badge">06h • 10h • 15h</span>
          </div>
          <div className="platforms">
            {[
              ["shopee", "06:00"],
              ["mercado_livre", "06:05"],
              ["tiktok", "06:12"],
              ["pinterest", "Distribuição"]
            ].map(([id, next]) => (
              <div className="platform" key={id}>
                <div><strong>{platformLabel[id as PlatformId]}</strong><small>Próxima: {next}</small></div>
                <div className="platformRight"><b>{active.filter((p) => p.platform === id).length}</b><span>não conectado</span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="card panel hero">
          <p className="eyebrow">PRODUTO CAMPEÃO DO DIA</p>
          <h2>{champion?.title ?? "Aguardando produtos"}</h2>
          <p>Ranking provisório pelo maior score. O motor avançado já está preparado para incluir tendência, concorrência, fornecedor e risco de política.</p>
          <div className="heroScore">
            <div><span>Score</span><strong>{champion?.score ?? 0}</strong></div>
            <div><span>Margem bruta</span><strong>{champion ? margin(champion) : 0}%</strong></div>
            <div><span>Estoque</span><strong>{champion?.stock ?? 0}</strong></div>
          </div>
        </article>
      </section>

      <section className="card panel">
        <div className="panelTitle">
          <div><p className="eyebrow">ESTEIRA CLOUD</p><h2>Produtos em operação</h2></div>
          <span className="badge">{metrics.publish} aprovados/publicados</span>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Produto</th><th>Origem</th><th>Custo</th><th>Mercado</th><th>Margem</th><th>Score</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td>
                  <td>{platformLabel[p.platform]}</td>
                  <td>{brl(p.cost)}</td>
                  <td>{brl(p.market_price)}</td>
                  <td>{margin(p)}%</td>
                  <td>{p.score}</td>
                  <td><span className="status">{p.status}</span></td>
                  <td className="actions">
                    <button onClick={() => changeStatus(p.id, "APROVADO")}>Aprovar</button>
                    <button onClick={() => changeStatus(p.id, "SALAO")}>Salão</button>
                    <button onClick={() => openHistory(p)}>Histórico</button>
                    <button onClick={() => changeStatus(p.id, "DESCARTADO")}>Descartar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!active.length && <p className="empty">Nenhum produto ainda. A esteira real está pronta para receber os primeiros itens.</p>}
        </div>
      </section>

      <section className="grid3">
        <article className="card mini"><p className="eyebrow">GUARDIÃO RL</p><h3>Conformidade antes do Salão</h3><p>Marca, restrições, estoque, prazo, política e fornecedor.</p><span className="badge">motor inicial pronto</span></article>
        <article className="card mini"><p className="eyebrow">CALCULADORA</p><h3>Preço e lucro automático</h3><p>Taxas, custo, frete, reserva, lucro e preço recomendado.</p><span className="badge">API pronta</span></article>
        <article className="card mini"><p className="eyebrow">SALÃO DA VITÓRIA</p><h3>4 conceitos cinematográficos</h3><p>Imagem premium, copy por canal e vídeo curto da Vitória.</p><span className="badge">estrutura pronta</span></article>
      </section>

      {historyOpen && (
        <div className="modalBackdrop" onClick={() => setHistoryOpen(false)}>
          <section className="card modal" onClick={(e) => e.stopPropagation()}>
            <div className="panelTitle">
              <div><p className="eyebrow">HISTÓRICO DO PRODUTO</p><h2>{historyTitle}</h2></div>
              <button className="secondary" onClick={() => setHistoryOpen(false)}>Fechar</button>
            </div>
            <div className="historyGrid">
              {historyRows.map((h) => (
                <div className="historyItem" key={h.id}>
                  <strong>{new Date(h.captured_at).toLocaleString("pt-BR")}</strong>
                  <span>Preço: {brl(Number(h.market_price ?? 0))}</span>
                  <span>Custo: {brl(Number(h.cost ?? 0))}</span>
                  <span>Estoque: {h.stock ?? 0}</span>
                  <span>Score: {h.score ?? 0}</span>
                  <span>Status: {h.status ?? "-"}</span>
                </div>
              ))}
              {!historyRows.length && <p className="empty">Ainda não há alterações registradas.</p>}
            </div>
          </section>
        </div>
      )}

      <footer><span>RL PIN • Loja dos Achados</span><span>V5 Premium • cloud foundation</span></footer>
    </main>
  );
}
