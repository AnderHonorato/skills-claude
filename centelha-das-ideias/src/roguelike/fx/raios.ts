/**
 * Relâmpagos, lasers, chicotes e cortes — todos desenhados como fitas.
 *  - Relâmpago: caminho serrilhado por deslocamento do ponto médio, com ramos,
 *    refeito várias vezes por segundo (tremula) e núcleo branco com halo colorido.
 *  - Laser contínuo (por id): energia rolando ao longo do feixe, núcleo + halo.
 *  - Chicote / corte: arco que "abre" rápido e se recolhe (sensação de golpe).
 */
import * as THREE from 'three';
import { ESTILO_FITA, type Fitas } from './fitas';
import { corLinear, realce, type CorFx } from './util';

interface Relampago {
  a: [number, number, number];
  b: [number, number, number];
  cor: THREE.Color;
  brilho: number;
  largura: number;
  vida: number;
  total: number;
  ramos: number;
  regen: number;
  intens: number;
  caminhos: Float32Array[];
  larguras: number[];
}

interface Laser {
  o: [number, number, number];
  d: [number, number, number];
  largura: number;
  cor: THREE.Color;
  brilho: number;
  toque: number;
  forca: number;
  semente: number;
}

interface Arco {
  pts: Float32Array;
  n: number;
  cor: THREE.Color;
  brilho: number;
  largura: number;
  vida: number;
  total: number;
  estilo: number;
  normal: THREE.Vector3 | null;
  semente: number;
}

const CIMA = new THREE.Vector3(0, 1, 0);

export class Raios {
  private relampagos: Relampago[] = [];
  private lasers = new Map<string | number, Laser>();
  private arcos: Arco[] = [];

  constructor(private detalhe: number) {}

  // ------------------------------------------------------------------ relâmpago

  /** Caminho serrilhado de a até b (deslocamento do ponto médio). */
  private caminho(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    niveis: number,
    aspereza: number
  ): Float32Array {
    let pts = [ax, ay, az, bx, by, bz];
    for (let nv = 0; nv < niveis; nv++) {
      const novo: number[] = [];
      for (let i = 0; i < pts.length / 3 - 1; i++) {
        const x1 = pts[i * 3];
        const y1 = pts[i * 3 + 1];
        const z1 = pts[i * 3 + 2];
        const x2 = pts[i * 3 + 3];
        const y2 = pts[i * 3 + 4];
        const z2 = pts[i * 3 + 5];
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dz = z2 - z1;
        const L = Math.hypot(dx, dy, dz) || 1;
        // vetor perpendicular aleatório
        let rx = Math.random() - 0.5;
        let ry = Math.random() - 0.5;
        let rz = Math.random() - 0.5;
        const pr = (rx * dx + ry * dy + rz * dz) / (L * L);
        rx -= dx * pr;
        ry -= dy * pr;
        rz -= dz * pr;
        const rl = Math.hypot(rx, ry, rz) || 1;
        const desl = (Math.random() - 0.5) * L * aspereza * 2;
        novo.push(x1, y1, z1);
        novo.push(
          (x1 + x2) / 2 + (rx / rl) * desl,
          (y1 + y2) / 2 + (ry / rl) * desl,
          (z1 + z2) / 2 + (rz / rl) * desl
        );
      }
      const u = pts.length - 3;
      novo.push(pts[u], pts[u + 1], pts[u + 2]);
      pts = novo;
      aspereza *= 0.92;
    }
    return new Float32Array(pts);
  }

  private refazer(r: Relampago): void {
    const [ax, ay, az] = r.a;
    const [bx, by, bz] = r.b;
    const L = Math.hypot(bx - ax, by - ay, bz - az);
    const niveis = Math.max(2, Math.min(this.detalhe, Math.round(Math.log2(L * 3 + 2))));
    const principal = this.caminho(ax, ay, az, bx, by, bz, niveis, 0.26);
    r.caminhos = [principal];
    r.larguras = [r.largura];
    const np = principal.length / 3;
    for (let k = 0; k < r.ramos; k++) {
      const i = Math.floor((0.15 + Math.random() * 0.6) * (np - 1));
      const sx = principal[i * 3];
      const sy = principal[i * 3 + 1];
      const sz = principal[i * 3 + 2];
      const j = Math.min(np - 1, i + 1);
      let dx = principal[j * 3] - sx;
      let dy = principal[j * 3 + 1] - sy;
      let dz = principal[j * 3 + 2] - sz;
      const dl = Math.hypot(dx, dy, dz) || 1;
      dx /= dl;
      dy /= dl;
      dz /= dl;
      const comp = L * (0.18 + Math.random() * 0.25);
      const ex = sx + (dx + (Math.random() - 0.5) * 1.6) * comp;
      const ey = Math.max(0.05, sy + (dy + (Math.random() - 0.5) * 1.2) * comp);
      const ez = sz + (dz + (Math.random() - 0.5) * 1.6) * comp;
      r.caminhos.push(this.caminho(sx, sy, sz, ex, ey, ez, Math.max(2, niveis - 2), 0.3));
      r.larguras.push(r.largura * 0.55);
    }
    r.intens = 0.65 + Math.random() * 0.35;
  }

