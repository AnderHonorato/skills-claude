import { BLOCO } from '../configuracao';
import type { Vetor } from '../contratos/base';
import type { Entidade } from '../contratos/entidades';
import type { Fisica, GerenciadorEntidades } from '../contratos/jogo';
import type { MundoJogo } from './mundo';

const PASSO_MAXIMO = 4;

/**
 * Movimento no plano do chão com colisão circular contra blocos e sólidos.
 * Regras de altura: um bloco é passável se a altura absoluta da entidade (superfície + z)
 * alcança o topo do obstáculo. Ao entrar num bloco mais baixo, a entidade fica no ar
 * (z aumenta) e cai pela gravidade de quem a controla.
 */
export class FisicaJogo implements Fisica {
  constructor(
    private mundo: MundoJogo,
    private entidades: () => GerenciadorEntidades
  ) {}

  mover(
    e: Entidade,
    dx: number,
    dy: number,
    opcoes: { ignorarSolidos?: boolean; podeCairEmVao?: boolean; alturaAbs?: number } = {}
  ): Vetor {
    const alturaAbs = opcoes.alturaAbs ?? this.mundo.alturaChaoEm(e.x, e.y) + e.z;
    const podeCair = opcoes.podeCairEmVao ?? true;
    const distancia = Math.hypot(dx, dy);
    const passos = Math.max(1, Math.ceil(distancia / PASSO_MAXIMO));
    const sx = dx / passos;
    const sy = dy / passos;
    let movidoX = 0;
    let movidoY = 0;
    const solidos = opcoes.ignorarSolidos ? [] : this.solidosProximos(e, distancia + 48);
    for (let i = 0; i < passos; i++) {
      if (sx !== 0) {
        const nx = e.x + sx;
        if (this.livre(e, nx, e.y, alturaAbs, podeCair, solidos)) {
          e.x = nx;
          movidoX += sx;
        }
      }
      if (sy !== 0) {
        const ny = e.y + sy;
        if (this.livre(e, e.x, ny, alturaAbs, podeCair, solidos)) {
          e.y = ny;
          movidoY += sy;
        }
      }
    }
    // Ajusta z para manter a altura absoluta sobre a nova superfície.
    const chao = this.mundo.temChao(e.x, e.y) ? this.mundo.alturaChaoEm(e.x, e.y) : 0;
    if (movidoX !== 0 || movidoY !== 0) {
      // Sem chão embaixo (vão), z segue a altura absoluta, inclusive negativa: a queda continua.
      e.z = this.mundo.temChao(e.x, e.y) ? Math.max(0, alturaAbs - chao) : alturaAbs;
    }
    return { x: movidoX, y: movidoY };
  }

  /** Verifica se o círculo da entidade cabe em (x, y). */
  livre(
    e: Entidade,
    x: number,
    y: number,
    alturaAbs: number,
    podeCair: boolean,
    solidos: Entidade[]
  ): boolean {
    const r = e.raio;
    const tx0 = Math.floor((x - r) / BLOCO);
    const tx1 = Math.floor((x + r) / BLOCO);
    const ty0 = Math.floor((y - r) / BLOCO);
    const ty1 = Math.floor((y + r) / BLOCO);
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        if (this.mundo.passavel(tx, ty, alturaAbs)) continue;
        // Círculo x retângulo do bloco.
        const cx = Math.max(tx * BLOCO, Math.min(x, (tx + 1) * BLOCO));
        const cy = Math.max(ty * BLOCO, Math.min(y, (ty + 1) * BLOCO));
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r - 0.01) return false;
      }
    }
    if (!podeCair && !this.mundo.temChao(x, y) && this.mundo.temChao(e.x, e.y)) return false;
    for (const s of solidos) {
      if (s === e) continue;
      if (
        s.alturaSolida !== undefined &&
        alturaAbs >= this.mundo.alturaChaoEm(s.x, s.y) + s.alturaSolida - 2
      )
        continue;
      const caixa = s.caixaSolida?.();
      if (caixa) {
        const cx = Math.max(caixa.x, Math.min(x, caixa.x + caixa.largura));
        const cy = Math.max(caixa.y, Math.min(y, caixa.y + caixa.altura));
        const dentroAgora =
          e.x > caixa.x &&
          e.x < caixa.x + caixa.largura &&
          e.y > caixa.y &&
          e.y < caixa.y + caixa.altura;
        if (dentroAgora) continue; // nunca prende quem já está dentro (ex.: porta fechando)
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r - 0.01) return false;
      } else {
        const rr = r + s.raio;
        const dAgora = (e.x - s.x) * (e.x - s.x) + (e.y - s.y) * (e.y - s.y);
        const dNovo = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
        if (dNovo < rr * rr && dNovo < dAgora) return false;
      }
    }
    return true;
  }

  private solidosProximos(e: Entidade, raio: number): Entidade[] {
    return this.entidades()
      .todas()
      .filter(
        (s) =>
          s.solido &&
          s !== e &&
          s.vivo &&
          Math.abs(s.x - e.x) < raio + 96 &&
          Math.abs(s.y - e.y) < raio + 96
      );
  }
}
