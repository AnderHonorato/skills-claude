/**
 * Volumes em UM draw call: cilindros abertos instanciados que o shader deforma em
 * funil de tornado (com faixas de vento girando e torção) ou em pilar de luz
 * (subir de nível, evolução) ou em muralha de fogo hexagonal (firewall). Opacos na silhueta e claros no meio, para parecerem
 * volumes de ar/luz e não tubos.
 */
import * as THREE from 'three';
import { aplicarMisturaPremultiplicada, corLinear, GLSL_SAIDA, realce, type CorFx } from './util';

export const ESTILO_VOLUME = { TORNADO: 0, PILAR: 1, FIREWALL: 2 } as const;

export interface Volume {
  estilo: number;
  x: number;
  y?: number;
  z: number;
  altura: number;
  raioBase: number;
  raioTopo: number;
  cor: CorFx;
  cor2?: CorFx;
  brilho?: number;
  alfa?: number;
  aditivo?: number;
  /** Velocidade de giro (voltas/s). */
  giro?: number;
}

interface VolumeVivo {
  v: Volume;
  forca: number;
  toque: number;
  sem: number;
  idade: number;
  /** Para volumes com vida fixa (pilares): duração total; 0 = contínuo. */
  total: number;
}

const VERT = /* glsl */ `
attribute vec4 iA;
attribute vec4 iB;
attribute vec4 iC;
attribute vec4 iD;
attribute vec4 iE;
uniform float uTempo;
varying vec2 vUv;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
varying float vBorda;
varying vec2 vEscala;
void main() {
  float y = position.y + 0.5;
  float estilo = iD.x;
  float rb = iD.y;
  float rt = iD.z;
  float sem = iD.w;
  float raio;
  vec3 desloc = vec3(0.0);
  if (estilo < 0.5) {
    raio = mix(rb, rt, pow(y, 1.35));
    float t = uTempo * 1.7 + sem;
    desloc.x = sin(y * 3.1 + t) * 0.28 * y * rt;
    desloc.z = cos(y * 2.3 + t * 1.3) * 0.22 * y * rt;
  } else if (estilo < 1.5) {
    raio = mix(rb, rt, y) * (1.0 + 0.08 * sin(y * 12.0 - uTempo * 6.0));
  } else {
    raio = rb;
  }
  vEscala = vec2(6.2831853 * rb / 0.42, iA.w / 0.42);
  vec3 dirR = normalize(vec3(position.x, 0.0, position.z));
  vec3 p = vec3(iA.x, iA.y, iA.z) + dirR * raio + vec3(0.0, y * iA.w, 0.0) + desloc;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec3 n = normalize((modelViewMatrix * vec4(dirR, 0.0)).xyz);
  vec3 v = normalize(-mv.xyz);
  vBorda = 1.0 - abs(dot(n, v));
  gl_Position = projectionMatrix * mv;
  vUv = vec2(uv.x, y);
  vB = iB;
  vC = iC;
  vD = iD;
  vE = iE;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uRuido;
uniform float uTempo;
varying vec2 vUv;
varying vec4 vB;
varying vec4 vC;
varying vec4 vD;
varying vec4 vE;
varying float vBorda;
varying vec2 vEscala;
float distHex(vec2 p) { p = abs(p); return max(dot(p, vec2(0.5, 0.8660254)), p.x); }
void main() {
  float y = vUv.y;
  float giro = vE.x;
  float sem = vD.w;
  vec3 corFinal;
  float alfaFinal;
  float aditivoFinal = vC.a;
  if (vD.x < 0.5) {
    float u = vUv.x * 3.0 + y * 1.6 - uTempo * giro;
    float n = texture2D(uRuido, vec2(u, y * 1.4 - uTempo * 0.6 + sem)).r;
    float n2 = texture2D(uRuido, vec2(u * 2.0 + 0.3, y * 3.0 - uTempo * 1.1)).g;
    float faixas = smoothstep(0.42, 0.75, n * 0.7 + n2 * 0.5);
    float corpo = (0.22 + 0.78 * pow(vBorda, 1.5)) * (0.35 + 0.65 * faixas);
    float fade = smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.72, y);
    corFinal = mix(vC.rgb, vB.rgb, faixas);
    alfaFinal = clamp(corpo, 0.0, 1.0) * fade * vB.a;
    aditivoFinal = vC.a * faixas;
  } else if (vD.x > 1.5) {
    // firewall: segmentos de muralha com grade hexagonal em chamas
    vec2 uv = vec2(vUv.x * floor(vEscala.x), y * vEscala.y);
    vec2 rr = vec2(1.0, 1.7320508);
    vec2 a = mod(uv, rr) - rr * 0.5;
    vec2 b = mod(uv - rr * 0.5, rr) - rr * 0.5;
    vec2 gv = dot(a, a) < dot(b, b) ? a : b;
    float aresta = smoothstep(0.09, 0.0, 0.5 - distHex(gv));
    float n = texture2D(uRuido, vec2(vUv.x * 4.0, y * 0.9 - uTempo * 1.3 + sem)).r;
    float n2 = texture2D(uRuido, vec2(vUv.x * 9.0, y * 2.0 - uTempo * 2.6)).g;
    float segs = 10.0;
    float sv = fract(vUv.x * segs);
    float vao = smoothstep(0.0, 0.035, sv) * smoothstep(1.0, 0.965, sv);
    float topo = smoothstep(1.0, 0.45, y + (n - 0.5) * 0.45 + (n2 - 0.5) * 0.2);
    float calor = (1.0 - y) * (0.6 + 0.6 * n);
    vec3 fundo = mix(vC.rgb, vB.rgb, calor);
    corFinal = fundo + vec3(1.0, 0.7, 0.25) * aresta * (0.8 + 0.6 * n2) * 1.2;
    alfaFinal = clamp((0.35 + 0.4 * calor) + aresta * 0.9, 0.0, 1.0) * topo * vao * vB.a;
    aditivoFinal = vC.a * (0.4 + 0.6 * aresta);
  } else {
    float n = texture2D(uRuido, vec2(vUv.x * 2.0, y * 0.8 - uTempo * 1.4 + sem)).g;
    float miolo = pow(1.0 - vBorda, 1.6);
    float fade = pow(1.0 - y, 1.3) * smoothstep(0.0, 0.05, y);
    corFinal = mix(vC.rgb, vB.rgb * 1.6, miolo) * (0.7 + 0.6 * n);
    alfaFinal = clamp((miolo * 0.9 + 0.15) * (0.6 + 0.6 * n), 0.0, 1.0) * fade * vB.a;
  }
  if (alfaFinal < 0.004) discard;
  ${GLSL_SAIDA}
}`;

