/**
 * Fitas: tiras de triângulos reconstruídas a cada quadro numa ÚNICA geometria
 * dinâmica. Servem para rastros de projéteis, relâmpagos, lasers, chicotes e cortes
 * (um draw call para tudo). Cada tira vira para a câmera (ou fica num plano fixo,
 * como o corte horizontal) e escolhe um estilo de shader:
 *  0 energia suave · 1 fogo (erosão por ruído) · 2 relâmpago (núcleo branco + halo)
 *  3 laser (energia rolando) · 4 corte (borda afiada) · 5 líquido (veneno/água)
 *  6 sombra (gravidade: miolo escuro e borda que brilha)
 */
import * as THREE from 'three';
import { aplicarMisturaPremultiplicada, GLSL_SAIDA } from './util';

export const ESTILO_FITA = {
  SUAVE: 0,
  FOGO: 1,
  RAIO: 2,
  LASER: 3,
  CORTE: 4,
  LIQUIDO: 5,
  SOMBRA: 6,
} as const;

const VERT = /* glsl */ `
attribute vec2 aUv;
attribute vec4 aCor;
attribute vec3 aInfo;
varying vec2 vUv;
varying vec4 vCor;
varying vec3 vInfo;
void main() {
  vUv = aUv;
  vCor = aCor;
  vInfo = aInfo;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = /* glsl */ `
