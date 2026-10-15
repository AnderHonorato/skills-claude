/**
 * Receitas por elemento: cada elemento tem paleta, rastro, impacto, nova e poça
 * com identidade própria (forma, movimento e material), não só cor:
 *  fogo — chamas que sobem, brasas e fumaça escura;
 *  gelo — estilhaços que caem e quicam, névoa fria, flocos e geada no chão;
 *  raio — faíscas riscadas muito rápidas e mini-relâmpagos;
 *  luz — clarão, estrela, raios radiais e pontinhos que sobem;
 *  vento — arcos girando em espiral e folhas;
 *  terra — pedras com gravidade, poeira opaca e rachaduras;
 *  veneno — bolhas, gotas que pingam e mancha ácida;
 *  arcano — glifos que giram e partículas em hélice;
 *  gravidade — tudo é SUGADO para dentro, núcleo escuro;
 *  som — anéis concêntricos e notas musicais;
 *  água — respingos de gotas e onda com espuma;
 *  cristal — cacos de vidro prismáticos e cintilações;
 *  codigo — dígitos binários, pixels verdes e fatias de glitch.
 */
import type { Elemento } from '../dados/habilidades';
import { ESTILO_FITA } from './fitas';
import { ESTILO_PLANO, type Planos } from './ondas';
import { MODO, type Emissao, type Particulas } from './particulas';
import type { Raios } from './raios';
import type { EstiloRastro } from './rastros';
import { D, Q } from './texturas';
import { sinal, sortear, type CorFx } from './util';
import type { Volumes } from './volumes';

export type { Elemento };

/** Elementos do FX: os 12 do jogo + 'codigo' (tema programação, verde-matriz). */
export type ElementoFx = Elemento | 'codigo';

/** O que as receitas precisam do sistema. */
export interface Ctx {
  p: Particulas;
  planos: Planos;
  raios: Raios;
  volumes: Volumes;
  /** Quantidade ajustada pela qualidade (arredondamento sorteado). */
  q(n: number): number;
  tempo: number;
  agendar(duracao: number, fn: (t: number, dt: number) => void): void;
  tremer(f: number): void;
  pulso(cor: CorFx, f: number): void;
}

export interface Paleta {
  base: string;
  claro: string;
  escuro: string;
}

export const PALETAS: Record<ElementoFx, Paleta> = {
  fogo: { base: '#ff7a2e', claro: '#ffd36b', escuro: '#7a1c08' },
  gelo: { base: '#7fd8ff', claro: '#effcff', escuro: '#2a78c0' },
  raio: { base: '#ffe45c', claro: '#ffffff', escuro: '#7a6cff' },
  luz: { base: '#ffd27a', claro: '#fff8e0', escuro: '#ff9a3c' },
  vento: { base: '#b8ffe0', claro: '#ffffff', escuro: '#4fbf94' },
  terra: { base: '#b08050', claro: '#e6cc98', escuro: '#4a3320' },
  veneno: { base: '#8cff3c', claro: '#e0ff9a', escuro: '#2a8a14' },
  arcano: { base: '#b27bff', claro: '#f0dcff', escuro: '#5a24c0' },
  gravidade: { base: '#8a6bff', claro: '#e2d8ff', escuro: '#12082a' },
  som: { base: '#ff8fd0', claro: '#fff0fa', escuro: '#b03c8c' },
  agua: { base: '#3fa8ff', claro: '#e2f5ff', escuro: '#1a58b0' },
  cristal: { base: '#bfeaff', claro: '#ffffff', escuro: '#6aa7d8' },
  codigo: { base: '#39ff88', claro: '#d8ffe8', escuro: '#0a5a2a' },
};

/** Glifos de código sorteados (mais 0 e 1). */
export const GLIFOS = [
  Q.ZERO,
  Q.UM,
  Q.ZERO,
  Q.UM,
  Q.ZERO,
  Q.UM,
  Q.CHAVES,
  Q.PONTO_VIRGULA,
  Q.LAMBDA,
  Q.CERQUILHA,
  Q.TAG,
];
const RGB_SPLIT = ['#ff2a6a', '#2af0ff', '#39ff88', '#ffffff'];

const PRISMA = ['#bfeaff', '#ffd6f5', '#d6ffe8', '#fff3c4', '#e0d0ff', '#c8fff6'];

const escolher = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** Direção aleatória no hemisfério de cima (x, y, z). */
function direcao(subida = 0.6): [number, number, number] {
  const a = Math.random() * Math.PI * 2;
  const y = sortear(0.1, 1) * subida;
  const h = Math.sqrt(Math.max(0, 1 - y * y));
  return [Math.cos(a) * h, y, Math.sin(a) * h];
}

/** Emite n partículas saindo de um ponto, com velocidade entre vMin e vMax. */
function jorro(
  c: Ctx,
  n: number,
  x: number,
  y: number,
  z: number,
  vMin: number,
  vMax: number,
  subida: number,
  base: Omit<Emissao, 'x' | 'y' | 'z'>,
  variar?: (o: Emissao, i: number) => void
): void {
  const k = c.q(n);
  for (let i = 0; i < k; i++) {
    const [dx, dy, dz] = direcao(subida);
    const v = sortear(vMin, vMax);
    const o: Emissao = {
      ...base,
      x,
      y,
      z,
      vx: dx * v,
      vy: dy * v + (base.vy ?? 0),
      vz: dz * v,
      vida: (base.vida ?? 0.6) * sortear(0.7, 1.25),
      rot: base.rot ?? Math.random() * Math.PI * 2,
    };
    if (variar) variar(o, i);
    c.p.emitir(o);
  }
}

// ------------------------------------------------------------------ rastros

export function estiloRastro(e: ElementoFx, s: number): EstiloRastro {
  switch (e) {
    case 'fogo':
      return {
        estilo: ESTILO_FITA.FOGO,
        aditivo: 1,
        cor: '#ff8a2e',
        corCauda: '#b8200a',
        brilho: 1.7,
        largura: 0.81 * s,
        duracao: 0.43,
      };
    case 'gelo':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0.75,
        cor: '#bff0ff',
        corCauda: '#3f9ee0',
        brilho: 1.4,
        largura: 0.44 * s,
        duracao: 0.35,
      };
    case 'raio':
      return {
        estilo: ESTILO_FITA.RAIO,
        aditivo: 1,
        cor: '#ffe45c',
        corCauda: '#9a8cff',
        brilho: 1.6,
        largura: 0.52 * s,
        duracao: 0.2,
      };
    case 'luz':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 1,
        cor: '#ffe2a0',
        corCauda: '#ff9a3c',
        brilho: 1.9,
        largura: 0.55 * s,
        duracao: 0.38,
      };
    case 'vento':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0.55,
        cor: '#f2fffa',
        corCauda: '#7fe0bc',
        brilho: 1.15,
        largura: 0.72 * s,
        duracao: 0.46,
        alfa: 0.75,
      };
    case 'terra':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0,
        cor: '#d8c09a',
        corCauda: '#8a6a48',
        brilho: 1,
        largura: 0.65 * s,
        duracao: 0.43,
        alfa: 0.55,
      };
    case 'veneno':
      return {
        estilo: ESTILO_FITA.LIQUIDO,
        aditivo: 0.7,
        cor: '#8cff3c',
        corCauda: '#2a8a14',
        brilho: 1.15,
        largura: 0.55 * s,
        duracao: 0.43,
      };
    case 'arcano':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 1,
        cor: '#c58bff',
        corCauda: '#5a24c0',
        brilho: 1.9,
        largura: 0.44 * s,
        duracao: 0.52,
      };
    case 'gravidade':
      return {
        estilo: ESTILO_FITA.SOMBRA,
        aditivo: 1,
        cor: '#8a6bff',
        brilho: 1.2,
        largura: 0.72 * s,
        duracao: 0.43,
      };
    case 'som':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0.9,
        cor: '#ffb0e0',
        corCauda: '#ff5cb8',
        brilho: 1.4,
        largura: 0.39 * s,
        duracao: 0.29,
      };
    case 'agua':
      return {
        estilo: ESTILO_FITA.LIQUIDO,
        aditivo: 0.55,
        cor: '#5cb8ff',
        corCauda: '#1a58b0',
        brilho: 1.2,
        largura: 0.57 * s,
        duracao: 0.38,
      };
    case 'codigo':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0.75,
        cor: '#39ff88',
        corCauda: '#0a8a3a',
        brilho: 1.3,
        largura: 0.42 * s,
        duracao: 0.45,
      };
    case 'cristal':
      return {
        estilo: ESTILO_FITA.SUAVE,
        aditivo: 0.9,
        cor: '#e6f8ff',
        corCauda: '#9fd0ff',
        brilho: 1.5,
        largura: 0.39 * s,
        duracao: 0.38,
      };
  }
}

/**
 * Partículas e "cabeça" do projétil a cada quadro. `ticks` = quantos pulsos de
 * emissão cabem neste quadro (taxa ~40/s); vx/vz = velocidade do projétil.
 */
