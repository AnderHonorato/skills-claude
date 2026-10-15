/**
 * Planos procedurais em UM draw call (quads instanciados): ondas de choque e novas
 * com estilo por elemento, decalques de chão (queimado, geada, veneno, runas...),
 * poças borbulhantes, disco de acreção e núcleo do buraco negro, auras, luz no chão,
 * raios de luz, redemoinho de poeira e o círculo de aviso dos meteoros.
 *
 * Cada instância escolhe o estilo; o shader ramifica por instância (coerente na
 * GPU). Planos de chão ficam a poucos centímetros do solo com polygonOffset.
 */
import * as THREE from 'three';
import { GRADE_DECAL } from './texturas';
import { aplicarMisturaPremultiplicada, corLinear, GLSL_SAIDA, realce, type CorFx } from './util';

export const ESTILO_PLANO = {
  ANEL: 0,
  ANEL_FOGO: 1,
  ANEL_GELO: 2,
  ANEL_SOM: 3,
  ANEL_AGUA: 4,
  ANEL_RUNICO: 5,
  ANEL_RAIO: 6,
  DECAL: 7,
  POCA: 8,
  ACRECAO: 9,
  NUCLEO: 10,
  AURA: 11,
  LUZ_CHAO: 12,
  RAIOS_LUZ: 13,
  VORTICE: 14,
  ANEL_SOMBRA: 15,
  ALVO: 16,
  /** Anel feito de pixels que piscam (tema código). */
  ANEL_DIGITAL: 17,
  /** Varredura para dentro do coletor de lixo (frente vai de fora ao centro). */
  VARREDURA: 18,
  /** Campo congelado do breakpoint: disco azul com linhas de varredura e hexágonos. */
  CONGELAR: 19,
  /** Marcador de breakpoint: bolinha vermelha com aro branco. */
  MARCADOR: 20,
  /** Grade hexagonal (disco ou anel, se param < 1). */
  GRADE_HEX: 21,
} as const;

export interface Plano {
  estilo: number;
  x: number;
  y?: number;
  z: number;
  /** Raio inicial e final (m). */
  raio: number;
  raioFim?: number;
  /** Duração (s). Planos de um quadro só ignoram. */
  vida?: number;
  cor: CorFx;
  cor2?: CorFx;
  brilho?: number;
  alfa?: number;
  aditivo?: number;
  /** Espessura do anel (fração do raio) ou quadro do decalque. */
  param?: number;
  /** Setor: direção central (rad, mesma convenção do jogo: x=cos, z=sin) e meia abertura. */
  direcao?: number;
  abertura?: number;
  rot?: number;
  giro?: number;
  /** 0 = deitado no chão, 1 = virado para a câmera. */
  modo?: number;
  /** Fração da vida para surgir. */
  entrada?: number;
  /** Expoente do desvanecer. */
  curva?: number;
  /** Expoente da expansão (maior = explode rápido e desacelera). */
  expansao?: number;
  /** Camada de desenho: 0 decalques/poças, 1 ondas/luzes, 2 objetos em pé. */
  camada?: number;
}

interface PlanoVivo {
  p: Plano;
  idade: number;
  total: number;
  sem: number;
  rot: number;
  /** Força de "estar ativo" para planos contínuos (poças, auras): 0..1 */
  forca: number;
  id: string | number | null;
  toque: number;
}

