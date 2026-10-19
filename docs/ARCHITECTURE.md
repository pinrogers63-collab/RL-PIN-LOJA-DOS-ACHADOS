# Arquitetura RL PIN V5 Premium

## Pipeline
Fonte -> Normalização -> Deduplicação -> Guardião RL -> Score -> Margem -> Aprovação -> Salão -> Publicação -> Monitoramento

## Coletas
- 09:00 BRT: coleta principal (garimpo via API pública + tendências oficiais se autorizado)
- 15:00 BRT: atualização de preço, estoque e tendência

Os horários estão declarados no Vercel em UTC (12:00 e 18:00), equivalentes a 09:00 e 15:00 BRT.

## Segurança
- Nenhuma integração externa é considerada conectada sem credencial válida.
- Endpoints de cron suportam CRON_SECRET.
- Coletas sem integração ficam em DRY_RUN.
- Auditoria registra mudanças importantes.
- Publicação futura será assistida antes de automação total.

## Salão
Quatro conceitos padrão:
1. Editorial Premium
2. Lifestyle Realista
3. Produto Herói
4. Desejo & Ambiente

A apresentação deve preservar características essenciais do produto.
