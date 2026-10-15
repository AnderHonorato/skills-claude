export const TAU = Math.PI * 2;

export function limitar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function interpolar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Interpolação exponencial independente da taxa de quadros. */
export function aproximar(atual: number, alvo: number, taxa: number, dt: number): number {
  return alvo + (atual - alvo) * Math.exp(-taxa * dt);
}

/** Diferença angular em (-PI, PI]. */
export function diferencaAngulo(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

export function aproximarAngulo(atual: number, alvo: number, taxa: number, dt: number): number {
  return atual + diferencaAngulo(atual, alvo) * (1 - Math.exp(-taxa * dt));
}

export function distancia(ax: number, az: number, bx: number, bz: number): number {
  return Math.hypot(bx - ax, bz - az);
}

export const suavizar = {
  saidaCubica: (t: number) => 1 - Math.pow(1 - t, 3),
  entradaSaida: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  elastico: (t: number) =>
    t === 0 || t === 1
      ? t
      : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  voltar: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
};

export function aleatorioEntre(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function escolher<T>(lista: readonly T[]): T {
  return lista[Math.floor(Math.random() * lista.length)];
}