export function cabecaProjetil(
  c: Ctx,
  e: ElementoFx,
  x: number,
  y: number,
  z: number,
  s: number,
  ticks: number,
  vx: number,
  vy: number,
  vz: number,
  cabeca: boolean
): void {
  const t = c.tempo;
  const atras = -0.12;
  const bx = vx * atras;
  const bz = vz * atras;
  const p = c.p;
  switch (e) {
    case 'fogo': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.4 * s,
          cor: '#ff6a1e',
          brilho: 1.1,
          alfa: 0.5,
          quadro: Q.BRILHO,
          aditivo: 0.6,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.95 * s,
          cor: '#ffc066',
          brilho: 1.9,
          quadro: Q.CHAMA_A,
          rot: t * 7,
          aditivo: 0.9,
        });
        p.desenharAgora({ x, y, z, tam: 0.45 * s, cor: '#fff3c4', brilho: 1.8, quadro: Q.BRILHO });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.25)
          p.emitir({
            x: x + bx,
            y,
            z: z + bz,
            vx: sinal() * 0.4,
            vy: 1.2,
            vz: sinal() * 0.4,
            vida: 0.7,
            tam: 0.35 * s,
            tamFim: 0.9 * s,
            cor: '#3d302b',
            corFim: '#2a2422',
            alfa: 0.4,
            aditivo: 0,
            quadro: Q.FUMACA_A,
            giro: sinal(),
            entrada: 0.2,
            arrasto: 1,
          });
        p.emitir({
          x: x + sinal() * 0.12 * s,
          y: y + sinal() * 0.12 * s,
          z: z + sinal() * 0.12 * s,
          vx: vx * 0.1 + sinal() * 0.5,
          vy: 0.8 + Math.random(),
          vz: vz * 0.1 + sinal() * 0.5,
          vida: 0.32,
          tam: 0.55 * s,
          tamFim: 0.2 * s,
          rot: Math.random() * 6,
          giro: sinal() * 4,
          cor: '#ffe08a',
          corFim: '#ff3a0a',
          brilho: 1.8,
          quadro: escolher([Q.CHAMA_A, Q.CHAMA_B]),
          aditivo: 0.85,
          arrasto: 3,
          entrada: 0.05,
        });
        if (Math.random() < 0.35)
          p.emitir({
            x,
            y,
            z,
            vx: vx * 0.15 + sinal() * 2,
            vy: sortear(0.5, 2.5),
            vz: vz * 0.15 + sinal() * 2,
            vida: sortear(0.4, 0.7),
            tam: 0.07 * s,
            cor: '#ffe7a0',
            corFim: '#ff5a1a',
            brilho: 2.4,
            quadro: Q.BRASA,
            modo: MODO.ESTICADO,
            estica: 0.05,
            gravidade: 3,
            arrasto: 1.5,
          });
      }
      break;
    }
    case 'gelo': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.9 * s,
          cor: '#7fd8ff',
          brilho: 1.5,
          alfa: 0.7,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.7 * s,
          cor: '#ffffff',
          brilho: 1.8,
          quadro: Q.ESTRELA,
          rot: t * 3,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.5)
          p.emitir({
            x: x + bx,
            y,
            z: z + bz,
            vx: sinal() * 0.3,
            vy: sinal() * 0.2,
            vz: sinal() * 0.3,
            vida: 0.6,
            tam: 0.3 * s,
            tamFim: 0.8 * s,
            cor: '#e8fbff',
            alfa: 0.35,
            aditivo: 0.35,
            quadro: Q.FUMACA_B,
            giro: sinal(),
            entrada: 0.2,
          });
        if (Math.random() < 0.6)
          p.emitir({
            x: x + sinal() * 0.2,
            y: y + sinal() * 0.15,
            z: z + sinal() * 0.2,
            vx: sinal() * 0.6,
            vy: -0.4,
            vz: sinal() * 0.6,
            vida: sortear(0.4, 0.8),
            tam: sortear(0.08, 0.16) * s,
            cor: '#ffffff',
            corFim: '#8fe3ff',
            brilho: 1.8,
            quadro: escolher([Q.FLOCO, Q.ESTRELA]),
            giro: sinal() * 5,
            gravidade: 1.2,
            aditivo: 0.8,
          });
      }
      break;
    }
    case 'raio': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.1 * s,
          cor: '#fff3a0',
          brilho: 2.2,
          quadro: Math.random() < 0.5 ? Q.ELETRICO_A : Q.ELETRICO_B,
          rot: Math.random() * 6,
        });
        p.desenharAgora({ x, y, z, tam: 0.4 * s, cor: '#ffffff', brilho: 3, quadro: Q.BRILHO });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.6)
          p.emitir({
            x,
            y,
            z,
            vx: sinal() * 6,
            vy: sinal() * 4,
            vz: sinal() * 6,
            vida: sortear(0.08, 0.18),
            tam: 0.06 * s,
            cor: '#ffffff',
            corFim: '#ffe45c',
            brilho: 3,
            quadro: Q.RISCO,
            modo: MODO.ESTICADO,
            estica: 0.035,
            arrasto: 4,
          });
      }
      break;
    }
    case 'luz': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.3 * s,
          cor: '#ffd27a',
          brilho: 1.4,
          alfa: 0.6,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.0 * s,
          cor: '#fff8e0',
          brilho: 2.2,
          quadro: Q.ESTRELA,
          rot: t * 2,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.45)
          p.emitir({
            x: x + sinal() * 0.2,
            y,
            z: z + sinal() * 0.2,
            vx: sinal() * 0.3,
            vy: sortear(0.6, 1.4),
            vz: sinal() * 0.3,
            vida: sortear(0.5, 0.9),
            tam: 0.09 * s,
            cor: '#fff3c4',
            corFim: '#ffb347',
            brilho: 2.3,
            quadro: Q.BRASA,
            arrasto: 1,
          });
      }
      break;
    }
    case 'vento': {
      if (cabeca)
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.1 * s,
          cor: '#f2fffa',
          brilho: 1.2,
          alfa: 0.7,
          quadro: Q.ESPIRAL,
          rot: -t * 14,
          aditivo: 0.6,
        });
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.3)
          p.emitir({
            x,
            y,
            z,
            orbX: x,
            orbZ: z,
            orbW: sinal() > 0 ? 9 : -9,
            orbVr: 1.5,
            vy: 0.3,
            vida: 0.35,
            tam: 0.7 * s,
            tamFim: 1.1 * s,
            rot: Math.random() * 6,
            giro: 9,
            cor: '#f2fffa',
            alfa: 0.7,
            aditivo: 0.55,
            quadro: Q.VENTO,
          });
        if (Math.random() < 0.06)
          p.emitir({
            x,
            y,
            z,
            vx: sinal() * 2,
            vy: sortear(0.5, 1.5),
            vz: sinal() * 2,
            vida: 1,
            tam: 0.16 * s,
            cor: '#8fd96a',
            corFim: '#5fae4a',
            aditivo: 0,
            quadro: Q.FOLHA,
            giro: sinal() * 8,
            gravidade: 2,
            arrasto: 1.5,
          });
      }
      break;
    }
    case 'terra': {
      if (cabeca)
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.55 * s,
          cor: '#9a7048',
          aditivo: 0,
          quadro: Q.ROCHA_A,
          rot: t * 6,
        });
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.4)
          p.emitir({
            x: x + bx,
            y,
            z: z + bz,
            vx: sinal() * 0.5,
            vy: 0.3,
            vz: sinal() * 0.5,
            vida: 0.7,
            tam: 0.3 * s,
            tamFim: 0.9 * s,
            cor: '#d8c09a',
            alfa: 0.5,
            aditivo: 0,
            quadro: Q.POEIRA,
            giro: sinal(),
            entrada: 0.15,
            arrasto: 2,
          });
        if (Math.random() < 0.15)
          p.emitir({
            x,
            y,
            z,
            vx: sinal() * 1.5,
            vy: 1,
            vz: sinal() * 1.5,
            vida: 0.7,
            tam: 0.1 * s,
            cor: '#7a5a3a',
            aditivo: 0,
            quadro: Q.ROCHA_B,
            giro: sinal() * 9,
            gravidade: 14,
            quique: 0.3,
            curva: 0.3,
          });
      }
      break;
    }
    case 'veneno': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.9 * s,
          cor: '#8cff3c',
          brilho: 1.2,
          alfa: 0.5,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.5 * s,
          cor: '#c8ff7a',
          brilho: 1.1,
          quadro: Q.BOLHA,
          aditivo: 0.4,
          rot: t,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.4)
          p.emitir({
            x: x + sinal() * 0.1,
            y,
            z: z + sinal() * 0.1,
            vx: vx * 0.1,
            vy: -0.5,
            vz: vz * 0.1,
            vida: 0.7,
            tam: 0.13 * s,
            cor: '#b8ff6a',
            corFim: '#4fc81e',
            brilho: 1.1,
            aditivo: 0.25,
            quadro: Q.GOTA,
            modo: MODO.ESTICADO,
            estica: -0.06,
            gravidade: 9,
          });
        if (Math.random() < 0.2)
          p.emitir({
            x: x + sinal() * 0.2,
            y,
            z: z + sinal() * 0.2,
            vx: sinal() * 0.3,
            vy: 0.6,
            vz: sinal() * 0.3,
            vida: 0.6,
            tam: 0.12 * s,
            tamFim: 0.2 * s,
            cor: '#d6ff8a',
            aditivo: 0.5,
            quadro: Q.BOLHA,
          });
      }
      break;
    }
    case 'arcano': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.1 * s,
          cor: '#9b5cff',
          brilho: 1.5,
          alfa: 0.7,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.75 * s,
          cor: '#f0dcff',
          brilho: 2,
          quadro: Q.RUNA_B,
          rot: t * 4,
        });
        p.desenharAgora({ x, y, z, tam: 0.35 * s, cor: '#ffffff', brilho: 2.5, quadro: Q.BRILHO });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.6) {
          const a = t * 14 + i;
          p.emitir({
            x: x + Math.cos(a) * 0.25 * s,
            y: y + Math.sin(a * 1.3) * 0.15,
            z: z + Math.sin(a) * 0.25 * s,
            vx: sinal() * 0.2,
            vy: 0.3,
            vz: sinal() * 0.2,
            vida: sortear(0.35, 0.6),
            tam: 0.1 * s,
            cor: '#e2c9ff',
            corFim: '#7a3cff',
            brilho: 2.2,
            quadro: Q.BRASA,
          });
        }
      }
      break;
    }
    case 'gravidade': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.3 * s,
          cor: '#8a6bff',
          brilho: 1.6,
          alfa: 0.8,
          quadro: Q.ANEL,
          rot: t,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.75 * s,
          cor: '#0a0418',
          aditivo: 0,
          alfa: 0.95,
          quadro: Q.BRILHO,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.5) {
          const a = Math.random() * Math.PI * 2;
          const r = 0.9 * s;
          p.emitir({
            x: x + Math.cos(a) * r,
            y: y + sinal() * 0.3,
            z: z + Math.sin(a) * r,
            vx: -Math.cos(a) * r * 4 + vx,
            vy: 0,
            vz: -Math.sin(a) * r * 4 + vz,
            vida: 0.22,
            tam: 0.06 * s,
            cor: '#e2d8ff',
            brilho: 2,
            quadro: Q.RISCO,
            modo: MODO.ESTICADO,
            estica: 0.05,
          });
        }
      }
      break;
    }
    case 'som': {
      if (cabeca)
        p.desenharAgora({ x, y, z, tam: 0.7 * s, cor: '#ffd6f0', brilho: 1.6, quadro: Q.BRILHO });
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.22)
          p.emitir({
            x,
            y,
            z,
            vida: 0.35,
            tam: 0.3 * s,
            tamFim: 1.6 * s,
            cor: '#ffc0e8',
            brilho: 1.4,
            aditivo: 0.85,
            quadro: Q.ANEL,
            entrada: 0,
          });
        if (Math.random() < 0.05)
          p.emitir({
            x,
            y,
            z,
            vx: sinal() * 0.8,
            vy: 1.4,
            vz: sinal() * 0.8,
            vida: 0.9,
            tam: 0.3 * s,
            cor: '#ff8fd0',
            brilho: 1.3,
            aditivo: 0.5,
            quadro: Q.NOTA,
            giro: sinal(),
            arrasto: 1,
          });
      }
      break;
    }
    case 'agua': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.9 * s,
          cor: '#5cb8ff',
          brilho: 1.2,
          alfa: 0.6,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.5 * s,
          cor: '#e2f5ff',
          brilho: 1.3,
          quadro: Q.BOLHA,
          aditivo: 0.5,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.45)
          p.emitir({
            x,
            y,
            z,
            vx: vx * 0.2 + sinal() * 1.5,
            vy: sortear(0.5, 2),
            vz: vz * 0.2 + sinal() * 1.5,
            vida: 0.5,
            tam: 0.11 * s,
            cor: '#e2f5ff',
            corFim: '#5cb8ff',
            brilho: 1.2,
            aditivo: 0.35,
            quadro: Q.GOTA,
            modo: MODO.ESTICADO,
            estica: -0.06,
            gravidade: 12,
          });
      }
      break;
    }
    case 'codigo': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 1.1 * s,
          cor: '#39ff88',
          brilho: 1.2,
          alfa: 0.55,
          quadro: Q.BRILHO,
          aditivo: 0.7,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.8 * s,
          cor: '#e8fff0',
          brilho: 1.6,
          quadro: Q.CHAVES,
          aditivo: 0.6,
        });
      }
      for (let i = 0; i < ticks; i++) {
        const r = Math.random();
        if (r < 0.22)
          p.emitir({
            x: x + bx * 0.5,
            y: y + sinal() * 0.1,
            z: z + bz * 0.5,
            vx: vx * 0.05 + sinal() * 0.3,
            vy: 0.4,
            vz: vz * 0.05 + sinal() * 0.3,
            vida: 0.6,
            tam: 0.6 * s,
            tamFim: 0.4 * s,
            cor: '#8affb8',
            corFim: '#18a850',
            brilho: 1.2,
            aditivo: 0.35,
            quadro: Q.CHAVES,
            entrada: 0,
          });
        else if (r < 0.6)
          p.emitir({
            x: x + sinal() * 0.2,
            y: y + sinal() * 0.15,
            z: z + sinal() * 0.2,
            vx: sinal() * 0.4,
            vy: sortear(0.3, 1),
            vz: sinal() * 0.4,
            vida: sortear(0.4, 0.7),
            tam: 0.2 * s,
            cor: '#d8ffe8',
            corFim: '#18c860',
            brilho: 1.3,
            aditivo: 0.55,
            quadro: Math.random() < 0.5 ? Q.ZERO : Q.UM,
          });
        else if (r < 0.75)
          p.emitir({
            x,
            y,
            z,
            vx: sinal() * 1.5,
            vy: sortear(0, 1.5),
            vz: sinal() * 1.5,
            vida: 0.5,
            tam: 0.08 * s,
            cor: '#39ff88',
            aditivo: 0.2,
            quadro: Q.PIXEL,
            gravidade: 5,
            curva: 0.4,
          });
      }
      break;
    }
    case 'cristal': {
      if (cabeca) {
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.8 * s,
          cor: '#bfeaff',
          brilho: 1.4,
          alfa: 0.6,
          quadro: Q.BRILHO,
        });
        p.desenharAgora({
          x,
          y,
          z,
          tam: 0.6 * s,
          cor: '#ffffff',
          brilho: 1.4,
          quadro: Q.CRISTAL,
          rot: t * 5,
          aditivo: 0.4,
        });
      }
      for (let i = 0; i < ticks; i++) {
        if (Math.random() < 0.3)
          p.emitir({
            x: x + sinal() * 0.3,
            y: y + sinal() * 0.2,
            z: z + sinal() * 0.3,
            vida: sortear(0.25, 0.45),
            tam: sortear(0.15, 0.3) * s,
            cor: escolher(PRISMA),
            brilho: 2.2,
            quadro: Q.ESTRELA,
            rot: Math.random(),
            giro: 2,
            entrada: 0.3,
          });
      }
      break;
    }
  }
}

