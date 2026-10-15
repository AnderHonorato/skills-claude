/**
 * Partículas em lote (um único draw por sistema): poeira, folhas, faíscas mágicas,
 * lágrimas, vapor de raiva, brilhos de acerto. Física simples na CPU.
 */
import * as THREE from 'three';
import { texturaCirculo } from './materiais';

export interface OpcoesParticula {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  vida?: number;
  tamanho?: number;
  /** Tamanho final relativo (1 = constante). */
  crescer?: number;
  cor?: THREE.ColorRepresentation;
  gravidade?: number;
  arrasto?: number;
  /** Ondulação lateral (folhas). */
  ondular?: number;
}

interface Particula {
  ativa: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  vida: number;
  total: number;
  tamanho: number;
  crescer: number;
  r: number;
  g: number;
  b: number;
  gravidade: number;
  arrasto: number;
  ondular: number;
  semente: number;
}

const VERT = /* glsl */ `
attribute float aTamanho;
attribute float aAlfa;
attribute vec3 aCor;
varying float vAlfa;
varying vec3 vCor;
uniform float uEscala;
void main() {
  vAlfa = aAlfa;
  vCor = aCor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aTamanho * uEscala / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMapa;
varying float vAlfa;
varying vec3 vCor;
void main() {
  vec4 t = texture2D(uMapa, gl_PointCoord);
  gl_FragColor = vec4(vCor, t.a * vAlfa);
  if (gl_FragColor.a < 0.01) discard;
  #include <colorspace_fragment>
}`;

export class SistemaParticulas {
  readonly pontos: THREE.Points;
  private lista: Particula[] = [];
  private posicoes: Float32Array;
  private cores: Float32Array;
  private tamanhos: Float32Array;
  private alfas: Float32Array;
  private proxima = 0;
  private cor = new THREE.Color();

  constructor(
    private capacidade: number,
    aditivo: boolean
  ) {
    this.posicoes = new Float32Array(capacidade * 3);
    this.cores = new Float32Array(capacidade * 3);
    this.tamanhos = new Float32Array(capacidade);
    this.alfas = new Float32Array(capacidade);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.posicoes, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'aCor',
      new THREE.BufferAttribute(this.cores, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'aTamanho',
      new THREE.BufferAttribute(this.tamanhos, 1).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'aAlfa',
      new THREE.BufferAttribute(this.alfas, 1).setUsage(THREE.DynamicDrawUsage)
    );
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uMapa: { value: texturaCirculo() }, uEscala: { value: 400 } },
      transparent: true,
      depthWrite: false,
      blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.pontos = new THREE.Points(geo, mat);
    this.pontos.frustumCulled = false;
    this.pontos.renderOrder = aditivo ? 10 : 9;
    for (let i = 0; i < capacidade; i++) {
      this.lista.push({
        ativa: false,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        vida: 0,
        total: 1,
        tamanho: 1,
        crescer: 1,
        r: 1,
        g: 1,
        b: 1,
        gravidade: 0,
        arrasto: 0,
        ondular: 0,
        semente: Math.random() * 100,
      });
    }
  }

  /** Escala de tamanho em pixels conforme a altura da tela. */
  definirEscala(alturaTela: number): void {
    (this.pontos.material as THREE.ShaderMaterial).uniforms.uEscala.value = alturaTela * 1.3;
  }

  emitir(o: OpcoesParticula): void {
    const p = this.lista[this.proxima];
    this.proxima = (this.proxima + 1) % this.capacidade;
    p.ativa = true;
    p.x = o.x;
    p.y = o.y;
    p.z = o.z;
    p.vx = o.vx ?? 0;
    p.vy = o.vy ?? 0;
    p.vz = o.vz ?? 0;
    p.vida = p.total = o.vida ?? 0.8;
    p.tamanho = o.tamanho ?? 0.3;
    p.crescer = o.crescer ?? 1;
    this.cor.set(o.cor ?? '#ffffff');
    p.r = this.cor.r;
    p.g = this.cor.g;
    p.b = this.cor.b;
    p.gravidade = o.gravidade ?? 0;
    p.arrasto = o.arrasto ?? 1.5;
    p.ondular = o.ondular ?? 0;
  }

  /** Explosão radial de n partículas. */
  explosao(
    x: number,
    y: number,
    z: number,
    n: number,
    o: Partial<OpcoesParticula> & { velocidade?: number } = {}
  ): void {
    const v = o.velocidade ?? 4;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * 0.9 + 0.1;
      this.emitir({
        ...o,
        x,
        y,
        z,
        vx: Math.cos(a) * v * e + (o.vx ?? 0),
        vy: (Math.random() * 0.8 + 0.4) * v * 0.7 + (o.vy ?? 0),
        vz: Math.sin(a) * v * e + (o.vz ?? 0),
        vida: (o.vida ?? 0.7) * (0.6 + Math.random() * 0.6),
      });
    }
  }

  atualizar(dt: number, tempo: number): void {
    for (let i = 0; i < this.capacidade; i++) {
      const p = this.lista[i];
      if (!p.ativa) {
        this.alfas[i] = 0;
        continue;
      }
      p.vida -= dt;
      if (p.vida <= 0) {
        p.ativa = false;
        this.alfas[i] = 0;
        continue;
      }
      const amortecer = Math.exp(-p.arrasto * dt);
      p.vx *= amortecer;
      p.vz *= amortecer;
      p.vy = p.vy * amortecer - p.gravidade * dt;
      p.x += p.vx * dt + (p.ondular ? Math.sin(tempo * 4 + p.semente) * p.ondular * dt : 0);
      p.y += p.vy * dt;
      p.z += p.vz * dt + (p.ondular ? Math.cos(tempo * 3 + p.semente) * p.ondular * dt : 0);
      const t = 1 - p.vida / p.total;
      this.posicoes[i * 3] = p.x;
      this.posicoes[i * 3 + 1] = p.y;
      this.posicoes[i * 3 + 2] = p.z;
      this.cores[i * 3] = p.r;
      this.cores[i * 3 + 1] = p.g;
      this.cores[i * 3 + 2] = p.b;
      this.tamanhos[i] = p.tamanho * (1 + (p.crescer - 1) * t);
      this.alfas[i] = Math.min(1, (1 - t) * 1.6) * Math.min(1, t * 12 + 0.2);
    }
    const geo = this.pontos.geometry;
    geo.attributes.position.needsUpdate = true;
    geo.attributes.aCor.needsUpdate = true;
    geo.attributes.aTamanho.needsUpdate = true;
    geo.attributes.aAlfa.needsUpdate = true;
  }
}
