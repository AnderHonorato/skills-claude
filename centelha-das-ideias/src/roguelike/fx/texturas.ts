/**
 * Texturas procedurais dos efeitos, desenhadas em canvas na inicialização (nada
 * vem da rede). Três peças:
 *  - atlas de partículas 8×6 (brilho, faísca, chamas, fumaças, anéis, estilhaços,
 *    eletricidade, vento, folha, gota, bolha, runas, rochas, estrela, nota... e os
 *    glifos de código: 0, 1, { }, </>, ;, #, λ, cadeado, pausa, pixel, bug...);
 *  - atlas de decalques de chão 4×2 (queimado, geada, veneno, círculo rúnico...);
 *  - ruído periódico 128×128 (4 canais) para os shaders animados.
 * As máscaras ficam no canal alfa; o RGB guarda só o sombreamento (tons de
 * cinza), que é multiplicado pela cor de cada partícula.
 */
import * as THREE from 'three';
import { criarAleatorio } from '../../nucleo/aleatorio';

/** Quadros do atlas de partículas (grade 8 colunas × 6 linhas). */
export const Q = {
  BRILHO: 0,
  FAISCA: 1,
  CHAMA_A: 2,
  CHAMA_B: 3,
  FUMACA_A: 4,
  FUMACA_B: 5,
  ANEL: 6,
  ONDA: 7,
  ESTILHACO: 8,
  CRISTAL: 9,
  ELETRICO_A: 10,
  ELETRICO_B: 11,
  VENTO: 12,
  FOLHA: 13,
  GOTA: 14,
  BOLHA: 15,
  RUNA_A: 16,
  RUNA_B: 17,
  ROCHA_A: 18,
  ROCHA_B: 19,
  RISCO: 20,
  ESTRELA: 21,
  NOTA: 22,
  FLOCO: 23,
  BRASA: 24,
  LASCA: 25,
  CHAMA_C: 26,
  RUNA_C: 27,
  POEIRA: 28,
  ESPIRAL: 29,
  RAIOS: 30,
  HEX: 31,
  // tema programação
  ZERO: 32,
  UM: 33,
  CHAVES: 34,
  TAG: 35,
  PONTO_VIRGULA: 36,
  CERQUILHA: 37,
  LAMBDA: 38,
  CADEADO: 39,
  PAUSA: 40,
  PIXEL: 41,
  HEXA: 42,
  GLITCH: 43,
  BUG: 44,
  XIS: 45,
  PROMPT: 46,
  ASTERISCO: 47,
} as const;

export const GRADE_ATLAS = { x: 8, y: 6 };

/** Quadros do atlas de decalques (grade 4 × 2). */
export const D = {
  QUEIMADO: 0,
  GEADA: 1,
  VENENO: 2,
  CIRCULO: 3,
  RACHADURA: 4,
  MOLHADO: 5,
  CRATERA: 6,
  SELO: 7,
} as const;

export const GRADE_DECAL = { x: 4, y: 2 };

// ------------------------------------------------------------------ ruído

/** Ruído de valor 2D periódico (período em células da grade). */
function criarRuido(semente: number) {
  const rnd = criarAleatorio(semente);
  const tab = new Float32Array(256 * 256);
  for (let i = 0; i < tab.length; i++) tab[i] = rnd();
  const suave = (t: number) => t * t * (3 - 2 * t);
  const pega = (ix: number, iy: number, p: number) => {
    if (p > 0) {
      ix = ((ix % p) + p) % p;
      iy = ((iy % p) + p) % p;
    }
    return tab[(ix & 255) + (iy & 255) * 256];
  };
  const ruido = (x: number, y: number, p = 0) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = suave(x - ix);
    const fy = suave(y - iy);
    const a = pega(ix, iy, p);
    const b = pega(ix + 1, iy, p);
    const c = pega(ix, iy + 1, p);
    const d = pega(ix + 1, iy + 1, p);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
  const fbm = (x: number, y: number, oitavas = 4, p = 0) => {
    let s = 0;
    let amp = 0.5;
    let tot = 0;
    let f = 1;
    for (let o = 0; o < oitavas; o++) {
      s += ruido(x * f, y * f, p ? p * f : 0) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / tot;
  };
  return { ruido, fbm };
}

const R = criarRuido(7);

const suaviza = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ pintura

type Pixel = (u: number, v: number, s: Float32Array) => void;

/** Pinta uma célula pixel a pixel. u, v em [-1, 1], v para CIMA. s = [r, g, b, a]. */
function pintar(ctx: CanvasRenderingContext2D, x0: number, y0: number, S: number, f: Pixel): void {
  const img = ctx.getImageData(x0, y0, S, S);
  const d = img.data;
  const s = new Float32Array(4);
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = ((px + 0.5) / S) * 2 - 1;
      const v = 1 - ((py + 0.5) / S) * 2;
      s[0] = s[1] = s[2] = 1;
      s[3] = 0;
      f(u, v, s);
      const i = (py * S + px) * 4;
      // compõe sobre o que já existe (permite misturar pixel + vetor)
      const a = Math.min(1, Math.max(0, s[3]));
      const a0 = d[i + 3] / 255;
      const ao = a + a0 * (1 - a);
      if (ao <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const c = Math.min(1, Math.max(0, s[k]));
        d[i + k] = Math.round(((c * a + (d[i + k] / 255) * a0 * (1 - a)) / ao) * 255);
      }
      d[i + 3] = Math.round(ao * 255);
    }
  }
  ctx.putImageData(img, x0, y0);
}

/** Desenho vetorial numa célula: coordenadas de -1 a 1 com y para cima. */
function vetor(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  S: number,
  f: (c: CanvasRenderingContext2D, px: number) => void
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  ctx.translate(x0 + S / 2, y0 + S / 2);
  ctx.scale(S / 2, -S / 2);
  f(ctx, 2 / S);
  ctx.restore();
}

/** Borda suave para tudo caber na célula (evita sangrar no mipmap). */
const borda = (d: number) => 1 - suaviza(0.86, 0.98, d);