const VERT = /* glsl */ `
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
attribute vec4 iD;
attribute vec4 iE;
varying vec2 vP;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
void main() {
  vec2 c = position.xy * 2.0;
  float R = iA.w;
  vec4 mv;
  if (iE.w < 0.5) {
    mv = modelViewMatrix * vec4(iA.x + c.x * R, iA.y, iA.z - c.y * R, 1.0);
  } else {
    mv = modelViewMatrix * vec4(iA.xyz, 1.0);
    mv.xy += c * R;
  }
  gl_Position = projectionMatrix * mv;
  vP = c;
  vB = iB;
  vC = iC;
  vD = iD;
  vE = iE;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uRuido;
uniform sampler2D uDecal;
uniform vec2 uGradeDecal;
uniform float uTempo;
varying vec2 vP;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
#define TAU 6.2831853
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 uv) { return texture2D(uRuido, uv).r; }
float distHex(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
/** xy = posição na célula, z = distância até a borda do hexágono, w = id sorteado. */
vec4 hexagono(vec2 uv) {
  vec2 rr = vec2(1.0, 1.7320508);
  vec2 hh = rr * 0.5;
  vec2 a = mod(uv, rr) - hh;
  vec2 b = mod(uv - hh, rr) - hh;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  return vec4(gv, 0.5 - distHex(gv), hash(floor((uv - gv) * 10.0 + 0.5)));
}
void main() {
  int estilo = int(vD.x + 0.5);
  float prog = vD.y;
  float rot = vD.z;
  float param = vD.w;
  float sem = vE.z;
  vec2 p = vP;
  float r = length(p);
  if (r > 1.0) discard;
  float ang = atan(p.y, p.x);
  vec3 cor = vB.rgb;
  vec3 cor2 = vC.rgb;
  float alfa = vB.a;
  float aditivoFinal = vC.a;
  vec3 corFinal = cor;
  float alfaFinal = 0.0;
  // setor (cones)
  float setor = 1.0;
  if (vE.y < 3.1) {
    float da = abs(mod(ang - vE.x + 3.14159265, TAU) - 3.14159265);
    setor = smoothstep(vE.y, vE.y - 0.35, da);
  }
  vec2 polar = vec2(ang / TAU, r);
  float esp = max(param, 0.02);
  float x = (r - (1.0 - esp)) / esp;
  if (estilo == 0) {
    float n = texture2D(uRuido, vec2(polar.x * 3.0 + sem, r * 0.6 - uTempo * 0.3)).g;
    float xx = x + (n - 0.5) * 0.5;
    float banda = smoothstep(-0.1, 0.8, xx) * smoothstep(1.0, 0.86, xx);
    float quente = pow(banda, 3.0);
    corFinal = mix(cor2, cor, smoothstep(0.0, 0.9, xx)) + vec3(quente * 0.6);
    alfaFinal = banda * alfa * setor;
  } else if (estilo == 1) {
    float n = texture2D(uRuido, vec2(polar.x * 5.0 + sem, r * 1.3 - uTempo * 1.1)).r;
    float n2 = texture2D(uRuido, vec2(polar.x * 11.0 - sem, r * 2.5 - uTempo * 2.3)).g;
    float xx = x + (n - 0.5) * 0.9 + (n2 - 0.5) * 0.4;
    float banda = smoothstep(-0.2, 0.75, xx) * smoothstep(1.05, 0.8, xx);
    float calor = banda * (0.6 + 0.6 * n2);
    vec3 fumo = vec3(0.12, 0.06, 0.04);
    corFinal = mix(fumo, cor2, smoothstep(0.05, 0.4, calor));
    corFinal = mix(corFinal, cor, smoothstep(0.35, 0.7, calor));
    corFinal = mix(corFinal, vec3(2.4, 2.1, 1.3), smoothstep(0.75, 1.0, calor));
    alfaFinal = smoothstep(0.02, 0.25, banda) * alfa * setor;
    aditivoFinal = smoothstep(0.25, 0.7, calor) * vC.a;
  } else if (estilo == 2) {
    float n = texture2D(uRuido, vec2(polar.x * 4.0 + sem, 0.3)).b;
    float pontas = abs(fract(polar.x * 34.0 + sem) - 0.5) * 2.0;
    float borda = 1.0 - (0.06 + 0.14 * n) * pontas;
    float bx = (r - (borda - esp)) / esp;
    float banda = smoothstep(0.0, 0.85, bx) * step(r, borda);
    float frente = smoothstep(0.55, 1.0, bx) * step(r, borda);
    float geada = smoothstep(borda - esp * 0.2, 0.0, r) * 0.14;
    float fio = texture2D(uRuido, p * 0.6 + sem).b;
    geada *= 0.4 + 1.2 * smoothstep(0.55, 0.9, fio);
    corFinal = mix(cor2, cor, banda) + vec3(frente * 1.2);
    alfaFinal = clamp(banda * 0.85 + geada, 0.0, 1.0) * alfa * setor;
    aditivoFinal = mix(0.25, 1.0, frente) * vC.a;
  } else if (estilo == 3) {
    float onda = sin(ang * 9.0 + uTempo * 14.0 + sem) * 0.008;
    float rr = r + onda;
    float a = 0.0;
    for (int i = 0; i < 3; i++) {
      float ri = 0.95 - float(i) * esp * 0.42;
      float w = 0.03 + float(i) * 0.008;
      a += exp(-pow((rr - ri) / w, 2.0)) * (1.0 - float(i) * 0.28);
    }
    corFinal = mix(cor2, cor, smoothstep(0.6, 0.95, rr)) * (1.0 + a * 0.4);
    alfaFinal = clamp(a, 0.0, 1.0) * alfa * setor;
  } else if (estilo == 4) {
    float n = texture2D(uRuido, vec2(polar.x * 6.0 + sem, r * 1.6 - uTempo * 0.9)).r;
    float n2 = texture2D(uRuido, vec2(polar.x * 15.0 + sem, r * 3.0 - uTempo * 1.7)).g;
    float xx = x + (n - 0.5) * 0.35;
    float corpo = smoothstep(-0.3, 0.5, xx) * smoothstep(1.0, 0.82, xx);
    float espuma = smoothstep(0.55, 0.85, xx + (n2 - 0.5) * 0.6) * smoothstep(1.0, 0.86, xx);
    float rastro = smoothstep(-1.5, 0.0, xx) * step(xx, 0.0) * 0.25 * n2;
    corFinal = mix(cor, cor2 * 1.5, espuma);
    alfaFinal = clamp(corpo * 0.7 + espuma * 0.8 + rastro, 0.0, 1.0) * alfa * setor;
    aditivoFinal = mix(0.15, 0.9, espuma) * vC.a;
  } else if (estilo == 5) {
    float giro = polar.x + rot / TAU;
    float traco = step(0.35, fract(giro * 28.0));
    float n = texture2D(uRuido, vec2(giro * 7.0, 0.5)).b;
    float linhaFora = exp(-pow((r - 0.97) / 0.012, 2.0));
    float linhaDentro = exp(-pow((r - (1.0 - esp)) / 0.012, 2.0));
    float banda = step(1.0 - esp + 0.03, r) * step(r, 0.94) * traco * smoothstep(0.3, 0.7, n);
    float halo = exp(-pow((r - (1.0 - esp * 0.5)) / (esp * 0.6), 2.0)) * 0.35;
    float a = linhaFora + linhaDentro * 0.7 + banda * 0.9 + halo;
    corFinal = mix(cor2, cor, banda + linhaFora) + vec3(linhaFora * 0.6);
    alfaFinal = clamp(a, 0.0, 1.0) * alfa * setor;
  } else if (estilo == 6) {
    float j = texture2D(uRuido, vec2(polar.x * 9.0 + floor(uTempo * 24.0) * 0.137, sem)).r;
    float rr = r + (j - 0.5) * 0.12;
    float fio = exp(-pow((rr - 0.94) / 0.018, 2.0));
    float halo = exp(-pow((rr - 0.92) / 0.09, 2.0)) * 0.5;
    corFinal = cor * (halo * 1.5 + 0.5) + vec3(1.8) * fio;
    alfaFinal = clamp(fio + halo, 0.0, 1.0) * alfa * setor;
  } else if (estilo == 7) {
    float c = cos(rot);
    float s = sin(rot);
    vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    vec2 uv = q * 0.5 + 0.5;
    float qd = param;
    vec2 cel = vec2(mod(qd, uGradeDecal.x), uGradeDecal.y - 1.0 - floor(qd / uGradeDecal.x));
    vec4 t = texture2D(uDecal, (cel + clamp(uv, 0.004, 0.996)) / uGradeDecal);
    corFinal = cor * t.rgb;
    alfaFinal = t.a * alfa;
  } else if (estilo == 8) {
    vec2 q = p * 0.5;
    float n = texture2D(uRuido, q * 0.6 + vec2(uTempo * 0.02, sem)).r;
    float e = r + (n - 0.5) * 0.32;
    float corpo = smoothstep(0.9, 0.8, e);
    float menisco = smoothstep(0.55, 0.86, e) * corpo;
    float c1 = texture2D(uRuido, q * 0.9 + vec2(uTempo * 0.05, -uTempo * 0.04) + sem).g;
    float c2 = texture2D(uRuido, q * 1.4 - vec2(uTempo * 0.06, uTempo * 0.03)).g;
    float veios = pow(1.0 - abs(c1 + c2 - 1.0), 10.0) * corpo;
    // bolhas: uma por célula, crescem e estouram
    vec2 g = p * 3.2 + sem * 7.0;
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash(id);
    vec2 centro = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.5;
    float fase = fract(uTempo * (0.35 + h * 0.4) + h * 10.0);
    float rb = 0.08 + 0.2 * fase;
    float db = length(f - centro);
    float bolha = exp(-pow((db - rb) / 0.035, 2.0)) * (1.0 - fase) * step(0.35, h) * corpo;
    corFinal = cor * (0.7 + 0.35 * n) + cor2 * (veios * 1.0 + bolha * 1.6 + menisco * 0.45);
    alfaFinal = clamp(corpo * 0.82 + bolha, 0.0, 1.0) * alfa;
    aditivoFinal = clamp(veios * 0.8 + bolha, 0.0, 1.0) * vC.a;
  } else if (estilo == 9) {
    float giro = ang + 2.4 / (r + 0.15) - uTempo * 2.6;
    float n = texture2D(uRuido, vec2(giro / TAU * 3.0 + sem, r * 1.5 - uTempo * 0.2)).r;
    float bracos = pow(0.5 + 0.5 * sin(giro * 3.0 + n * 5.0), 2.0);
    float disco = smoothstep(0.26, 0.36, r) * smoothstep(1.0, 0.55, r);
    float calor = pow(smoothstep(1.0, 0.3, r), 1.6);
    float doppler = 1.0 + 0.55 * cos(ang - 0.9);
    float br = disco * (0.35 + 0.65 * bracos) * (0.5 + n) * doppler;
    corFinal = mix(cor, cor2 * 1.8, calor) * (0.6 + br);
    alfaFinal = clamp(br, 0.0, 1.0) * alfa;
    float buraco = smoothstep(0.34, 0.26, r);
    corFinal = mix(corFinal, vec3(0.0), buraco);
    alfaFinal = max(alfaFinal, buraco * alfa);
    aditivoFinal = (1.0 - buraco) * vC.a;
  } else if (estilo == 10) {
    float n = texture2D(uRuido, vec2(polar.x * 4.0 - uTempo * 0.4, r * 0.8 + sem)).g;
    float horizonte = smoothstep(0.47, 0.44, r);
    float foton = exp(-pow((r - 0.48) / 0.022, 2.0));
    float lente = exp(-pow((r - 0.56 - (n - 0.5) * 0.05) / 0.07, 2.0)) * 0.55;
    float halo = smoothstep(1.0, 0.45, r) * 0.25 * (0.5 + n);
    corFinal = cor2 * (foton * 2.4 + lente * 1.4) + cor * halo;
    alfaFinal = clamp(horizonte + foton + lente + halo, 0.0, 1.0) * alfa;
    corFinal = mix(corFinal, vec3(0.0), horizonte);
    aditivoFinal = (1.0 - horizonte) * vC.a;
  } else if (estilo == 11) {
    float n = texture2D(uRuido, vec2(polar.x * 5.0 + uTempo * 0.05, r * 0.7 - uTempo * 0.25)).g;
    float aro = exp(-pow((r - 0.95) / 0.03, 2.0));
    float aro2 = exp(-pow((r - 0.86) / 0.012, 2.0)) * 0.6;
    float raios = pow(0.5 + 0.5 * cos(ang * 12.0 + rot), 10.0) * smoothstep(1.0, 0.2, r) * 0.45;
    float campo = smoothstep(1.0, 0.0, r) * 0.18 * (0.6 + 0.8 * n);
    corFinal = mix(cor2, cor, aro + aro2) * (1.0 + aro * 0.6);
    alfaFinal = clamp(aro + aro2 + raios + campo, 0.0, 1.0) * alfa;
  } else if (estilo == 12) {
    float a = exp(-r * r * 4.5) * smoothstep(1.0, 0.8, r);
    corFinal = cor;
    alfaFinal = a * alfa;
  } else if (estilo == 13) {
    float giro = ang + rot;
    float n = texture2D(uRuido, vec2(giro / TAU * 6.0 + sem, 0.5)).r;
    float raios = pow(0.5 + 0.5 * cos(giro * 18.0), 14.0);
    float comp = 0.45 + 0.55 * n;
    float a = raios * smoothstep(comp, 0.0, r) + exp(-r * r * 30.0);
    corFinal = mix(cor2, cor, smoothstep(0.6, 0.0, r));
    alfaFinal = clamp(a, 0.0, 1.0) * alfa;
  } else if (estilo == 14) {
    float s = fract(polar.x * 3.0 + r * 1.6 - uTempo * 1.3 + sem);
    float n = texture2D(uRuido, vec2(polar.x * 4.0, r - uTempo * 0.4)).g;
    float bracos = smoothstep(0.5, 0.0, abs(s - 0.5)) * (0.5 + n);
    float a = bracos * smoothstep(1.0, 0.4, r) * smoothstep(0.1, 0.35, r);
    corFinal = mix(cor2, cor, n);
    alfaFinal = clamp(a, 0.0, 1.0) * alfa;
  } else if (estilo == 15) {
    float n = texture2D(uRuido, vec2(polar.x * 5.0 + sem, r - uTempo * 0.6)).g;
    float xx = x + (n - 0.5) * 0.4;
    float banda = smoothstep(-0.2, 0.6, xx) * smoothstep(1.0, 0.85, xx);
    float borda = exp(-pow((xx - 0.05) / 0.12, 2.0));
    corFinal = mix(vec3(0.04, 0.0, 0.09), cor * 2.0, borda);
    alfaFinal = clamp(banda * 0.75 + borda * 0.8, 0.0, 1.0) * alfa * setor;
    aditivoFinal = borda * vC.a;
  } else if (estilo == 17) {
    vec2 g = vec2(polar.x * 90.0, r * 22.0);
    vec2 f = fract(g);
    float h = hash(floor(g) + floor(uTempo * 14.0) * 0.731 + sem);
    float quad = step(0.14, f.x) * step(f.x, 0.86) * step(0.14, f.y) * step(f.y, 0.86);
    float banda = smoothstep(-0.15, 0.6, x) * step(x, 1.0);
    float frente = smoothstep(0.7, 0.95, x) * step(x, 1.0);
    float liga = step(0.42, h) * banda;
    corFinal = mix(cor2, cor, x) + vec3(frente * 0.5);
    alfaFinal = clamp(quad * (liga * 0.85 + frente), 0.0, 1.0) * alfa * setor;
  } else if (estilo == 18) {
    float R = 1.0 - prog * 0.97;
    float d = r - R;
    float frente = exp(-pow(d / 0.03, 2.0));
    float riscos = pow(0.5 + 0.5 * cos(ang * 36.0 + sem), 6.0);
    float n = texture2D(uRuido, vec2(polar.x * 6.0, r * 2.0 + uTempo)).g;
    float cauda = step(0.0, d) * exp(-d * 5.0) * (0.25 + 0.75 * riscos) * (0.5 + n) * 0.6;
    corFinal = mix(cor2, cor, frente) + vec3(frente * 0.6);
    alfaFinal = clamp(frente + cauda, 0.0, 1.0) * alfa;
  } else if (estilo == 19) {
    vec4 hx = hexagono(p * 5.0);
    float borda = smoothstep(0.06, 0.0, hx.z) * 0.3;
    float linha = fract(p.y * 9.0 - uTempo * 1.2);
    float scan = smoothstep(0.0, 0.06, linha) * smoothstep(0.22, 0.06, linha) * 0.45;
    float aro = exp(-pow((r - 0.95) / 0.03, 2.0));
    float fundo = 0.2 + 0.1 * sin(uTempo * 6.0);
    corFinal = mix(cor2, cor, aro + scan) + vec3(aro * 0.5);
    alfaFinal = clamp(fundo + scan + borda + aro, 0.0, 1.0) * alfa;
    aditivoFinal = vC.a * clamp(scan * 2.0 + aro + borda, 0.0, 1.0);
  } else if (estilo == 20) {
    float pulso = 0.5 + 0.5 * sin(uTempo * 9.0);
    float disco = smoothstep(0.62, 0.58, r);
    float aro = exp(-pow((r - 0.72) / 0.05, 2.0));
    float halo = smoothstep(1.0, 0.6, r) * (0.25 + 0.25 * pulso);
    float brilho = exp(-pow(length(p - vec2(-0.2, 0.2)) / 0.14, 2.0)) * disco;
    corFinal = cor * (0.75 + 0.35 * smoothstep(0.6, 0.0, r)) + cor2 * (aro + brilho);
    alfaFinal = clamp(disco + aro + halo, 0.0, 1.0) * alfa;
    aditivoFinal = vC.a * clamp(halo * 2.0 + aro * 0.5, 0.0, 1.0);
  } else if (estilo == 21) {
    vec4 hx = hexagono(p * 6.0 + vec2(0.0, uTempo * 0.15));
    float aresta = smoothstep(0.07, 0.0, hx.z);
    float acende = step(0.7, fract(hx.w + uTempo * 0.6)) * 0.35;
    float mascara = param < 0.99 ? smoothstep(-0.1, 0.4, x) * smoothstep(1.0, 0.85, x) : smoothstep(1.0, 0.9, r);
    corFinal = mix(cor2, cor, aresta) + vec3(aresta * 0.3);
    alfaFinal = clamp(aresta * 0.9 + acende + 0.08, 0.0, 1.0) * mascara * alfa;
  } else {
    float pulso = 0.5 + 0.5 * sin(uTempo * 14.0);
    float aro = exp(-pow((r - 0.95) / 0.035, 2.0));
    float dentro = fract(r * 1.0 + prog * 3.0);
    float anelInterno = exp(-pow((dentro - 0.5) / 0.05, 2.0)) * 0.4 * step(r, 0.95);
    float preenche = smoothstep(1.0, 0.0, r) * (0.18 + 0.12 * pulso) + smoothstep(prog, prog - 0.05, r) * 0.18;
    corFinal = mix(cor2, cor, aro);
    alfaFinal = clamp(aro + anelInterno + preenche, 0.0, 1.0) * alfa;
  }
  alfaFinal *= smoothstep(1.0, 0.97, r);
  if (alfaFinal < 0.004) discard;
  ${GLSL_SAIDA}
}`;

