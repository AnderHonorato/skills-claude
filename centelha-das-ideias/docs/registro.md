# Registro de desenvolvimento

Registro curto para retomar o trabalho após interrupções. Mais recente no topo.

## Decisões

- **D1 — Tecnologia:** TypeScript + Vite + motor próprio em Canvas 2D (ver `docs/tecnologia.md`). Arte procedural vetorial desenhada a cada quadro; chão estático em cache por pedaços.
- **D2 — Entrega:** build em arquivo único (`vite-plugin-singlefile`): `dist/index.html` roda offline, inclusive aberto do disco.
- **D3 — APK:** inviável nesta sessão: `dl.google.com` (Android SDK) bloqueado pela política de rede. Entrega web responsiva para celular.
- **D4 — Mascote:** as imagens de referência não chegaram à sessão; identidade baseada no mascote do Claude Code (corpo retangular terracota, olhos escuros, bracinhos, quatro perninhas).
- **D5 — Organização multiagente:** contratos em `src/contratos`, responsáveis por arquivo em `docs/contratos.md`; agentes trabalham em worktrees isoladas e o orquestrador integra.
- **D6 — Fronteira:** definida só em `src/dados/mundo.ts` (`MUNDO.fronteira`); blocos `F` aplicados pelo mundo; bloqueia andar, pular, esquivar, projéteis, fios e criações.

## Concluído

- Núcleo: motor (laço fixo 60 Hz, entrada teclado/mouse/controle/toque virtual, câmera, partículas), mundo (grade, alturas, vãos, linha de visão, fronteira), física com alturas, Claude jogável (8 direções, corrida, pulo com coiote/buffer, esquiva, beirada, queda em vão, dano, humor, piscar), entidades simples, salvamento versionado, cenas puláveis, renderizador com ordenação.
- Sonda Playwright (`ferramentas/sondar.mjs`) validou: movimento, parada na beirada da água funda, pulo (z 36 px), console limpo.

## Pendências

- Integração dos módulos dos agentes (arte, áudio, combate, habilidades, interface, conteúdo).
- Revisão crítica com partidas reais e medição de tempo.
- Publicação (link) e pacote para download.