// ------------------------------------------------------------------ quadros

function quadroBrilho(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  s[3] = (Math.exp(-d * d * 5) * 0.85 + Math.exp(-d * d * 40) * 0.4) * borda(d);
}

function quadroFaisca(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const b1 = Math.exp(-Math.abs(v) * 34) * Math.pow(Math.max(0, 1 - Math.abs(u)), 1.6);
  const b2 = Math.exp(-Math.abs(u) * 34) * Math.pow(Math.max(0, 1 - Math.abs(v)), 1.6);
  const nucleo = Math.exp(-d * d * 30);
  s[3] = Math.min(1, b1 + b2 + nucleo + Math.exp(-d * d * 6) * 0.25) * borda(d);
}

function quadroChama(semente: number): Pixel {
  return (u, v, s) => {
    const d = Math.hypot(u, v * 0.92);
    const n = R.fbm(u * 2.1 + semente, v * 2.1 - semente * 0.7, 4);
    const n2 = R.fbm(u * 5 + 9 + semente, v * 5 + 3, 3);
    const e = d + (n - 0.5) * 0.75;
    let a = suaviza(0.92, 0.3, e) * (0.72 + 0.28 * n2);
    a *= borda(d);
    s[3] = a;
    const brilho = 0.5 + 0.5 * suaviza(0.85, 0.05, e);
    s[0] = s[1] = s[2] = brilho;
  };
}

function quadroLingua(u: number, v: number, s: Float32Array) {
  const t = (v + 1) / 2;
  const n = R.fbm(u * 2.5 + 4, v * 2 + 11, 4);
  const meia = 0.62 * Math.pow(Math.max(0, 1 - t), 0.75) * suaviza(-0.05, 0.3, t);
  const x = Math.abs(u + (n - 0.5) * 0.35 * t);
  const a = suaviza(meia, meia * 0.35, x) * (0.75 + 0.25 * n);
  s[3] = a * borda(Math.hypot(u, v) * 0.95);
  const brilho = 0.45 + 0.55 * suaviza(meia, 0, x) * suaviza(1, 0.2, t);
  s[0] = s[1] = s[2] = brilho;
}

function quadroFumaca(semente: number, wisp: boolean): Pixel {
  const rnd = criarAleatorio(semente);
  const bolhas: [number, number, number][] = [];
  const n = wisp ? 9 : 7;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * (wisp ? 0.45 : 0.32);
    bolhas.push([Math.cos(a) * r, Math.sin(a) * r, (wisp ? 0.22 : 0.32) + rnd() * 0.22]);
  }
  return (u, v, s) => {
    let dens = 0;
    for (const [bx, by, br] of bolhas) {
      const dd = ((u - bx) ** 2 + (v - by) ** 2) / (br * br);
      dens += Math.exp(-dd * 1.6);
    }
    const n = R.fbm(u * 3 + semente, v * 3 - semente, 5);
    dens *= 0.6 + 0.8 * n;
    const d = Math.hypot(u, v);
    s[3] = suaviza(0.15, wisp ? 0.9 : 0.75, dens) * borda(d) * (wisp ? 0.75 : 1);
    // luz vinda de cima/esquerda
    const sombra =
      0.62 + 0.38 * Math.min(1, Math.max(0, 0.5 + v * 0.45 - u * 0.25 + (n - 0.5) * 0.6));
    s[0] = s[1] = s[2] = sombra;
  };
}

function quadroAnel(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const x = (d - 0.8) / 0.055;
  s[3] = (Math.exp(-x * x) + 0.25 * Math.exp(-(((d - 0.8) / 0.18) ** 2))) * borda(d);
}

function quadroOnda(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const frente = suaviza(0.9, 0.78, d);
  const cauda = Math.pow(suaviza(0.2, 0.8, d), 2.2);
  s[3] = frente * cauda * borda(d);
  s[0] = s[1] = s[2] = 0.6 + 0.4 * suaviza(0.55, 0.82, d);
}

function quadroRiscoVento(u: number, v: number, s: Float32Array) {
  const r = Math.hypot(u, v);
  const ang = Math.atan2(v, u);
  const a0 = -2.6;
  const a1 = 0.9;
  if (ang < a0 || ang > a1) return;
  const t = (ang - a0) / (a1 - a0);
  const esp = 0.02 + 0.11 * Math.sin(Math.PI * Math.pow(t, 0.8));
  const x = (r - 0.66) / esp;
  s[3] = Math.exp(-x * x) * Math.pow(t, 0.6) * borda(r);
}

function quadroFolha(u: number, v: number, s: Float32Array) {
  const c = Math.cos(0.7);
  const sn = Math.sin(0.7);
  const x = u * c - v * sn;
  const y = u * sn + v * c;
  const L = 0.86;
  if (Math.abs(x) > L) return;
  const meia = 0.34 * Math.pow(1 - (x / L) ** 2, 0.85);
  const ay = Math.abs(y + 0.06 * Math.sin(x * 3));
  s[3] = suaviza(meia, meia - 0.03, ay);
  const nervura = Math.exp(-((y / 0.025) ** 2)) * 0.35;
  const lado = y > 0 ? 1 : 0.8;
  s[0] = s[1] = s[2] = (lado - nervura) * (0.85 + 0.15 * (x / L));
  if (x < -L + 0.05 && Math.abs(y) < 0.03) s[3] = 1;
}

function quadroGota(u: number, v: number, s: Float32Array) {
  const cy = -0.3;
  const r = 0.5;
  const dc = Math.hypot(u, v - cy);
  let dentro = dc < r ? 1 : 0;
  // cone até a ponta
  if (v > cy && v < 0.9) {
    const t = (v - cy) / (0.9 - cy);
    const meia = r * Math.sqrt(Math.max(0, 1 - t)) * (1 - t * 0.15);
    if (Math.abs(u) < meia) dentro = 1;
  }
  const aa = suaviza(r + 0.02, r - 0.02, dc);
  s[3] = Math.max(dentro ? 1 : 0, aa);
  const realce = Math.exp(-(((u + 0.18) ** 2 + (v + 0.12) ** 2) / 0.012));
  const aro = suaviza(r - 0.15, r, dc) * 0.25;
  s[0] = s[1] = s[2] = Math.min(1, 0.62 + 0.25 * (-v * 0.4 + 0.5) + realce + aro);
}

