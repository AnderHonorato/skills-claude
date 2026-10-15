/**
 * Partículas de efeito em UM draw call: quads instanciados (InstancedBufferGeometry)
 * com atlas de texturas e mistura pré-multiplicada — cada partícula escolhe o quanto
 * é aditiva (luz) ou opaca (fumaça, rocha), então fogo e fumaça escura convivem no
 * mesmo lote e continuam legíveis sobre a grama clara.
 *
 * Simulação na CPU em arrays tipados (sem objetos por partícula): posição,
 * velocidade, gravidade, arrasto, quique no chão, rotação/giro, tamanho e cor que
 * variam com a vida, curva de alfa, órbita opcional (espirais, vórtices) e três modos
 * de desenho: virada para a câmera, deitada no chão ou esticada na velocidade.
 */
import * as THREE from 'three';
import { GRADE_ATLAS } from './texturas';
import { aplicarMisturaPremultiplicada, corLinear, GLSL_SAIDA, realce, type CorFx } from './util';

/** Como o quad é orientado. */
export const MODO = {
  /** Virado para a câmera (billboard). */
  TELA: 0,
  /** Deitado no plano do chão (XZ). */
  CHAO: 1,
  /** Esticado na direção da velocidade em tela; o topo da textura vai à frente. */
  ESTICADO: 2,
} as const;

export interface Emissao {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  /** Segundos de vida. */
  vida?: number;
  /** Tamanho inicial (m) e final. */
  tam?: number;
  tamFim?: number;
  /** Rotação inicial (rad) e giro (rad/s). */
  rot?: number;
  giro?: number;
  cor?: CorFx;
  corFim?: CorFx;
  /** Multiplicador de intensidade (>1 alimenta o bloom). */
  brilho?: number;
  /** Alfa máximo. */
  alfa?: number;
  /** Quadro do atlas (ver Q em texturas.ts). */
  quadro?: number;
  /** 0 = tinta (cobre), 1 = luz (soma). */
  aditivo?: number;
  modo?: number;
  gravidade?: number;
  arrasto?: number;
  /**
   * MODO.ESTICADO: segundos de "rastro" (comprimento = velocidade × estica). O "topo"
   * da textura aponta para onde a partícula vai; negativo inverte (gotas: ponta atrás).
   */
  estica?: number;
  /** Largura/altura do quad nos modos TELA e CHAO (barras de glitch, linhas de varredura). */
  aspecto?: number;
  /** Fração da vida para surgir (0 = já nasce visível). */
  entrada?: number;
  /** Expoente do desvanecer (1 linear, >1 some cedo, <1 segura e some no fim). */
  curva?: number;
  /** Fator de quique ao tocar o chão (0 = atravessa). */
  quique?: number;
  /** Órbita em torno de (orbX, orbZ): velocidade angular (rad/s) e radial (m/s). */
  orbW?: number;
  orbVr?: number;
  orbX?: number;
  orbZ?: number;
}

const VERT = /* glsl */ `
attribute vec4 iPos;
attribute vec4 iCor;
attribute vec4 iInfo;
attribute vec4 iVel;
uniform vec2 uGrade;
varying vec2 vUv;
varying vec4 vCor;
varying float vAditivo;
void main() {
  vec2 canto = position.xy;
  float tam = iPos.w;
  float c = cos(iInfo.x);
  float s = sin(iInfo.x);
  vec2 cc = canto;
  if (iInfo.w < 1.5) cc.x *= iVel.w;
  vec2 r = vec2(c * cc.x - s * cc.y, s * cc.x + c * cc.y) * tam;
  vec4 mv;
  if (iInfo.w < 0.5) {
    mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
    mv.xy += r;
  } else if (iInfo.w < 1.5) {
    mv = modelViewMatrix * vec4(iPos.xyz + vec3(r.x, 0.0, -r.y), 1.0);
  } else {
    mv = modelViewMatrix * vec4(iPos.xyz, 1.0);
    vec3 vv = (modelViewMatrix * vec4(iVel.xyz, 0.0)).xyz;
    float L = length(vv.xy);
    vec2 dir = L > 1e-4 ? vv.xy / L : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);
    float comp = tam + L * abs(iVel.w);
    vec2 eixo = dir * (iVel.w < 0.0 ? -1.0 : 1.0);
    mv.xy += eixo * (canto.y * comp - (comp - tam) * 0.5) + nrm * canto.x * tam;
  }
  gl_Position = projectionMatrix * mv;
  float q = iInfo.y;
  vec2 cel = vec2(mod(q, uGrade.x), uGrade.y - 1.0 - floor(q / uGrade.x));
  vUv = (cel + canto + 0.5) / uGrade;
  vCor = iCor;
  vAditivo = iInfo.z;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec4 vCor;
varying float vAditivo;
void main() {
  vec4 t = texture2D(uAtlas, vUv);
  float alfaFinal = t.a * vCor.a;
  if (alfaFinal < 0.004) discard;
  vec3 corFinal = vCor.rgb * t.rgb;
  float aditivoFinal = vAditivo;
  ${GLSL_SAIDA}
}`;

