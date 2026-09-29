"use client";

import { useEffect, useMemo, useState } from "react";

type Status = "NOVO" | "EM_ALTA" | "OBSERVAR" | "APROVADO" | "SALAO" | "PUBLICADO" | "DESCARTADO";
type Platform = "Shopee" | "Mercado Livre" | "TikTok Shop" | "Pinterest";

type Product = {
  id: string;
  title: string;
  platform: Platform;
  cost: number;
  marketPrice: number;
  stock: number;
  score: number;
  status: Status;
};

const demo: Product[] = [
  { id: "demo-1", title: "Kit premium de utensílios de cozinha", platform: "Shopee", cost: 39.9, marketPrice: 89.9, stock: 120, score: 92, status: "SALAO" },
  { id: "demo-2", title: "Luminária decorativa touch", platform: "Mercado Livre", cost: 34.9, marketPrice: 79.9, stock: 88, score: 88, status: "APROVADO" },
  { id: "demo-3", title: "Organizador modular para cozinha", platform: "TikTok Shop", cost: 24.9, marketPrice: 59.9, stock: 64, score: 84, status: "OBSERVAR" }
];

function brl(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
}

function margin(p: Product) {
  if (!p.marketPrice) return 0;
  return Math.round(((p.marketPrice - p.cost) / p.marketPrice) * 100);
}

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({
    title: "",
    platform: "Shopee" as Platform,
    cost: "",
    marketPrice: "",
    stock: ""
  });

  useEffect(() => {
    const raw = window.localStorage.getItem("rlpin-products-v1");
    setProducts(raw ? JSON.parse(raw) : demo);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem("rlpin-products-v1", JSON.stringify(products));
  }, [products, ready]);

  const active = useMemo(() => products.filter((p) => p.status !== "DESCARTADO"), [products]);
  const metrics = {
    total: active.length,
    valid: active.filter((p) => p.score >= 75).length,
    salon: active.filter((p) => p.status === "SALAO").length,
    publish: active.filter((p) => p.status === "APROVADO" || p.status === "PUBLICADO").length,
    discarded: products.filter((p) => p.status === "DESCARTADO").length
  };

  function addProduct(e: React.FormEvent) {
    e.preventDefault();
    const cost = Number(form.cost.replace(",", "."));
    const marketPrice = Number(form.marketPrice.replace(",", "."));
    const stock = Number(form.stock || "0");
    if (!form.title.trim() || !Number.isFinite(cost) || !Number.isFinite(marketPrice)) return;

    const duplicate = products.some((p) =>
      p.title.trim().toLowerCase() === form.title.trim().toLowerCase() &&
      p.platform === form.platform
    );

    if (duplicate) {
      alert("Produto já existe nesta plataforma. Atualize o existente para evitar duplicação.");
      return;
    }

    const rawMargin = marketPrice > 0 ? ((marketPrice - cost) / marketPrice) * 100 : 0;
    const score = Math.max(0, Math.min(100, Math.round(rawMargin * 2 + (stock > 0 ? 20 : 0))));

    setProducts((prev) => [
      {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        platform: form.platform,
        cost,
        marketPrice,
        stock,
        score,
        status: score >= 80 ? "EM_ALTA" : score >= 65 ? "OBSERVAR" : "NOVO"
      },
      ...prev
    ]);

    setForm({ title: "", platform: "Shopee", cost: "", marketPrice: "", stock: "" });
  }

  function setStatus(id: string, status: Status) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  }

  function resetDemo() {
    if (confirm("Restaurar os produtos de demonstração?")) setProducts(demo);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">RL PIN • CENTRAL DE OPERAÇÕES</p>
          <h1>Loja dos Achados <span>V5 Premium</span></h1>
          <p className="sub">Garimpo → Guardião → Margem → Salão → Vitória → Publicação</p>
        </div>
        <div className="sync">
          <span className="dot" />
          <div>
            <strong>Base funcional ativa</strong>
            <small>Coletas planejadas: 06:00 • 10:00 • 15:00</small>
          </div>
        </div>
      </header>

      <section className="metrics">
        <article className="card metric"><small>Na esteira</small><strong>{metrics.total}</strong><span>produtos ativos</span></article>
        <article className="card metric"><small>Válidos</small><strong>{metrics.valid}</strong><span>score ≥ 75</span></article>
        <article className="card metric"><small>No Salão</small><strong>{metrics.salon}</strong><span>em criação premium</span></article>
        <article className="card metric"><small>Descartados</small><strong>{metrics.discarded}</strong><span>fora da operação</span></article>
      </section>

      <section className="card panel">
        <div className="panelTitle">
          <div>
            <p className="eyebrow">IMPORTADOR OPERACIONAL</p>
            <h2>Adicionar produto à esteira</h2>
          </div>
          <button className="secondary" onClick={resetDemo}>Restaurar demonstração</button>
        </div>

        <form className="productForm" onSubmit={addProduct}>
          <input placeholder="Nome do produto" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value as Platform })}>
            <option>Shopee</option><option>Mercado Livre</option><option>TikTok Shop</option><option>Pinterest</option>
          </select>
          <input placeholder="Custo R$" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          <input placeholder="Preço mercado R$" inputMode="decimal" value={form.marketPrice} onChange={(e) => setForm({ ...form, marketPrice: e.target.value })} />
          <input placeholder="Estoque" inputMode="numeric" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          <button className="primary" type="submit">+ Adicionar</button>
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
              ["Shopee", "06:00"],
              ["Mercado Livre", "06:05"],
              ["TikTok Shop", "06:12"],
              ["Pinterest", "Distribuição"]
            ].map(([name, next]) => (
              <div className="platform" key={name}>
                <div><strong>{name}</strong><small>Próxima: {next}</small></div>
                <div className="platformRight"><b>{active.filter((p) => p.platform === name).length}</b><span>não conectado</span></div>
              </div>
            ))}
          </div>
        </article>

        <article className="card panel hero">
          <p className="eyebrow">PRODUTO CAMPEÃO DO DIA</p>
          <h2>{active.sort((a,b) => b.score-a.score)[0]?.title ?? "Aguardando produtos"}</h2>
          <p>Seleção provisória pelo maior score da esteira. O ranking avançado entrará com tendência, concorrência, fornecedor e políticas.</p>
          <div className="heroScore">
            <div><span>Score</span><strong>{active.sort((a,b) => b.score-a.score)[0]?.score ?? 0}</strong></div>
            <div><span>Margem bruta</span><strong>{active[0] ? margin(active.sort((a,b) => b.score-a.score)[0]) : 0}%</strong></div>
            <div><span>Estoque</span><strong>{active.sort((a,b) => b.score-a.score)[0]?.stock ?? 0}</strong></div>
          </div>
        </article>
      </section>

      <section className="card panel">
        <div className="panelTitle">
          <div><p className="eyebrow">ESTEIRA</p><h2>Produtos em operação</h2></div>
          <span className="badge">{metrics.publish} aprovados/publicados</span>
        </div>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Produto</th><th>Origem</th><th>Custo</th><th>Mercado</th><th>Margem</th><th>Score</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {active.map((p) => (
                <tr key={p.id}>
                  <td>{p.title}</td><td>{p.platform}</td><td>{brl(p.cost)}</td><td>{brl(p.marketPrice)}</td><td>{margin(p)}%</td><td>{p.score}</td>
                  <td><span className="status">{p.status}</span></td>
                  <td className="actions">
                    <button onClick={() => setStatus(p.id, "APROVADO")}>Aprovar</button>
                    <button onClick={() => setStatus(p.id, "SALAO")}>Salão</button>
                    <button onClick={() => setStatus(p.id, "DESCARTADO")}>Descartar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid3">
        <article className="card mini"><p className="eyebrow">GUARDIÃO RL</p><h3>Conformidade antes do Salão</h3><p>Marca, restrições, estoque, prazo, política e fornecedor.</p><span className="badge">motor inicial pronto</span></article>
        <article className="card mini"><p className="eyebrow">CALCULADORA</p><h3>Preço e lucro automático</h3><p>Taxas, custo, frete, reserva, lucro e preço recomendado.</p><span className="badge">API pronta</span></article>
        <article className="card mini"><p className="eyebrow">SALÃO DA VITÓRIA</p><h3>4 conceitos cinematográficos</h3><p>Imagem premium, copy por canal e vídeo curto da Vitória.</p><span className="badge">próxima fase</span></article>
      </section>

      <footer><span>RL PIN • Loja dos Achados</span><span>V5 Premium • construção ativa</span></footer>
    </main>
  );
}