// ------------------------------------------------------------------ impactos

/** Clarão rápido comum a vários impactos. */
function clarao(c: Ctx, x: number, y: number, z: number, tam: number, cor: CorFx, brilho = 2.2) {
  c.p.emitir({
    x,
    y,
    z,
    vida: 0.14,
    tam: tam * 0.6,
    tamFim: tam,
    cor,
    brilho,
    quadro: Q.BRILHO,
    entrada: 0,
    curva: 1.6,
  });
}

/** Fatia horizontal curta de glitch (barras RGB deslocadas). */
export function glitchFatia(c: Ctx, x: number, y: number, z: number, s: number, barras = 3): void {
  const n = c.q(barras);
  for (let k = 0; k < n; k++) {
    const yy = y + sinal() * 0.35 * s;
    const xx = x + sinal() * 0.3 * s;
    const tam = sortear(0.05, 0.11) * s;
    const asp = sortear(7, 14);
    const vida = sortear(0.09, 0.18);
    c.p.emitir({
      x: xx - 0.07 * s,
      y: yy,
      z,
      vida,
      tam,
      aspecto: asp,
      cor: RGB_SPLIT[0],
      brilho: 1.3,
      aditivo: 0.6,
      quadro: Q.PIXEL,
      entrada: 0,
      curva: 0.25,
    });
    c.p.emitir({
      x: xx + 0.07 * s,
      y: yy,
      z,
      vida,
      tam,
      aspecto: asp,
      cor: RGB_SPLIT[1],
      brilho: 1.3,
      aditivo: 0.6,
      quadro: Q.PIXEL,
      entrada: 0,
      curva: 0.25,
    });
    c.p.emitir({
      x: xx,
      y: yy,
      z,
      vida: vida * 0.7,
      tam: tam * 0.6,
      aspecto: asp,
      cor: '#ffffff',
      brilho: 1.6,
      aditivo: 0.5,
      quadro: Q.PIXEL,
      entrada: 0,
      curva: 0.25,
    });
  }
}

