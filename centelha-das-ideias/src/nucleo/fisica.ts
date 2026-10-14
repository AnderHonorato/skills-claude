/**
 * Física do mundo: altura do chão, colisão de círculos contra sólidos (caixas e cilindros),
 * rampas e linha de visão. Pura (sem Three.js), usada pelo jogo e pelos testes.
 */
import type { Rampa, Solido } from './tipos';

/** Diferença de altura que se sobe andando (degrau). */
export const DEGRAU = 0.45;

export interface ResultadoColisao {
  colidiu: boolean;
  /** Bateu na parede da fronteira. */
  fronteira: boolean;
}

export class MundoFisico {
  constructor(
    readonly solidos: Solido[],
    readonly rampas: Rampa[],
    private flag: (nome: string) => boolean
  ) {}

  ativo(s: Solido): boolean {
    if (s.seFlag && !this.flag(s.seFlag)) return false;
    if (s.semFlag && this.flag(s.semFlag)) return false;
    return true;
  }

  /** O ponto (x, z) está dentro da projeção do sólido (com margem). */
  contem(s: Solido, x: number, z: number, margem = 0): boolean {
    if (s.forma === 'cilindro') return Math.hypot(x - s.x, z - s.z) <= (s.r ?? 0) + margem;
    return (
      Math.abs(x - s.x) <= (s.w ?? 0) / 2 + margem && Math.abs(z - s.z) <= (s.d ?? 0) / 2 + margem
    );
  }

  private alturaRampa(r: Rampa, x: number, z: number): number | null {
    if (Math.abs(x - r.x) > r.w / 2 || Math.abs(z - r.z) > r.d / 2) return null;
    const t = r.eixo === 'x' ? (x - (r.x - r.w / 2)) / r.w : (z - (r.z - r.d / 2)) / r.d;
    return r.de + (r.ate - r.de) * t;
  }

  /**
   * Altura do chão sob (x, z) para quem está na altura y: o topo mais alto que ainda
   * está ao alcance de um degrau. -Infinity = vão (sem chão).
   */
  alturaChao(x: number, z: number, y = 1e6, margem = 0.12): number {
    let melhor = -Infinity;
    for (const s of this.solidos) {
      if (s.topo > y + DEGRAU || s.topo <= melhor) continue;
      if (!this.ativo(s)) continue;
      if (this.contem(s, x, z, margem)) melhor = s.topo;
    }
    for (const r of this.rampas) {
      const h = this.alturaRampa(r, x, z);
      if (h !== null && h <= y + DEGRAU && h > melhor) melhor = h;
    }
    return melhor;
  }

  /** Existe algum chão (em qualquer altura) sob o ponto? */
  temChao(x: number, z: number): boolean {
    return this.alturaChao(x, z) > -Infinity;
  }

  /**
   * Empurra um círculo (raio) para fora dos sólidos que bloqueiam na faixa de altura
   * [y, y + altura]. Altera `p` no lugar.
   */
  resolver(p: { x: number; z: number }, y: number, raio: number, altura: number): ResultadoColisao {
    const r: ResultadoColisao = { colidiu: false, fronteira: false };
    for (let passo = 0; passo < 3; passo++) {
      let mexeu = false;
      for (const s of this.solidos) {
        if (s.topo <= y + DEGRAU || s.base >= y + altura) continue;
        if (!this.ativo(s)) continue;
        if (s.forma === 'cilindro') {
          const dx = p.x - s.x;
          const dz = p.z - s.z;
          const d = Math.hypot(dx, dz);
          const min = (s.r ?? 0) + raio;
          if (d >= min) continue;
          const nx = d > 1e-6 ? dx / d : 1;
          const nz = d > 1e-6 ? dz / d : 0;
          p.x = s.x + nx * min;
          p.z = s.z + nz * min;
        } else {
          const hw = (s.w ?? 0) / 2;
          const hd = (s.d ?? 0) / 2;
          const cx = Math.max(s.x - hw, Math.min(p.x, s.x + hw));
          const cz = Math.max(s.z - hd, Math.min(p.z, s.z + hd));
          let dx = p.x - cx;
          let dz = p.z - cz;
          const d = Math.hypot(dx, dz);
          if (d >= raio) continue;
          if (d < 1e-6) {
            // centro dentro da caixa: sai pelo lado mais próximo
            const esq = p.x - (s.x - hw);
            const dir = s.x + hw - p.x;
            const cima = p.z - (s.z - hd);
            const baixo = s.z + hd - p.z;
            const m = Math.min(esq, dir, cima, baixo);
            if (m === esq) p.x = s.x - hw - raio;
            else if (m === dir) p.x = s.x + hw + raio;
            else if (m === cima) p.z = s.z - hd - raio;
            else p.z = s.z + hd + raio;
          } else {
            dx /= d;
            dz /= d;
            p.x = cx + dx * raio;
            p.z = cz + dz * raio;
          }
        }
        mexeu = true;
        r.colidiu = true;
        if (s.tipo === 'fronteira') r.fronteira = true;
      }
      if (!mexeu) break;
    }
    return r;
  }

  /** Algum sólido ativo bloqueia o segmento na altura y? (amostrado) */
  linhaLivre(ax: number, az: number, bx: number, bz: number, y: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.ceil(d / 0.35));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      if (this.bloqueado(x, z, y)) return false;
    }
    return true;
  }

  /** Há um sólido ocupando o ponto na altura y (paredes, troncos, fronteira)? */
  bloqueado(x: number, z: number, y: number, tipos?: Solido['tipo'][]): Solido | null {
    for (const s of this.solidos) {
      if (s.tipo === 'ilha' || s.tipo === 'ponte') continue;
      if (tipos && !tipos.includes(s.tipo)) continue;
      if (s.topo <= y || s.base > y) continue;
      if (!this.ativo(s)) continue;
      if (this.contem(s, x, z)) return s;
    }
    return null;
  }

  /** Posição em que dá para ficar em pé (chão a até 1 m abaixo e nada ocupando). */
  pontoValido(x: number, z: number, raio = 0.42): boolean {
    const chao = this.alturaChao(x, z, 50, 0);
    if (chao === -Infinity) return false;
    const p = { x, z };
    const r = this.resolver(p, chao, raio, 1.1);
    return !r.colidiu;
  }
}