export class Volumes {
  readonly malha: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private attrs: THREE.InstancedBufferAttribute[] = [];
  private mapa = new Map<string | number, VolumeVivo>();
  private seq = 0;
  readonly uniformes: { uRuido: { value: THREE.Texture }; uTempo: { value: number } };

  constructor(
    readonly capacidade: number,
    ruido: THREE.Texture,
    segmentos: number
  ) {
    const base = new THREE.CylinderGeometry(1, 1, 1, segmentos, 10, true);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    this.geo.setAttribute('uv', base.getAttribute('uv'));
    for (const nome of ['iA', 'iB', 'iC', 'iD', 'iE']) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacidade * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      this.geo.setAttribute(nome, a);
      this.attrs.push(a);
    }
    this.geo.instanceCount = 0;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.uniformes = { uRuido: { value: ruido }, uTempo: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniformes,
      side: THREE.DoubleSide,
    });
    aplicarMisturaPremultiplicada(mat);
    this.malha = new THREE.Mesh(this.geo, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 25;
  }

  /** Volume contínuo: existe enquanto for tocado (some suave depois). */
  manter(id: string | number, v: Volume, tempo: number): void {
    let e = this.mapa.get(id);
    if (!e) {
      e = { v, forca: 0, toque: tempo, sem: Math.random() * 10, idade: 0, total: 0 };
      this.mapa.set(id, e);
    }
    e.v = v;
    e.toque = tempo;
  }

  /** Volume com duração fixa (sobe, brilha e some). */
  criar(v: Volume, duracao: number): void {
    this.mapa.set(`__v${this.seq++}`, {
      v,
      forca: 0,
      toque: 0,
      sem: Math.random() * 10,
      idade: 0,
      total: duracao,
    });
  }

  atualizar(dt: number, tempo: number, folga: number): void {
    this.uniformes.uTempo.value = tempo % 1000;
    let n = 0;
    const A = this.attrs.map((a) => a.array as Float32Array);
    for (const [id, e] of this.mapa) {
      e.idade += dt;
      let f: number;
      if (e.total > 0) {
        const t = e.idade / e.total;
        if (t >= 1) {
          this.mapa.delete(id);
          continue;
        }
        f = Math.min(1, t / 0.12) * Math.pow(1 - t, 0.8);
      } else {
        const ativo = tempo - e.toque <= folga;
        e.forca = Math.max(0, Math.min(1, e.forca + (ativo ? dt * 3 : -dt * 2)));
        if (!ativo && e.forca <= 0) {
          this.mapa.delete(id);
          continue;
        }
        f = e.forca;
      }
      if (n >= this.capacidade) continue;
      const v = e.v;
      const cor = corLinear(v.cor);
      const cor2 = corLinear(v.cor2 ?? v.cor);
      const b = realce(v.brilho ?? 1);
      const k = n * 4;
      const sobe = e.total > 0 ? 0.4 + 0.6 * Math.min(1, e.idade / (e.total * 0.25)) : f;
      A[0][k] = v.x;
      A[0][k + 1] = v.y ?? 0;
      A[0][k + 2] = v.z;
      A[0][k + 3] = v.altura * sobe;
      A[1][k] = cor.r * b;
      A[1][k + 1] = cor.g * b;
      A[1][k + 2] = cor.b * b;
      A[1][k + 3] = (v.alfa ?? 1) * f;
      A[2][k] = cor2.r * b;
      A[2][k + 1] = cor2.g * b;
      A[2][k + 2] = cor2.b * b;
      A[2][k + 3] = v.aditivo ?? 0.5;
      A[3][k] = v.estilo;
      A[3][k + 1] = v.raioBase * (0.5 + 0.5 * f);
      A[3][k + 2] = v.raioTopo * (0.5 + 0.5 * f);
      A[3][k + 3] = e.sem;
      A[4][k] = v.giro ?? 1.5;
      n++;
    }
    this.geo.instanceCount = n;
    for (const a of this.attrs) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(4, n * 4));
      a.needsUpdate = true;
    }
  }

  limpar(): void {
    this.mapa.clear();
  }

  descartar(): void {
    this.geo.dispose();
    (this.malha.material as THREE.Material).dispose();
  }
}
