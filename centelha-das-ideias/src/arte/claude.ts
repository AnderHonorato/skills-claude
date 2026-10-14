/**
 * Claude, o protagonista (RESPONSÁVEL: agente de Arte do Personagem).
 * Versão provisória do orquestrador para validar o motor. Assinaturas são contrato.
 */
import type { VisualClaude } from '../contratos/arte';
import type { Humor } from '../contratos/base';
import { PALETA } from './paleta';

/** Medidas de referência (px do mundo) — ver docs/arte.md. */
export const MEDIDAS_CLAUDE = {
  largura: 20,
  alturaFrente: 13,
  profundidadeTopo: 6,
  pernas: 4,
};

/**
 * Desenha Claude com os pés em (v.x, v.ySolo - v.z). Contexto em coordenadas do mundo.
 * Não desenhe a sombra de contato (o motor desenha).
 */
export function desenharClaude(ctx: CanvasRenderingContext2D, v: VisualClaude): void {
  if (v.invulneravel && Math.floor(v.tempo * 20) % 2 === 0) return;
  const { largura, alturaFrente } = MEDIDAS_CLAUDE;
  const x = v.x;
  const pe = v.ySolo - v.z;
  ctx.save();
  ctx.globalAlpha = v.alpha;
  ctx.translate(x, pe);
  ctx.scale(v.escala, v.escala);
  // pernas
  const passo = Math.sin(v.fasePasso * Math.PI * 2) * (v.velocidade > 0.05 ? 1.6 : 0);
  ctx.fillStyle = PALETA.claudeEscuro;
  ctx.fillRect(-8, -4 - Math.max(0, passo), 2.5, 4);
  ctx.fillRect(-4, -4 - Math.max(0, -passo), 2.5, 4);
  ctx.fillRect(2, -4 - Math.max(0, passo), 2.5, 4);
  ctx.fillRect(6, -4 - Math.max(0, -passo), 2.5, 4);
  // corpo
  ctx.fillStyle = PALETA.claude;
  ctx.fillRect(-largura / 2, -4 - alturaFrente, largura, alturaFrente);
  ctx.fillStyle = PALETA.claudeTopo;
  ctx.fillRect(-largura / 2, -4 - alturaFrente - 5, largura, 5);
  // olhos (somente se não estiver de costas)
  if (v.direcao !== 6 && v.direcao !== 5 && v.direcao !== 7) {
    const abertura = 4 * (1 - v.palpebra);
    ctx.fillStyle = PALETA.olho;
    ctx.fillRect(-5, -4 - alturaFrente + 2, 2.4, Math.max(0.6, abertura));
    ctx.fillRect(3, -4 - alturaFrente + 2, 2.4, Math.max(0.6, abertura));
  }
  ctx.restore();
}

/** Retrato expressivo para o HUD (quadrado de `tamanho` px com canto em (x, y)). */
export function desenharRetratoClaude(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tamanho: number,
  humor: Humor,
  tempo: number,
  palpebra: number
): void {
  ctx.fillStyle = PALETA.claude;
  ctx.fillRect(x + tamanho * 0.15, y + tamanho * 0.25, tamanho * 0.7, tamanho * 0.55);
  ctx.fillStyle = PALETA.olho;
  const a = tamanho * 0.18 * (1 - palpebra);
  ctx.fillRect(x + tamanho * 0.33, y + tamanho * 0.36, tamanho * 0.08, Math.max(1, a));
  ctx.fillRect(x + tamanho * 0.59, y + tamanho * 0.36, tamanho * 0.08, Math.max(1, a));
}

/**
 * Arma desenhada isolada (no chão como item, no inventário ou na mão de Claude).
 * Origem = cabo; `angulo` em radianos; `escala` 1 = tamanho em jogo.
 */
export function desenharArma(
  ctx: CanvasRenderingContext2D,
  arma: string,
  x: number,
  y: number,
  angulo: number,
  escala: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angulo);
  ctx.scale(escala, escala);
  ctx.fillStyle = arma === 'martelo' ? '#E5534B' : arma === 'colher' ? '#C9C3B8' : '#B98157';
  ctx.fillRect(0, -1.5, 16, 3);
  ctx.restore();
}