export function impacto(c: Ctx, e: ElementoFx, x: number, y: number, z: number, s: number): void {
  const p = c.p;
  switch (e) {
    case 'fogo': {
      jorro(c, 3, x, y, z, 0.3, 1, 0.8, {
        vida: 1.1,
        tam: 0.45 * s,
        tamFim: 1.5 * s,
        cor: '#4a3a34',
        corFim: '#262120',
        alfa: 0.55,
        aditivo: 0,
        quadro: Q.FUMACA_A,
        vy: 1.4,
        arrasto: 1.6,
        entrada: 0.25,
        giro: 0.6,
      });
      clarao(c, x, y, z, 1.8 * s, '#fff0c0');
      jorro(
        c,
        12,
        x,
        y,
        z,
        1.4,
        3.6,
        0.7,
        {
          vida: 0.6,
          tam: 0.6 * s,
          tamFim: 1.35 * s,
          cor: '#ffd060',
          corFim: '#c8280a',
          brilho: 1.7,
          quadro: Q.CHAMA_A,
          aditivo: 0.6,
          arrasto: 5,
          gravidade: -2.5,
          curva: 1.1,
        },
        (o) => {
          o.quadro = escolher([Q.CHAMA_A, Q.CHAMA_B, Q.CHAMA_C]);
          o.giro = sinal() * 3;
        }
      );
      jorro(c, 12, x, y, z, 3, 8, 0.8, {
        vida: 0.7,
        tam: 0.08 * s,
        cor: '#ffe7a0',
        corFim: '#ff4a12',
        brilho: 2.6,
        quadro: Q.BRASA,
        modo: MODO.ESTICADO,
        estica: 0.04,
        gravidade: 7,
        arrasto: 1.2,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.LUZ_CHAO,
        x,
        z,
        raio: 2.4 * s,
        vida: 0.5,
        cor: '#ff7a2e',
        brilho: 1.3,
        curva: 1.5,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_FOGO,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.5 * s,
        vida: 0.35,
        cor: '#ffb347',
        cor2: '#e8380c',
        brilho: 1.2,
        param: 0.5,
        aditivo: 0.8,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 0.9 * s,
        vida: 2.2,
        cor: '#2a1a12',
        param: D.QUEIMADO,
        alfa: 0.7,
        aditivo: 0,
        camada: 0,
        curva: 0.6,
      });
      break;
    }
    case 'gelo': {
      clarao(c, x, y, z, 1.3 * s, '#dff8ff', 1.8);
      jorro(c, 3, x, y, z, 0.3, 1, 0.4, {
        vida: 0.9,
        tam: 0.5 * s,
        tamFim: 1.4 * s,
        cor: '#e8fbff',
        alfa: 0.45,
        aditivo: 0.3,
        quadro: Q.FUMACA_B,
        arrasto: 2,
        entrada: 0.2,
        giro: 0.5,
      });
      jorro(
        c,
        9,
        x,
        y,
        z,
        2.5,
        6,
        0.75,
        {
          vida: 0.8,
          tam: 0.28 * s,
          cor: '#ffffff',
          corFim: '#9fe6ff',
          brilho: 1.25,
          aditivo: 0.3,
          quadro: Q.ESTILHACO,
          gravidade: 13,
          quique: 0.35,
          arrasto: 0.5,
          curva: 0.4,
        },
        (o) => {
          o.quadro = escolher([Q.ESTILHACO, Q.LASCA, Q.ESTILHACO]);
          o.giro = sinal() * 12;
          o.tam = sortear(0.18, 0.36) * s;
        }
      );
      jorro(c, 6, x, y + 0.2, z, 0.4, 1.2, 1, {
        vida: 0.9,
        tam: 0.14 * s,
        cor: '#ffffff',
        brilho: 1.9,
        quadro: Q.FLOCO,
        giro: 2,
        gravidade: 0.8,
        arrasto: 1.5,
        entrada: 0.1,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_GELO,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.6 * s,
        vida: 0.35,
        cor: '#ffffff',
        cor2: '#7fd8ff',
        brilho: 1.2,
        param: 0.35,
        aditivo: 0.8,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 1.1 * s,
        vida: 2.4,
        cor: '#e8fbff',
        param: D.GEADA,
        alfa: 0.75,
        aditivo: 0.2,
        camada: 0,
        curva: 0.6,
        entrada: 0.1,
      });
      break;
    }
    case 'raio': {
      clarao(c, x, y, z, 1.6 * s, '#fff6c0', 1.8);
      jorro(c, 16, x, y, z, 6, 14, 0.7, {
        vida: 0.22,
        tam: 0.07 * s,
        cor: '#ffffff',
        corFim: '#ffe45c',
        brilho: 3,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.03,
        arrasto: 4,
        gravidade: 4,
      });
      for (let k = 0; k < 2; k++)
        p.emitir({
          x,
          y,
          z,
          vida: 0.32,
          tam: 1.5 * s,
          cor: '#fff07a',
          brilho: 1.8,
          aditivo: 0.7,
          quadro: k ? Q.ELETRICO_A : Q.ELETRICO_B,
          rot: Math.random() * 6,
          giro: sinal() * 20,
          entrada: 0,
        });
      const ramos = c.q(3);
      for (let k = 0; k < ramos; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = sortear(0.8, 1.6) * s;
        c.raios.relampago(x, y, z, x + Math.cos(a) * r, 0.05, z + Math.sin(a) * r, '#ffd23c', {
          largura: 0.32 * s,
          vida: 0.28,
          ramos: 1,
        });
      }
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_RAIO,
        x,
        z,
        raio: 0.4 * s,
        raioFim: 1.5 * s,
        vida: 0.35,
        cor: '#ffd23c',
        brilho: 1.3,
        aditivo: 0.6,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 0.9 * s,
        vida: 1.6,
        cor: '#1c1830',
        param: D.QUEIMADO,
        alfa: 0.5,
        aditivo: 0,
        camada: 0,
        curva: 0.6,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.LUZ_CHAO,
        x,
        z,
        raio: 2 * s,
        vida: 0.2,
        cor: '#d8e4ff',
        brilho: 1.2,
      });
      break;
    }
    case 'luz': {
      clarao(c, x, y, z, 2.4 * s, '#fff3c4', 2.2);
      p.emitir({
        x,
        y,
        z,
        vida: 0.32,
        tam: 1.2 * s,
        tamFim: 2.2 * s,
        cor: '#fff8e0',
        brilho: 2.2,
        quadro: Q.ESTRELA,
        rot: Math.random(),
        giro: 2.5,
        entrada: 0,
        curva: 1.4,
      });
      p.emitir({
        x,
        y,
        z,
        vida: 0.38,
        tam: 1.4 * s,
        tamFim: 2.6 * s,
        cor: '#ffd27a',
        brilho: 1.6,
        quadro: Q.RAIOS,
        rot: Math.random() * 6,
        giro: -1.5,
        entrada: 0,
      });
      jorro(c, 10, x, y, z, 0.5, 2, 1, {
        vida: 0.9,
        tam: 0.1 * s,
        cor: '#fff3c4',
        corFim: '#ffb347',
        brilho: 2.4,
        quadro: Q.BRASA,
        vy: 1.4,
        arrasto: 2,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.5 * s,
        vida: 0.3,
        cor: '#ffd27a',
        cor2: '#ff9a3c',
        brilho: 1.2,
        param: 0.18,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.LUZ_CHAO,
        x,
        z,
        raio: 2.2 * s,
        vida: 0.35,
        cor: '#ffe2a0',
        brilho: 1.3,
      });
      break;
    }
    case 'vento': {
      const n = c.q(7);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = 0.2 * s;
        const w = (k % 2 ? 1 : -1) * sortear(7, 10);
        p.emitir({
          x: x + Math.cos(a) * r0,
          y: y + sinal() * 0.3,
          z: z + Math.sin(a) * r0,
          orbX: x,
          orbZ: z,
          orbW: w,
          orbVr: 2.6 * s,
          vy: sortear(0.2, 1.2),
          vida: sortear(0.35, 0.5),
          tam: sortear(0.7, 1.1) * s,
          tamFim: 1.4 * s,
          rot: a,
          giro: w,
          cor: '#f6fffb',
          alfa: 0.8,
          aditivo: 0.5,
          quadro: Q.VENTO,
          entrada: 0.1,
        });
      }
      jorro(
        c,
        4,
        x,
        y,
        z,
        1.5,
        3.5,
        0.9,
        {
          vida: 1.1,
          tam: 0.18 * s,
          cor: '#8fd96a',
          corFim: '#5fae4a',
          aditivo: 0,
          quadro: Q.FOLHA,
          gravidade: 3,
          arrasto: 1.4,
        },
        (o) => {
          o.giro = sinal() * 9;
        }
      );
      jorro(c, 3, x, 0.2, z, 0.8, 2, 0.15, {
        vida: 0.7,
        tam: 0.4 * s,
        tamFim: 1.1 * s,
        cor: '#e8ddc8',
        alfa: 0.4,
        aditivo: 0,
        quadro: Q.POEIRA,
        arrasto: 2.5,
        entrada: 0.2,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.VORTICE,
        x,
        z,
        raio: 1.6 * s,
        vida: 0.45,
        cor: '#f6fffb',
        cor2: '#b8ffe0',
        alfa: 0.7,
        aditivo: 0.5,
        giro: -6,
      });
      break;
    }
    case 'terra': {
      jorro(
        c,
        5,
        x,
        0.2,
        z,
        0.8,
        2.2,
        0.35,
        {
          vida: 1.1,
          tam: 0.5 * s,
          tamFim: 1.7 * s,
          cor: '#cdb38a',
          corFim: '#b89c74',
          alfa: 0.7,
          aditivo: 0,
          quadro: Q.POEIRA,
          arrasto: 2.2,
          entrada: 0.15,
          vy: 0.5,
        },
        (o) => {
          o.quadro = escolher([Q.POEIRA, Q.FUMACA_A]);
          o.giro = sinal() * 0.6;
        }
      );
      jorro(
        c,
        8,
        x,
        y,
        z,
        3,
        6.5,
        0.95,
        {
          vida: 1.1,
          tam: 0.26 * s,
          cor: '#9a7048',
          aditivo: 0,
          quadro: Q.ROCHA_A,
          gravidade: 18,
          quique: 0.38,
          curva: 0.25,
        },
        (o) => {
          o.quadro = escolher([Q.ROCHA_A, Q.ROCHA_B]);
          o.giro = sinal() * 10;
          o.tam = sortear(0.14, 0.34) * s;
          o.cor = escolher(['#9a7048', '#7d5a3a', '#b08a5a']);
        }
      );
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL,
        x,
        z,
        raio: 0.4 * s,
        raioFim: 1.9 * s,
        vida: 0.4,
        cor: '#e6d2a8',
        cor2: '#a88a60',
        alfa: 0.75,
        aditivo: 0,
        param: 0.4,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 1.3 * s,
        vida: 2.6,
        cor: '#3a2a1a',
        param: D.RACHADURA,
        alfa: 0.8,
        aditivo: 0,
        camada: 0,
        curva: 0.5,
      });
      c.tremer(0.12 * s);
      break;
    }
    case 'veneno': {
      clarao(c, x, y, z, 1.2 * s, '#c8ff7a', 1.6);
      jorro(c, 3, x, y, z, 0.2, 0.7, 0.6, {
        vida: 1.2,
        tam: 0.5 * s,
        tamFim: 1.5 * s,
        cor: '#8cff3c',
        corFim: '#4f9a2a',
        alfa: 0.35,
        aditivo: 0.15,
        quadro: Q.FUMACA_B,
        arrasto: 1.5,
        vy: 0.5,
        entrada: 0.25,
        giro: 0.5,
      });
      jorro(c, 10, x, y, z, 2, 5, 0.85, {
        vida: 0.8,
        tam: 0.15 * s,
        cor: '#d6ff8a',
        corFim: '#4fc81e',
        brilho: 1.15,
        aditivo: 0.3,
        quadro: Q.GOTA,
        modo: MODO.ESTICADO,
        estica: -0.07,
        gravidade: 13,
      });
      jorro(c, 7, x, y, z, 0.3, 1.2, 1, {
        vida: 0.9,
        tam: 0.14 * s,
        tamFim: 0.26 * s,
        cor: '#e0ff9a',
        aditivo: 0.55,
        quadro: Q.BOLHA,
        vy: 0.9,
        arrasto: 1.5,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 1.1 * s,
        vida: 2.6,
        cor: '#5fd82a',
        param: D.VENENO,
        alfa: 0.8,
        aditivo: 0.15,
        camada: 0,
        curva: 0.6,
        entrada: 0.08,
      });
      break;
    }
    case 'arcano': {
      clarao(c, x, y, z, 1.4 * s, '#e2c9ff', 2);
      p.emitir({
        x,
        y,
        z,
        vida: 0.45,
        tam: 0.6 * s,
        tamFim: 1.9 * s,
        cor: '#f0dcff',
        corFim: '#9b5cff',
        brilho: 2.1,
        quadro: escolher([Q.RUNA_A, Q.RUNA_B, Q.RUNA_C]),
        rot: Math.random() * 6,
        giro: 3.5,
        entrada: 0,
        curva: 1.5,
      });
      const n = c.q(10);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        p.emitir({
          x: x + Math.cos(a) * 0.15,
          y: y + sinal() * 0.2,
          z: z + Math.sin(a) * 0.15,
          orbX: x,
          orbZ: z,
          orbW: sinal() > 0 ? 6 : -6,
          orbVr: sortear(1.2, 2.4) * s,
          vy: sortear(0.3, 1.2),
          vida: sortear(0.45, 0.7),
          tam: 0.12 * s,
          cor: '#f0dcff',
          corFim: '#7a3cff',
          brilho: 2.4,
          quadro: Q.BRASA,
        });
      }
      jorro(
        c,
        3,
        x,
        y,
        z,
        1,
        2.5,
        0.6,
        {
          vida: 0.5,
          tam: 0.25 * s,
          cor: '#c58bff',
          brilho: 1.8,
          quadro: Q.HEX,
          arrasto: 3,
          curva: 1.2,
        },
        (o) => {
          o.giro = sinal() * 6;
        }
      );
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_RUNICO,
        x,
        z,
        raio: 0.5 * s,
        raioFim: 1.6 * s,
        vida: 0.45,
        cor: '#e2c9ff',
        cor2: '#7a3cff',
        brilho: 1.6,
        param: 0.3,
        giro: 3,
      });
      break;
    }
    case 'gravidade': {
      const n = c.q(16);
      for (let k = 0; k < n; k++) {
        const a = Math.random() * Math.PI * 2;
        const r = sortear(1.2, 2) * s;
        const vida = sortear(0.3, 0.45);
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        const py = sortear(0.1, 1.4);
        p.emitir({
          x: px,
          y: py,
          z: pz,
          vx: (x - px) / vida,
          vy: (y - py) / vida,
          vz: (z - pz) / vida,
          vida,
          tam: 0.07 * s,
          cor: '#e2d8ff',
          corFim: '#8a6bff',
          brilho: 2.3,
          quadro: Q.RISCO,
          modo: MODO.ESTICADO,
          estica: 0.05,
          entrada: 0.2,
        });
      }
      p.emitir({
        x,
        y,
        z,
        vida: 0.4,
        tam: 1.3 * s,
        tamFim: 0.15 * s,
        cor: '#0a0418',
        alfa: 0.9,
        aditivo: 0,
        quadro: Q.BRILHO,
        entrada: 0.1,
        curva: 0.4,
      });
      p.emitir({
        x,
        y,
        z,
        vida: 0.4,
        tam: 1.6 * s,
        tamFim: 0.2 * s,
        cor: '#8a6bff',
        brilho: 1.8,
        quadro: Q.ANEL,
        entrada: 0.1,
        curva: 0.6,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_SOMBRA,
        x,
        z,
        raio: 2 * s,
        raioFim: 0.2 * s,
        vida: 0.45,
        cor: '#8a6bff',
        param: 0.35,
        alfa: 0.9,
        expansao: 1.6,
      });
      c.agendar(0.4, (t) => {
        if (t >= 1) {
          clarao(c, x, y, z, 1.2 * s, '#e2d8ff', 2.4);
          jorro(c, 8, x, y, z, 3, 6, 0.4, {
            vida: 0.25,
            tam: 0.06 * s,
            cor: '#ffffff',
            corFim: '#8a6bff',
            brilho: 2.6,
            quadro: Q.RISCO,
            modo: MODO.ESTICADO,
            estica: 0.04,
            arrasto: 3,
          });
        }
      });
      break;
    }
    case 'som': {
      clarao(c, x, y, z, 1 * s, '#fff0fa', 1.8);
      for (let k = 0; k < 3; k++)
        p.emitir({
          x,
          y,
          z,
          vida: 0.32 + k * 0.08,
          tam: 0.3 * s,
          tamFim: (1.6 + k * 0.5) * s,
          cor: '#ffc0e8',
          corFim: '#ff5cb8',
          brilho: 1.6,
          aditivo: 0.85,
          quadro: Q.ANEL,
          entrada: 0,
          curva: 1.2,
        });
      jorro(
        c,
        3,
        x,
        y,
        z,
        0.6,
        1.4,
        1,
        {
          vida: 1,
          tam: 0.32 * s,
          cor: '#ff8fd0',
          brilho: 1.4,
          aditivo: 0.6,
          quadro: Q.NOTA,
          vy: 1.2,
          arrasto: 1.2,
        },
        (o) => {
          o.rot = sinal() * 0.4;
          o.giro = sinal();
        }
      );
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_SOM,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 2 * s,
        vida: 0.45,
        cor: '#ffc0e8',
        cor2: '#ff5cb8',
        brilho: 1.4,
        param: 0.6,
      });
      break;
    }
    case 'agua': {
      jorro(
        c,
        14,
        x,
        y,
        z,
        2.5,
        6,
        0.9,
        {
          vida: 0.75,
          tam: 0.15 * s,
          cor: '#e2f5ff',
          corFim: '#3fa8ff',
          brilho: 1.2,
          aditivo: 0.35,
          quadro: Q.GOTA,
          modo: MODO.ESTICADO,
          estica: -0.06,
          gravidade: 15,
        },
        (o) => {
          o.tam = sortear(0.08, 0.2) * s;
        }
      );
      jorro(c, 3, x, y, z, 0.3, 1, 0.5, {
        vida: 0.7,
        tam: 0.5 * s,
        tamFim: 1.3 * s,
        cor: '#e2f5ff',
        alfa: 0.4,
        aditivo: 0.3,
        quadro: Q.FUMACA_B,
        arrasto: 2,
        entrada: 0.2,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_AGUA,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.8 * s,
        vida: 0.5,
        cor: '#3fa8ff',
        cor2: '#e2f5ff',
        param: 0.45,
        aditivo: 0.6,
      });
      c.planos.criar({
        estilo: ESTILO_PLANO.DECAL,
        x,
        z,
        raio: 1.2 * s,
        vida: 1.8,
        cor: '#2a6fb0',
        param: D.MOLHADO,
        alfa: 0.55,
        aditivo: 0,
        camada: 0,
        curva: 0.7,
      });
      break;
    }
    case 'codigo': {
      clarao(c, x, y, z, 1.1 * s, '#b8ffd0', 1.6);
      jorro(
        c,
        10,
        x,
        y,
        z,
        1.2,
        3,
        1,
        {
          vida: 0.8,
          tam: 0.42 * s,
          tamFim: 0.3 * s,
          cor: '#c8ffd8',
          corFim: '#18c860',
          brilho: 1.3,
          aditivo: 0.35,
          quadro: Q.ZERO,
          vy: 1.2,
          arrasto: 2.5,
          entrada: 0,
          rot: 0,
        },
        (o) => {
          o.quadro = Math.random() < 0.5 ? Q.ZERO : Q.UM;
        }
      );
      jorro(
        c,
        12,
        x,
        y,
        z,
        2,
        5,
        0.8,
        {
          vida: 0.7,
          tam: 0.11 * s,
          cor: '#39ff88',
          aditivo: 0.15,
          quadro: Q.PIXEL,
          gravidade: 12,
          quique: 0.35,
          curva: 0.4,
        },
        (o) => {
          o.tam = sortear(0.07, 0.15) * s;
          o.cor = Math.random() < 0.7 ? '#39ff88' : '#b8ffd0';
        }
      );
      glitchFatia(c, x, y, z, s);
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL_DIGITAL,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.5 * s,
        vida: 0.35,
        cor: '#39ff88',
        cor2: '#0a8a3a',
        brilho: 1.2,
        param: 0.4,
        aditivo: 0.5,
      });
      break;
    }
    case 'cristal': {
      clarao(c, x, y, z, 1.5 * s, '#ffffff', 2.2);
      jorro(
        c,
        10,
        x,
        y,
        z,
        2.5,
        6.5,
        0.8,
        {
          vida: 0.8,
          tam: 0.24 * s,
          cor: '#ffffff',
          brilho: 1.3,
          aditivo: 0.35,
          quadro: Q.LASCA,
          gravidade: 12,
          quique: 0.35,
          curva: 0.4,
        },
        (o) => {
          o.quadro = escolher([Q.LASCA, Q.CRISTAL, Q.ESTILHACO]);
          o.cor = escolher(PRISMA);
          o.giro = sinal() * 14;
          o.tam = sortear(0.14, 0.32) * s;
        }
      );
      const n = c.q(6);
      for (let k = 0; k < n; k++)
        p.emitir({
          x: x + sinal() * 0.9 * s,
          y: y + sortear(-0.3, 0.6),
          z: z + sinal() * 0.9 * s,
          vida: sortear(0.25, 0.5),
          tam: sortear(0.3, 0.55) * s,
          cor: escolher(PRISMA),
          brilho: 2.6,
          quadro: Q.ESTRELA,
          rot: Math.random(),
          giro: 3,
          entrada: 0.3,
        });
      c.planos.criar({
        estilo: ESTILO_PLANO.ANEL,
        x,
        z,
        raio: 0.3 * s,
        raioFim: 1.4 * s,
        vida: 0.3,
        cor: '#ffd6f5',
        cor2: '#9fd0ff',
        brilho: 1.1,
        param: 0.14,
        aditivo: 0.7,
      });
      break;
    }
  }
}

