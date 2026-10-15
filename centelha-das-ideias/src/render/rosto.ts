/**
 * Rosto expressivo reutilizável (Claude e NPCs): olhos com piscar e olhar,
 * sobrancelhas, várias bocas e bochechas coradas. Transições suaves entre emoções.
 */
import * as THREE from 'three';
import type { Humor } from '../nucleo/tipos';
import { aproximar } from '../nucleo/matematica';

interface Pose {
  /** Escala dos olhos (x, y). */
  olho: [number, number];
  /** Olhos felizes em arco (^ ^). */
  arco: number;
  /** Olhos de dor (> <). */
  xis: number;
  /** Ângulo das sobrancelhas (positivo = bravo, negativo = triste) e altura. */
  sobr: number;
  sobrY: number;
  sobrVis: number;
  boca: 'sorriso' | 'sorrisao' | 'linha' | 'o' | 'triste' | 'aberta' | 'ondulada';
  rubor: number;
  /** Deslocamento vertical do olhar. */
  olharY: number;
}

const POSES: Record<Humor, Pose> = {
  neutro: {
    olho: [1, 1],
    arco: 0,
    xis: 0,
    sobr: 0,
    sobrY: 0,
    sobrVis: 0,
    boca: 'sorriso',
    rubor: 0,
    olharY: 0,
  },
  feliz: {
    olho: [1, 1],
    arco: 1,
    xis: 0,
    sobr: -0.1,
    sobrY: 0.02,
    sobrVis: 0,
    boca: 'sorrisao',
    rubor: 0.6,
    olharY: 0,
  },
  triste: {
    olho: [0.95, 0.85],
    arco: 0,
    xis: 0,
    sobr: -0.55,
    sobrY: 0.01,
    sobrVis: 1,
    boca: 'triste',
    rubor: 0,
    olharY: -0.02,
  },
  raiva: {
    olho: [1, 0.8],
    arco: 0,
    xis: 0,
    sobr: 0.6,
    sobrY: -0.02,
    sobrVis: 1,
    boca: 'ondulada',
    rubor: 0.3,
    olharY: 0,
  },
  surpreso: {
    olho: [1.3, 1.4],
    arco: 0,
    xis: 0,
    sobr: -0.15,
    sobrY: 0.06,
    sobrVis: 1,
    boca: 'o',
    rubor: 0,
    olharY: 0.01,
  },
  medo: {
    olho: [0.75, 1.15],
    arco: 0,
    xis: 0,
    sobr: -0.45,
    sobrY: 0.04,
    sobrVis: 1,
    boca: 'ondulada',
    rubor: 0,
    olharY: 0,
  },
  curioso: {
    olho: [1.1, 1.1],
    arco: 0,
    xis: 0,
    sobr: -0.2,
    sobrY: 0.04,
    sobrVis: 1,
    boca: 'o',
    rubor: 0,
    olharY: 0.02,
  },
  determinado: {
    olho: [1, 0.85],
    arco: 0,
    xis: 0,
    sobr: 0.3,
    sobrY: -0.01,
    sobrVis: 1,
    boca: 'linha',
    rubor: 0,
    olharY: 0,
  },
  envergonhado: {
    olho: [0.9, 0.9],
    arco: 0,
    xis: 0,
    sobr: -0.3,
    sobrY: 0.02,
    sobrVis: 1,
    boca: 'ondulada',
    rubor: 1,
    olharY: -0.035,
  },
  sonolento: {
    olho: [1.05, 0.18],
    arco: 0,
    xis: 0,
    sobr: -0.05,
    sobrY: -0.01,
    sobrVis: 0,
    boca: 'o',
    rubor: 0,
    olharY: -0.02,
  },
  carinho: {
    olho: [1, 1],
    arco: 1,
    xis: 0,
    sobr: -0.25,
    sobrY: 0.02,
    sobrVis: 0,
    boca: 'sorriso',
    rubor: 1,
    olharY: 0,
  },
  dor: {
    olho: [1, 1],
    arco: 0,
    xis: 1,
    sobr: 0.4,
    sobrY: 0,
    sobrVis: 1,
    boca: 'aberta',
    rubor: 0,
    olharY: 0,
  },
};

export interface OpcoesRosto {
  /** Distância entre os olhos e tamanho base. */
  separacao: number;
  tamanho: number;
  corOlho?: THREE.ColorRepresentation;
  corRubor?: THREE.ColorRepresentation;
}

