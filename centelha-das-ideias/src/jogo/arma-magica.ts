/**
 * A arma mágica: flutua ao lado do Claude (não precisa estar presa ao braço) e é
 * guiada por magia. No golpe ela voa em arco, cresce, deixa um rastro brilhante e
 * volta a encolher. Cada tipo de arma tem seu movimento (corte, giro, estocada,
 * pancada, colherada, disparo, defesa).
 */
import * as THREE from 'three';
import { ARMAS } from '../dados/armas';
import { aproximar, suavizar } from '../nucleo/matematica';
import type { IdArma } from '../nucleo/tipos';
import { criarModeloArma, type ModeloArma } from '../render/modelos';
import type { SistemaParticulas } from '../render/particulas';

export type Movimento =
  | 'repouso'
  | 'corte'
  | 'giro'
  | 'estocada'
  | 'esmagar'
  | 'erguer'
  | 'disparo'
  | 'defesa'
  | 'investida';

const AMOSTRAS = 18;

class Rastro {
  readonly malha: THREE.Mesh;
  private base: THREE.Vector3[] = [];
  private ponta: THREE.Vector3[] = [];
  private pos: Float32Array;
  private cor: Float32Array;
  private corBase = new THREE.Color();
  ativo = false;

  constructor() {
    this.pos = new Float32Array(AMOSTRAS * 2 * 3);
    this.cor = new Float32Array(AMOSTRAS * 2 * 4);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage)
    );
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(this.cor, 4).setUsage(THREE.DynamicDrawUsage)
    );
    const idx: number[] = [];
    for (let i = 0; i < AMOSTRAS - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.malha = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.malha.frustumCulled = false;
    this.malha.renderOrder = 11;
  }

  definirCor(c: string): void {
    this.corBase.set(c);
  }

  amostrar(b: THREE.Vector3, p: THREE.Vector3): void {
    this.base.unshift(b.clone());
    this.ponta.unshift(p.clone());
    if (this.base.length > AMOSTRAS) {
      this.base.pop();
      this.ponta.pop();
    }
  }

  esvaziar(dt: number): void {
    // encolhe o rastro quando o golpe acaba
    const n = Math.max(1, Math.floor(dt * 90));
    for (let i = 0; i < n && this.base.length; i++) {
      this.base.pop();
      this.ponta.pop();
    }
  }

  atualizar(): void {
    const n = this.base.length;
    for (let i = 0; i < AMOSTRAS; i++) {
      const k = Math.min(i, Math.max(0, n - 1));
      const b = this.base[k];
      const p = this.ponta[k];
      const alfa = n > 1 && i < n ? (1 - i / n) * 0.85 : 0;
      if (b && p) {
        // base do rastro: perto da ponta (fita mais fina e elegante)
        const meio = b.clone().lerp(p, 0.45);
        this.pos.set([meio.x, meio.y, meio.z], i * 6);
        this.pos.set([p.x, p.y, p.z], i * 6 + 3);
      }
      this.cor.set([this.corBase.r, this.corBase.g, this.corBase.b, alfa * 0.3], i * 8);
      this.cor.set([1, 1, 1, alfa], i * 8 + 4);
    }
    this.malha.geometry.attributes.position.needsUpdate = true;
    this.malha.geometry.attributes.color.needsUpdate = true;
    this.malha.visible = n > 1;
  }
}

export class ArmaMagica {
  readonly grupo = new THREE.Group();
  private modelos = new Map<IdArma, ModeloArma>();
  private atual: ModeloArma | null = null;
  private idAtual: IdArma | null = null;
  readonly rastro = new Rastro();
  private anelMao: THREE.Mesh;
  private aura: THREE.Sprite;

  movimento: Movimento = 'repouso';
  private t = 0;
  private duracao = 0.3;
  private angulo = 0;
  private arco = Math.PI;
  private sentido = 1;
  private crescimento = 2;
  private raio = 1;
  private escala = 1;
  private tempo = 0;
  private posSuave = new THREE.Vector3();
  private quatSuave = new THREE.Quaternion();
  private iniciou = false;
  private brilhoNivel = 0;
  private aparecer = 0;

  private v1 = new THREE.Vector3();
  private v2 = new THREE.Vector3();
  private q1 = new THREE.Quaternion();
  private cima = new THREE.Vector3(0, 1, 0);

  constructor(private brilhos: SistemaParticulas) {
    this.anelMao = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.025, 4, 18),
      new THREE.MeshBasicMaterial({
        color: '#ffe9a8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.anelMao.renderOrder = 12;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    this.aura = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      })
    );
    this.aura.scale.setScalar(1.2);
    this.grupo.visible = false;
  }

  /** Objetos que vão para a cena. */
  objetos(): THREE.Object3D[] {
    return [this.grupo, this.rastro.malha, this.anelMao, this.aura];
  }

  get arma(): IdArma | null {
    return this.idAtual;
  }