export class Planos {
  readonly malha: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private attrs: THREE.InstancedBufferAttribute[] = [];
  private vivos: PlanoVivo[] = [];
  private agora: Plano[] = [];
  private continuos = new Map<string | number, PlanoVivo>();
  readonly uniformes: {
    uRuido: { value: THREE.Texture };
    uDecal: { value: THREE.Texture };
    uGradeDecal: { value: THREE.Vector2 };
    uTempo: { value: number };
  };

  constructor(
    readonly capacidade: number,
    ruido: THREE.Texture,
    decal: THREE.Texture
  ) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    for (const nome of ['iA', 'iB', 'iC', 'iD', 'iE']) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacidade * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(nome, a);
      this.attrs.push(a);
    }
    this.geo.instanceCount = 0;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniformes = {
      uRuido: { value: ruido },
      uDecal: { value: decal },
      uGradeDecal: { value: new THREE.Vector2(GRADE_DECAL.x, GRADE_DECAL.y) },
      uTempo: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniformes,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    aplicarMisturaPremultiplicada(mat);
    this.malha = new THREE.Mesh(this.geo, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 20;
  }

  /** Plano com vida própria (expande e some sozinho). */
  criar(p: Plano): void {
    if (this.vivos.length >= this.capacidade) this.vivos.shift();
    this.vivos.push({
      p,
      idade: 0,
      total: p.vida ?? 1,
      sem: Math.random() * 10,
      rot: p.rot ?? Math.random() * Math.PI * 2,
      forca: 1,
      id: null,
      toque: 0,
    });
  }

  /** Plano desenhado só neste quadro. */
  desenharAgora(p: Plano): void {
    this.agora.push(p);
  }

  /**
   * Plano contínuo identificado por id (poça, aura, disco): surge suave, segue
   * existindo enquanto for tocado e some sozinho quando deixam de chamar.
   */
  manter(id: string | number, p: Plano, tempo: number): void {
    let v = this.continuos.get(id);
    if (!v) {
      v = {
        p,
        idade: 0,
        total: 1,
        sem: Math.random() * 10,
        rot: p.rot ?? 0,
        forca: 0,
        id,
        toque: tempo,
      };
      this.continuos.set(id, v);
    }
    v.p = p;
    v.toque = tempo;
  }

  atualizar(dt: number, tempo: number, folga: number): void {
    this.uniformes.uTempo.value = tempo % 1000;
    const A = this.attrs.map((a) => a.array as Float32Array);
    let n = 0;
    const escrever = (
      p: Plano,
      prog: number,
      raio: number,
      alfa: number,
      sem: number,
      rot: number
    ) => {
      if (n >= this.capacidade) return;
      const cor = corLinear(p.cor);
      const cor2 = corLinear(p.cor2 ?? p.cor);
      const b = realce(p.brilho ?? 1);
      const k = n * 4;
      A[0][k] = p.x;
      A[0][k + 1] = p.y ?? (p.camada === 0 ? 0.025 : 0.06);
      A[0][k + 2] = p.z;
      A[0][k + 3] = raio;
      A[1][k] = cor.r * b;
      A[1][k + 1] = cor.g * b;
      A[1][k + 2] = cor.b * b;
      A[1][k + 3] = alfa;
      A[2][k] = cor2.r * b;
      A[2][k + 1] = cor2.g * b;
      A[2][k + 2] = cor2.b * b;
      A[2][k + 3] = p.aditivo ?? 1;
      A[3][k] = p.estilo;
      A[3][k + 1] = prog;
      A[3][k + 2] = rot;
      A[3][k + 3] = p.param ?? 0.25;
      A[4][k] = -(p.direcao ?? 0);
      A[4][k + 1] = p.abertura ?? 10;
      A[4][k + 2] = sem;
      A[4][k + 3] = p.modo ?? 0;
      n++;
    };
    // envelhece
    for (let i = this.vivos.length - 1; i >= 0; i--) {
      const v = this.vivos[i];
      v.idade += dt;
      v.rot += (v.p.giro ?? 0) * dt;
      if (v.idade >= v.total) this.vivos.splice(i, 1);
    }
    for (const [id, v] of this.continuos) {
      const ativo = tempo - v.toque <= folga;
      v.forca = Math.max(0, Math.min(1, v.forca + (ativo ? dt * 4 : -dt * 2.5)));
      v.rot += (v.p.giro ?? 0) * dt;
      v.idade += dt;
      if (!ativo && v.forca <= 0) this.continuos.delete(id);
    }
    for (let camada = 0; camada <= 2; camada++) {
      for (const v of this.vivos) {
        const p = v.p;
        if ((p.camada ?? 1) !== camada) continue;
        const t = Math.min(1, v.idade / v.total);
        const e = 1 - Math.pow(1 - t, p.expansao ?? 2.5);
        const raio = p.raio + ((p.raioFim ?? p.raio) - p.raio) * e;
        const ent = p.entrada ?? 0.05;
        const fIn = ent > 0 ? Math.min(1, t / ent) : 1;
        const alfa = (p.alfa ?? 1) * fIn * Math.pow(1 - t, p.curva ?? 1);
        escrever(p, t, raio, alfa, v.sem, v.rot);
      }
      for (const v of this.continuos.values()) {
        const p = v.p;
        if ((p.camada ?? 1) !== camada) continue;
        const f = v.forca;
        const ease = 1 - Math.pow(1 - f, 3);
        escrever(p, v.idade, p.raio * (0.35 + 0.65 * ease), (p.alfa ?? 1) * f, v.sem, v.rot);
      }
      for (const p of this.agora) {
        if ((p.camada ?? 1) !== camada) continue;
        escrever(p, 0, p.raio, p.alfa ?? 1, 0, p.rot ?? 0);
      }
    }
    this.agora.length = 0;
    this.geo.instanceCount = n;
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(4, n * 4));
      a.needsUpdate = true;
    }
  }

  limpar(): void {
    this.vivos.length = 0;
    this.agora.length = 0;
    this.continuos.clear();
  }

  descartar(): void {
    this.geo.dispose();
    (this.malha.material as THREE.Material).dispose();
  }
}
