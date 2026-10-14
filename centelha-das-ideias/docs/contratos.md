# Contratos técnicos e responsabilidades

Fonte de verdade em código: `src/contratos/*.ts`. Este documento explica regras que os tipos não expressam.

## 1. Responsáveis por arquivo

Dois agentes nunca editam o mesmo arquivo. Mudanças em arquivos de outro responsável passam pelo orquestrador.

| Área | Responsável | Arquivos |
| --- | --- | --- |
| Núcleo, contratos, motor, mundo, física, jogador, entidades simples, salvamento, cenas, render | Orquestrador | `src/contratos/**`, `src/motor/**`, `src/mundo/**`, `src/jogo/**`, `src/entidades/**`, `src/sistemas/{flags,salvamento,cenas}.ts`, `src/configuracao.ts`, `src/principal.ts`, `src/depuracao/**`, `src/arte/paleta.ts`, `docs/{design,contratos,registro,tecnologia}.md`, `vite.config.ts`, `package.json` |
| Arte do personagem (Claude, armas, retrato) | Agente Arte-Claude | `src/arte/claude.ts`, `src/arte/claude/**`, `ferramentas/galeria-claude.*`, `docs/arte-claude.md` |
| Arte de NPCs, inimigos e chefe | Agente Arte-Personagens | `src/arte/personagens.ts`, `src/arte/personagens/**`, `ferramentas/galeria-personagens.*` |
| Cenário, mecanismos (visual), atmosfera, partículas | Agente Arte-Cenário | `src/arte/cenario.ts`, `src/arte/cenario/**`, `src/arte/efeitos.ts`, `ferramentas/galeria-cenario.*`, `docs/arte.md` (seção de decorações) |
| Música e efeitos sonoros | Agente Áudio | `src/audio/**`, `ferramentas/galeria-audio.*`, `testes/unidade/audio*.teste.ts` |
| Combate, armas, inimigos, chefe, projéteis | Agente Combate | `src/sistemas/combate/**`, `testes/unidade/combate*.teste.ts` |
| Habilidades, energia, mecanismos, enigmas | Agente Habilidades | `src/sistemas/habilidades/**`, `testes/unidade/habilidades*.teste.ts` |
| Interface, HUD, balões, menus, mapa, toque | Agente Interface | `src/ui/**`, `src/estilos/**`, `testes/unidade/ui*.teste.ts` |
| Mundo, regiões, NPCs, diálogos, missões, cenas (dados) | Agente Conteúdo | `src/dados/**`, `src/sistemas/dialogo/**`, `src/sistemas/missoes/**`, `ferramentas/verificar-mapas.*`, `testes/unidade/{mapas,missoes,dialogos}*.teste.ts` |
| Testes ponta a ponta e revisão crítica | Agentes Críticos | `testes/e2e/**` (somente leitura no resto) |

Se precisar de um campo novo num contrato, **não edite o contrato**: estenda localmente (ex.: `interface MinhaEntidade extends Entidade { ... }`) e registre o pedido no relatório final.

## 2. Ponto de montagem de cada módulo

| Módulo | Exporta | Usado em |
| --- | --- | --- |
| Combate | `criarCombate(jogo): ApiCombate` em `src/sistemas/combate/indice.ts` | `src/jogo/jogo.ts` |
| Habilidades | `criarHabilidades(jogo): ApiHabilidades` em `src/sistemas/habilidades/indice.ts` | idem |
| Diálogo | `criarDialogo(jogo): ApiDialogo` em `src/sistemas/dialogo/indice.ts` | idem |
| Missões | `criarMissoes(jogo): ApiMissoes` em `src/sistemas/missoes/indice.ts` | idem |
| Interface | `criarUi(jogo, raiz): ApiUi` em `src/ui/indice.ts` | idem |
| Áudio | `criarAudio(): ApiAudio` em `src/audio/indice.ts` | idem |
| Mundo | `MUNDO: DefinicaoMundo` em `src/dados/mundo.ts` | idem |
| Cenas | `CENAS: DefinicaoCena[]` em `src/dados/cenas.ts` | idem |

Cada `Api*` expõe `fabricas: MapaFabricas` para os tipos de `EspecEntidade` que cria:

- Núcleo (`src/entidades/base.ts`): `decoracao`, `luz`, `placa`, `gatilho`, `coletavel`, `arma`, `pedraMemoria`, `bau`, `santuario`, `gaiola`.
- Habilidades: `fonte`, `receptor`, `prisma`, `porta`, `ponteRetratil`, `plataformaMovel`, `placaPressao`, `caixa`, `ancora`, `runa`, `alavanca`, `lampada`, `engrenagem`, `pisoOculto`, `cristal`, `zonaEnigma`.
- Combate: `inimigo`, `chefe`.
- Diálogo: `npc`.