  equipar(id: IdArma | null, nivel: number): void {
    if (id === this.idAtual) {
      this.brilhoNivel = nivel;
      return;
    }
    if (this.atual) this.grupo.remove(this.atual.grupo);
    this.idAtual = id;
    this.brilhoNivel = nivel;
    if (!id) {
      this.atual = null;
      this.grupo.visible = false;
      return;
    }
    let m = this.modelos.get(id);
    if (!m) {
      m = criarModeloArma(id);
      this.modelos.set(id, m);
    }
    this.atual = m;
    this.grupo.add(m.grupo);
    this.grupo.visible = true;
    this.rastro.definirCor(ARMAS[id].brilho);
    (this.aura.material as THREE.SpriteMaterial).color.set(ARMAS[id].brilho);
    this.aparecer = 1;
    // poeira mágica de troca
    const p = this.posSuave;
    this.brilhos.explosao(p.x, p.y, p.z, 18, {
      cor: ARMAS[id].brilho,
      tamanho: 0.25,
      vida: 0.6,
      velocidade: 3,
      gravidade: -1,
    });
  }

  /** Inicia um movimento de golpe. */
  golpear(
    m: Movimento,
    angulo: number,
    duracao: number,
    opcoes: { arco?: number; sentido?: number; crescimento?: number; raio?: number } = {}
  ): void {
    this.movimento = m;
    this.t = 0;
    this.duracao = duracao;
    this.angulo = angulo;
    this.arco = opcoes.arco ?? Math.PI * 0.8;
    this.sentido = opcoes.sentido ?? 1;
    this.crescimento = opcoes.crescimento ?? 2;
    this.raio = opcoes.raio ?? 0.5;
  }

  /** Progresso do golpe (0..1) ou -1. */
  get progresso(): number {
    return this.movimento === 'repouso' || this.movimento === 'defesa'
      ? -1
      : Math.min(1, this.t / this.duracao);
  }

  defender(ativo: boolean, angulo: number): void {
    if (ativo) {
      this.movimento = 'defesa';
      this.angulo = angulo;
    } else if (this.movimento === 'defesa') this.movimento = 'repouso';
  }

  /** Posição da ponta no mundo. */
  pontaMundo(alvo: THREE.Vector3): THREE.Vector3 {
    if (!this.atual) return alvo.copy(this.posSuave);
    return this.atual.ponta.getWorldPosition(alvo);
  }