function quadroBolha(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const aro = Math.exp(-(((d - 0.78) / 0.07) ** 2));
  const dentro = 0.18 * suaviza(0.82, 0.2, d);
  const realce = Math.exp(-(((u + 0.32) ** 2 + (v - 0.32) ** 2) / 0.02)) * 0.95;
  s[3] = Math.min(1, aro * 0.95 + dentro + realce) * borda(d);
  s[0] = s[1] = s[2] = 0.8 + 0.2 * realce;
}

function quadroRisco(u: number, v: number, s: Float32Array) {
  // vertical: o topo é a cabeça (mais brilhante), a cauda afina para baixo
  const x = u / 0.13;
  const cauda = Math.pow(Math.max(0, 1 - v * v), 1.3) * (0.55 + 0.45 * (v * 0.5 + 0.5));
  const corpo = Math.exp(-x * x) * cauda;
  const nucleo = Math.exp(-((u / 0.04) ** 2)) * Math.pow(Math.max(0, 1 - v * v), 2);
  s[3] = Math.min(1, corpo * 0.8 + nucleo);
}

function quadroEstrela(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const raio = (x: number, y: number, larg: number, comp: number) =>
    Math.exp(-Math.abs(y) * larg) * Math.pow(Math.max(0, 1 - Math.abs(x) / comp), 2.2);
  const c = Math.SQRT1_2;
  const du = (u + v) * c;
  const dv = (v - u) * c;
  const a =
    raio(u, v, 40, 1) +
    raio(v, u, 40, 1) +
    0.55 * raio(du, dv, 46, 0.55) +
    0.55 * raio(dv, du, 46, 0.55) +
    Math.exp(-d * d * 22) +
    0.3 * Math.exp(-d * d * 4);
  s[3] = Math.min(1, a) * borda(d);
}

function quadroBrasa(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  s[3] = Math.min(1, Math.exp(-d * d * 14) * 1.2 + Math.exp(-d * d * 3) * 0.25) * borda(d);
  s[0] = s[1] = s[2] = 0.75 + 0.25 * Math.exp(-d * d * 30);
}

function quadroPoeira(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const n = R.fbm(u * 2.6 + 31, v * 2.6 + 5, 5);
  const e = d + (n - 0.5) * 0.9;
  s[3] = suaviza(0.95, 0.15, e) * 0.85 * borda(d);
  s[0] = s[1] = s[2] = 0.7 + 0.3 * n;
}

function quadroEspiral(u: number, v: number, s: Float32Array) {
  const r = Math.hypot(u, v);
  const ang = Math.atan2(v, u) + Math.PI; // 0..2π
  const voltas = 1.6;
  let melhor = 0;
  for (let k = 0; k < 3; k++) {
    const th = ang + k * Math.PI * 2;
    const t = th / (Math.PI * 2 * voltas);
    if (t > 1) continue;
    const rs = 0.08 + 0.8 * t;
    const esp = 0.03 + 0.07 * t;
    const x = (r - rs) / esp;
    melhor = Math.max(melhor, Math.exp(-x * x) * Math.pow(t, 0.4));
  }
  s[3] = melhor * borda(r);
}

function quadroRaios(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const ang = Math.atan2(v, u);
  const n = R.ruido(((ang + Math.PI) / (Math.PI * 2)) * 12, 3.3, 12);
  const raios = Math.pow(0.5 + 0.5 * Math.cos(ang * 14), 8) * (0.5 + n);
  const comp = 0.5 + 0.45 * n;
  const a = raios * suaviza(comp, 0.1, d) + Math.exp(-d * d * 18) * 0.8;
  s[3] = Math.min(1, a) * borda(d);
}

// --- vetoriais

function desenharEstilhaco(c: CanvasRenderingContext2D) {
  const topo: [number, number] = [0.05, 0.95];
  const dir: [number, number] = [0.26, 0.05];
  const base: [number, number] = [-0.02, -0.92];
  const esq: [number, number] = [-0.24, -0.18];
  const tri = (a: [number, number], b: [number, number], d: [number, number], cor: string) => {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.lineTo(d[0], d[1]);
    c.closePath();
    c.fillStyle = cor;
    c.fill();
  };
  tri(topo, esq, base, '#ffffff');
  tri(topo, dir, base, '#9fb1c4');
  c.beginPath();
  c.moveTo(topo[0], topo[1]);
  c.lineTo(dir[0], dir[1]);
  c.lineTo(base[0], base[1]);
  c.lineTo(esq[0], esq[1]);
  c.closePath();
  c.lineWidth = 0.035;
  c.strokeStyle = '#ffffff';
  c.stroke();
  c.beginPath();
  c.moveTo(topo[0], topo[1]);
  c.lineTo(base[0], base[1]);
  c.lineWidth = 0.02;
  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.stroke();
}

function desenharCristal(c: CanvasRenderingContext2D) {
  const w = 0.32;
  const faces: [number, number][][] = [
    [
      [-w, -0.6],
      [-w, 0.45],
      [0, 0.92],
      [-0.05, -0.85],
    ],
    [
      [-0.05, -0.85],
      [0, 0.92],
      [w * 0.55, 0.5],
      [w * 0.55, -0.62],
    ],
    [
      [w * 0.55, -0.62],
      [w * 0.55, 0.5],
      [0, 0.92],
      [w, 0.42],
      [w, -0.55],
    ],
  ];
  const tons = ['#ffffff', '#c9d6e3', '#8d9db0'];
  faces.forEach((f, i) => {
    c.beginPath();
    c.moveTo(f[0][0], f[0][1]);
    for (let k = 1; k < f.length; k++) c.lineTo(f[k][0], f[k][1]);
    c.closePath();
    c.fillStyle = tons[i];
    c.fill();
  });
  c.lineWidth = 0.03;
  c.strokeStyle = '#ffffff';
  c.beginPath();
  c.moveTo(-w, -0.6);
  c.lineTo(-w, 0.45);
  c.lineTo(0, 0.92);
  c.lineTo(w, 0.42);
  c.lineTo(w, -0.55);
  c.lineTo(-0.05, -0.85);
  c.closePath();
  c.stroke();
}