## 3. Coordenadas, alturas e desenho

- 1 bloco = 32 px. Posição da entidade = ponto no chão sob os pés (px do mundo). `z` = altura acima da superfície.
- Superfícies: chão 0, plataforma `P` 24 px, plataforma alta `Q` 48 px. `jogo.mundo.alturaChaoEm(x, y)`.
- Visual: `ySolo = y - alturaChao`; o corpo é desenhado em `ySolo - z`. A sombra de contato é do motor (defina `raioSombra`).
- Use `jogo.fisica.mover(e, dx, dy, { podeCairEmVao: false })` para toda entidade que anda.
- Pulo de Claude: impulso 260 px/s, gravidade 900 px/s² → ápice 37,5 px; ~0,58 s no ar; vão de 1 bloco andando, 2 blocos correndo. Botas de Mola: 330 px/s → ápice 60 px.
- Vão: `' '` e `w`. Andar contra o vão para na beirada; segurar 0,35 s permite descer de propósito. Queda: volta ao último ponto seguro com 1 de dano (nunca fatal).

### Ordenação (profundidade)

- Entidade: `y + alturaChao` (ou `profundidade()`).
- Bloco alto: `ty * 32` (árvore `ty * 32 + 16`), via `profundidadeBloco` em `src/arte/cenario.ts`.
- Desenho de blocos altos (`desenharBlocoAlto`) inclui topo e frente; a frente é desenhada só se o bloco ao sul for mais baixo.

## 4. Regras de comportamento compartilhadas

- Inimigos só perseguem/atacam quando `jogo.estado === 'jogando'`.
- Tudo que dá dano usa `jogo.combate.causarDano(alvo, dano)`.
- Conectar Fonte ↔ Inimigo: `causarDano(inimigo, { tipo: 'choque', quantidade: 1, quebraEscudo: true, atordoa: 2.5, origem })`.
- Conectar Inimigo ↔ Inimigo: `jogo.combate.amarrar(a, b, 5)`.
- Conectar Fonte ↔ Núcleo do chefe: `causarDano(chefe, { tipo: 'choque', quantidade: 1, fonte: entidadeFonte, origem })`; o chefe conta fontes distintas.
- Cortador: lê `jogo.habilidades.conexoes()` e chama `desfazerConexao(origem, destino)`.
- Escudo Refletor (entidade com `refletor: true`) devolve projéteis; Aliado de Luz (`distrai: true`, `aliado: true`) pode virar alvo dos inimigos.
- Golpes de arma atingem entidades com `atingivel: true` (inimigos, runas, cristais). Espinhos `r` quebram com qualquer arma; paredes `X` só com Martelo (`jogo.mundo.definirBloco(tx, ty, vira, true)`).
- Determinação (`jogador.determinacaoPor > 0`): recargas de habilidade 25% mais rápidas.
- Inspiração: Criar gasta 1; +0,25 por acerto em inimigo; +0,25 por revelação nova; +1 por Centelha.
- Flags padronizadas: `grupo:<id>` (grupo de inimigos derrotado), `enigma:<id>` (resolvido), `bau:<id>`, `gatilho:<id>`, `restaurada:<regiao>`, `missao:<id>:iniciada`, `ativo:<id>` (fallback), `santuario:<id>`, `faisca:<id>`, `revelado:<id>`, `chefe:derrotado`.
- Mecanismo de enigma resolvido permanece ativo após carregar (lê `enigma:<id>`).
- Sons: `jogo.audio.tocar(id, { x, y, tom })` com ids de `src/contratos/audio.ts`. Efeitos visuais: `efeito(jogo.particulas, nome, x, y, opcoes)` de `src/arte/efeitos.ts`.

## 5. Interface e acessibilidade

- Balões: acompanham quem fala, ficam dentro da tela, não cobrem controles de toque.
- Toda ação tem atalho exibido no jogo (teclado) e botão no toque.
- Textos curtos; nada de emojis do navegador como elementos de jogo (ícones são desenhados).

## 6. Desempenho

- Alvo: 60 quadros/s em notebook comum e celular intermediário; `renderizador.msQuadro` < 8 ms em 1280x720.
- Funções de desenho não alocam objetos grandes por quadro; caches estáticos via `OffscreenCanvas` quando útil.
- Partículas: máximo 900 vivas.

## 7. Testes

- Unidade: `pnpm testar` (Vitest, arquivos `testes/unidade/**/*.teste.ts`, ambiente node).
- Tipos: `pnpm tipos`.
- Navegador: `node ferramentas/sondar.mjs --url http://127.0.0.1:<porta>/ --passos "..."` (ver cabeçalho do arquivo). API de teste em `window.__centelha`.
- Cada agente usa sua própria porta de servidor de desenvolvimento (ver instruções do agente).
