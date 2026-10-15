/**
 * Lote de instâncias reescrito a cada quadro: muito barato para centenas de
 * inimigos, projéteis e cristais (um draw por tipo).
 */
import * as THREE from 'three';

export class Lote {
  readonly malha: THREE.InstancedMesh;
  private n = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private p = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    readonly capacidade: number,
    sombra = false
  ) {
    this.malha = new THREE.InstancedMesh(geo, mat, capacidade);
    this.malha.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.malha.setColorAt(0, new THREE.Color(1, 1, 1));
    this.malha.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.malha.count = 0;
    this.malha.frustumCulled = false;
    this.malha.castShadow = sombra;
  }

  iniciar(): void {
    this.n = 0;
  }

  /** Adiciona uma instância. Retorna false se o lote encheu. */
  por(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    rx: number,
    ry: number,
    rz: number,
    cor: THREE.ColorRepresentation | THREE.Color
  ): boolean {
    if (this.n >= this.capacidade) return false;
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.compose(this.p.set(x, y, z), this.q, this.s.set(sx, sy, sz));
    this.malha.setMatrixAt(this.n, this.m);
    if (cor instanceof THREE.Color) this.malha.setColorAt(this.n, cor);
    else this.malha.setColorAt(this.n, this.c.set(cor));
    this.n++;
    return true;
  }

  /** Versão com quaternion pronto. */
  porQ(x: number, y: number, z: number, s: number, q: THREE.Quaternion, cor: THREE.Color): void {
    if (this.n >= this.capacidade) return;
    this.m.compose(this.p.set(x, y, z), q, this.s.set(s, s, s));
    this.malha.setMatrixAt(this.n, this.m);
    this.malha.setColorAt(this.n, cor);
    this.n++;
  }

  concluir(): void {
    this.malha.count = this.n;
    this.malha.instanceMatrix.needsUpdate = true;
    if (this.malha.instanceColor) this.malha.instanceColor.needsUpdate = true;
  }
}

/** Pontos de brilho aditivo (halo dos cristais, núcleos de projéteis). */
export class Halos {
  readonly pontos: THREE.Points;
  private pos: Float32Array;
  private cor: Float32Array;
  private tam: Float32Array;
  private n = 0;
  private c = new THREE.Color();

  constructor(private capacidade: number) {
    this.pos = new Float32Array(capacidade * 3);
    this.cor = new Float32Array(capacidade * 3);
    this.tam = new Float32Array(capacidade);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'aCor',
      new THREE.BufferAttribute(this.cor, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'aTam',
      new THREE.BufferAttribute(this.tam, 1).setUsage(THREE.DynamicDrawUsage)
    );
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uEscala: { value: 800 } },
      vertexShader: /* glsl */ `
        attribute vec3 aCor; attribute float aTam; varying vec3 vCor; uniform float uEscala;
        void main(){ vCor = aCor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aTam * uEscala / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `
        varying vec3 vCor;
        void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; float a = pow(max(0.0, 1.0 - d), 2.2);
          gl_FragColor = vec4(vCor * a, a); if (a < 0.01) discard;
          #include <colorspace_fragment>
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.pontos = new THREE.Points(geo, mat);
    this.pontos.frustumCulled = false;
    this.pontos.renderOrder = 8;
  }

  definirEscala(alturaTela: number): void {
    (this.pontos.material as THREE.ShaderMaterial).uniforms.uEscala.value = alturaTela * 1.25;
  }

  private marca = 0;

  iniciar(): void {
    this.n = 0;
    this.marca = 0;
  }

  /** Guarda o que já foi posto (pela simulação) para o desenho acrescentar por cima. */
  marcar(): void {
    this.marca = this.n;
  }

  /** Descarta o que o desenho do quadro anterior acrescentou após a marca. */
  voltarMarca(): void {
    this.n = this.marca;
  }

  por(
    x: number,
    y: number,
    z: number,
    tamanho: number,
    cor: THREE.ColorRepresentation,
    intensidade = 1
  ): void {
    if (this.n >= this.capacidade) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.c.set(cor);
    this.cor[i * 3] = this.c.r * intensidade;
    this.cor[i * 3 + 1] = this.c.g * intensidade;
    this.cor[i * 3 + 2] = this.c.b * intensidade;
    this.tam[i] = tamanho;
  }

  concluir(): void {
    const g = this.pontos.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true;
    g.attributes.aCor.needsUpdate = true;
    g.attributes.aTam.needsUpdate = true;
  }
}