// ------------------------------------------------------------------ explosões

const DECAL_EXPLOSAO: Partial<
  Record<ElementoFx, { q: number; cor: string; aditivo: number; alfa: number }>
> = {
  fogo: { q: D.CRATERA, cor: '#2a1a12', aditivo: 0, alfa: 0.85 },
  gelo: { q: D.GEADA, cor: '#e8fbff', aditivo: 0.25, alfa: 0.8 },
  raio: { q: D.QUEIMADO, cor: '#1c1830', aditivo: 0, alfa: 0.6 },
  luz: { q: D.SELO, cor: '#ffe2a0', aditivo: 1, alfa: 0.7 },
  terra: { q: D.CRATERA, cor: '#5a4026', aditivo: 0, alfa: 0.85 },
  veneno: { q: D.VENENO, cor: '#5fd82a', aditivo: 0.15, alfa: 0.85 },
  arcano: { q: D.CIRCULO, cor: '#c58bff', aditivo: 1, alfa: 0.7 },
  gravidade: { q: D.CIRCULO, cor: '#2a1450', aditivo: 0, alfa: 0.7 },
  agua: { q: D.MOLHADO, cor: '#2a6fb0', aditivo: 0, alfa: 0.6 },
  cristal: { q: D.GEADA, cor: '#ffd6f5', aditivo: 0.4, alfa: 0.6 },
  codigo: { q: D.CIRCULO, cor: '#39ff88', aditivo: 0.8, alfa: 0.6 },
};

