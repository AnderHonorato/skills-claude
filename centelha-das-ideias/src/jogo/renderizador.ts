import {
  desenharAnimacoesChao,
  desenharAtmosfera,
  desenharBlocoAlto,
  desenharFundo,
  profundidadeBloco,
} from '../arte/cenario';
import { BLOCO } from '../configuracao';
import type { Entidade } from '../contratos/entidades';
import { infoBloco } from '../mundo/tiles';
import type { JogoCentelha } from './jogo';

interface ItemDesenho {
  chave: number;
  entidade: Entidade | null;
  codigo: string;
  tx: number;
  ty: number;
}

/**
 * Pipeline de desenho (ver docs/contratos.md §Ordenação):
 *  1. Fundo (tela)          2. Chão em pedaços (mundo)   3. Animações do chão
 *  4. Telegrafias no chão   5. Objetos ordenados (blocos altos + entidades com sombra)
 *  6. Partículas normais    7. Sobreposições (fios, golpes, projéteis)  8. Partículas aditivas
 *  9. Atmosfera (tela)     10. Interface no canvas (balões, avisos)
 */
export class Renderizador {
  private itens: ItemDesenho[] = [];
  /** Estatística simples de desempenho (ms do último quadro). */
  msQuadro = 0;

  constructor(private jogo: JogoCentelha) {}

  desenhar(): void {
    const inicio = performance.now();
    const { jogo } = this;
    const tela = jogo.tela;
    const ctx = tela.ctx;
    const cam = jogo.camera;
    const dpr = tela.dpr;
    const escala = cam.zoom * dpr;
    const cx = cam.xVisual;
    const cy = cam.yVisual;
    const area = { x: cx, y: cy, largura: cam.largura, altura: cam.altura };
    const centro = jogo.mundo.bloco(cx + cam.largura / 2, cy + cam.altura / 2);
    const tema = jogo.mundo.consulta.tema(centro.tx, centro.ty);

    // 1. fundo
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenharFundo(ctx, tema, cam, jogo.tempo, cam.larguraTela, cam.alturaTela);

    if (jogo.estado !== 'titulo' || jogo.entidades.todas().length > 0) {
      // 2..8 mundo — câmera alinhada ao pixel do dispositivo evita costuras
      const ox = Math.round(cx * escala) / escala;
      const oy = Math.round(cy * escala) / escala;
      ctx.setTransform(escala, 0, 0, escala, -ox * escala, -oy * escala);
      jogo.chao.desenhar(ctx, area);
      const tx0 = Math.floor(cx / BLOCO) - 1;
      const ty0 = Math.floor(cy / BLOCO) - 1;
      const tx1 = Math.ceil((cx + cam.largura) / BLOCO) + 1;
      const ty1 = Math.ceil((cy + cam.altura) / BLOCO) + 4;
      this.seguro(() =>
        desenharAnimacoesChao(ctx, jogo.mundo.consulta, { tx0, ty0, tx1, ty1 }, jogo.tempo)
      );
      this.seguro(() => jogo.combate.desenharChao(ctx));
      this.seguro(() => jogo.habilidades.desenharChao(ctx));
      this.desenharOrdenados(ctx, tx0, ty0, tx1, ty1, area);
      jogo.particulas.desenhar(ctx, false, area);
      this.seguro(() => jogo.combate.desenharSobre(ctx));
      this.seguro(() => jogo.habilidades.desenharSobre(ctx));
      ctx.globalCompositeOperation = 'lighter';
      jogo.particulas.desenhar(ctx, true, area);
      ctx.globalCompositeOperation = 'source-over';
    }

    // 9..10 tela
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.seguro(() =>
      desenharAtmosfera(
        ctx,
        tema,
        cam,
        jogo.tempo,
        jogo.luzes,
        jogo.ruidoVisual,
        cam.larguraTela,
        cam.alturaTela,
        (x, y) => cam.mundoParaTela(x, y)
      )
    );
    if (jogo.estado !== 'titulo') this.seguro(() => jogo.ui.desenharTela(ctx));
    this.msQuadro = performance.now() - inicio;
  }

  private desenharOrdenados(
    ctx: CanvasRenderingContext2D,
    tx0: number,
    ty0: number,
    tx1: number,
    ty1: number,
    area: { x: number; y: number; largura: number; altura: number }
  ): void {
    const { jogo } = this;
    const mundo = jogo.mundo;
    const itens = this.itens;
    itens.length = 0;
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const codigo = mundo.codigoEm(tx, ty);
        if (!infoBloco(codigo).alto) continue;
        itens.push({ chave: profundidadeBloco(codigo, tx, ty), entidade: null, codigo, tx, ty });
      }
    }
    const margem = 96;
    for (const e of jogo.entidades.todas()) {
      if (!e.vivo) continue;
      if (e.x < area.x - margem || e.x > area.x + area.largura + margem) continue;
      if (e.y < area.y - margem || e.y > area.y + area.altura + margem * 2) continue;
      const chave = e.profundidade ? e.profundidade() : e.y + mundo.alturaChaoEm(e.x, e.y);
      itens.push({ chave, entidade: e, codigo: '', tx: 0, ty: 0 });
    }
    itens.sort((a, b) => a.chave - b.chave);

    const j = jogo.jogador;
    for (const item of itens) {
      if (item.entidade) {
        const e = item.entidade;
        this.desenharSombra(ctx, e);
        try {
          e.desenhar(ctx, jogo);
        } catch (erro) {
          console.error(`[render] erro ao desenhar ${e.id}`, erro);
          e.vivo = false;
        }
      } else {
        let transparente = 0;
        if (item.codigo === 'T') {
          const bx = (item.tx + 0.5) * BLOCO;
          const by = (item.ty + 0.5) * BLOCO;
          const dx = Math.abs(j.x - bx);
          const dy = by - j.y;
          if (dx < 30 && dy > 0 && dy < 80) transparente = 1 - dx / 30;
        }
        try {
          desenharBlocoAlto(
            ctx,
            item.codigo,
            item.tx,
            item.ty,
            mundo.consulta,
            jogo.tempo,
            transparente
          );
        } catch (erro) {
          console.error('[render] erro no bloco', item.codigo, erro);
        }
      }
    }
  }

  private desenharSombra(ctx: CanvasRenderingContext2D, e: Entidade): void {
    const r = e.raioSombra ?? 0;
    if (r <= 0) return;
    const mundo = this.jogo.mundo;
    if (!mundo.temChao(e.x, e.y)) return;
    const solo = e.y - mundo.alturaChaoEm(e.x, e.y);
    const altura = Math.max(0, e.z);
    const fator = Math.max(0.45, 1 - altura / 70);
    ctx.fillStyle = `rgba(43, 30, 40, ${0.28 * fator})`;
    ctx.beginPath();
    ctx.ellipse(e.x, solo, r * fator, r * 0.45 * fator, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private seguro(fn: () => void): void {
    try {
      fn();
    } catch (erro) {
      console.error('[render]', erro);
    }
  }
}