uniform sampler2D uRuido;
uniform float uTempo;
varying vec2 vUv;
varying vec4 vCor;
varying vec3 vInfo;
void main() {
  float x = vUv.y;
  float ax = abs(x);
  float ao = vUv.x;
  int estilo = int(vInfo.x + 0.5);
  float sem = vInfo.z;
  vec3 cor = vCor.rgb;
  vec3 corFinal = cor;
  float alfaFinal = 0.0;
  float aditivoFinal = vInfo.y;
  if (estilo == 0) {
    float perfil = exp(-ax * ax * 1.8) * smoothstep(1.0, 0.72, ax);
    float nucleo = exp(-ax * ax * 26.0) * vCor.a;
    corFinal = cor * (0.75 + 0.5 * perfil) + vec3(nucleo * 0.7);
    alfaFinal = perfil * vCor.a;
  } else if (estilo == 1) {
    float n = texture2D(uRuido, vec2(ao * 0.45 - uTempo * 1.7 + sem, x * 0.22 + sem * 0.37)).r;
    float n2 = texture2D(uRuido, vec2(ao * 1.1 - uTempo * 2.9, x * 0.5 + sem)).g;
    float calor = (1.0 - ax * ax) * vCor.a;
    float chama = smoothstep(0.0, 0.35, calor - (n * 0.75 + n2 * 0.35) * (1.15 - vCor.a));
    vec3 quente = vec3(1.0, 0.85, 0.45) * 1.5;
    corFinal = mix(cor * 0.45, cor * 1.2, smoothstep(0.1, 0.6, chama));
    corFinal = mix(corFinal, quente, smoothstep(0.85, 1.0, chama) * vCor.a * (1.0 - ax));
    alfaFinal = chama;
    aditivoFinal = mix(0.2, 0.75, smoothstep(0.3, 0.9, chama)) * vInfo.y;
  } else if (estilo == 2) {
    float nucleo = smoothstep(0.22, 0.04, ax);
    float halo = exp(-ax * ax * 5.0);
    corFinal = cor * halo * 1.1 + vec3(1.8) * nucleo;
    alfaFinal = clamp(halo * 0.6 + nucleo, 0.0, 1.0) * vCor.a;
    aditivoFinal = vInfo.y * mix(0.55, 1.0, nucleo);
  } else if (estilo == 3) {
    float n = texture2D(uRuido, vec2(ao * 0.22 - uTempo * 3.2, x * 0.18 + sem)).g;
    float n2 = texture2D(uRuido, vec2(ao * 0.6 - uTempo * 7.0, x * 0.4 + sem * 2.0)).r;
    float nucleo = exp(-ax * ax * 40.0);
    float meio = exp(-ax * ax * 7.0);
    float fora = exp(-ax * ax * 1.8) * 0.45;
    float pulso = 0.75 + 0.5 * n + 0.35 * n2;
    corFinal = cor * (meio * 1.6 + fora) * pulso + vec3(2.6) * nucleo;
    alfaFinal = clamp(nucleo + meio * 0.9 + fora, 0.0, 1.0) * vCor.a;
  } else if (estilo == 4) {
    float corpo = smoothstep(-1.0, 0.55, x) * smoothstep(1.0, 0.82, x);
    float fio = exp(-pow((x - 0.72) / 0.11, 2.0));
    float n = texture2D(uRuido, vec2(ao * 0.9 + sem, x * 0.15)).r;
    float listras = 0.55 + 0.75 * n;
    corFinal = cor * listras + vec3(1.25) * fio;
    aditivoFinal = vInfo.y * mix(0.5, 1.0, fio);
    alfaFinal = clamp(corpo * listras * 0.85 + fio, 0.0, 1.0) * vCor.a;
  } else if (estilo == 5) {
    float n = texture2D(uRuido, vec2(ao * 0.7 - uTempo * 0.8 + sem, x * 0.25)).r;
    float borda = 0.62 + 0.38 * n;
    float corpo = smoothstep(borda, borda - 0.18, ax);
    float brilho = exp(-pow((x + 0.35) / 0.15, 2.0)) * corpo;
    corFinal = cor * (0.85 + 0.3 * n) + vec3(1.2) * brilho;
    alfaFinal = corpo * vCor.a;
    aditivoFinal = vInfo.y * (0.2 + 0.8 * brilho);
  } else {
    float n = texture2D(uRuido, vec2(ao * 0.5 - uTempo * 1.2 + sem, x * 0.3)).g;
    float corpo = smoothstep(1.0, 0.45, ax + (n - 0.5) * 0.3);
    float aro = exp(-pow((ax - 0.62) / 0.16, 2.0));
    corFinal = mix(vec3(0.03, 0.0, 0.08), cor * 1.8, aro);
    alfaFinal = clamp(corpo * 0.85 + aro * 0.6, 0.0, 1.0) * vCor.a;
    aditivoFinal = aro * vInfo.y;
  }
  if (alfaFinal < 0.004) discard;
  ${GLSL_SAIDA}
}`;

const MAX_PONTOS_TIRA = 256;

export class Fitas {
  readonly malha: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private pos: Float32Array;
  private uv: Float32Array;
  private cor: Float32Array;
  private info: Float32Array;
  private idx: Uint16Array | Uint32Array;
  private nv = 0;
  private ni = 0;
  private cam = new THREE.Vector3();
  // tira em construção
  private tmp = new Float32Array(MAX_PONTOS_TIRA * 8);
  private nt = 0;
  private estilo = 0;
  private aditivo = 1;
  private semente = 0;
  private normal: THREE.Vector3 | null = null;
  private dist = 0;
  private escalaUv = 1;
  readonly uniformes: { uRuido: { value: THREE.Texture }; uTempo: { value: number } };

  constructor(
    readonly maxVertices: number,
    ruido: THREE.Texture
  ) {
    const N = maxVertices;
    this.pos = new Float32Array(N * 3);
    this.uv = new Float32Array(N * 2);
    this.cor = new Float32Array(N * 4);
    this.info = new Float32Array(N * 3);
    this.idx = N < 65535 ? new Uint16Array(N * 3) : new Uint32Array(N * 3);
    this.geo = new THREE.BufferGeometry();
    const din = (a: THREE.BufferAttribute) => a.setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', din(new THREE.BufferAttribute(this.pos, 3)));
    this.geo.setAttribute('aUv', din(new THREE.BufferAttribute(this.uv, 2)));
    this.geo.setAttribute('aCor', din(new THREE.BufferAttribute(this.cor, 4)));
    this.geo.setAttribute('aInfo', din(new THREE.BufferAttribute(this.info, 3)));
    this.geo.setIndex(din(new THREE.BufferAttribute(this.idx, 1)));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.geo.setDrawRange(0, 0);
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
    this.malha.renderOrder = 28;
  }

  /** Começa um quadro novo (zera a geometria). */
  iniciar(camera: THREE.Camera, tempo: number): void {
    this.nv = 0;
    this.ni = 0;
    camera.getWorldPosition(this.cam);
    this.uniformes.uTempo.value = tempo % 1000;
  }

  /**
   * Começa uma tira. `normal` fixa o plano (ex.: (0,1,0) deita no chão); sem ela,
   * a tira vira para a câmera. `escalaUv` multiplica a coordenada ao longo (m).
   */
  comecar(
    estilo: number,
    aditivo = 1,
    semente = 0,
    normal: THREE.Vector3 | null = null,
    escalaUv = 1
  ) {
    this.nt = 0;
    this.estilo = estilo;
    this.aditivo = aditivo;
    this.semente = semente;
    this.normal = normal;
    this.dist = 0;
    this.escalaUv = escalaUv;
  }

  /** Acrescenta um ponto (cor linear já multiplicada pelo brilho). */
  ponto(
    x: number,
    y: number,
    z: number,
    largura: number,
    r: number,
    g: number,
    b: number,
    a: number
  ) {
    if (this.nt >= MAX_PONTOS_TIRA) return;
    const k = this.nt * 8;
    const t = this.tmp;
    if (this.nt > 0) this.dist += Math.hypot(x - t[k - 8], y - t[k - 7], z - t[k - 6]);
    t[k] = x;
    t[k + 1] = y;
    t[k + 2] = z;
    t[k + 3] = largura;
    t[k + 4] = r;
    t[k + 5] = g;
    t[k + 6] = b;
    t[k + 7] = a;
    // guarda a distância acumulada no lugar do "largura" de outra lista? usamos um array à parte
    this.distancias[this.nt] = this.dist;
    this.nt++;
  }

  private distancias = new Float32Array(MAX_PONTOS_TIRA);

  /** Fecha a tira e gera os triângulos. */
  terminar(): void {
    const n = this.nt;
    if (n < 2) return;
    if (this.nv + n * 2 > this.maxVertices || this.ni + (n - 1) * 6 > this.idx.length) return;
    const t = this.tmp;
    const v0 = this.nv;
    for (let i = 0; i < n; i++) {
      const k = i * 8;
      const a = Math.max(0, i - 1) * 8;
      const b = Math.min(n - 1, i + 1) * 8;
      let tx = t[b] - t[a];
      let ty = t[b + 1] - t[a + 1];
      let tz = t[b + 2] - t[a + 2];
      let rx: number;
      let ry: number;
      let rz: number;
      if (this.normal) {
        rx = this.normal.x;
        ry = this.normal.y;
        rz = this.normal.z;
      } else {
        rx = this.cam.x - t[k];
        ry = this.cam.y - t[k + 1];
        rz = this.cam.z - t[k + 2];
      }
      // lado = tangente × (direção da câmera ou normal)
      let sx = ty * rz - tz * ry;
      let sy = tz * rx - tx * rz;
      let sz = tx * ry - ty * rx;
      let L = Math.hypot(sx, sy, sz);
      if (L < 1e-6) {
        tx = 1;
        ty = 0;
        tz = 0;
        sx = 0;
        sy = rz;
        sz = -ry;
        L = Math.hypot(sx, sy, sz) || 1;
      }
      const m = (t[k + 3] * 0.5) / L;
      sx *= m;
      sy *= m;
      sz *= m;
      const along = this.distancias[i] * this.escalaUv;
      for (let lado = -1; lado <= 1; lado += 2) {
        const v = this.nv++;
        this.pos[v * 3] = t[k] + sx * lado;
        this.pos[v * 3 + 1] = t[k + 1] + sy * lado;
        this.pos[v * 3 + 2] = t[k + 2] + sz * lado;
        this.uv[v * 2] = along;
        this.uv[v * 2 + 1] = lado;
        this.cor[v * 4] = t[k + 4];
        this.cor[v * 4 + 1] = t[k + 5];
        this.cor[v * 4 + 2] = t[k + 6];
        this.cor[v * 4 + 3] = t[k + 7];
        this.info[v * 3] = this.estilo;
        this.info[v * 3 + 1] = this.aditivo;
        this.info[v * 3 + 2] = this.semente;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = v0 + i * 2;
      this.idx[this.ni++] = a;
      this.idx[this.ni++] = a + 1;
      this.idx[this.ni++] = a + 2;
      this.idx[this.ni++] = a + 1;
      this.idx[this.ni++] = a + 3;
      this.idx[this.ni++] = a + 2;
    }
    this.nt = 0;
  }

  /** Envia a geometria do quadro para a GPU. */
  concluir(): void {
    const g = this.geo;
    g.setDrawRange(0, this.ni);
    const marca = (nome: string, itens: number) => {
      const a = g.getAttribute(nome) as THREE.BufferAttribute;
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(itens, this.nv * itens));
      a.needsUpdate = true;
    };
    marca('position', 3);
    marca('aUv', 2);
    marca('aCor', 4);
    marca('aInfo', 3);
    const ix = g.index!;
    ix.clearUpdateRanges();
    ix.addUpdateRange(0, Math.max(1, this.ni));
    ix.needsUpdate = true;
  }

  descartar(): void {
    this.geo.dispose();
    (this.malha.material as THREE.Material).dispose();
  }
}
