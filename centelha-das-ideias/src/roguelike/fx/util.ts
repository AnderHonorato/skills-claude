/**
 * Utilidades compartilhadas pelo sistema de efeitos (FX): níveis de qualidade,
 * cache de cores lineares, sorteio rápido e o modo de mistura "pré-multiplicado"
 * que deixa cada partícula escolher entre brilho aditivo e transparência comum
 * dentro do MESMO draw call.
 */
import * as THREE from 'three';

export type QualidadeFx = 'alta' | 'media' | 'baixa';

export interface ConfigFx {
  /** Lado da célula do atlas de partículas (px). */
  celulaAtlas: number;
  /** Lado da célula do atlas de decalques (px). */
  celulaDecal: number;
  /** Máximo de partículas vivas. */
  maxParticulas: number;
  /** Multiplicador da quantidade emitida pelas receitas. */
  densidade: number;
  /** Máximo de vértices das fitas (rastros, raios, lasers, cortes). */
  maxVerticesFita: number;
  /** Máximo de planos procedurais (ondas, decalques, poças...). */
  maxPlanos: number;
  /** Máximo de volumes (tornados, pilares). */
  maxVolumes: number;
  /** Níveis de subdivisão do relâmpago. */
  detalheRaio: number;
}

export const CONFIGS: Record<QualidadeFx, ConfigFx> = {
  alta: {
    celulaAtlas: 192,
    celulaDecal: 512,
    maxParticulas: 3600,
    densidade: 1,
    maxVerticesFita: 12000,
    maxPlanos: 320,
    maxVolumes: 24,
    detalheRaio: 5,
  },
  media: {
    celulaAtlas: 128,
    celulaDecal: 256,
    maxParticulas: 2000,
    densidade: 0.65,
    maxVerticesFita: 7000,
    maxPlanos: 220,
    maxVolumes: 16,
    detalheRaio: 4,
  },
  baixa: {
    celulaAtlas: 128,
    celulaDecal: 256,
    maxParticulas: 900,
    densidade: 0.38,
    maxVerticesFita: 3600,
    maxPlanos: 140,
    maxVolumes: 10,
    detalheRaio: 3,
  },
};

/** Cor aceita pelas receitas: '#rrggbb', número 0xrrggbb ou THREE.Color. */
export type CorFx = string | number | THREE.Color;

const cacheCores = new Map<string | number, THREE.Color>();

/** Converte para THREE.Color linear, com cache (não altere o objeto devolvido). */
export function corLinear(c: CorFx): THREE.Color {
  if (c instanceof THREE.Color) return c;
  let r = cacheCores.get(c);
  if (!r) {
    r = new THREE.Color(c);
    cacheCores.set(c, r);
  }
  return r;
}

/** Sorteio uniforme em [a, b). */
export function sortear(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

/** Valor em [-1, 1). */
export function sinal(): number {
  return Math.random() * 2 - 1;
}

export function limitar(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/**
 * Mistura pré-multiplicada: cor = src + dst·(1 − αsrc). O shader devolve
 * (rgb·α, α·(1 − aditivo)); aditivo = 1 soma luz, aditivo = 0 cobre como tinta.
 */
export function aplicarMisturaPremultiplicada(m: THREE.Material): void {
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.transparent = true;
  m.depthWrite = false;
  m.premultipliedAlpha = true;
}

/**
 * Quanto a luz "aditiva" deixa o fundo passar. Sobre a grama clara do jogo, luz
 * 100% aditiva vira branco e perde a cor; cobrindo 35% do fundo o matiz aparece.
 */
export const OCLUSAO_LUZ = 0.65;

/** Comprime o reforço HDR das receitas (brilho > 1) para não estourar em branco. */
export function realce(b: number): number {
  return b <= 1 ? b : 1 + (b - 1) * 0.55;
}

/**
 * Trecho GLSL comum: converte a cor para o espaço de saída ANTES de
 * pré-multiplicar (evita halos cinzentos) e grava gl_FragColor.
 */
export const GLSL_SAIDA = /* glsl */ `
  gl_FragColor = vec4(corFinal, 1.0);
  #include <colorspace_fragment>
  gl_FragColor = vec4(gl_FragColor.rgb * alfaFinal, alfaFinal * (1.0 - aditivoFinal * ${OCLUSAO_LUZ.toFixed(3)}));
`;
