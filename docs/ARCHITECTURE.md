# Arquitetura RL PIN V5 Premium

## Pipeline
Fonte -> Normalização -> Deduplicação -> Guardião RL -> Score -> Margem -> Aprovação -> Salão -> Publicação -> Monitoramento

## Coletas
- 06:00 BRT: coleta principal
- 10:00 BRT: preço, estoque e tendência
- 15:00 BRT: preço, estoque e tendência

Os horários estão declarados no Vercel em UTC (09:00, 13:00 e 18:00).

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
