/**
 * Pós-processamento opcional: bloom (UnrealBloomPass em resolução reduzida e com
 * limiar alto, para que só os efeitos com cor > 1 brilhem — o chão toon não) e um
 * pulso de impacto (clarão colorido + aberração cromática nas bordas). Em 'baixa'
 * o bloom é desligado e `render` vira um renderer.render comum.
 *
 * Uso:
 *   const pos = new PosProcesso(renderer, 'alta');
 *   pos.redimensionar(w, h, dpr);
 *   pos.render(renderer, cena, camera); // em vez de renderer.render
 *   pos.pulso('#ffffff', 0.6);          // golpe forte / dano
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { QualidadeFx } from './util';

const SHADER_PULSO = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uForca: { value: 0 },
    uCor: { value: new THREE.Color(1, 1, 1) },
    uAberracao: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uForca;
    uniform float uAberracao;
    uniform vec3 uCor;
    varying vec2 vUv;
    void main() {
      vec2 d = vUv - 0.5;
      float borda = dot(d, d) * 4.0;
      vec2 off = d * uAberracao * borda;
      vec4 c = texture2D(tDiffuse, vUv);
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.b = texture2D(tDiffuse, vUv - off).b;
      float vinheta = smoothstep(0.15, 1.2, borda);
      c.rgb = mix(c.rgb, uCor, uForca * (0.18 + 0.6 * vinheta));
      gl_FragColor = c;
    }`,
};

export class PosProcesso {
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  private passoPulso: ShaderPass | null = null;
  private forcaPulso = 0;
  private aberracao = 0;
  private corPulso = new THREE.Color();
  private qualidade: QualidadeFx;
  private largura = 1;
  private altura = 1;
  private dpr = 1;
  /** Intensidade do bloom (0 desliga sem destruir). */
  intensidade = 1;

  constructor(
    private renderer: THREE.WebGLRenderer,
    qualidade: QualidadeFx
  ) {
    this.qualidade = qualidade;
    this.montar();
  }

  get ativo(): boolean {
    return this.composer !== null;
  }

  definirQualidade(q: QualidadeFx): void {
    if (q === this.qualidade) return;
    this.qualidade = q;
    this.desmontar();
    this.montar();
    this.redimensionar(this.largura, this.altura, this.dpr);
  }

  private montar(): void {
    if (this.qualidade === 'baixa') return;
    const gl = this.renderer.getContext();
    const webgl2 =
      typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const alvo = new THREE.WebGLRenderTarget(2, 2, {
      type: THREE.HalfFloatType,
      samples: webgl2 && this.qualidade === 'alta' ? 4 : 0,
    });
    this.composer = new EffectComposer(this.renderer, alvo);
    this.composer.addPass(new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera()));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.35, 1.12);
    this.composer.addPass(this.bloom);
    this.passoPulso = new ShaderPass(SHADER_PULSO);
    this.passoPulso.enabled = false;
    this.composer.addPass(this.passoPulso);
    this.composer.addPass(new OutputPass());
  }

  private desmontar(): void {
    if (!this.composer) return;
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.bloom?.dispose();
    this.composer.dispose();
    this.composer = null;
    this.bloom = null;
    this.passoPulso = null;
  }

  /** Chame junto com renderer.setSize (largura/altura em px CSS). */
  redimensionar(largura: number, altura: number, dpr: number): void {
    this.largura = largura;
    this.altura = altura;
    this.dpr = dpr;
    if (!this.composer || !this.bloom) return;
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(largura, altura);
    // bloom em resolução reduzida (metade na alta, um terço na média)
    const div = this.qualidade === 'alta' ? 2 : 3;
    this.bloom.setSize(
      Math.max(64, Math.round((largura * dpr) / div)),
      Math.max(64, Math.round((altura * dpr) / div))
    );
  }

  /** Clarão de impacto (cor) com aberração cromática; forca ~0.2–1. */
  pulso(cor: THREE.ColorRepresentation, forca = 0.5): void {
    this.corPulso.set(cor);
    this.forcaPulso = Math.max(this.forcaPulso, forca);
    this.aberracao = Math.max(this.aberracao, forca * 0.02);
  }

  /** Avança o pulso (chame uma vez por quadro). */
  atualizar(dt: number): void {
    this.forcaPulso = Math.max(0, this.forcaPulso - dt * 3.2);
    this.aberracao = Math.max(0, this.aberracao - dt * 0.09);
  }

  /** Desenha a cena (com bloom quando ativo). */
  render(renderer: THREE.WebGLRenderer, cena: THREE.Scene, camera: THREE.Camera): void {
    if (!this.composer || !this.bloom) {
      renderer.render(cena, camera);
      return;
    }
    const passo = this.composer.passes[0] as RenderPass;
    passo.scene = cena;
    passo.camera = camera;
    this.bloom.strength = 0.38 * this.intensidade;
    this.bloom.enabled = this.intensidade > 0.01;
    if (this.passoPulso) {
      const ativo = this.forcaPulso > 0.003 || this.aberracao > 0.0003;
      this.passoPulso.enabled = ativo;
      if (ativo) {
        const u = this.passoPulso.uniforms;
        u.uForca.value = Math.min(0.85, this.forcaPulso * 0.55);
        u.uAberracao.value = this.aberracao;
        (u.uCor.value as THREE.Color).copy(this.corPulso);
      }
    }
    this.composer.render();
  }

  descartar(): void {
    this.desmontar();
  }
}
