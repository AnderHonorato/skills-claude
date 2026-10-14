/**
 * O Claude em 3D: corpo terracota arredondado, olhos escuros, bracinhos e pezinhos,
 * e a centelha que flutua sobre a cabeça. Toda a animação é procedural: andar,
 * correr, pular (antecipação, estica, encolhe), rolar, golpear, apanhar, dormir,
 * e linguagem corporal para cada emoção.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Humor } from '../nucleo/tipos';
import { aproximar, aproximarAngulo, limitar } from '../nucleo/matematica';
import { Emote } from './emotes';
import { gradienteToon } from './materiais';
import { Rosto } from './rosto';

export interface EstadoAnimacao {
  /** Velocidade horizontal (m/s) e a máxima de corrida. */
  velocidade: number;
  noChao: boolean;
  vy: number;
  /** Ângulo para onde o corpo olha (rad, 0 = +z). */
  angulo: number;
  /** 0..1 durante o golpe; -1 = sem golpe. */
  golpe: number;
  /** Ângulo do golpe atual (para torcer o corpo). */
  anguloGolpe: number;
  /** 0..1 durante a esquiva; -1 = sem esquiva. */
  esquiva: number;
  ferido: number;
  humor: Humor;
  escondido: boolean;
  defendendo: boolean;
  falando: boolean;
  /** 0..1 enquanto a habilidade é lançada. */
  conjurando: number;
}

const COR_CORPO = '#D97757';
const COR_ESCURA = '#B65A3E';

export class ModeloClaude {
  readonly raiz = new THREE.Group();
  /** Pivô de giro (olha para a direção do movimento). */
  private giro = new THREE.Group();
  /** Pivô de achatamento/estiramento (na base). */
  private mola = new THREE.Group();
  private corpo = new THREE.Group();
  /** Pivô central (para a cambalhota da esquiva). */
  private nucleo = new THREE.Group();
  private bracoE = new THREE.Group();
  private bracoD = new THREE.Group();
  private peE = new THREE.Group();
  private peD = new THREE.Group();
  private centelha: THREE.Mesh;
  private brilhoCentelha: THREE.Sprite;
  readonly rosto: Rosto;
  readonly emote = new Emote(2.0);
  private materiais: THREE.MeshToonMaterial[] = [];
  private matCentelha: THREE.MeshBasicMaterial;
  private sombra: THREE.Mesh;
  /** Mão direita em coordenadas do mundo (de onde sai a magia que guia a arma). */
  readonly mao = new THREE.Object3D();

  private fase = 0;
  private esticar = 0;
  private esticarV = 0;
  private tempo = 0;
  private noChaoAntes = true;
  private anguloVisual = 0;
  private inclinacao = 0;
  private girar = 0;
  private flash = 0;

