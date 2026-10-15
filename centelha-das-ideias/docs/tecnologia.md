# Tecnologia: comparação e escolha

## Requisitos que pesaram

1. Arte **procedural vetorial** com expressões contínuas (olhos interpolando entre humores, squash & stretch, armas em qualquer ângulo) — desenhada a cada quadro, sem folhas de sprites.
2. Câmera 3/4 com **altura separada da posição no chão** (pulo, plataformas, vãos) e ordenação por profundidade própria.
3. Web em computador e celular, toque multiponto, 60 quadros/s, **sem dependência de rede após carregar**.
4. Código, nomes e comentários em português; projeto modular para expansões.

## Opções avaliadas

| Opção | Prós | Contras para este jogo |
| --- | --- | --- |
| **Phaser 4.1** (estável desde abr/2026) | Motor completo: cenas, áudio, tweens, câmeras, WebGL, filtros e luzes | Pensado para texturas/sprites; desenho vetorial imediato a cada quadro (expressões contínuas) vira geração de texturas ou `Graphics` sem antisserrilhado; API nova (v4) pouco documentada em exemplos maduros |
| **PixiJS 8** | Renderizador WebGL/WebGPU muito rápido | Só renderização: física, entrada, áudio e cenas seriam próprios do mesmo jeito; `Graphics` reconstruído a cada quadro é caro |
| **Kaplay** | Simples, rápido de prototipar | Menos controle de pipeline e desempenho previsível em cenas densas |
| **Canvas 2D + motor próprio (TypeScript + Vite)** ✅ | Desenho vetorial imediato e antisserrilhado nativo; controle total da ordenação/alturas; nenhuma dependência em tempo de execução; arquivo único offline | Precisamos escrever laço, entrada, câmera e partículas (pequenos e testáveis) |

**Escolha:** Canvas 2D com motor próprio em TypeScript, empacotado pelo Vite em **um único HTML** (`vite-plugin-singlefile`). O chão estático é pré-desenhado em pedaços (técnica de pré-renderização em canvas fora da tela recomendada pela MDN) e só o que se move é redesenhado.

## Decisões de suporte

- **Entrada:** Pointer Events com `touch-action: none` e captura de ponteiro para joystick e botões multitoque; teclado, mouse e controle padrão.
- **Áudio:** Web Audio procedural (sem arquivos), contexto criado/retomado em gesto do usuário (política de reprodução automática), canais de volume e suspensão na pausa.
- **Salvamento:** `localStorage` com objeto versionado e migrações sequenciais; validação de posição após atualizações de conteúdo.
- **Expansão de mapa:** regiões em dados (`src/dados/regioes/*.ts`) com origem no mundo; fronteira única em `src/dados/mundo.ts`.
- **APK:** o caminho viável seria Capacitor 8 (alvo SDK 36). **Nesta sessão o Android SDK não pôde ser baixado** (`dl.google.com` bloqueado pela política de rede), então não há APK compilado. A versão web roda em tela cheia no navegador do celular.

## Fontes consultadas

- Phaser v4.0.0 "Caladan" (estável): https://phaser.io/download/stable
- Phaser 4 (página de download): https://phaser.io/download/phaser4
- MDN — Otimizando o canvas: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- web.dev — Desempenho de canvas: https://web.dev/articles/canvas-performance
- MDN — `setPointerCapture()`: https://developer.mozilla.org/docs/Web/API/Element/setPointerCapture
- MDN — Boas práticas da Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
- Capacitor — Alvo do SDK Android: https://capacitorjs.com/docs/android/setting-target-sdk
- vite-plugin-singlefile (README): https://cdn.jsdelivr.net/npm/vite-plugin-singlefile@2.3.3/README.md
- Fonte Fredoka (SIL OFL 1.1): https://github.com/google/fonts/tree/main/ofl/fredoka
