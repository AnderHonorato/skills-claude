import { BLOCO, BLOCOS_POR_PEDACO } from '../configuracao';
import { pintarPedaco } from '../arte/cenario';
import type { MundoJogo } from './mundo';

const TAMANHO_PEDACO = BLOCO * BLOCOS_POR_PEDACO;
const MAXIMO_EM_CACHE = 40;
/** Pedaços pintados por quadro no máximo (evita engasgos). */
const PINTURAS_POR_QUADRO = 3;

interface Pedaco {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  escala: number;
  sujo: boolean;
  usadoEm: number;
}

/**
 * Cache do chão estático em pedaços pré-desenhados (12x12 blocos), redesenhados quando
 * blocos mudam ou quando a escala de tela muda. Mantém memória limitada (LRU).
 */
export class Chao {
  private cache = new Map<string, Pedaco>();
  private quadro = 0;
  private escala = 1;

  constructor(private mundo: MundoJogo) {}

  definirEscala(escala: number): void {
    const nova = Math.min(3, Math.max(0.5, escala));
    if (Math.abs(nova - this.escala) > 0.001) {
      this.escala = nova;
      for (const p of this.cache.values()) p.sujo = true;
    }
  }

  invalidarBloco(tx: number, ty: number): void {
    // O bloco e seus vizinhos (bordas e espessuras dependem dos vizinhos).
    for (let dy = -1; dy <= 2; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.floor((tx + dx) / BLOCOS_POR_PEDACO);
        const py = Math.floor((ty + dy) / BLOCOS_POR_PEDACO);
        const p = this.cache.get(`${px},${py}`);
        if (p) p.sujo = true;
      }
    }
  }

  invalidarTudo(): void {
    for (const p of this.cache.values()) p.sujo = true;
  }

  /** Desenha os pedaços visíveis. `ctx` já está em coordenadas do mundo. */
  desenhar(
    ctx: CanvasRenderingContext2D,
    area: { x: number; y: number; largura: number; altura: number }
  ): void {
    this.quadro++;
    let pinturas = 0;
    const px0 = Math.floor(area.x / TAMANHO_PEDACO);
    const py0 = Math.floor(area.y / TAMANHO_PEDACO);
    const px1 = Math.floor((area.x + area.largura) / TAMANHO_PEDACO);
    const py1 = Math.floor((area.y + area.altura + 24) / TAMANHO_PEDACO);
    for (let py = py0; py <= py1; py++) {
      for (let px = px0; px <= px1; px++) {
        if (px < 0 || py < 0) continue;
        if (px * BLOCOS_POR_PEDACO >= this.mundo.larguraBlocos) continue;
        if (py * BLOCOS_POR_PEDACO >= this.mundo.alturaBlocos) continue;
        const chave = `${px},${py}`;
        let p = this.cache.get(chave);
        const precisaPintar = !p || p.sujo;
        if (precisaPintar && (pinturas < PINTURAS_POR_QUADRO || !p)) {
          p = this.pintar(px, py, p);
          this.cache.set(chave, p);
          pinturas++;
        }
        if (!p) continue;
        p.usadoEm = this.quadro;
        ctx.drawImage(
          p.canvas as CanvasImageSource,
          px * TAMANHO_PEDACO,
          py * TAMANHO_PEDACO,
          TAMANHO_PEDACO + 1 / this.escala,
          TAMANHO_PEDACO + 1 / this.escala
        );
      }
    }
    if (this.cache.size > MAXIMO_EM_CACHE) this.descartarAntigos();
  }

  private pintar(px: number, py: number, existente?: Pedaco): Pedaco {
    const lado = Math.ceil(TAMANHO_PEDACO * this.escala);
    let canvas = existente?.canvas;
    if (!canvas || canvas.width !== lado) {
      canvas =
        typeof OffscreenCanvas !== 'undefined'
          ? new OffscreenCanvas(lado, lado)
          : Object.assign(document.createElement('canvas'), { width: lado, height: lado });
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lado, lado);
      ctx.setTransform(
        this.escala,
        0,
        0,
        this.escala,
        -px * TAMANHO_PEDACO * this.escala,
        -py * TAMANHO_PEDACO * this.escala
      );
      try {
        // Pinta um bloco a mais em volta para bordas que transbordam (espessuras).
        pintarPedaco(
          ctx,
          this.mundo.consulta,
          px * BLOCOS_POR_PEDACO - 1,
          py * BLOCOS_POR_PEDACO - 2,
          BLOCOS_POR_PEDACO + 2,
          BLOCOS_POR_PEDACO + 3
        );
      } catch (erro) {
        console.error('[chao] erro ao pintar pedaço', px, py, erro);
      }
    }
    return { canvas, escala: this.escala, sujo: false, usadoEm: this.quadro };
  }

  private descartarAntigos(): void {
    const ordenados = [...this.cache.entries()].sort((a, b) => a[1].usadoEm - b[1].usadoEm);
    while (ordenados.length > MAXIMO_EM_CACHE * 0.75) {
      const [chave] = ordenados.shift()!;
      this.cache.delete(chave);
    }
  }
}