  relampago(
    ax: number,
    ay: number,
    az: number,
    bx: number,
    by: number,
    bz: number,
    cor: CorFx,
    opcoes: { largura?: number; vida?: number; ramos?: number; brilho?: number } = {}
  ): void {
    if (this.relampagos.length > 48) this.relampagos.shift();
    const r: Relampago = {
      a: [ax, ay, az],
      b: [bx, by, bz],
      cor: corLinear(cor),
      brilho: realce(opcoes.brilho ?? 1.6),
      largura: opcoes.largura ?? 0.55,
      vida: opcoes.vida ?? 0.22,
      total: opcoes.vida ?? 0.22,
      ramos: opcoes.ramos ?? 2,
      regen: 0,
      intens: 1,
      caminhos: [],
      larguras: [],
    };
    this.refazer(r);
    this.relampagos.push(r);
  }

  // ------------------------------------------------------------------ laser

  /** Mantém um laser vivo neste quadro. Devolve a força atual (0..1, para surgir/sumir). */
  laser(
    id: string | number,
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    largura: number,
    cor: CorFx,
    tempo: number,
    brilho = 1.5
  ): number {
    let l = this.lasers.get(id);
    if (!l) {
      l = {
        o: [ox, oy, oz],
        d: [dx, dy, dz],
        largura,
        cor: corLinear(cor),
        brilho: realce(brilho),
        toque: tempo,
        forca: 0,
        semente: Math.random() * 10,
      };
      this.lasers.set(id, l);
    }
    l.o[0] = ox;
    l.o[1] = oy;
    l.o[2] = oz;
    l.d[0] = dx;
    l.d[1] = dy;
    l.d[2] = dz;
    l.largura = largura;
    l.cor = corLinear(cor);
    l.brilho = realce(brilho);
    l.toque = tempo;
    return l.forca;
  }

  // ------------------------------------------------------------------ arcos

  /** Chicote ao longo de pontos [x,y,z, x,y,z, ...]. */
  chicote(
    pontos: ArrayLike<number>,
    cor: CorFx,
    opcoes: {
      largura?: number;
      vida?: number;
      brilho?: number;
      estilo?: number;
      deitado?: boolean;
    } = {}
  ): void {
    const n = Math.floor(pontos.length / 3);
    if (n < 2) return;
    if (this.arcos.length > 40) this.arcos.shift();
    this.arcos.push({
      pts: Float32Array.from(pontos),
      n,
      cor: corLinear(cor),
      brilho: realce(opcoes.brilho ?? 1.4),
      largura: opcoes.largura ?? 0.5,
      vida: opcoes.vida ?? 0.28,
      total: opcoes.vida ?? 0.28,
      estilo: opcoes.estilo ?? ESTILO_FITA.CORTE,
      normal: opcoes.deitado ? CIMA : null,
      semente: Math.random() * 10,
    });
  }