function desenharLasca(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.moveTo(-0.06, 0.95);
  c.lineTo(0.14, -0.2);
  c.lineTo(0.02, -0.95);
  c.lineTo(-0.12, -0.1);
  c.closePath();
  const g = c.createLinearGradient(-0.12, 0, 0.14, 0);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.5, '#dfe8f2');
  g.addColorStop(1, '#8796a8');
  c.fillStyle = g;
  c.fill();
  c.lineWidth = 0.025;
  c.strokeStyle = '#ffffff';
  c.stroke();
}

function desenharEletrico(semente: number) {
  return (c: CanvasRenderingContext2D, px: number) => {
    const rnd = criarAleatorio(semente);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.55);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, 0.55, 0, Math.PI * 2);
    c.fill();
    c.lineCap = 'round';
    c.lineJoin = 'round';
    const ramos = 6 + Math.floor(rnd() * 3);
    for (let r = 0; r < ramos; r++) {
      let ang = rnd() * Math.PI * 2;
      let x = 0;
      let y = 0;
      const comp = 0.55 + rnd() * 0.35;
      const passos = 6;
      const pts: [number, number][] = [[0, 0]];
      for (let k = 0; k < passos; k++) {
        ang += (rnd() - 0.5) * 1.3;
        x += (Math.cos(ang) * comp) / passos;
        y += (Math.sin(ang) * comp) / passos;
        pts.push([x, y]);
      }
      for (const [larg, alfa] of [
        [0.09, 0.25],
        [0.035, 1],
      ]) {
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts) c.lineTo(p[0], p[1]);
        c.lineWidth = Math.max(px, larg);
        c.strokeStyle = `rgba(255,255,255,${alfa})`;
        c.stroke();
      }
    }
  };
}

