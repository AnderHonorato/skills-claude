# Claude — A Centelha das Ideias

Jogo 3D (Three.js) com dois modos:

- **Sobrevivência (padrão)** — roguelike: escolha uma mente (Claude, GPT, Gemini, Llama, Mistral
  ou DeepSeek), sobreviva a hordas crescentes do Ruído, colete cristais de experiência e monte sua
  build com até 10 habilidades ativas e 5 passivas, cada uma evoluindo até o nível 10.
- **Aventura clássica** — o Claude explora ilhas flutuantes onde as ideias viraram lugares
  (abra com `?modo=aventura` ou pelo link no menu).

## Jogar

- **Link:** https://claude.ai/artifact/NNYiRYmQDY8fcm7PwDtSHy
- **Arquivo único (offline):** `pnpm install && pnpm compilar` e abra `dist/index.html` no navegador.

### Sobrevivência

| Ação                                      | Teclado        | Celular                            |
| ----------------------------------------- | -------------- | ---------------------------------- |
| Andar                                     | WASD ou setas  | Arrastar em qualquer lugar da tela |
| Esquiva (invulnerável por um instante)    | Espaço, C ou K | Botão Esquiva                      |
| Escolher carta ao subir de nível          | 1–4 ou clique  | Tocar na carta                     |
| Sortear as cartas de novo (2 por partida) | R              | Botão                              |
| Pausa (volume, vozes)                     | Esc ou P       | II                                 |

As habilidades disparam sozinhas, cada uma com recarga e velocidade próprias.

- **24 habilidades ativas** em 12 elementos (fogo, gelo, raio, luz, vento, terra, veneno,
  gravidade, cristal, som, arcano, água): órbitas, projéteis, cadeias, ondas, chicotes, auras,
  chuvas, tornados, buracos negros, lasers giratórios, ricochetes, bumerangues, poças e drones.
  Evoluções nos níveis 5 e 10 mudam o comportamento (ex.: a Centelha Orbital ganha um segundo
  anel girando ao contrário e, no 10, vira um Sol Particular que nunca apaga).
- **13 passivas** (vida, regeneração, velocidade, recarga, dano, área, projéteis extras, ímã,
  sorte, armadura, velocidade dos projéteis, duração e experiência).
- O que você já tem aparece bem mais nas cartas (peso 5, ou 6,5 quando a próxima escolha é
  uma evolução, contra 1 de uma nova).
- **Cristais** em quatro tamanhos (1, 4, 15 e 60 de experiência): quanto maior, mais brilha.
  Aglomerados longe do centro guardam cristais prismáticos.
- **Hordas** a cada 60 s e o chefe **Grande Ruído** a cada 180 s (onda que se esquiva, investida
  com aviso no chão e invocação). O dia vira noite com o tempo.
- **Vozes:** cada personagem fala em português (síntese de voz do navegador, com tom e ritmo
  próprios; sem voz disponível, usa bipes com entonação). Inimigos resmungam com vozes sintetizadas.
- Recorde de tempo salvo por personagem no navegador.

### Aventura clássica

| Ação                        | Teclado/mouse                    | Celular                                       |
| --------------------------- | -------------------------------- | --------------------------------------------- |
| Andar / correr              | WASD ou setas / Shift            | Arrastar no lado esquerdo (até a borda corre) |
| Pular                       | Espaço                           | Pular                                         |
| Atacar / especial           | J ou clique / L ou botão direito | Atacar / Especial                             |
| Esquivar                    | C ou K                           | Esquiva                                       |
| Falar / usar                | E                                | Usar                                          |
| Observar / Conectar / Criar | Q / R / F                        | botões que aparecem ao aprender               |
| Trocar arma                 | 1–6 ou roda do mouse             | Arma                                          |
| Mapa / pausa                | M / Esc                          | Mapa / II                                     |

Andar, pular e atacar funcionam ao mesmo tempo (também no toque).

## Desenvolvimento

```bash
pnpm install
pnpm iniciar          # servidor local em http://127.0.0.1:5173
pnpm tipos            # checagem de tipos
pnpm testar           # testes do núcleo e da progressão do roguelike
node testes/e2e/rota.mjs   # joga a história inteira automaticamente (precisa do servidor)
pnpm compilar && node ferramentas/gerar-artefato.mjs   # arquivo único + versão para publicar
```

Documentação: `docs/design.md` (seção 13 descreve a versão 3D), `docs/tecnologia.md` (referências oficiais).