  /** Corte em meia-lua deitado: centro, ângulo do golpe (x=cos, z=sin), raio e abertura. */
  corte(
    x: number,
    y: number,
    z: number,
    angulo: number,
    raio: number,
    abertura: number,
    cor: CorFx,
    opcoes: { largura?: number; vida?: number; brilho?: number; sentido?: number } = {}
  ): void {
    const seg = 22;
    const pts: number[] = [];
    const s = opcoes.sentido ?? 1;
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const a = angulo + (t - 0.5) * abertura * s;
      const rr = raio * (0.92 + 0.08 * Math.sin(Math.PI * t));
      pts.push(x + Math.cos(a) * rr, y + Math.sin(Math.PI * t) * 0.15, z + Math.sin(a) * rr);
    }
    this.chicote(pts, cor, {
      largura: opcoes.largura ?? raio * 0.42,
      vida: opcoes.vida ?? 0.26,
      brilho: opcoes.brilho ?? 1.5,
      estilo: ESTILO_FITA.CORTE,
      deitado: true,
    });
  }

  // ------------------------------------------------------------------ quadro

  /** Envelhece tudo. Devolve os lasers ativos para as receitas pintarem faíscas. */
  atualizar(dt: number, tempo: number, folga: number): void {
    for (let i = this.relampagos.length - 1; i >= 0; i--) {
      const r = this.relampagos[i];
      r.vida -= dt;
      if (r.vida <= 0) {
        this.relampagos.splice(i, 1);
        continue;
      }
      r.regen -= dt;
      if (r.regen <= 0) {
        r.regen = 0.045 + Math.random() * 0.03;
        this.refazer(r);
      }
    }
    for (const [id, l] of this.lasers) {
      const ativo = tempo - l.toque <= folga;
      l.forca = Math.max(0, Math.min(1, l.forca + (ativo ? dt * 8 : -dt * 6)));
      if (!ativo && l.forca <= 0) this.lasers.delete(id);
    }
    for (let i = this.arcos.length - 1; i >= 0; i--) {
      this.arcos[i].vida -= dt;
      if (this.arcos[i].vida <= 0) this.arcos.splice(i, 1);
    }
  }

  lasersAtivos(): IterableIterator<Laser> {
    return this.lasers.values();
  }

  desenhar(f: Fitas, tempo: number): void {
    // relâmpagos
    for (const r of this.relampagos) {
      const t = 1 - r.vida / r.total;
      const fade = (t < 0.15 ? 1 : Math.pow(1 - (t - 0.15) / 0.85, 0.7)) * r.intens;
      const c = r.cor;
      const b = r.brilho;
      for (let k = 0; k < r.caminhos.length; k++) {
        const p = r.caminhos[k];
        const n = p.length / 3;
        f.comecar(ESTILO_FITA.RAIO, 1, k);
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const afina = k === 0 ? 1 : 1 - u * 0.85;
          f.ponto(
            p[i * 3],
            p[i * 3 + 1],
            p[i * 3 + 2],
            r.larguras[k] * afina,
            c.r * b,
            c.g * b,
            c.b * b,
            fade * (k === 0 ? 1 : 0.8)
          );
        }
        f.terminar();
      }
    }
    // lasers
    for (const l of this.lasers.values()) {
      if (l.forca <= 0) continue;
      const c = l.cor;
      const b = l.brilho;
      const L = Math.hypot(l.d[0] - l.o[0], l.d[1] - l.o[1], l.d[2] - l.o[2]);
      const seg = Math.max(2, Math.min(24, Math.ceil(L / 0.6)));
      const pulso = 1 + 0.08 * Math.sin(tempo * 40 + l.semente);
      f.comecar(ESTILO_FITA.LASER, 1, l.semente);
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const larg = l.largura * 2.6 * l.forca * pulso * (u < 0.06 ? 0.6 + (u / 0.06) * 0.4 : 1);
        f.ponto(
          l.o[0] + (l.d[0] - l.o[0]) * u,
          l.o[1] + (l.d[1] - l.o[1]) * u,
          l.o[2] + (l.d[2] - l.o[2]) * u,
          larg,
          c.r * b,
          c.g * b,
          c.b * b,
          Math.min(1, l.forca * 1.2)
        );
      }
      f.terminar();
    }
    // chicotes e cortes: abrem rápido e recolhem
    for (const a of this.arcos) {
      const t = 1 - a.vida / a.total;
      const cabeca = Math.min(1, t / 0.32);
      const cauda = Math.max(0, (t - 0.25) / 0.75);
      const c = a.cor;
      const b = a.brilho;
      f.comecar(a.estilo, 1, a.semente, a.normal, 1);
      const n = a.n;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        if (u > cabeca + 1e-3) break;
        if (u < cauda - 1e-3) continue;
        const local = (u - cauda) / Math.max(0.05, cabeca - cauda);
        const larg = a.largura * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, local))), 0.6);
        const alfa = Math.pow(1 - t, 0.6);
        f.ponto(
          a.pts[i * 3],
          a.pts[i * 3 + 1],
          a.pts[i * 3 + 2],
          larg,
          c.r * b,
          c.g * b,
          c.b * b,
          alfa
        );
      }
      f.terminar();
    }
  }

  limpar(): void {
    this.relampagos.length = 0;
    this.lasers.clear();
    this.arcos.length = 0;
  }
}
