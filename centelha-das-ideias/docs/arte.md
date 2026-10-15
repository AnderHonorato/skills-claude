# Direção de arte

## Linguagem visual

**Ilustração geométrica plana, vetorial, desenhada por código (Canvas 2D).** Nada de pixel art, nada de 3D, nada de imagens externas.

- Formas simples e volumosas, com **três tons por volume**: topo claro (luz vem do alto à esquerda), frente média, lateral direita escura.
- Contornos finos (1–1,5 px do mundo) em tom escuro **da própria cor** do objeto — nunca preto puro.
- Sombras de contato elípticas e suaves (o motor desenha as das entidades).
- Brilhos e luz em aditivo, com moderação: perigo e objetivo precisam continuar legíveis.
- Paleta única em `src/arte/paleta.ts`. Regiões tomadas pelo Ruído usam a mesma paleta dessaturada (`dessaturar`) com toques de glitch magenta/ciano; restauradas, voltam à cor plena.
- Câmera 3/4 elevada: vemos o topo do chão e a frente dos objetos. Alturas se leem pelas faces frontais (paredes 40 px, plataformas 24/48 px, árvores ~70 px).

## Claude (protagonista)

Referência: mascote do Claude Code — corpo retangular compacto terracota, dois olhos escuros verticais, bracinhos laterais curtos e **quatro perninhas** em dois pares.

- Corpo: 20 px de largura, 13 px de frente, 6 px de topo visível, pernas 4 px. Cor `claude`, topo `claudeTopo`, lateral `claudeEscuro`, contorno `claudeContorno`.
- Olhos: retângulos verticais arredondados (~2,4 x 4 px) no terço superior da face frontal; brilho minúsculo. Forma dos olhos carrega o humor.
- Oito direções: de frente (sul) mostra a face com olhos; diagonais mostram face + lateral; leste/oeste mostram a lateral com olhos deslocados para a frente; de costas (norte) sem olhos.
- Pernas realmente animadas: pares alternados sobem/avançam no ciclo `fasePasso`; corrida com passada maior e leve inclinação; corpo quica 1 px.
- Squash & stretch leve: pulo estica, aterrissagem achata, dano recua e pisca.

## Inimigos (Ruído)

Criaturas de estática cinza-violeta com bordas que "chiam" (pequenos deslocamentos tracejados), núcleo com brilho. Telegrafia sempre clara: cor `perigo`, anel crescente ou postura exagerada antes do ataque. Ponto fraco revelado por Observar: losango dourado pulsante.

## Interface

Painéis marfim/ardósia com cantos arredondados, destaques terracota, fonte Fredoka (OFL, embutida). Ícones desenhados em SVG próprio. Balões de fala marfim com cauda apontando para quem fala; nome do falante na cor do NPC.

## Catálogo de decorações (modelo → uso)

Mantido pelo agente de Arte de Cenário em `src/arte/cenario.ts` (exportar `MODELOS_DECORACAO`). O agente de Conteúdo só usa modelos listados lá.
