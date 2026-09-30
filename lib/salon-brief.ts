export type SalonBriefInput = {
  title: string;
  category?: string;
  platform: string;
  marketPrice?: number;
};

export function buildSalonBrief(input: SalonBriefInput) {
  const category = input.category?.trim() || "geral";
  const price = input.marketPrice ? ` Faixa de preço observada: R$ ${input.marketPrice.toFixed(2)}.` : "";

  const base = {
    product: input.title,
    category,
    fidelityRule: "Preservar forma, cor, material, proporção e características essenciais do produto. Não inventar funções.",
    copyRule: "Copy emocional, clara e persuasiva, sem promessas falsas, urgência enganosa ou benefícios não comprovados.",
    videoRule: "Vídeo vertical de até 10 segundos com Vitória simpática, demonstrando uso simples e realista."
  };

  return {
    ...base,
    concepts: [
      {
        id:"premium",
        title:"Editorial Premium",
        prompt:`Fotografia editorial premium de ${input.title}, iluminação cinematográfica, fundo sofisticado, foco total no produto, detalhes realistas, composição limpa.`
      },
      {
        id:"lifestyle",
        title:"Lifestyle Realista",
        prompt:`${input.title} em uso realista no contexto de ${category}, ambiente elegante e crível, luz natural controlada, pessoa usando o item de maneira coerente.`
      },
      {
        id:"hero",
        title:"Produto Herói",
        prompt:`Hero shot de ${input.title}, enquadramento de destaque, textura e acabamento visíveis, iluminação dramática controlada, aparência de campanha premium.`
      },
      {
        id:"desire",
        title:"Desejo & Ambiente",
        prompt:`Cena aspiracional com ${input.title} como protagonista, atmosfera acolhedora, sensação de desejo e praticidade, sem alterar o produto real.`
      }
    ],
    copy: {
      headline:`${input.title}: transforme o detalhe que faltava no seu dia.`,
      body:`Um achado para quem valoriza praticidade, visual e uma experiência mais agradável no dia a dia.${price} Confira os detalhes antes de comprar.`,
      cta:"Veja os detalhes e escolha se faz sentido para você."
    }
  };
}