export class Particulas {
  readonly malha: THREE.Mesh;
  private geo: THREE.InstancedBufferGeometry;
  private aPos: THREE.InstancedBufferAttribute;
  private aCor: THREE.InstancedBufferAttribute;
  private aInfo: THREE.InstancedBufferAttribute;
  private aVel: THREE.InstancedBufferAttribute;
  private n = 0;
  // estado (struct of arrays)
  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private vida: Float32Array;
  private total: Float32Array;
  private t0: Float32Array;
  private t1: Float32Array;
  private rot: Float32Array;
  private giro: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private alfa: Float32Array;
  private quadro: Float32Array;
  private adit: Float32Array;
  private modo: Float32Array;
  private grav: Float32Array;
  private arr: Float32Array;
  private estica: Float32Array;
  private asp: Float32Array;
  private entrada: Float32Array;
  private curva: Float32Array;
  private quique: Float32Array;
  private orb: Float32Array; // cx, cz, ang, raio, w, vr
  private temOrb: Uint8Array;
  private instante: Uint8Array;

  constructor(
    readonly capacidade: number,
    atlas: THREE.Texture
  ) {
    const N = capacidade;
    this.px = new Float32Array(N);
    this.py = new Float32Array(N);
    this.pz = new Float32Array(N);
    this.vx = new Float32Array(N);
    this.vy = new Float32Array(N);
    this.vz = new Float32Array(N);
    this.vida = new Float32Array(N);
    this.total = new Float32Array(N);
    this.t0 = new Float32Array(N);
    this.t1 = new Float32Array(N);
    this.rot = new Float32Array(N);
    this.giro = new Float32Array(N);
    this.c0 = new Float32Array(N * 3);
    this.c1 = new Float32Array(N * 3);
    this.alfa = new Float32Array(N);
    this.quadro = new Float32Array(N);
    this.adit = new Float32Array(N);
    this.modo = new Float32Array(N);
    this.grav = new Float32Array(N);
    this.arr = new Float32Array(N);
    this.estica = new Float32Array(N);
    this.asp = new Float32Array(N);
    this.entrada = new Float32Array(N);
    this.curva = new Float32Array(N);
    this.quique = new Float32Array(N);
    this.orb = new Float32Array(N * 6);
    this.temOrb = new Uint8Array(N);
    this.instante = new Uint8Array(N);

    const base = new THREE.PlaneGeometry(1, 1);
    this.geo = new THREE.InstancedBufferGeometry();
    this.geo.index = base.index;
    this.geo.setAttribute('position', base.getAttribute('position'));
    const attr = () => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.aPos = attr();
    this.aCor = attr();
    this.aInfo = attr();
    this.aVel = attr();
    this.geo.setAttribute('iPos', this.aPos);
    this.geo.setAttribute('iCor', this.aCor);
    this.geo.setAttribute('iInfo', this.aInfo);
    this.geo.setAttribute('iVel', this.aVel);
    this.geo.instanceCount = 0;
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uAtlas: { value: atlas },
        uGrade: { value: new THREE.Vector2(GRADE_ATLAS.x, GRADE_ATLAS.y) },
      },
      depthTest: true,
    });
    aplicarMisturaPremultiplicada(mat);
    this.malha = new THREE.Mesh(this.geo, mat);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 30;
  }

  get vivas(): number {
    return this.n;
  }

  /** Cria uma partícula. Devolve false se o lote estiver cheio. */
  emitir(o: Emissao): boolean {
    let i = this.n;
    if (i >= this.capacidade) {
      // cheio: substitui uma partícula aleatória já perto do fim
      i = Math.floor(Math.random() * this.capacidade);
      if (this.vida[i] > this.total[i] * 0.4) return false;
    } else this.n++;
    this.px[i] = o.x;
    this.py[i] = o.y;
    this.pz[i] = o.z;
    this.vx[i] = o.vx ?? 0;
    this.vy[i] = o.vy ?? 0;
    this.vz[i] = o.vz ?? 0;
    const vida = o.vida ?? 0.6;
    this.vida[i] = vida;
    this.total[i] = vida;
    const tam = o.tam ?? 0.4;
    this.t0[i] = tam;
    this.t1[i] = o.tamFim ?? tam;
    this.rot[i] = o.rot ?? 0;
    this.giro[i] = o.giro ?? 0;
    const ca = corLinear(o.cor ?? '#ffffff');
    const cb = o.corFim !== undefined ? corLinear(o.corFim) : ca;
    const b = realce(o.brilho ?? 1);
    this.c0[i * 3] = ca.r * b;
    this.c0[i * 3 + 1] = ca.g * b;
    this.c0[i * 3 + 2] = ca.b * b;
    this.c1[i * 3] = cb.r * b;
    this.c1[i * 3 + 1] = cb.g * b;
    this.c1[i * 3 + 2] = cb.b * b;
    this.alfa[i] = o.alfa ?? 1;
    this.quadro[i] = o.quadro ?? 0;
    this.adit[i] = o.aditivo ?? 1;
    this.modo[i] = o.modo ?? 0;
    this.grav[i] = o.gravidade ?? 0;
    this.arr[i] = o.arrasto ?? 0;
    this.estica[i] = o.estica ?? 0.05;
    this.asp[i] = o.aspecto ?? 1;
    this.entrada[i] = o.entrada ?? 0.08;
    this.curva[i] = o.curva ?? 1;
    this.quique[i] = o.quique ?? 0;
    this.instante[i] = 0;
    if (o.orbW !== undefined || o.orbVr !== undefined) {
      const cx = o.orbX ?? o.x;
      const cz = o.orbZ ?? o.z;
      const k = i * 6;
      this.orb[k] = cx;
      this.orb[k + 1] = cz;
      this.orb[k + 2] = Math.atan2(o.z - cz, o.x - cx);
      this.orb[k + 3] = Math.hypot(o.x - cx, o.z - cz);
      this.orb[k + 4] = o.orbW ?? 0;
      this.orb[k + 5] = o.orbVr ?? 0;
      this.temOrb[i] = 1;
    } else this.temOrb[i] = 0;
    return true;
  }

  /** Sprite que aparece só neste quadro (cabeças de projéteis, brilhos contínuos). */
  desenharAgora(o: Emissao): void {
    if (this.n >= this.capacidade) return;
    const ok = this.emitir({ ...o, vida: 1, entrada: 0, curva: 1 });
    if (ok) this.instante[this.n - 1] = 1;
  }

  private remover(i: number): void {
    const u = --this.n;
    if (i === u) return;
    this.px[i] = this.px[u];
    this.py[i] = this.py[u];
    this.pz[i] = this.pz[u];
    this.vx[i] = this.vx[u];
    this.vy[i] = this.vy[u];
    this.vz[i] = this.vz[u];
    this.vida[i] = this.vida[u];
    this.total[i] = this.total[u];
    this.t0[i] = this.t0[u];
    this.t1[i] = this.t1[u];
    this.rot[i] = this.rot[u];
    this.giro[i] = this.giro[u];
    for (let k = 0; k < 3; k++) {
      this.c0[i * 3 + k] = this.c0[u * 3 + k];
      this.c1[i * 3 + k] = this.c1[u * 3 + k];
    }
    this.alfa[i] = this.alfa[u];
    this.quadro[i] = this.quadro[u];
    this.adit[i] = this.adit[u];
    this.modo[i] = this.modo[u];
    this.grav[i] = this.grav[u];
    this.arr[i] = this.arr[u];
    this.estica[i] = this.estica[u];
    this.asp[i] = this.asp[u];
    this.entrada[i] = this.entrada[u];
    this.curva[i] = this.curva[u];
    this.quique[i] = this.quique[u];
    this.temOrb[i] = this.temOrb[u];
    this.instante[i] = this.instante[u];
    for (let k = 0; k < 6; k++) this.orb[i * 6 + k] = this.orb[u * 6 + k];
  }

  atualizar(dt: number): void {
    const P = this.aPos.array as Float32Array;
    const C = this.aCor.array as Float32Array;
    const I = this.aInfo.array as Float32Array;
    const V = this.aVel.array as Float32Array;
    let i = 0;
    let w = 0;
    // 1) simula e remove as mortas
    while (i < this.n) {
      if (this.instante[i] === 2) {
        this.remover(i);
        continue;
      }
      if (this.instante[i] === 0) {
        this.vida[i] -= dt;
        if (this.vida[i] <= 0) {
          this.remover(i);
          continue;
        }
        const amort = this.arr[i] > 0 ? Math.exp(-this.arr[i] * dt) : 1;
        this.vx[i] *= amort;
        this.vz[i] *= amort;
        this.vy[i] = this.vy[i] * amort - this.grav[i] * dt;
        if (this.temOrb[i]) {
          const k = i * 6;
          this.orb[k + 2] += this.orb[k + 4] * dt;
          this.orb[k + 3] = Math.max(0, this.orb[k + 3] + this.orb[k + 5] * dt);
          const a = this.orb[k + 2];
          const r = this.orb[k + 3];
          const nx = this.orb[k] + Math.cos(a) * r + this.vx[i] * dt;
          const nz = this.orb[k + 1] + Math.sin(a) * r + this.vz[i] * dt;
          this.orb[k] += this.vx[i] * dt;
          this.orb[k + 1] += this.vz[i] * dt;
          // velocidade aparente (para o modo esticado)
          const ivx = (nx - this.px[i]) / Math.max(dt, 1e-4);
          const ivz = (nz - this.pz[i]) / Math.max(dt, 1e-4);
          this.px[i] = nx;
          this.pz[i] = nz;
          V[w * 4] = ivx;
          V[w * 4 + 2] = ivz;
        } else {
          this.px[i] += this.vx[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          V[w * 4] = this.vx[i];
          V[w * 4 + 2] = this.vz[i];
        }
        this.py[i] += this.vy[i] * dt;
        if (this.quique[i] > 0 && this.py[i] < 0.04 && this.vy[i] < 0) {
          this.py[i] = 0.04;
          this.vy[i] = -this.vy[i] * this.quique[i];
          this.vx[i] *= 0.55;
          this.vz[i] *= 0.55;
          this.giro[i] *= 0.5;
          if (Math.abs(this.vy[i]) < 0.6) this.vy[i] = 0;
        }
        this.rot[i] += this.giro[i] * dt;
      } else {
        V[w * 4] = this.vx[i];
        V[w * 4 + 2] = this.vz[i];
        this.instante[i] = 2; // some no próximo quadro
      }
      // 2) escreve a instância
      const t = 1 - this.vida[i] / this.total[i];
      const ent = this.entrada[i];
      const fIn = ent > 0 ? Math.min(1, t / ent) : 1;
      const fOut = Math.pow(Math.max(0, 1 - t), this.curva[i]);
      const e = 1 - (1 - t) * (1 - t);
      P[w * 4] = this.px[i];
      P[w * 4 + 1] = this.py[i];
      P[w * 4 + 2] = this.pz[i];
      P[w * 4 + 3] = this.t0[i] + (this.t1[i] - this.t0[i]) * e;
      const k3 = i * 3;
      C[w * 4] = this.c0[k3] + (this.c1[k3] - this.c0[k3]) * t;
      C[w * 4 + 1] = this.c0[k3 + 1] + (this.c1[k3 + 1] - this.c0[k3 + 1]) * t;
      C[w * 4 + 2] = this.c0[k3 + 2] + (this.c1[k3 + 2] - this.c0[k3 + 2]) * t;
      C[w * 4 + 3] = this.alfa[i] * fIn * fOut;
      I[w * 4] = this.rot[i];
      I[w * 4 + 1] = this.quadro[i];
      I[w * 4 + 2] = this.adit[i];
      I[w * 4 + 3] = this.modo[i];
      V[w * 4 + 1] = this.vy[i];
      V[w * 4 + 3] = this.modo[i] > 1.5 ? this.estica[i] : this.asp[i];
      w++;
      i++;
    }
    this.geo.instanceCount = w;
    for (const a of [this.aPos, this.aCor, this.aInfo, this.aVel]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(4, w * 4));
      a.needsUpdate = true;
    }
  }

  limpar(): void {
    this.n = 0;
    this.geo.instanceCount = 0;
  }

  descartar(): void {
    this.geo.dispose();
    (this.malha.material as THREE.Material).dispose();
  }
}
