import type { Direcao8, Vetor } from '../contratos/base';

export const TAU = Math.PI * 2;

export function limitar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function interpolar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolação exponencial independente de taxa de quadros. */
export function aproximar(atual: number, alvo: number, taxa: number, dt: number): number {
  return alvo + (atual - alvo) * Math.exp(-taxa * dt);
}

export function distancia(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function distancia2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function normalizar(v: Vetor): Vetor {
  const m = Math.hypot(v.x, v.y);
  return m > 1e-6 ? { x: v.x / m, y: v.y / m } : { x: 0, y: 0 };
}

/** Diferença angular em (-PI, PI]. */
export function diferencaAngulo(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** Ângulo (rad, 0 = leste, PI/2 = sul) para uma das oito direções. */
export function anguloParaDirecao(angulo: number): Direcao8 {
  const passo = Math.round(angulo / (Math.PI / 4));
  return (((passo % 8) + 8) % 8) as Direcao8;
}

export function direcaoParaAngulo(d: Direcao8): number {
  return d * (Math.PI / 4);
}

export const suavizar = {
  entrada: (t: number) => t * t,
  saida: (t: number) => 1 - (1 - t) * (1 - t),
  entradaSaida: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  elastico: (t: number) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  voltar: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
};

/** Hash determinístico 0..1 para inteiros (variações de cenário). */
export function hash2(x: number, y: number, canal = 0): number {
  let h = (x * 374761393 + y * 668265263 + canal * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

/** Gerador pseudoaleatório com semente (mulberry32). */
export function criarAleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function aleatorioEntre(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function escolher<T>(lista: readonly T[]): T {
  return lista[Math.floor(Math.random() * lista.length)] as T;
}
