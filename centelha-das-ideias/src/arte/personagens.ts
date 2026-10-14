/**
 * NPCs, inimigos e chefe (RESPONSÁVEL: agente de Arte de Personagens).
 * Versão provisória do orquestrador. Assinaturas são contrato.
 */
import type { VisualChefe, VisualInimigo, VisualNpc } from '../contratos/arte';
import { PALETA } from './paleta';

/** Desenha um NPC com os pés em (x, ySolo - z). */
export function desenharNpc(ctx: CanvasRenderingContext2D, v: VisualNpc): void {
  const pe = v.ySolo - v.z;
  ctx.fillStyle = v.especie === 'tartaruga' ? PALETA.gramaEscura : PALETA.luz;
  ctx.beginPath();
  ctx.ellipse(v.x, pe - 9, 10, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETA.olho;
  ctx.fillRect(v.x - 4, pe - 12, 2, 3);
  ctx.fillRect(v.x + 2, pe - 12, 2, 3);
}

/** Desenha um inimigo (inclui telegrafia do próprio corpo; áreas no chão são do combate). */
export function desenharInimigo(ctx: CanvasRenderingContext2D, v: VisualInimigo): void {
  const pe = v.ySolo - v.z;
  ctx.fillStyle =
    v.flashDano > 0 ? '#ffffff' : v.estado === 'telegrafando' ? PALETA.perigo : PALETA.ruido;
  ctx.beginPath();
  ctx.arc(v.x, pe - 8, v.especie === 'casco' ? 12 : 8, 0, Math.PI * 2);
  ctx.fill();
}

export function desenharChefe(ctx: CanvasRenderingContext2D, v: VisualChefe): void {
  const pe = v.ySolo - v.z;
  ctx.fillStyle = PALETA.ruidoEscuro;
  ctx.beginPath();
  ctx.arc(v.x, pe - 40, 36, 0, Math.PI * 2);
  ctx.fill();
}

/** Retrato do NPC para balões/menus (quadrado com canto em (x, y)). */
export function desenharRetratoNpc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tamanho: number,
  id: string,
  especie: string,
  tempo: number
): void {
  ctx.fillStyle = PALETA.creme;
  ctx.beginPath();
  ctx.arc(x + tamanho / 2, y + tamanho / 2, tamanho * 0.4, 0, Math.PI * 2);
  ctx.fill();
}
