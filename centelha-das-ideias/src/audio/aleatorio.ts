/**
 * Números pseudoaleatórios com semente: as variações de som e música ficam
 * reproduzíveis nos testes, mas diferentes a cada execução no jogo.
 */
export type Rng = () => number;

/** Gerador mulberry32 (32 bits): rápido e bom o bastante para áudio. */
export function criarRng(semente: number): Rng {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash FNV-1a de 32 bits (ids de faixas, nomes de falantes). */
export function hashTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combina vários inteiros em uma semente bem espalhada. */
export function misturar(...valores: number[]): number {
  let h = 0x9e3779b9;
  for (const v of valores) {
    h ^= Math.imul((v | 0) ^ 0x85ebca6b, 0xc2b2ae35);
    h = (Math.imul((h << 13) | (h >>> 19), 5) + 0xe6546b64) | 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function entre(rng: Rng, a: number, b: number): number {
  return a + (b - a) * rng();
}

export function escolher<T>(rng: Rng, lista: readonly T[]): T {
  return lista[Math.min(lista.length - 1, Math.floor(rng() * lista.length))];
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p;
}
