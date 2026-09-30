export type Channel = "SHOPEE" | "MERCADO_LIVRE" | "TIKTOK" | "PINTEREST";

export const channelFormats: Record<Channel, { label: string; aspect: string; purpose: string }[]> = {
  SHOPEE: [
    { label: "Principal", aspect: "1:1", purpose: "Imagem principal e galeria" },
    { label: "Vertical", aspect: "4:5", purpose: "Apresentação detalhada" }
  ],
  MERCADO_LIVRE: [
    { label: "Principal", aspect: "1:1", purpose: "Imagem de anúncio" },
    { label: "Galeria", aspect: "4:3", purpose: "Contexto de uso" }
  ],
  TIKTOK: [
    { label: "Vídeo", aspect: "9:16", purpose: "Vídeo curto da Vitória" },
    { label: "Capa", aspect: "9:16", purpose: "Capa vertical" }
  ],
  PINTEREST: [
    { label: "Pin", aspect: "2:3", purpose: "Pin de produto" },
    { label: "Idea", aspect: "9:16", purpose: "Conteúdo vertical" }
  ]
};

export const salonConcepts = [
  { id: "premium", name: "Editorial Premium", goal: "Elevar percepção de valor sem alterar o produto." },
  { id: "lifestyle", name: "Lifestyle Realista", goal: "Mostrar o produto em uso em ambiente aspiracional." },
  { id: "hero", name: "Produto Herói", goal: "Destacar forma, material e função com luz cinematográfica." },
  { id: "desire", name: "Desejo & Ambiente", goal: "Criar atmosfera emocional mantendo fidelidade ao item." }
];

export function victoryWardrobe(category: string) {
  const c = category.toLowerCase();
  if (c.includes("cozinha") || c.includes("utens")) return "Avental premium e look casual elegante";
  if (c.includes("luxo") || c.includes("decoração") || c.includes("decoracao")) return "Look elegante e sofisticado";
  if (c.includes("tecnologia") || c.includes("eletr")) return "Look moderno minimalista";
  return "Jeans premium e camisa neutra";
}