  constructor() {
    const mat = (cor: string) => {
      const m = new THREE.MeshToonMaterial({
        color: cor,
        gradientMap: gradienteToon(),
        transparent: true,
      });
      this.materiais.push(m);
      return m;
    };
    const corpoMat = mat(COR_CORPO);
    const escuroMat = mat(COR_ESCURA);

    // corpo: bloco arredondado, levemente mais largo embaixo
    const geoCorpo = new RoundedBoxGeometry(0.92, 0.82, 0.72, 5, 0.24);
    const tronco = new THREE.Mesh(geoCorpo, corpoMat);
    tronco.castShadow = true;
    this.nucleo.position.y = 0.62;
    this.corpo.add(this.nucleo);
    this.nucleo.add(tronco);
    // contorno cartoon (casca invertida)
    const contorno = new THREE.Mesh(
      geoCorpo,
      new THREE.MeshBasicMaterial({ color: '#3a2228', side: THREE.BackSide })
    );
    contorno.position.copy(tronco.position);
    contorno.scale.setScalar(1.06);
    this.nucleo.add(contorno);

    // rosto na frente (+z)
    this.rosto = new Rosto({ separacao: 0.17, tamanho: 0.085 });
    this.rosto.grupo.position.set(0, 0.08, 0.365);
    this.nucleo.add(this.rosto.grupo);

    // bracinhos
    for (const [g, lado] of [
      [this.bracoE, -1],
      [this.bracoD, 1],
    ] as const) {
      g.position.set(lado * 0.47, 0.04, 0);
      const braco = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.2, 4, 8), escuroMat);
      braco.position.y = -0.14;
      braco.castShadow = true;
      g.add(braco);
      this.nucleo.add(g);
    }
    const ponta = new THREE.Object3D();
    ponta.position.y = -0.3;
    this.bracoD.add(ponta);
    ponta.add(this.mao);

    // pezinhos
    for (const [g, lado] of [
      [this.peE, -1],
      [this.peD, 1],
    ] as const) {
      g.position.set(lado * 0.2, 0.2, 0);
      const pe = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.12, 4, 8), escuroMat);
      pe.rotation.x = Math.PI / 2;
      pe.position.set(0, -0.11, 0.04);
      pe.castShadow = true;
      g.add(pe);
      this.mola.add(g);
    }

    // a centelha sobre a cabeça
    this.matCentelha = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
    this.centelha = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), this.matCentelha);
    this.centelha.position.set(0, 0.7, 0);
    this.nucleo.add(this.centelha);
    const texBrilho = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d')!;
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,240,200,1)');
      gr.addColorStop(1, 'rgba(255,200,120,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.brilhoCentelha = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texBrilho,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
      })
    );
    this.brilhoCentelha.scale.setScalar(0.7);
    this.brilhoCentelha.position.copy(this.centelha.position);
    this.nucleo.add(this.brilhoCentelha);

    this.mola.add(this.corpo);
    this.giro.add(this.mola);
    this.raiz.add(this.giro);
    this.raiz.add(this.emote.sprite);

    // sombra de contato (ajuda a ler a altura do pulo)
    this.sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.42, 20),
      new THREE.MeshBasicMaterial({
        color: '#1d1720',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.renderOrder = 2;
  }

  /** Sombra de contato: adicionada à cena separadamente (fica no chão). */
  get sombraContato(): THREE.Mesh {
    return this.sombra;
  }

  /** Impulso de mola: positivo estica, negativo achata. */
  impulso(v: number): void {
    this.esticarV += v;
  }

  piscarBranco(): void {
    this.flash = 0.18;
  }

  posicionarSombra(x: number, chao: number, z: number, altura: number): void {
    this.sombra.position.set(x, chao + 0.03, z);
    const s = limitar(1 - altura * 0.12, 0.35, 1);
    this.sombra.scale.setScalar(s);
    (this.sombra.material as THREE.MeshBasicMaterial).opacity = 0.35 * s;
    this.sombra.visible = chao > -50;
  }

  atualizar(dt: number, e: EstadoAnimacao): void {
    this.tempo += dt;
    const t = this.tempo;
    const vel = e.velocidade;
    const andando = e.noChao && vel > 0.4;

    // giro suave com inclinação nas curvas
    const antes = this.anguloVisual;
    const alvoGiro = e.golpe >= 0 ? e.anguloGolpe : e.angulo;
    this.anguloVisual = aproximarAngulo(this.anguloVisual, alvoGiro, e.golpe >= 0 ? 30 : 14, dt);
    const taxaGiro = (this.anguloVisual - antes) / Math.max(dt, 1e-4);
    this.giro.rotation.y = this.anguloVisual;

    // mola de achatar/esticar
    if (e.noChao && !this.noChaoAntes) this.esticarV -= 2.6 + Math.min(4, Math.abs(e.vy) * 0.18);
    if (!e.noChao && this.noChaoAntes && e.vy > 0) this.esticarV += 3.2;
    this.noChaoAntes = e.noChao;
    const k = 220;
    const c = 13;
    this.esticarV += (-k * this.esticar - c * this.esticarV) * dt;
    this.esticar += this.esticarV * dt;
    const alvoAr = e.noChao ? 0 : limitar(e.vy * 0.012, -0.08, 0.14);
    const s = limitar(this.esticar + alvoAr, -0.35, 0.35);
    let respira = Math.sin(t * 2.2) * 0.018;
    if (e.humor === 'sonolento') respira = Math.sin(t * 1.3) * 0.04;
    this.mola.scale.set(1 - s * 0.5 - respira * 0.5, 1 + s + respira, 1 - s * 0.5 - respira * 0.5);

    // ciclo de passos
    const ritmo = andando ? 7 + vel * 1.6 : 0;
    this.fase += ritmo * dt;
    const passo = Math.sin(this.fase);
    const quique = andando ? Math.abs(Math.sin(this.fase)) * 0.07 * Math.min(1, vel / 4) : 0;
    let corpoY = quique;
    let inclinaAlvo = limitar(vel * 0.035, 0, 0.26);
    let rolar = 0;
    let girarY = 0;

    // linguagem corporal de cada emoção
    switch (e.humor) {
      case 'triste':
        inclinaAlvo += 0.12;
        corpoY -= 0.03;
        break;
      case 'medo':
        rolar = Math.sin(t * 50) * 0.04;
        inclinaAlvo -= 0.1;
        break;
      case 'raiva':
        rolar = Math.sin(t * 38) * 0.03;
        inclinaAlvo += 0.08;
        break;
      case 'feliz':
        if (!andando && e.noChao) corpoY += Math.abs(Math.sin(t * 7)) * 0.1;
        rolar = Math.sin(t * 7) * 0.06;
        break;
      case 'curioso':
        rolar = 0.22 + Math.sin(t * 1.5) * 0.04;
        break;
      case 'envergonhado':
        inclinaAlvo += 0.15;
        girarY = Math.sin(t * 3) * 0.25;
        break;
      case 'sonolento':
        rolar = Math.sin(t * 0.9) * 0.12;
        inclinaAlvo += 0.14 + Math.sin(t * 0.9) * 0.06;
        break;
      case 'determinado':
        inclinaAlvo += 0.06;
        break;
      case 'carinho':
        rolar = Math.sin(t * 2.5) * 0.1;
        break;
      case 'dor':
        inclinaAlvo -= 0.25;
        break;
    }
    if (e.ferido > 0) inclinaAlvo -= 0.4 * e.ferido;
    this.inclinacao = aproximar(this.inclinacao, inclinaAlvo, 10, dt);
    this.girar = aproximar(this.girar, limitar(-taxaGiro * 0.05, -0.35, 0.35), 10, dt);

    // esquiva: cambalhota para frente
    let cambalhota = 0;
    if (e.esquiva >= 0) cambalhota = e.esquiva * Math.PI * 2;
    this.corpo.position.y = corpoY;
    this.corpo.rotation.set(this.inclinacao, girarY, this.girar + rolar);
    this.nucleo.rotation.x = cambalhota;
    if (e.esquiva >= 0) this.corpo.position.y += Math.sin(e.esquiva * Math.PI) * 0.35;

    // pés
    if (andando) {
      this.peE.rotation.x = passo * 0.9;
      this.peD.rotation.x = -passo * 0.9;
      this.peE.position.y = 0.2 + Math.max(0, Math.sin(this.fase)) * 0.09;
      this.peD.position.y = 0.2 + Math.max(0, -Math.sin(this.fase)) * 0.09;
    } else if (!e.noChao) {
      this.peE.rotation.x = aproximar(this.peE.rotation.x, -0.6, 12, dt);
      this.peD.rotation.x = aproximar(this.peD.rotation.x, 0.4, 12, dt);
      this.peE.position.y = aproximar(this.peE.position.y, 0.3, 12, dt);
      this.peD.position.y = aproximar(this.peD.position.y, 0.26, 12, dt);
    } else {
      for (const p of [this.peE, this.peD]) {
        p.rotation.x = aproximar(p.rotation.x, 0, 14, dt);
        p.position.y = aproximar(p.position.y, 0.2, 14, dt);
      }
    }

    // braços: balanço, no ar para cima, golpe guiando a magia
    let alvoEX = andando ? -passo * 0.9 : 0;
    let alvoDX = andando ? passo * 0.9 : 0;
    let alvoEZ = -0.15;
    let alvoDZ = 0.15;
    if (!e.noChao) {
      alvoEZ = -1.5;
      alvoDZ = 1.5;
      alvoEX = -0.3;
      alvoDX = -0.3;
    }
    if (e.humor === 'feliz' && !andando && e.noChao) {
      alvoEZ = -2.4 + Math.sin(t * 7) * 0.4;
      alvoDZ = 2.4 - Math.sin(t * 7) * 0.4;
    }
    if (e.humor === 'medo' || e.humor === 'envergonhado') {
      alvoEX = -1.2;
      alvoDX = -1.2;
      alvoEZ = 0.5;
      alvoDZ = -0.5;
    }
    if (e.humor === 'raiva' && !andando) {
      alvoEZ = -0.6 + Math.sin(t * 30) * 0.1;
      alvoDZ = 0.6 - Math.sin(t * 30) * 0.1;
    }
    if (e.falando) alvoDX = -0.7 + Math.sin(t * 6) * 0.35;
    if (e.golpe >= 0) {
      // braço direito aponta e "rege" a arma
      alvoDX = -1.6 + Math.sin(e.golpe * Math.PI) * 0.3;
      alvoDZ = 0.3 - e.golpe * 0.6;
    }
    if (e.defendendo) {
      alvoDX = -1.5;
      alvoEX = -1.5;
      alvoEZ = 0.4;
      alvoDZ = -0.4;
    }
    if (e.conjurando > 0) {
      alvoEZ = -2.6;
      alvoDZ = 2.6;
    }
    const kb = e.golpe >= 0 ? 30 : 12;
    this.bracoE.rotation.x = aproximar(this.bracoE.rotation.x, alvoEX, kb, dt);
    this.bracoD.rotation.x = aproximar(this.bracoD.rotation.x, alvoDX, kb, dt);
    this.bracoE.rotation.z = aproximar(this.bracoE.rotation.z, alvoEZ, kb, dt);
    this.bracoD.rotation.z = aproximar(this.bracoD.rotation.z, alvoDZ, kb, dt);

    // olhar: acompanha a direção e às vezes passeia
    const olharX = Math.sin(t * 0.7) * 0.3 + limitar(taxaGiro * -0.1, -0.6, 0.6);
    this.rosto.olhar.set(
      aproximar(this.rosto.olhar.x, olharX, 6, dt),
      aproximar(this.rosto.olhar.y, e.humor === 'sonolento' ? -0.4 : 0, 6, dt)
    );
    this.rosto.definirHumor(e.ferido > 0.4 ? 'dor' : e.humor);
    this.rosto.atualizar(dt);

    // centelha: cor e tamanho conforme a emoção
    const corC = COR_CENTELHA[e.humor] ?? '#ffd27a';
    this.matCentelha.color.lerp(new THREE.Color(corC), 1 - Math.exp(-6 * dt));
    (this.brilhoCentelha.material as THREE.SpriteMaterial).color.copy(this.matCentelha.color);
    const pulso =
      e.humor === 'determinado'
        ? 1.5 + Math.sin(t * 12) * 0.2
        : e.humor === 'triste'
          ? 0.75
          : e.humor === 'sonolento'
            ? 0.6
            : 1 + Math.sin(t * 3) * 0.08;
    this.centelha.scale.setScalar(pulso);
    this.centelha.rotation.y = t * 2.4;
    this.centelha.position.y = 0.7 + Math.sin(t * 2.6) * 0.05 + (e.humor === 'triste' ? -0.08 : 0);
    this.brilhoCentelha.position.copy(this.centelha.position);
    this.brilhoCentelha.scale.setScalar(0.65 * pulso + (e.conjurando > 0 ? 0.8 : 0));

    // transparência dentro do mato e brilho de dano
    this.flash = Math.max(0, this.flash - dt);
    const alfa = e.escondido ? 0.45 : 1;
    for (const m of this.materiais) {
      m.opacity = aproximar(m.opacity, alfa, 10, dt);
      m.emissive.setRGB(this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0);
      m.depthWrite = m.opacity > 0.95;
    }
    this.emote.atualizar(dt);
  }
}

const COR_CENTELHA: Partial<Record<Humor, string>> = {
  feliz: '#ffe27a',
  triste: '#8fb6ff',
  raiva: '#ff6b5a',
  surpreso: '#ffffff',
  medo: '#c9b8ff',
  curioso: '#7af0d0',
  determinado: '#ff9b3d',
  envergonhado: '#ff9fb8',
  sonolento: '#9aa0c8',
  carinho: '#ff8fb0',
  dor: '#ff6b5a',
};