  atualizar(
    dt: number,
    px: number,
    py: number,
    pz: number,
    anguloJogador: number,
    mao: THREE.Vector3,
    escondido: boolean
  ): void {
    this.tempo += dt;
    if (!this.atual) {
      this.rastro.esvaziar(dt);
      this.rastro.atualizar();
      return;
    }
    const tempo = this.tempo;
    let alvoPos = this.v1;
    let alvoQuat = this.q1;
    let escalaAlvo = 1;
    let seguir = 14;

    if (this.movimento !== 'repouso' && this.movimento !== 'defesa') {
      this.t += dt;
      if (this.t >= this.duracao) this.movimento = 'repouso';
    }
    const p = this.progresso;
    const cresce = p >= 0 ? Math.sin(Math.min(1, p * 1.15) * Math.PI) : 0;

    switch (this.movimento) {
      case 'repouso': {
        // flutua atrás do ombro direito, girando devagar
        const lado = new THREE.Vector3(
          0.72,
          1.5 + Math.sin(tempo * 2.2) * 0.1,
          -0.32
        ).applyAxisAngle(this.cima, anguloJogador);
        alvoPos.set(px + lado.x, py + lado.y, pz + lado.z);
        alvoQuat.setFromEuler(
          new THREE.Euler(0.35 + Math.sin(tempo * 1.4) * 0.12, anguloJogador + tempo * 0.6, 0.45)
        );
        escalaAlvo = 0.82;
        seguir = 10;
        break;
      }
      case 'corte':
      case 'giro': {
        const e = suavizar.entradaSaida(p);
        const a =
          this.movimento === 'giro'
            ? this.angulo + this.sentido * Math.PI * 2 * e
            : this.angulo + this.sentido * (-this.arco / 2 + this.arco * e);
        const dir = this.v2
          .set(Math.sin(a), 0.18 - Math.sin(p * Math.PI) * 0.12, Math.cos(a))
          .normalize();
        alvoPos.set(
          px + dir.x * this.raio,
          py + 0.75 + Math.sin(p * Math.PI) * 0.15,
          pz + dir.z * this.raio
        );
        alvoQuat.setFromUnitVectors(this.cima, dir);
        alvoQuat.multiply(
          new THREE.Quaternion().setFromAxisAngle(this.cima, a + this.sentido * 0.5)
        );
        escalaAlvo = 1 + (this.crescimento - 1) * cresce;
        seguir = 60;
        break;
      }
      case 'estocada':
      case 'investida': {
        const dir = this.v2.set(Math.sin(this.angulo), 0.05, Math.cos(this.angulo)).normalize();
        const avanco = this.movimento === 'investida' ? 0.55 : 0.3 + Math.sin(p * Math.PI) * 1.1;
        alvoPos.set(px + dir.x * avanco, py + 0.72, pz + dir.z * avanco);
        alvoQuat.setFromUnitVectors(this.cima, dir);
        alvoQuat.multiply(new THREE.Quaternion().setFromAxisAngle(this.cima, tempo * 20));
        escalaAlvo = 1 + (this.crescimento - 1) * (this.movimento === 'investida' ? 1 : cresce);
        seguir = 60;
        break;
      }
      case 'esmagar':
      case 'erguer': {
        const e = suavizar.entradaSaida(p);
        const el = this.movimento === 'esmagar' ? 1.45 - e * 1.75 : -0.4 + e * 1.8;
        const dir = this.v2.set(
          Math.sin(this.angulo) * Math.cos(el),
          Math.sin(el),
          Math.cos(this.angulo) * Math.cos(el)
        );
        alvoPos.set(
          px + Math.sin(this.angulo) * 0.35,
          py + 0.85,
          pz + Math.cos(this.angulo) * 0.35
        );
        alvoQuat.setFromUnitVectors(this.cima, dir.normalize());
        escalaAlvo = 1 + (this.crescimento - 1) * cresce;
        seguir = 60;
        break;
      }
      case 'disparo': {
        const recuo = p < 0.3 ? -p * 0.8 : -(1 - p) * 0.35;
        const dir = this.v2.set(Math.sin(this.angulo), 0.25, Math.cos(this.angulo)).normalize();
        alvoPos.set(px + dir.x * (0.55 + recuo), py + 0.95, pz + dir.z * (0.55 + recuo));
        alvoQuat.setFromUnitVectors(this.cima, dir);
        escalaAlvo = 1 + (this.crescimento - 1) * cresce * 0.6;
        seguir = 40;
        break;
      }
      case 'defesa': {
        const dir = this.v2.set(Math.sin(this.angulo), 0, Math.cos(this.angulo));
        alvoPos.set(px + dir.x * 0.75, py + 0.25, pz + dir.z * 0.75);
        alvoQuat.setFromEuler(new THREE.Euler(0, this.angulo, 0));
        escalaAlvo = 1.55;
        seguir = 30;
        break;
      }
    }

    if (!this.iniciou) {
      this.posSuave.copy(alvoPos);
      this.quatSuave.copy(alvoQuat);
      this.iniciou = true;
    }
    const k = 1 - Math.exp(-seguir * dt);
    this.posSuave.lerp(alvoPos, k);
    this.quatSuave.slerp(alvoQuat, k);
    this.aparecer = Math.max(0, this.aparecer - dt * 2.5);
    this.escala = aproximar(this.escala, escalaAlvo, 22, dt);
    const pop = 1 + Math.sin(this.aparecer * Math.PI) * 0.5;
    this.grupo.position.copy(this.posSuave);
    this.grupo.quaternion.copy(this.quatSuave);
    this.grupo.scale.setScalar(
      this.escala * pop * (this.aparecer > 0 ? 1 - this.aparecer * 0.4 : 1)
    );

    // aura e magia guiando a arma a partir da mão
    const golpeando = p >= 0 || this.movimento === 'defesa';
    this.aura.position.copy(this.posSuave);
    (this.aura.material as THREE.SpriteMaterial).opacity =
      (golpeando ? 0.75 : 0.35 + Math.sin(tempo * 3) * 0.1) *
      (escondido ? 0.4 : 1) *
      (1 + this.brilhoNivel * 0.08);
    this.aura.scale.setScalar(0.9 + this.escala * 0.6 + (this.brilhoNivel >= 5 ? 0.5 : 0));
    const anel = this.anelMao.material as THREE.MeshBasicMaterial;
    anel.opacity = aproximar(anel.opacity, golpeando ? 0.95 : 0, 18, dt);
    this.anelMao.position.copy(mao);
    this.anelMao.rotation.set(tempo * 4, tempo * 3, 0);
    this.anelMao.scale.setScalar(1 + Math.sin(tempo * 20) * 0.15);
    if (golpeando && Math.random() < 0.9) {
      const t = Math.random();
      const pp = this.v2.copy(mao).lerp(this.posSuave, t);
      this.brilhos.emitir({
        x: pp.x,
        y: pp.y,
        z: pp.z,
        vy: 0.5,
        vida: 0.35,
        tamanho: 0.13,
        cor: ARMAS[this.idAtual!].brilho,
        arrasto: 4,
      });
    } else if (Math.random() < 0.12 + this.brilhoNivel * 0.05) {
      this.brilhos.emitir({
        x: this.posSuave.x + (Math.random() - 0.5) * 0.4,
        y: this.posSuave.y,
        z: this.posSuave.z + (Math.random() - 0.5) * 0.4,
        vy: 0.6,
        vida: 0.8,
        tamanho: 0.1,
        cor: this.brilhoNivel >= 5 ? '#ffd27a' : ARMAS[this.idAtual!].brilho,
      });
    }

    // rastro do golpe
    if (p >= 0 && this.movimento !== 'disparo') {
      const ponta = this.atual.ponta.getWorldPosition(new THREE.Vector3());
      this.rastro.amostrar(this.posSuave, ponta);
    } else this.rastro.esvaziar(dt);
    this.rastro.atualizar();
  }
}