export class Rosto {
  readonly grupo = new THREE.Group();
  private olhos: THREE.Group[] = [];
  private arcos: THREE.Mesh[] = [];
  private xis: THREE.Group[] = [];
  private sobrancelhas: THREE.Mesh[] = [];
  private brilhos: THREE.Mesh[] = [];
  private bocas: Record<Pose['boca'], THREE.Object3D>;
  private rubores: THREE.Mesh[] = [];
  private matRubor: THREE.MeshBasicMaterial;
  humor: Humor = 'neutro';
  private atual = {
    ox: 1,
    oy: 1,
    arco: 0,
    xis: 0,
    sobr: 0,
    sobrY: 0,
    sobrVis: 0,
    rubor: 0,
    olharY: 0,
  };
  private piscar = 0;
  private proximoPiscar = 2;
  olhar = new THREE.Vector2();
  private tempo = 0;

  constructor(private o: OpcoesRosto) {
    const preto = new THREE.MeshBasicMaterial({ color: o.corOlho ?? '#1d1720' });
    const branco = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const t = o.tamanho;
    for (const lado of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(lado * o.separacao, 0, 0);
      const olho = new THREE.Mesh(new THREE.CapsuleGeometry(t * 0.55, t * 0.7, 4, 10), preto);
      olho.scale.z = 0.5;
      g.add(olho);
      const brilho = new THREE.Mesh(new THREE.SphereGeometry(t * 0.22, 8, 6), branco);
      brilho.position.set(t * 0.18, t * 0.35, t * 0.22);
      g.add(brilho);
      this.brilhos.push(brilho);
      this.grupo.add(g);
      this.olhos.push(g);
      // olho feliz em arco
      const arco = new THREE.Mesh(
        new THREE.TorusGeometry(t * 0.62, t * 0.2, 5, 12, Math.PI),
        preto
      );
      arco.position.set(lado * o.separacao, -t * 0.2, 0);
      this.grupo.add(arco);
      this.arcos.push(arco);
      // olho de dor
      const x = new THREE.Group();
      for (const ang of [0.6, -0.6]) {
        const barra = new THREE.Mesh(new THREE.BoxGeometry(t * 1.3, t * 0.32, t * 0.2), preto);
        barra.rotation.z = ang * lado;
        barra.position.y = ang > 0 ? t * 0.25 : -t * 0.25;
        barra.position.x = -lado * t * 0.1;
        x.add(barra);
      }
      x.position.set(lado * o.separacao, 0, 0);
      this.grupo.add(x);
      this.xis.push(x);
      // sobrancelha
      const s = new THREE.Mesh(new THREE.BoxGeometry(t * 1.4, t * 0.3, t * 0.2), preto);
      s.position.set(lado * o.separacao, t * 1.55, 0.01);
      this.grupo.add(s);
      this.sobrancelhas.push(s);
    }
    // bocas
    const mb = preto;
    const bocaY = -t * 1.65;
    const sorriso = new THREE.Mesh(new THREE.TorusGeometry(t * 0.55, t * 0.16, 5, 12, Math.PI), mb);
    sorriso.rotation.z = Math.PI;
    sorriso.position.y = bocaY + t * 0.35;
    const sorrisao = new THREE.Group();
    const meia = new THREE.Mesh(
      new THREE.CircleGeometry(t * 0.8, 14, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#4a1f24' })
    );
    const lingua = new THREE.Mesh(
      new THREE.CircleGeometry(t * 0.42, 10, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#f08a8a' })
    );
    lingua.position.set(0, -t * 0.32, 0.002);
    sorrisao.add(meia, lingua);
    sorrisao.position.y = bocaY + t * 0.4;
    const linha = new THREE.Mesh(new THREE.BoxGeometry(t * 0.9, t * 0.18, t * 0.15), mb);
    linha.position.y = bocaY + t * 0.1;
    const oBoca = new THREE.Mesh(new THREE.TorusGeometry(t * 0.32, t * 0.14, 5, 12), mb);
    oBoca.position.y = bocaY;
    const triste = new THREE.Mesh(new THREE.TorusGeometry(t * 0.5, t * 0.15, 5, 12, Math.PI), mb);
    triste.position.y = bocaY - t * 0.25;
    const aberta = new THREE.Mesh(
      new THREE.CircleGeometry(t * 0.48, 12),
      new THREE.MeshBasicMaterial({ color: '#4a1f24' })
    );
    aberta.scale.y = 0.8;
    aberta.position.y = bocaY;
    const ondulada = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(t * 0.42, t * 0.15, t * 0.15), mb);
      seg.position.set((i - 1) * t * 0.36, 0, 0);
      seg.rotation.z = i % 2 === 0 ? 0.5 : -0.5;
      ondulada.add(seg);
    }
    ondulada.position.y = bocaY + t * 0.05;
    this.bocas = { sorriso, sorrisao, linha, o: oBoca, triste, aberta, ondulada };
    for (const b of Object.values(this.bocas)) {
      b.visible = false;
      this.grupo.add(b);
    }
    // rubor
    this.matRubor = new THREE.MeshBasicMaterial({
      color: o.corRubor ?? '#ff8f9a',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    for (const lado of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.CircleGeometry(t * 0.62, 14), this.matRubor);
      r.scale.y = 0.6;
      r.position.set(lado * (o.separacao + t * 0.9), -t * 1.0, -0.004);
      this.grupo.add(r);
      this.rubores.push(r);
    }
    this.definirHumor('neutro');
  }

  definirHumor(h: Humor): void {
    this.humor = h;
    const p = POSES[h];
    for (const [nome, b] of Object.entries(this.bocas)) b.visible = nome === p.boca;
  }

  /** Força uma piscada agora. */
  piscarAgora(): void {
    this.piscar = 0.14;
  }

  atualizar(dt: number): void {
    this.tempo += dt;
    const p = POSES[this.humor];
    const a = this.atual;
    const k = 14;
    a.ox = aproximar(a.ox, p.olho[0], k, dt);
    a.oy = aproximar(a.oy, p.olho[1], k, dt);
    a.arco = aproximar(a.arco, p.arco, k, dt);
    a.xis = aproximar(a.xis, p.xis, k * 1.5, dt);
    a.sobr = aproximar(a.sobr, p.sobr, k, dt);
    a.sobrY = aproximar(a.sobrY, p.sobrY, k, dt);
    a.sobrVis = aproximar(a.sobrVis, p.sobrVis, k, dt);
    a.rubor = aproximar(a.rubor, p.rubor, 6, dt);
    a.olharY = aproximar(a.olharY, p.olharY, 8, dt);

    this.proximoPiscar -= dt;
    if (this.proximoPiscar <= 0) {
      this.piscar = 0.13;
      this.proximoPiscar = 1.6 + Math.random() * 3.4;
      if (Math.random() < 0.18) this.proximoPiscar = 0.25; // piscada dupla
    }
    this.piscar = Math.max(0, this.piscar - dt);
    const fechado = this.piscar > 0 ? Math.sin((this.piscar / 0.13) * Math.PI) : 0;
    const normal = Math.max(0, 1 - a.arco - a.xis);
    const t = this.o.tamanho;
    const tremor = this.humor === 'medo' ? Math.sin(this.tempo * 60) * t * 0.06 : 0;
    for (let i = 0; i < 2; i++) {
      const lado = i === 0 ? -1 : 1;
      const olho = this.olhos[i];
      olho.scale.set(
        a.ox * normal + 0.001,
        Math.max(0.08, a.oy * (1 - fechado * 0.92)) * normal + 0.001,
        1
      );
      olho.position.x = lado * this.o.separacao + this.olhar.x * t * 0.5 + tremor;
      olho.position.y = this.olhar.y * t * 0.4 + a.olharY;
      this.brilhos[i].visible = this.humor !== 'sonolento';
      const arco = this.arcos[i];
      arco.scale.setScalar(Math.max(0.001, a.arco));
      arco.visible = a.arco > 0.05;
      const x = this.xis[i];
      x.scale.setScalar(Math.max(0.001, a.xis));
      x.visible = a.xis > 0.05;
      const s = this.sobrancelhas[i];
      s.rotation.z = -lado * a.sobr * 0.9;
      s.position.y = t * 1.55 + a.sobrY + (this.humor === 'curioso' && lado === 1 ? t * 0.35 : 0);
      s.scale.setScalar(Math.max(0.001, a.sobrVis));
      s.visible = a.sobrVis > 0.05;
    }
    this.matRubor.opacity = a.rubor * 0.75;
  }
}