/** Explosão grande de área. Fogo vira impacto de meteoro completo. */
export function explosao(c: Ctx, e: ElementoFx, x: number, z: number, raio: number): void {
  const s = raio / 1.6;
  const y = 0.5;
  if (e === 'fogo') {
    meteoroImpacto(c, x, z, raio);
    return;
  }
  impacto(c, e, x, y, z, s * 1.3);
  const pal = PALETAS[e];
  nova(c, e, x, z, raio * 1.15, 0.5, 0, 10);
  const d = DECAL_EXPLOSAO[e];
  if (d)
    c.planos.criar({
      estilo: ESTILO_PLANO.DECAL,
      x,
      z,
      raio: raio * 1.05,
      vida: 3.2,
      cor: d.cor,
      param: d.q,
      alfa: d.alfa,
      aditivo: d.aditivo,
      camada: 0,
      curva: 0.6,
      entrada: 0.05,
      giro: d.aditivo > 0.5 ? 0.6 : 0,
    });
  c.planos.criar({
    estilo: ESTILO_PLANO.LUZ_CHAO,
    x,
    z,
    raio: raio * 1.6,
    vida: 0.5,
    cor: pal.base,
    brilho: 1.3,
    curva: 1.5,
  });
  c.tremer(0.25 + raio * 0.05);
  c.pulso(pal.claro, 0.3);
}

