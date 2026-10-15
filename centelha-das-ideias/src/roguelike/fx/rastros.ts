/**
 * Rastros em fita para projéteis rápidos (bola de fogo, lança de gelo, mísseis,
 * lâmina de vento, discos...). Cada rastro guarda as últimas posições com o
 * horário; a fita afina e some com a idade dos pontos. Tudo vai para a geometria
 * compartilhada de Fitas (um draw call). Um rastro que deixa de ser tocado para de
 * crescer e se desfaz sozinho.
 */
import * as THREE from 'three';
import type { Fitas } from './fitas';
import { corLinear, realce, type CorFx } from './util';

export interface EstiloRastro {
  /** ESTILO_FITA.* */
  estilo: number;
  aditivo: number;
  cor: CorFx;
  /** Cor na ponta final da cauda (padrão: a mesma). */
  corCauda?: CorFx;
  brilho: number;
  /** Largura na cabeça (m). */
  largura: number;
  /** Quanto tempo cada ponto dura (s) — define o comprimento. */
  duracao: number;
  alfa?: number;
}

const MAX_PONTOS = 40;

interface Rastro {
  pts: Float32Array; // x, y, z, t
  ini: number;
  n: number;
  estilo: EstiloRastro;
  toque: number;
  cabeca: [number, number, number];
  semente: number;
  /** Acúmulo para emissão de partículas por segundo (usado pelas receitas). */
  acumulo: number;
  vivo: boolean;
}

export class Rastros {
  private mapa = new Map<string | number, Rastro>();
  private c0 = new THREE.Color();

  /** Atualiza a cabeça do rastro `id`. Devolve o estado (útil para emitir partículas). */
  tocar(
    id: string | number,
    x: number,
    y: number,
    z: number,
    estilo: EstiloRastro,
    tempo: number
  ): { acumulo: number; novo: boolean; dx: number; dy: number; dz: number } {
    let r = this.mapa.get(id);
    let novo = false;
    if (!r || !r.vivo) {
      if (r) this.mapa.delete(id);
      r = {
        pts: new Float32Array(MAX_PONTOS * 4),
        ini: 0,
        n: 0,
        estilo,
        toque: tempo,
        cabeca: [x, y, z],
        semente: Math.random() * 10,
        acumulo: 0,
        vivo: true,
      };
      this.mapa.set(id, r);
      novo = true;
    }
    r.estilo = estilo;
    const [hx, hy, hz] = r.cabeca;
    const dx = x - hx;
    const dy = y - hy;
    const dz = z - hz;
    r.cabeca[0] = x;
    r.cabeca[1] = y;
    r.cabeca[2] = z;
    // guarda um ponto se andou o bastante ou passou tempo suficiente
    const ult = r.n > 0 ? ((r.ini + r.n - 1) % MAX_PONTOS) * 4 : -1;
    const longe =
      ult < 0 ||
      Math.hypot(x - r.pts[ult], y - r.pts[ult + 1], z - r.pts[ult + 2]) > 0.18 ||
      tempo - r.pts[ult + 3] > 1 / 40;
    if (longe) {
      if (r.n >= MAX_PONTOS) {
        r.ini = (r.ini + 1) % MAX_PONTOS;
        r.n--;
      }
      const k = ((r.ini + r.n) % MAX_PONTOS) * 4;
      r.pts[k] = x;
      r.pts[k + 1] = y;
      r.pts[k + 2] = z;
      r.pts[k + 3] = tempo;
      r.n++;
    }
    r.toque = tempo;
    return { acumulo: r.acumulo, novo, dx, dy, dz };
  }

  /** Guarda o acúmulo de emissão do rastro (as receitas controlam a taxa). */
  definirAcumulo(id: string | number, v: number): void {
    const r = this.mapa.get(id);
    if (r) r.acumulo = v;
  }

  /** Para de crescer: a cauda termina de sumir sozinha. */
  fim(id: string | number): void {
    const r = this.mapa.get(id);
    if (r) r.vivo = false;
  }

  atualizar(tempo: number, folga: number): void {
    for (const [id, r] of this.mapa) {
      if (r.vivo && tempo - r.toque > folga) r.vivo = false;
      const dur = r.estilo.duracao;
      while (r.n > 0 && tempo - r.pts[r.ini * 4 + 3] > dur) {
        r.ini = (r.ini + 1) % MAX_PONTOS;
        r.n--;
      }
      if (!r.vivo && r.n === 0) this.mapa.delete(id);
    }
  }

  desenhar(f: Fitas, tempo: number): void {
    for (const r of this.mapa.values()) {
      if (r.n < 1) continue;
      const e = r.estilo;
      const ca = corLinear(e.cor);
      const cb = corLinear(e.corCauda ?? e.cor);
      const alfa = e.alfa ?? 1;
      f.comecar(e.estilo, e.aditivo, r.semente);
      // cabeça (posição atual) só enquanto vivo
      const b = realce(e.brilho);
      if (r.vivo) {
        f.ponto(
          r.cabeca[0],
          r.cabeca[1],
          r.cabeca[2],
          e.largura,
          ca.r * b,
          ca.g * b,
          ca.b * b,
          alfa
        );
      }
      for (let j = r.n - 1; j >= 0; j--) {
        const k = ((r.ini + j) % MAX_PONTOS) * 4;
        const idade = tempo - r.pts[k + 3];
        const v = Math.max(0, 1 - idade / e.duracao);
        if (j === r.n - 1 && r.vivo) {
          const d = Math.hypot(
            r.pts[k] - r.cabeca[0],
            r.pts[k + 1] - r.cabeca[1],
            r.pts[k + 2] - r.cabeca[2]
          );
          if (d < 0.02) continue;
        }
        this.c0.setRGB(ca.r, ca.g, ca.b).lerp(cb, 1 - v);
        f.ponto(
          r.pts[k],
          r.pts[k + 1],
          r.pts[k + 2],
          e.largura * Math.pow(v, 0.45),
          this.c0.r * b,
          this.c0.g * b,
          this.c0.b * b,
          alfa * Math.pow(v, 0.9)
        );
      }
      f.terminar();
    }
  }

  get quantidade(): number {
    return this.mapa.size;
  }

  limpar(): void {
    this.mapa.clear();
  }
}
