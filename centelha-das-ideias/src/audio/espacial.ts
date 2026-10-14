/**
 * Som posicional (lógica pura): atenuação por distância, panorâmica estéreo e
 * abafamento de sons distantes. Distâncias em px do mundo.
 */

/** Até esta distância o som toca com volume cheio. */
export const DISTANCIA_PLENA = 80;
/** Escala da queda de volume após a distância plena. */
export const ESCALA_DISTANCIA = 150;
/** A partir daqui o som nem é tocado (economiza vozes). */
export const DISTANCIA_CORTE = 1000;
/** Distância horizontal que leva a panorâmica ao máximo. */
export const LARGURA_PANORAMA = 420;

/** Ganho por distância: 1 perto, ~0,08 (-22 dB) a 600 px, 0 além do corte. */
export function ganhoPorDistancia(d: number): number {
  if (!(d >= 0)) return 1;
  if (d >= DISTANCIA_CORTE) return 0;
  if (d <= DISTANCIA_PLENA) return 1;
  const k = (d - DISTANCIA_PLENA) / ESCALA_DISTANCIA;
  return 1 / (1 + k * k);
}

/** Panorâmica -0,85..0,85 a partir do deslocamento horizontal. */
export function panoramica(dx: number): number {
  if (!Number.isFinite(dx)) return 0;
  return Math.max(-1, Math.min(1, dx / LARGURA_PANORAMA)) * 0.85;
}

/** Frequência de corte do abafamento (null = sem filtro). */
export function corteAbafamento(d: number): number | null {
  if (!(d > 220)) return null;
  return Math.max(900, 20000 * Math.exp(-(d - 220) / 300));
}

export interface Espacializacao {
  ganho: number;
  pan: number;
  corte: number | null;
}

export function espacializar(
  x: number,
  y: number,
  ouvinteX: number,
  ouvinteY: number
): Espacializacao {
  const dx = x - ouvinteX;
  const dy = y - ouvinteY;
  const d = Math.hypot(dx, dy);
  return { ganho: ganhoPorDistancia(d), pan: panoramica(dx), corte: corteAbafamento(d) };
}