/** Impacto completo de meteoro: clarão, bola de fogo, onda, destroços, cratera e coluna de fumaça. */
export function meteoroImpacto(c: Ctx, x: number, z: number, raio: number): void {
  const p = c.p;
  const s = raio / 1.6;
  p.emitir({
    x,
    y: 0.8,
    z,
    vida: 0.14,
    tam: 2 * s,
    tamFim: 3.6 * s,
    cor: '#fff0c0',
    brilho: 1.8,
    quadro: Q.BRILHO,
    entrada: 0,
    curva: 2,
  });
  // fumaça primeiro (fica por baixo)
  jorro(
    c,
    7,
    x,
    0.6,
    z,
    1.5,
    3.5,
    0.5,
    {
      vida: 1.8,
      tam: 0.9 * s,
      tamFim: 2.6 * s,
      cor: '#4a3a34',
      corFim: '#2a2422',
      alfa: 0.6,
      aditivo: 0,
      quadro: Q.FUMACA_A,
      arrasto: 2.2,
      vy: 1.2,
      entrada: 0.2,
      giro: 0.5,
    },
    (o) => {
      o.quadro = escolher([Q.FUMACA_A, Q.FUMACA_B]);
    }
  );
  // bola de fogo
  jorro(
    c,
    18,
    x,
    0.6,
    z,
    2,
    6,
    0.6,
    {
      vida: 0.65,
      tam: 0.8 * s,
      tamFim: 1.9 * s,
      cor: '#ffc850',
      corFim: '#b8220a',
      brilho: 1.5,
      quadro: Q.CHAMA_A,
      aditivo: 0.55,
      arrasto: 5,
      gravidade: -3,
      curva: 1.1,
    },
    (o) => {
      o.quadro = escolher([Q.CHAMA_A, Q.CHAMA_B, Q.CHAMA_C]);
      o.giro = sinal() * 2.5;
    }
  );
  // destroços com brasas
  jorro(
    c,
    10,
    x,
    0.4,
    z,
    5,
    10,
    0.9,
    {
      vida: 1.2,
      tam: 0.3 * s,
      cor: '#3a2a22',
      aditivo: 0,
      quadro: Q.ROCHA_A,
      gravidade: 20,
      quique: 0.3,
      curva: 0.25,
    },
    (o) => {
      o.quadro = escolher([Q.ROCHA_A, Q.ROCHA_B]);
      o.giro = sinal() * 10;
      o.tam = sortear(0.18, 0.4) * s;
    }
  );
  jorro(c, 26, x, 0.5, z, 5, 13, 0.85, {
    vida: 1,
    tam: 0.1 * s,
    cor: '#ffe7a0',
    corFim: '#ff4a12',
    brilho: 2.8,
    quadro: Q.BRASA,
    modo: MODO.ESTICADO,
    estica: 0.04,
    gravidade: 9,
    arrasto: 1,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL_FOGO,
    x,
    z,
    raio: 0.5 * s,
    raioFim: raio * 1.35,
    vida: 0.55,
    cor: '#ffb347',
    cor2: '#e8380c',
    brilho: 1.5,
    param: 0.45,
    aditivo: 1,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL,
    x,
    z,
    raio: 0.6 * s,
    raioFim: raio * 1.9,
    vida: 0.7,
    cor: '#e8d8c0',
    cor2: '#a89070',
    alfa: 0.55,
    aditivo: 0,
    param: 0.3,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.DECAL,
    x,
    z,
    raio: raio * 1.1,
    vida: 4.5,
    cor: '#2a1a12',
    param: D.CRATERA,
    alfa: 0.9,
    aditivo: 0,
    camada: 0,
    curva: 0.5,
    entrada: 0.02,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.DECAL,
    x,
    z,
    raio: raio * 0.8,
    vida: 2.2,
    cor: '#ff5a1a',
    param: D.QUEIMADO,
    alfa: 0.8,
    brilho: 1.6,
    aditivo: 1,
    camada: 0,
    curva: 1.6,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.LUZ_CHAO,
    x,
    z,
    raio: raio * 2.4,
    vida: 0.8,
    cor: '#ff7a2e',
    brilho: 1.5,
    curva: 1.4,
  });
  // coluna de fumaça e brasas que ficam subindo
  c.agendar(1.1, (t, dt) => {
    const n = c.q(dt * 22 * (1 - t));
    for (let k = 0; k < n; k++)
      p.emitir({
        x: x + sinal() * 0.5 * s,
        y: 0.5,
        z: z + sinal() * 0.5 * s,
        vx: sinal() * 0.4,
        vy: sortear(1.8, 3),
        vz: sinal() * 0.4,
        vida: 1.6,
        tam: 0.6 * s,
        tamFim: 2 * s,
        cor: '#3a302c',
        corFim: '#5a524e',
        alfa: 0.5,
        aditivo: 0,
        quadro: Q.FUMACA_A,
        giro: sinal() * 0.5,
        arrasto: 0.8,
        entrada: 0.2,
      });
    if (Math.random() < dt * 30)
      p.emitir({
        x: x + sinal() * raio * 0.6,
        y: 0.2,
        z: z + sinal() * raio * 0.6,
        vy: sortear(1, 2.5),
        vx: sinal() * 0.3,
        vz: sinal() * 0.3,
        vida: 0.9,
        tam: 0.09,
        cor: '#ffd27a',
        corFim: '#ff3a0a',
        brilho: 2.5,
        quadro: Q.BRASA,
      });
  });
  c.tremer(0.45 + raio * 0.06);
  c.pulso('#ffd27a', 0.45);
}

// ------------------------------------------------------------------ novas

interface ConfigNova {
  estilo: number;
  cor: string;
  cor2: string;
  brilho: number;
  param: number;
  aditivo: number;
  alfa?: number;
  /** Partículas por segundo ao longo da frente. */
  taxa: number;
  frente: (c: Ctx, x: number, y: number, z: number, nx: number, nz: number) => void;
}

const NOVAS: Record<ElementoFx, ConfigNova> = {
  gelo: {
    estilo: ESTILO_PLANO.ANEL_GELO,
    cor: '#ffffff',
    cor2: '#7fd8ff',
    brilho: 1.25,
    param: 0.3,
    aditivo: 0.75,
    taxa: 70,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: 0.15,
        z,
        vx: nx * 2,
        vy: sortear(2, 4.5),
        vz: nz * 2,
        vida: 0.6,
        tam: sortear(0.18, 0.32),
        cor: '#ffffff',
        corFim: '#9fe6ff',
        brilho: 1.25,
        aditivo: 0.3,
        quadro: Q.ESTILHACO,
        rot: Math.random() * 6,
        giro: sinal() * 10,
        gravidade: 12,
        quique: 0.3,
        curva: 0.5,
      });
      if (Math.random() < 0.4)
        c.p.emitir({
          x,
          y: 0.3,
          z,
          vx: nx,
          vz: nz,
          vy: 0.3,
          vida: 0.8,
          tam: 0.5,
          tamFim: 1.2,
          cor: '#e8fbff',
          alfa: 0.35,
          aditivo: 0.3,
          quadro: Q.FUMACA_B,
          arrasto: 2,
          entrada: 0.2,
        });
    },
  },
  fogo: {
    estilo: ESTILO_PLANO.ANEL_FOGO,
    cor: '#ffb347',
    cor2: '#e8380c',
    brilho: 1.4,
    param: 0.35,
    aditivo: 1,
    taxa: 60,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: 0.3,
        z,
        vx: nx * 1.5,
        vy: sortear(1.5, 3),
        vz: nz * 1.5,
        vida: 0.45,
        tam: 0.5,
        tamFim: 1,
        cor: '#ffe08a',
        corFim: '#e8380c',
        brilho: 1.8,
        aditivo: 0.85,
        quadro: escolher([Q.CHAMA_A, Q.CHAMA_B, Q.CHAMA_C]),
        giro: sinal() * 2,
        arrasto: 3,
      });
    },
  },
  raio: {
    estilo: ESTILO_PLANO.ANEL_RAIO,
    cor: '#ffe45c',
    cor2: '#ffffff',
    brilho: 1.6,
    param: 0.2,
    aditivo: 1,
    taxa: 50,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.3,
        z,
        vx: sinal() * 5,
        vy: sortear(1, 4),
        vz: sinal() * 5,
        vida: 0.15,
        tam: 0.06,
        cor: '#ffffff',
        corFim: '#ffe45c',
        brilho: 3,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.03,
        arrasto: 4,
      });
    },
  },
  luz: {
    estilo: ESTILO_PLANO.ANEL,
    cor: '#fff8e0',
    cor2: '#ffd27a',
    brilho: 1.6,
    param: 0.22,
    aditivo: 1,
    taxa: 40,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.2,
        z,
        vy: sortear(1, 2.5),
        vida: 0.7,
        tam: 0.1,
        cor: '#fff3c4',
        corFim: '#ffb347',
        brilho: 2.4,
        quadro: Q.BRASA,
        arrasto: 1,
      });
    },
  },
  vento: {
    estilo: ESTILO_PLANO.ANEL,
    cor: '#f6fffb',
    cor2: '#b8ffe0',
    brilho: 1.1,
    param: 0.3,
    aditivo: 0.5,
    alfa: 0.8,
    taxa: 30,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: sortear(0.2, 1),
        z,
        vx: nx * 3,
        vz: nz * 3,
        vida: 0.35,
        tam: 0.9,
        rot: Math.atan2(nz, nx),
        giro: 8,
        cor: '#f6fffb',
        alfa: 0.7,
        aditivo: 0.5,
        quadro: Q.VENTO,
      });
    },
  },
  terra: {
    estilo: ESTILO_PLANO.ANEL,
    cor: '#e6d2a8',
    cor2: '#a88a60',
    brilho: 1,
    param: 0.4,
    aditivo: 0,
    alfa: 0.75,
    taxa: 40,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: 0.2,
        z,
        vx: nx,
        vy: 0.4,
        vz: nz,
        vida: 0.9,
        tam: 0.5,
        tamFim: 1.3,
        cor: '#cdb38a',
        alfa: 0.6,
        aditivo: 0,
        quadro: Q.POEIRA,
        arrasto: 2,
        entrada: 0.15,
      });
      if (Math.random() < 0.4)
        c.p.emitir({
          x,
          y: 0.2,
          z,
          vx: nx * 2,
          vy: sortear(3, 5),
          vz: nz * 2,
          vida: 0.8,
          tam: sortear(0.12, 0.25),
          cor: '#8a6a48',
          aditivo: 0,
          quadro: Q.ROCHA_A,
          giro: sinal() * 8,
          gravidade: 16,
          quique: 0.3,
          curva: 0.3,
        });
    },
  },
  veneno: {
    estilo: ESTILO_PLANO.ANEL,
    cor: '#c8ff7a',
    cor2: '#3fbf1f',
    brilho: 1.2,
    param: 0.4,
    aditivo: 0.4,
    taxa: 40,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.2,
        z,
        vy: sortear(0.5, 1.2),
        vida: 0.7,
        tam: 0.14,
        tamFim: 0.24,
        cor: '#e0ff9a',
        aditivo: 0.5,
        quadro: Q.BOLHA,
      });
    },
  },
  arcano: {
    estilo: ESTILO_PLANO.ANEL_RUNICO,
    cor: '#f0dcff',
    cor2: '#7a3cff',
    brilho: 1.7,
    param: 0.22,
    aditivo: 1,
    taxa: 35,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.3,
        z,
        vy: sortear(0.5, 1.5),
        vida: 0.6,
        tam: 0.11,
        cor: '#f0dcff',
        corFim: '#7a3cff',
        brilho: 2.4,
        quadro: Q.BRASA,
      });
    },
  },
  gravidade: {
    estilo: ESTILO_PLANO.ANEL_SOMBRA,
    cor: '#8a6bff',
    cor2: '#12082a',
    brilho: 1,
    param: 0.35,
    aditivo: 1,
    taxa: 30,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: 0.4,
        z,
        vx: -nx * 4,
        vz: -nz * 4,
        vida: 0.3,
        tam: 0.07,
        cor: '#e2d8ff',
        brilho: 2.2,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.05,
      });
    },
  },
  som: {
    estilo: ESTILO_PLANO.ANEL_SOM,
    cor: '#ffc0e8',
    cor2: '#ff5cb8',
    brilho: 1.5,
    param: 0.5,
    aditivo: 0.9,
    taxa: 8,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.4,
        z,
        vy: 1.3,
        vx: sinal() * 0.5,
        vz: sinal() * 0.5,
        vida: 0.9,
        tam: 0.3,
        cor: '#ff8fd0',
        brilho: 1.3,
        aditivo: 0.6,
        quadro: Q.NOTA,
        giro: sinal(),
        arrasto: 1,
      });
    },
  },
  agua: {
    estilo: ESTILO_PLANO.ANEL_AGUA,
    cor: '#3fa8ff',
    cor2: '#e2f5ff',
    brilho: 1.1,
    param: 0.4,
    aditivo: 0.55,
    taxa: 70,
    frente: (c, x, y, z, nx, nz) => {
      c.p.emitir({
        x,
        y: 0.2,
        z,
        vx: nx * 2.5,
        vy: sortear(2.5, 5),
        vz: nz * 2.5,
        vida: 0.6,
        tam: sortear(0.1, 0.18),
        cor: '#e2f5ff',
        corFim: '#5cb8ff',
        brilho: 1.2,
        aditivo: 0.35,
        quadro: Q.GOTA,
        modo: MODO.ESTICADO,
        estica: -0.06,
        gravidade: 14,
      });
    },
  },
  codigo: {
    estilo: ESTILO_PLANO.ANEL_DIGITAL,
    cor: '#39ff88',
    cor2: '#0a8a3a',
    brilho: 1.3,
    param: 0.35,
    aditivo: 0.6,
    taxa: 30,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: 0.3,
        z,
        vy: sortear(0.8, 1.8),
        vida: 0.7,
        tam: 0.26,
        cor: '#e8fff0',
        corFim: '#18c860',
        brilho: 1.3,
        aditivo: 0.55,
        quadro: Math.random() < 0.5 ? Q.ZERO : Q.UM,
        arrasto: 1,
      });
    },
  },
  cristal: {
    estilo: ESTILO_PLANO.ANEL_GELO,
    cor: '#ffffff',
    cor2: '#ffd6f5',
    brilho: 1.3,
    param: 0.25,
    aditivo: 0.9,
    taxa: 30,
    frente: (c, x, y, z) => {
      c.p.emitir({
        x,
        y: sortear(0.2, 0.8),
        z,
        vida: 0.35,
        tam: 0.35,
        cor: escolher(PRISMA),
        brilho: 2.4,
        quadro: Q.ESTRELA,
        rot: Math.random(),
        giro: 3,
        entrada: 0.3,
      });
    },
  },
};

