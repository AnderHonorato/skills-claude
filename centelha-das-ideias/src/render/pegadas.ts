/**
 * Pegadas que vão sumindo: cada passo deixa uma marca oval no chão que desbota.
 * Na água, viram ondinhas que se abrem.
 */
import * as THREE from 'three';

const VERT = /* glsl */ `
attribute float aAlfa;
varying float vAlfa;
varying vec2 vUv;
void main() {
  vAlfa = aAlfa;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const FRAG = /* glsl */ `
uniform vec3 uCor;
varying float vAlfa;
varying vec2 vUv;
void main() {
  float d = length((vUv - 0.5) * vec2(2.0, 2.0));
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * vAlfa;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uCor, a);
  #include <colorspace_fragment>
}`;

export class Pegadas {
  readonly malha: THREE.InstancedMesh;
  private vidas: Float32Array;
  private alfas: Float32Array;
  private proxima = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private eixo = new THREE.Vector3(0, 1, 0);

  constructor(private capacidade = 160) {
    const geo = new THREE.PlaneGeometry(0.2, 0.3);
    geo.rotateX(-Math.PI / 2);
    this.alfas = new Float32Array(capacidade);
    this.vidas = new Float32Array(capacidade);
    geo.setAttribute('aAlfa', new THREE.InstancedBufferAttribute(this.alfas, 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { uCor: { value: new THREE.Color('#5a3d2c') } },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
    });
    this.malha = new THREE.InstancedMesh(geo, mat, capacidade);
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 3;
    for (let i = 0; i < capacidade; i++) {
      this.m.makeScale(0, 0, 0);
      this.malha.setMatrixAt(i, this.m);
    }
  }

  marcar(x: number, y: number, z: number, angulo: number, lado: number): void {
    const i = this.proxima;
    this.proxima = (this.proxima + 1) % this.capacidade;
    const ox = Math.cos(angulo) * 0.13 * lado;
    const oz = -Math.sin(angulo) * 0.13 * lado;
    this.q.setFromAxisAngle(this.eixo, angulo);
    this.m.compose(new THREE.Vector3(x + ox, y + 0.03, z + oz), this.q, new THREE.Vector3(1, 1, 1));
    this.malha.setMatrixAt(i, this.m);
    this.vidas[i] = 7;
    this.malha.instanceMatrix.needsUpdate = true;
  }

  atualizar(dt: number): void {
    for (let i = 0; i < this.capacidade; i++) {
      if (this.vidas[i] <= 0) {
        this.alfas[i] = 0;
        continue;
      }
      this.vidas[i] -= dt;
      this.alfas[i] = Math.min(0.42, (this.vidas[i] / 7) * 0.55);
    }
    (this.malha.geometry.getAttribute('aAlfa') as THREE.InstancedBufferAttribute).needsUpdate =
      true;
  }
}