function desenharRuna(variante: number) {
  return (c: CanvasRenderingContext2D) => {
    c.strokeStyle = '#ffffff';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = 0.06;
    c.beginPath();
    c.arc(0, 0, 0.82, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 0.035;
    c.beginPath();
    c.arc(0, 0, 0.68, 0, Math.PI * 2);
    c.stroke();
    // marcas entre os aros
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const r0 = 0.7;
      const r1 = k % 2 ? 0.8 : 0.76;
      c.beginPath();
      c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      c.stroke();
    }
    c.lineWidth = 0.055;
    c.beginPath();
    if (variante === 0) {
      for (let k = 0; k <= 3; k++) {
        const a = Math.PI / 2 + (k / 3) * Math.PI * 2;
        const x = Math.cos(a) * 0.6;
        const y = Math.sin(a) * 0.6;
        if (k === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.moveTo(0, 0.6);
      c.lineTo(0, -0.3);
      c.moveTo(-0.2, 0.05);
      c.lineTo(0.2, 0.05);
    } else if (variante === 1) {
      for (let k = 0; k <= 5; k++) {
        const a = Math.PI / 2 + ((k * 2) / 5) * Math.PI * 2;
        const x = Math.cos(a) * 0.6;
        const y = Math.sin(a) * 0.6;
        if (k === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
    } else {
      c.moveTo(-0.35, -0.4);
      c.lineTo(0, 0.5);
      c.lineTo(0.35, -0.4);
      c.moveTo(-0.45, 0.1);
      c.lineTo(0.45, 0.1);
      c.moveTo(0, 0.5);
      c.lineTo(0, -0.55);
      c.moveTo(0.18, -0.2);
      c.arc(0, -0.2, 0.18, 0, Math.PI * 2);
    }
    c.stroke();
  };
}

function desenharRocha(semente: number) {
  return (c: CanvasRenderingContext2D) => {
    const rnd = criarAleatorio(semente);
    const n = 8;
    const pts: [number, number][] = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.4;
      const r = 0.58 + rnd() * 0.3;
      pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.9]);
    }
    const cx = (rnd() - 0.5) * 0.2;
    const cy = 0.1 + rnd() * 0.15;
    for (let k = 0; k < n; k++) {
      const p = pts[k];
      const q = pts[(k + 1) % n];
      const am = Math.atan2((p[1] + q[1]) / 2 - cy, (p[0] + q[0]) / 2 - cx);
      const luz = 0.5 + 0.5 * Math.cos(am - 2.2);
      const t = Math.round(90 + luz * 150);
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(p[0], p[1]);
      c.lineTo(q[0], q[1]);
      c.closePath();
      c.fillStyle = `rgb(${t},${t},${t})`;
      c.fill();
      c.strokeStyle = `rgb(${t},${t},${t})`;
      c.lineWidth = 0.01;
      c.stroke();
    }
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.closePath();
    c.lineWidth = 0.05;
    c.strokeStyle = 'rgb(60,60,60)';
    c.stroke();
  };
}

function desenharNota(c: CanvasRenderingContext2D) {
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';
  c.save();
  c.translate(-0.22, -0.5);
  c.rotate(0.45);
  c.beginPath();
  c.ellipse(0, 0, 0.27, 0.19, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
  c.fillRect(-0.0, -0.48, 0.1, 1.25);
  c.beginPath();
  c.moveTo(0.1, 0.77);
  c.bezierCurveTo(0.2, 0.5, 0.55, 0.45, 0.4, 0.05);
  c.bezierCurveTo(0.45, 0.35, 0.25, 0.42, 0.1, 0.5);
  c.closePath();
  c.fill();
}

function desenharFloco(c: CanvasRenderingContext2D) {
  c.strokeStyle = '#ffffff';
  c.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    c.save();
    c.rotate((k / 6) * Math.PI * 2);
    c.lineWidth = 0.075;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(0, 0.85);
    for (const [y, l] of [
      [0.35, 0.22],
      [0.6, 0.16],
    ]) {
      c.moveTo(0, y);
      c.lineTo(l, y + l * 0.9);
      c.moveTo(0, y);
      c.lineTo(-l, y + l * 0.9);
    }
    c.stroke();
    c.restore();
  }
  c.fillStyle = '#ffffff';
  c.beginPath();
  c.arc(0, 0, 0.12, 0, Math.PI * 2);
  c.fill();
}

function desenharHex(c: CanvasRenderingContext2D) {
  c.strokeStyle = '#ffffff';
  c.lineJoin = 'round';
  for (const [r, l] of [
    [0.8, 0.09],
    [0.52, 0.05],
  ]) {
    c.lineWidth = l;
    c.beginPath();
    for (let k = 0; k <= 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  c.fillStyle = 'rgba(255,255,255,0.25)';
  c.beginPath();
  c.arc(0, 0, 0.5, 0, Math.PI * 2);
  c.fill();
}

// ------------------------------------------------------------------ atlas

function novoCanvas(w: number, h: number): CanvasRenderingContext2D {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas 2D indisponível para gerar texturas de FX.');
  return ctx;
}

/** Aplica brilho (glow) a um desenho vetorial copiando-o borrado por baixo. */
function comBrilho(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  S: number,
  f: (c: CanvasRenderingContext2D, px: number) => void,
  forca = 0.06
): void {
  const tmp = novoCanvas(S, S);
  vetor(tmp, 0, 0, S, f);
  colarComBrilho(ctx, tmp.canvas, x0, y0, S, forca);
}

/**
 * Cola uma célula pronta com halo. Usa shadowBlur (funciona em todo navegador,
 * inclusive Safari/iOS, que ignora ctx.filter), recortado na célula.
 */
function colarComBrilho(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement,
  x0: number,
  y0: number,
  S: number,
  forca: number,
  corHalo = 'rgba(255,255,255,0.95)'
): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, S, S);
  ctx.clip();
  ctx.shadowColor = corHalo;
  ctx.shadowBlur = Math.max(1, S * forca);
  ctx.drawImage(img, x0, y0);
  ctx.shadowBlur = Math.max(1, S * forca * 0.4);
  ctx.drawImage(img, x0, y0);
  ctx.restore();
}

const FONTE_MONO =
  '"DejaVu Sans Mono", "Menlo", "Consolas", "Roboto Mono", "Courier New", monospace';

/** Glifo de código em monoespaçada negrito, centrado, com brilho. */
function desenharTexto(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  S: number,
  texto: string,
  escala = 0.72,
  forca = 0.07
): void {
  const tmp = novoCanvas(S, S);
  let tam = S * escala;
  tmp.font = `bold ${tam}px ${FONTE_MONO}`;
  const w = tmp.measureText(texto).width;
  if (w > S * 0.8) {
    tam *= (S * 0.8) / w;
    tmp.font = `bold ${tam}px ${FONTE_MONO}`;
  }
  tmp.textAlign = 'center';
  tmp.textBaseline = 'middle';
  // contorno escuro: o glifo continua legível sobre a grama clara (RGB × cor mantém o preto)
  tmp.strokeStyle = '#000000';
  tmp.lineJoin = 'round';
  tmp.lineWidth = S * 0.09;
  tmp.strokeText(texto, S / 2, S / 2 + tam * 0.05);
  tmp.fillStyle = '#ffffff';
  tmp.fillText(texto, S / 2, S / 2 + tam * 0.05);
  colarComBrilho(ctx, tmp.canvas, x0, y0, S, forca, 'rgba(0,0,0,0.85)');
}

/** Ícone vetorial com contorno/halo escuro (mesmo motivo dos glifos). */
function iconeEscuro(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  S: number,
  f: (c: CanvasRenderingContext2D, px: number) => void
): void {
  const tmp = novoCanvas(S, S);
  vetor(tmp, 0, 0, S, f);
  colarComBrilho(ctx, tmp.canvas, x0, y0, S, 0.05, 'rgba(0,0,0,0.9)');
}

// --- ícones do tema programação (coordenadas -1..1, y para cima)

function desenharCadeado(c: CanvasRenderingContext2D) {
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineWidth = 0.14;
  c.beginPath();
  c.arc(0, 0.12, 0.34, 0, Math.PI);
  c.lineTo(-0.34, -0.05);
  c.moveTo(0.34, 0.12);
  c.lineTo(0.34, -0.05);
  c.stroke();
  const x = -0.58;
  const y = -0.78;
  const w = 1.16;
  const h = 0.86;
  const r = 0.12;
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(0, -0.25, 0.12, 0, Math.PI * 2);
  c.fill();
  c.fillRect(-0.05, -0.58, 0.1, 0.3);
  c.globalCompositeOperation = 'source-over';
}

function desenharPausa(c: CanvasRenderingContext2D) {
  c.fillStyle = '#ffffff';
  for (const x of [-0.42, 0.14]) {
    c.beginPath();
    c.moveTo(x + 0.06, -0.7);
    c.lineTo(x + 0.22, -0.7);
    c.quadraticCurveTo(x + 0.28, -0.7, x + 0.28, -0.64);
    c.lineTo(x + 0.28, 0.64);
    c.quadraticCurveTo(x + 0.28, 0.7, x + 0.22, 0.7);
    c.lineTo(x + 0.06, 0.7);
    c.quadraticCurveTo(x, 0.7, x, 0.64);
    c.lineTo(x, -0.64);
    c.quadraticCurveTo(x, -0.7, x + 0.06, -0.7);
    c.fill();
  }
}

function desenharPixel(c: CanvasRenderingContext2D) {
  // voxel visto de frente: face clara, bisel de luz em cima/esquerda e sombra embaixo/direita
  const a = 0.8;
  const b = 0.56;
  const quad = (pts: number[][], cor: string) => {
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.closePath();
    c.fillStyle = cor;
    c.fill();
  };
  quad(
    [
      [-a, a],
      [a, a],
      [b, b],
      [-b, b],
    ],
    '#ffffff'
  );
  quad(
    [
      [-a, a],
      [-b, b],
      [-b, -b],
      [-a, -a],
    ],
    '#e4e4e4'
  );
  quad(
    [
      [a, a],
      [a, -a],
      [b, -b],
      [b, b],
    ],
    '#9a9a9a'
  );
  quad(
    [
      [-a, -a],
      [-b, -b],
      [b, -b],
      [a, -a],
    ],
    '#808080'
  );
  quad(
    [
      [-b, b],
      [b, b],
      [b, -b],
      [-b, -b],
    ],
    '#c8c8c8'
  );
  c.strokeStyle = '#1a1a1a';
  c.lineWidth = 0.08;
  c.strokeRect(-a, -a, a * 2, a * 2);
}

function desenharGlitch(c: CanvasRenderingContext2D) {
  const rnd = criarAleatorio(91);
  c.fillStyle = '#ffffff';
  let y = -0.8;
  while (y < 0.8) {
    const h = 0.05 + rnd() * 0.14;
    const x0 = -0.95 + rnd() * 0.5;
    const x1 = 0.95 - rnd() * 0.5;
    if (rnd() < 0.75) c.fillRect(x0, y, x1 - x0, h);
    y += h + 0.03 + rnd() * 0.08;
  }
}

function desenharBug(c: CanvasRenderingContext2D) {
  c.fillStyle = '#ffffff';
  c.strokeStyle = '#ffffff';
  c.lineCap = 'round';
  c.lineWidth = 0.08;
  for (const s of [-1, 1]) {
    for (const y of [0.15, -0.1, -0.35]) {
      c.beginPath();
      c.moveTo(0.25 * s, y);
      c.lineTo(0.62 * s, y + (y > 0 ? 0.18 : y < -0.2 ? -0.2 : 0));
      c.stroke();
    }
    c.beginPath();
    c.moveTo(0.1 * s, 0.55);
    c.lineTo(0.3 * s, 0.82);
    c.stroke();
  }
  c.beginPath();
  c.ellipse(0, -0.12, 0.34, 0.48, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(0, 0.46, 0.2, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'destination-out';
  c.lineWidth = 0.05;
  c.beginPath();
  c.moveTo(0, 0.3);
  c.lineTo(0, -0.55);
  c.stroke();
  c.globalCompositeOperation = 'source-over';
}

export function criarAtlasParticulas(celula: number): THREE.Texture {
  const S = celula;
  const ctx = novoCanvas(S * GRADE_ATLAS.x, S * GRADE_ATLAS.y);
  const pos = (q: number): [number, number] => [
    (q % GRADE_ATLAS.x) * S,
    Math.floor(q / GRADE_ATLAS.x) * S,
  ];
  const px = (q: number, f: Pixel) => {
    const [x, y] = pos(q);
    pintar(ctx, x, y, S, f);
  };
  const vt = (q: number, f: (c: CanvasRenderingContext2D, px: number) => void, brilho = 0) => {
    const [x, y] = pos(q);
    if (brilho > 0) comBrilho(ctx, x, y, S, f, brilho);
    else vetor(ctx, x, y, S, f);
  };

  px(Q.BRILHO, quadroBrilho);
  px(Q.FAISCA, quadroFaisca);
  px(Q.CHAMA_A, quadroChama(1.3));
  px(Q.CHAMA_B, quadroChama(7.9));
  px(Q.FUMACA_A, quadroFumaca(11, false));
  px(Q.FUMACA_B, quadroFumaca(23, true));
  px(Q.ANEL, quadroAnel);
  px(Q.ONDA, quadroOnda);
  vt(Q.ESTILHACO, desenharEstilhaco);
  vt(Q.CRISTAL, desenharCristal);
  vt(Q.ELETRICO_A, desenharEletrico(3), 0.04);
  vt(Q.ELETRICO_B, desenharEletrico(8), 0.04);
  px(Q.VENTO, quadroRiscoVento);
  px(Q.FOLHA, quadroFolha);
  px(Q.GOTA, quadroGota);
  px(Q.BOLHA, quadroBolha);
  vt(Q.RUNA_A, desenharRuna(0), 0.05);
  vt(Q.RUNA_B, desenharRuna(1), 0.05);
  vt(Q.ROCHA_A, desenharRocha(5));
  vt(Q.ROCHA_B, desenharRocha(17));
  px(Q.RISCO, quadroRisco);
  px(Q.ESTRELA, quadroEstrela);
  vt(Q.NOTA, desenharNota, 0.05);
  vt(Q.FLOCO, desenharFloco, 0.04);
  px(Q.BRASA, quadroBrasa);
  vt(Q.LASCA, desenharLasca);
  px(Q.CHAMA_C, quadroLingua);
  vt(Q.RUNA_C, desenharRuna(2), 0.05);
  px(Q.POEIRA, quadroPoeira);
  px(Q.ESPIRAL, quadroEspiral);
  px(Q.RAIOS, quadroRaios);
  vt(Q.HEX, desenharHex, 0.05);
  // tema programação
  const tx = (q: number, t: string, e = 0.72) => {
    const [x, y] = pos(q);
    desenharTexto(ctx, x, y, S, t, e);
  };
  tx(Q.ZERO, '0', 0.8);
  tx(Q.UM, '1', 0.8);
  tx(Q.CHAVES, '{ }', 0.7);
  tx(Q.TAG, '</>', 0.7);
  tx(Q.PONTO_VIRGULA, ';', 0.85);
  tx(Q.CERQUILHA, '#', 0.8);
  tx(Q.LAMBDA, 'λ', 0.85);
  const ic = (q: number, f: (c: CanvasRenderingContext2D, px: number) => void) => {
    const [x, y] = pos(q);
    iconeEscuro(ctx, x, y, S, f);
  };
  ic(Q.CADEADO, desenharCadeado);
  ic(Q.PAUSA, desenharPausa);
  vt(Q.PIXEL, desenharPixel);
  tx(Q.HEXA, '0x', 0.7);
  vt(Q.GLITCH, desenharGlitch);
  ic(Q.BUG, desenharBug);
  tx(Q.XIS, '×', 0.9);
  tx(Q.PROMPT, '>_', 0.7);
  tx(Q.ASTERISCO, '*', 0.95);

  const t = new THREE.CanvasTexture(ctx.canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 1;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ decalques

function decalQueimado(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const ang = Math.atan2(v, u);
  const n = R.fbm(u * 2.4 + 3, v * 2.4 + 8, 5);
  const raios = R.ruido(((ang + Math.PI) / (Math.PI * 2)) * 10, 1.7, 10);
  const e = d + (n - 0.5) * 0.55 - raios * 0.18;
  const a = suaviza(0.9, 0.25, e) * (0.75 + 0.25 * n);
  s[3] = a * borda(d);
  s[0] = s[1] = s[2] = 0.35 + 0.65 * suaviza(0.15, 0.85, e) * n;
}

function decalGeada(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const n = R.fbm(u * 3 + 50, v * 3 + 20, 5);
  const e = d + (n - 0.5) * 0.4;
  s[3] = suaviza(0.95, 0.4, e) * (0.3 + 0.4 * n) * borda(d);
  s[0] = s[1] = s[2] = 0.85 + 0.15 * n;
}

function decalGeadaRamos(c: CanvasRenderingContext2D, px: number) {
  const rnd = criarAleatorio(41);
  c.strokeStyle = '#ffffff';
  c.lineCap = 'round';
  const ramo = (x: number, y: number, ang: number, comp: number, larg: number, nivel: number) => {
    const x2 = x + Math.cos(ang) * comp;
    const y2 = y + Math.sin(ang) * comp;
    c.lineWidth = Math.max(px, larg);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x2, y2);
    c.stroke();
    if (nivel <= 0) return;
    const filhos = 3;
    for (let k = 1; k <= filhos; k++) {
      const t = k / (filhos + 1);
      const bx = x + (x2 - x) * t;
      const by = y + (y2 - y) * t;
      const l = comp * (0.35 + rnd() * 0.15) * (1 - t * 0.5);
      ramo(bx, by, ang + 0.75, l, larg * 0.6, nivel - 1);
      ramo(bx, by, ang - 0.75, l, larg * 0.6, nivel - 1);
    }
  };
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + rnd() * 0.4;
    ramo(0, 0, a, 0.62 + rnd() * 0.25, 0.04, 2);
  }
}

function decalVeneno(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const n = R.fbm(u * 2 + 70, v * 2 + 7, 4);
  const e = d + (n - 0.5) * 0.6;
  let a = suaviza(0.72, 0.62, e);
  // gotículas satélites
  const rnd = criarAleatorio(77);
  for (let k = 0; k < 9; k++) {
    const ang = rnd() * Math.PI * 2;
    const r = 0.7 + rnd() * 0.18;
    const rr = 0.04 + rnd() * 0.06;
    const dd = Math.hypot(u - Math.cos(ang) * r, v - Math.sin(ang) * r);
    a = Math.max(a, suaviza(rr, rr - 0.02, dd));
  }
  s[3] = a * borda(d);
  const aro = suaviza(0.4, 0.68, e) * 0.35;
  s[0] = s[1] = s[2] = 0.6 + 0.25 * n + aro;
}

function decalCirculo(c: CanvasRenderingContext2D, px: number) {
  c.strokeStyle = '#ffffff';
  c.fillStyle = '#ffffff';
  c.lineCap = 'round';
  const aro = (r: number, l: number) => {
    c.lineWidth = Math.max(px, l);
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
  };
  aro(0.92, 0.035);
  aro(0.8, 0.02);
  aro(0.45, 0.025);
  aro(0.12, 0.02);
  // runas entre os aros
  const rnd = criarAleatorio(5);
  const nr = 18;
  c.lineWidth = Math.max(px, 0.018);
  for (let k = 0; k < nr; k++) {
    const a = (k / nr) * Math.PI * 2;
    c.save();
    c.rotate(a);
    c.translate(0, 0.86);
    c.beginPath();
    const tipo = Math.floor(rnd() * 4);
    if (tipo === 0) {
      c.moveTo(-0.03, -0.035);
      c.lineTo(0, 0.035);
      c.lineTo(0.03, -0.035);
    } else if (tipo === 1) {
      c.moveTo(0, -0.04);
      c.lineTo(0, 0.04);
      c.moveTo(-0.03, 0.01);
      c.lineTo(0.03, 0.01);
    } else if (tipo === 2) {
      c.arc(0, 0, 0.025, 0, Math.PI * 2);
    } else {
      c.moveTo(-0.03, 0.035);
      c.lineTo(0.03, 0.035);
      c.lineTo(-0.03, -0.035);
      c.lineTo(0.03, -0.035);
    }
    c.stroke();
    c.restore();
  }
  // hexagrama
  c.lineWidth = Math.max(px, 0.02);
  for (const off of [0, Math.PI / 3]) {
    c.beginPath();
    for (let k = 0; k <= 3; k++) {
      const a = Math.PI / 2 + off + (k / 3) * Math.PI * 2;
      const x = Math.cos(a) * 0.8;
      const y = Math.sin(a) * 0.8;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  // pontos nos vértices
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + (k / 6) * Math.PI * 2;
    c.beginPath();
    c.arc(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.03, 0, Math.PI * 2);
    c.fill();
  }
}

function decalRachadura(c: CanvasRenderingContext2D, px: number) {
  const rnd = criarAleatorio(13);
  c.strokeStyle = '#ffffff';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const fenda = (x: number, y: number, ang: number, comp: number, larg: number, nivel: number) => {
    const passos = 6;
    let cx = x;
    let cy = y;
    c.beginPath();
    c.moveTo(cx, cy);
    for (let k = 0; k < passos; k++) {
      ang += (rnd() - 0.5) * 0.7;
      cx += (Math.cos(ang) * comp) / passos;
      cy += (Math.sin(ang) * comp) / passos;
      c.lineTo(cx, cy);
      if (nivel > 0 && rnd() < 0.3) {
        c.lineWidth = Math.max(px, larg * (1 - k / passos));
        c.stroke();
        fenda(cx, cy, ang + (rnd() < 0.5 ? 0.8 : -0.8), comp * 0.45, larg * 0.6, nivel - 1);
        c.beginPath();
        c.moveTo(cx, cy);
      }
    }
    c.lineWidth = Math.max(px, larg * 0.5);
    c.stroke();
  };
  for (let k = 0; k < 8; k++) {
    fenda(0, 0, (k / 8) * Math.PI * 2 + rnd() * 0.5, 0.55 + rnd() * 0.35, 0.06, 2);
  }
  const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.4);
  g.addColorStop(0, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, 0.4, 0, Math.PI * 2);
  c.fill();
}

function decalMolhado(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const n = R.fbm(u * 2.2 + 90, v * 2.2 + 33, 4);
  const e = d + (n - 0.5) * 0.5;
  const corpo = suaviza(0.78, 0.6, e);
  const aro = Math.exp(-(((e - 0.66) / 0.05) ** 2));
  s[3] = Math.min(1, corpo * 0.55 + aro * 0.6) * borda(d);
  s[0] = s[1] = s[2] = 0.7 + 0.3 * aro;
}

function decalCratera(u: number, v: number, s: Float32Array) {
  const d = Math.hypot(u, v);
  const ang = Math.atan2(v, u);
  const n = R.fbm(u * 3 + 120, v * 3 + 60, 5);
  const e = d + (n - 0.5) * 0.3;
  const fundo = suaviza(0.5, 0.2, e);
  const borda1 = Math.exp(-(((e - 0.55) / 0.09) ** 2));
  const ejecao =
    Math.pow(R.ruido(((ang + Math.PI) / (Math.PI * 2)) * 14, 5.5, 14), 3) * suaviza(1, 0.55, e);
  s[3] = Math.min(1, fundo * 0.95 + borda1 * 0.8 + ejecao * 0.6 + suaviza(0.95, 0.5, e) * 0.3);
  s[3] *= borda(d);
  s[0] = s[1] = s[2] = 0.2 + borda1 * 0.65 + n * 0.15;
}

function decalSelo(c: CanvasRenderingContext2D, px: number) {
  c.strokeStyle = '#ffffff';
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const aro = (r: number, l: number) => {
    c.lineWidth = Math.max(px, l);
    c.beginPath();
    c.arc(0, 0, r, 0, Math.PI * 2);
    c.stroke();
  };
  aro(0.93, 0.04);
  aro(0.86, 0.012);
  // estrela de 8 pontas
  c.lineWidth = Math.max(px, 0.022);
  for (const off of [0, Math.PI / 4]) {
    c.beginPath();
    for (let k = 0; k <= 4; k++) {
      const a = off + (k / 4) * Math.PI * 2;
      const x = Math.cos(a) * 0.86;
      const y = Math.sin(a) * 0.86;
      if (k === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  aro(0.6, 0.02);
  // raios curtos
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    const r1 = k % 4 === 0 ? 0.5 : 0.55;
    c.lineWidth = Math.max(px, 0.012);
    c.beginPath();
    c.moveTo(Math.cos(a) * 0.6, Math.sin(a) * 0.6);
    c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    c.stroke();
  }
  aro(0.25, 0.03);
}

export function criarAtlasDecais(celula: number): THREE.Texture {
  const S = celula;
  const ctx = novoCanvas(S * GRADE_DECAL.x, S * GRADE_DECAL.y);
  const pos = (q: number): [number, number] => [
    (q % GRADE_DECAL.x) * S,
    Math.floor(q / GRADE_DECAL.x) * S,
  ];
  const px = (q: number, f: Pixel) => {
    const [x, y] = pos(q);
    pintar(ctx, x, y, S, f);
  };
  const vt = (q: number, f: (c: CanvasRenderingContext2D, px: number) => void, brilho = 0) => {
    const [x, y] = pos(q);
    if (brilho > 0) comBrilho(ctx, x, y, S, f, brilho);
    else vetor(ctx, x, y, S, f);
  };
  px(D.QUEIMADO, decalQueimado);
  px(D.GEADA, decalGeada);
  vt(D.GEADA, decalGeadaRamos, 0.01);
  px(D.VENENO, decalVeneno);
  vt(D.CIRCULO, decalCirculo, 0.012);
  vt(D.RACHADURA, decalRachadura);
  px(D.MOLHADO, decalMolhado);
  px(D.CRATERA, decalCratera);
  vt(D.SELO, decalSelo, 0.012);
  const t = new THREE.CanvasTexture(ctx.canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

// ------------------------------------------------------------------ ruído p/ shaders

/** Ruído periódico 128×128: R e G = fbm em escalas diferentes, B = cristas, A = fino. */
export function criarTexturaRuido(): THREE.DataTexture {
  const N = 128;
  const dados = new Uint8Array(N * N * 4);
  const r2 = criarRuido(99);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const a = R.fbm(u * 4, v * 4, 5, 4);
      const b = r2.fbm(u * 8, v * 8, 4, 8);
      const c = 1 - Math.abs(r2.fbm(u * 6 + 0.5, v * 6 + 0.5, 4, 6) * 2 - 1);
      const d = R.ruido(u * 32, v * 32, 32);
      const i = (y * N + x) * 4;
      dados[i] = Math.round(a * 255);
      dados[i + 1] = Math.round(b * 255);
      dados[i + 2] = Math.round(c * c * 255);
      dados[i + 3] = Math.round(d * 255);
    }
  }
  const t = new THREE.DataTexture(dados, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