/**
 * Nova: onda que se expande do centro até raioMax em `duracao` segundos, com
 * partículas nascendo na frente. `direcao`/`abertura` (rad) fazem um cone.
 */
export function nova(
  c: Ctx,
  e: ElementoFx,
  x: number,
  z: number,
  raioMax: number,
  duracao: number,
  direcao = 0,
  abertura = 10
): void {
  const cfg = NOVAS[e];
  c.planos.criar({
    estilo: cfg.estilo,
    x,
    z,
    raio: 0.4,
    raioFim: raioMax,
    vida: duracao,
    cor: cfg.cor,
    cor2: cfg.cor2,
    brilho: cfg.brilho,
    param: cfg.param,
    aditivo: cfg.aditivo,
    alfa: cfg.alfa ?? 1,
    direcao,
    abertura,
    expansao: 1.6,
    curva: 1.1,
    giro: 1.5,
  });
  if (e === 'gelo' || e === 'cristal')
    c.planos.criar({
      estilo: ESTILO_PLANO.DECAL,
      x,
      z,
      raio: raioMax * 0.95,
      vida: duracao + 1.4,
      cor: e === 'gelo' ? '#e8fbff' : '#ffe6fa',
      param: D.GEADA,
      alfa: 0.5,
      aditivo: 0.3,
      camada: 0,
      entrada: 0.25,
      curva: 1,
    });
  if (e === 'som' || e === 'agua') {
    // segunda onda logo atrás
    c.agendar(duracao * 0.18, (t) => {
      if (t >= 1)
        c.planos.criar({
          estilo: cfg.estilo,
          x,
          z,
          raio: 0.3,
          raioFim: raioMax * 0.85,
          vida: duracao * 0.9,
          cor: cfg.cor,
          cor2: cfg.cor2,
          brilho: cfg.brilho * 0.8,
          param: cfg.param,
          aditivo: cfg.aditivo,
          alfa: 0.7,
          direcao,
          abertura,
          expansao: 1.6,
        });
    });
  }
  let acc = 0;
  c.agendar(duracao * 0.85, (t, dt) => {
    const e2 = 1 - Math.pow(1 - Math.min(1, t / 0.85), 1.6);
    const r = 0.4 + (raioMax - 0.4) * e2;
    const setor = Math.min(Math.PI, abertura);
    acc += c.q(cfg.taxa * dt * (0.5 + r / 6) * (setor / Math.PI));
    while (acc >= 1) {
      acc--;
      const a = direcao + sinal() * setor;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      cfg.frente(c, x + nx * r * 0.95, 0, z + nz * r * 0.95, nx, nz);
    }
  });
}

// ------------------------------------------------------------------ poças

export const CORES_POCA: Record<ElementoFx, [string, string]> = {
  veneno: ['#3fbf1f', '#d6ff8a'],
  fogo: ['#e8380c', '#ffd36b'],
  agua: ['#2a7fd8', '#bfe6ff'],
  gelo: ['#8fdcff', '#ffffff'],
  arcano: ['#6a2cd8', '#e2c9ff'],
  gravidade: ['#1a0a3a', '#8a6bff'],
  raio: ['#3a3aa0', '#ffe45c'],
  luz: ['#ffb347', '#fff8e0'],
  vento: ['#7fd8b8', '#ffffff'],
  terra: ['#5a4026', '#c99a5b'],
  som: ['#b03c8c', '#ffc0e8'],
  cristal: ['#7fb8e0', '#ffffff'],
  codigo: ['#0a6a30', '#39ff88'],
};

/** Partículas de uma poça viva (bolhas, vapores, brasas). n = quantas neste quadro. */
export function particulasPoca(
  c: Ctx,
  e: ElementoFx,
  x: number,
  z: number,
  raio: number,
  n: number
): void {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * raio * 0.75;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (e === 'fogo') {
      c.p.emitir({
        x: px,
        y: 0.1,
        z: pz,
        vy: sortear(0.8, 1.8),
        vida: 0.6,
        tam: 0.35,
        tamFim: 0.1,
        cor: '#ffe08a',
        corFim: '#ff3a0a',
        brilho: 1.8,
        aditivo: 0.85,
        quadro: Q.CHAMA_C,
        arrasto: 1,
      });
    } else if (e === 'veneno') {
      if (Math.random() < 0.6)
        c.p.emitir({
          x: px,
          y: 0.08,
          z: pz,
          vy: sortear(0.1, 0.4),
          vida: sortear(0.5, 0.9),
          tam: sortear(0.08, 0.16),
          tamFim: 0.26,
          cor: '#e0ff9a',
          aditivo: 0.5,
          quadro: Q.BOLHA,
        });
      else
        c.p.emitir({
          x: px,
          y: 0.15,
          z: pz,
          vy: sortear(0.4, 0.9),
          vida: 1.4,
          tam: 0.4,
          tamFim: 1.1,
          cor: '#8cff3c',
          corFim: '#4f9a2a',
          alfa: 0.22,
          aditivo: 0.2,
          quadro: Q.FUMACA_B,
          giro: sinal() * 0.5,
          entrada: 0.3,
        });
    } else {
      const [, claro] = CORES_POCA[e];
      c.p.emitir({
        x: px,
        y: 0.08,
        z: pz,
        vy: sortear(0.3, 0.8),
        vida: 0.7,
        tam: 0.12,
        tamFim: 0.2,
        cor: claro,
        brilho: 1.4,
        aditivo: 0.6,
        quadro: Q.BOLHA,
      });
    }
  }
}
