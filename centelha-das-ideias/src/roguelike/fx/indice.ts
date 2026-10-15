/**
 * SistemaFx — fachada única dos efeitos visuais das habilidades.
 *
 * O jogo cria UM sistema, chama as receitas nos eventos (lançar, viajar, acertar,
 * terminar) e chama `atualizar(dt, camera)` uma vez por quadro, ANTES de desenhar.
 * Tudo é desenhado em 4 draw calls (partículas, fitas, planos, volumes), mais o
 * bloom opcional do PosProcesso.
 *
 * Efeitos contínuos (rastros, lasers, tornados, buracos negros, poças) usam um id:
 * chame a receita a cada quadro enquanto existirem; se pararem de chamar por mais
 * de `folga` segundos, o efeito some suavemente sozinho.
 *
 *   const fx = new SistemaFx(cena, 'alta');
 *   fx.projetilRastro(p.id, 'fogo', p.x, 1, p.z);   // todo quadro
 *   fx.impacto('fogo', x, 1, z);                     // ao acertar
 *   fx.atualizar(dt, camera);
 */
import * as THREE from 'three';
import type { Elemento } from '../dados/habilidades';
import {
  cabecaProjetil,
  CORES_POCA,
  estiloRastro,
  explosao,
  impacto,
  meteoroImpacto,
  nova,
  PALETAS,
  particulasPoca,
  type ElementoFx,
} from './elementos';
import * as codigo from './codigo';
import { Fitas } from './fitas';
import { ESTILO_PLANO, Planos } from './ondas';
import { MODO, Particulas } from './particulas';
import { PosProcesso } from './posprocesso';
import { Raios } from './raios';
import { Rastros } from './rastros';
import { criarAtlasDecais, criarAtlasParticulas, criarTexturaRuido, D, Q } from './texturas';
import { CONFIGS, sinal, sortear, type ConfigFx, type CorFx, type QualidadeFx } from './util';
import { ESTILO_VOLUME, Volumes } from './volumes';

export type { Elemento, ElementoFx, QualidadeFx, CorFx };
export { PosProcesso };

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

type Id = string | number;

interface Agendado {
  idade: number;
  total: number;
  fn: (t: number, dt: number) => void;
}

const copiarCor = (c: CorFx): CorFx => (c instanceof THREE.Color ? c.clone() : c);

export class SistemaFx implements codigo.CtxCodigo {
  readonly grupo = new THREE.Group();
  readonly p: Particulas;
  readonly planos: Planos;
  readonly raios: Raios;
  readonly volumes: Volumes;
  readonly fitas: Fitas;
  readonly rastros = new Rastros();
  readonly config: ConfigFx;
  /** Tempo interno (s). */
  tempo = 0;
  /** Segundos sem receber chamada até um efeito contínuo começar a sumir. */
  folga = 0.12;
  private dtQuadro = 1 / 60;
  private agenda: Agendado[] = [];
  private acumulos = new Map<string, { v: number; toque: number }>();
  private tremorAtual = 0;
  private seq = 0;
  private texturas: THREE.Texture[];
  private pos: PosProcesso | null = null;
  private tmpCor = new THREE.Color();

  constructor(
    private cena: THREE.Scene,
    readonly qualidade: QualidadeFx = 'media'
  ) {
    this.config = CONFIGS[qualidade];
    const atlas = criarAtlasParticulas(this.config.celulaAtlas);
    const decal = criarAtlasDecais(this.config.celulaDecal);
    const ruido = criarTexturaRuido();
    this.texturas = [atlas, decal, ruido];
    this.p = new Particulas(this.config.maxParticulas, atlas);
    this.fitas = new Fitas(this.config.maxVerticesFita, ruido);
    this.planos = new Planos(this.config.maxPlanos, ruido, decal);
    this.volumes = new Volumes(this.config.maxVolumes, ruido, qualidade === 'baixa' ? 14 : 24);
    this.raios = new Raios(this.config.detalheRaio);
    this.grupo.name = 'efeitos-fx';
    this.grupo.add(this.planos.malha, this.volumes.malha, this.fitas.malha, this.p.malha);
    cena.add(this.grupo);
  }

  // ------------------------------------------------------------------ Ctx

  /** Quantidade ajustada pela qualidade (arredondamento sorteado). */
  q(n: number): number {
    const v = n * this.config.densidade;
    const i = Math.floor(v);
    return i + (Math.random() < v - i ? 1 : 0);
  }

  agendar(duracao: number, fn: (t: number, dt: number) => void): void {
    this.agenda.push({ idade: 0, total: Math.max(1e-3, duracao), fn });
  }

  tremer(f: number): void {
    this.tremorAtual = Math.max(this.tremorAtual, f);
  }

  pulso(cor: CorFx, f: number): void {
    this.pos?.pulso(cor instanceof THREE.Color ? cor : new THREE.Color(cor), f);
  }

  /** Quantas emissões cabem neste quadro para uma taxa (por segundo). */
  taxa(chave: string, porSegundo: number): number {
    let a = this.acumulos.get(chave);
    if (!a) {
      a = { v: Math.random(), toque: this.tempo - this.dtQuadro };
      this.acumulos.set(chave, a);
    }
    const dt = Math.min(0.1, Math.max(0, this.tempo - a.toque));
    a.toque = this.tempo;
    a.v += porSegundo * this.config.densidade * dt;
    const n = Math.floor(a.v);
    a.v -= n;
    return n;
  }

  // ------------------------------------------------------------------ pós-processo

  /** Cria (uma vez) o pós-processamento com bloom ligado a este renderer. */
  criarPosProcesso(renderer: THREE.WebGLRenderer): PosProcesso {
    if (!this.pos) this.pos = new PosProcesso(renderer, this.qualidade);
    return this.pos;
  }

  // ------------------------------------------------------------------ receitas

  /** Faísca de acerto típica do elemento (escala 1 ≈ inimigo comum). */
  impacto(elemento: ElementoFx, x: number, y: number, z: number, escala = 1): void {
    this.sombra(x, z, 1.5 * escala, 0.45);
    impacto(this, elemento, x, y, z, escala);
  }

  /** Sombra suave no chão: dá contraste aos brilhos sobre a grama clara. */
  private sombra(x: number, z: number, raio: number, vida: number, alfa = 0.32): void {
    this.planos.criar({
      estilo: ESTILO_PLANO.LUZ_CHAO,
      x,
      z,
      raio,
      vida,
      cor: '#0c2410',
      alfa,
      aditivo: 0,
      camada: 0,
      entrada: 0.05,
      curva: 1.2,
    });
  }

  /**
   * Rastro + partículas + brilho da cabeça de um projétil. Chame todo quadro com a
   * posição atual. `cabeca=false` se o jogo já desenha o projétil e só quer o rastro.
   */
  projetilRastro(
    id: Id,
    elemento: ElementoFx,
    x: number,
    y: number,
    z: number,
    escala = 1,
    cabeca = true
  ): void {
    const estilo = estiloRastro(elemento, escala);
    const r = this.rastros.tocar(id, x, y, z, estilo, this.tempo);
    const inv = r.novo ? 0 : 1 / Math.max(1e-3, this.dtQuadro);
    const ticks = this.taxa(`r:${id}`, 40);
    cabecaProjetil(
      this,
      elemento,
      x,
      y,
      z,
      escala,
      ticks,
      r.dx * inv,
      r.dy * inv,
      r.dz * inv,
      cabeca
    );
    if (cabeca && y > 0.25)
      this.planos.desenharAgora({
        estilo: ESTILO_PLANO.LUZ_CHAO,
        x,
        z,
        raio: 0.7 * escala,
        cor: '#0c2410',
        alfa: 0.28 / (1 + y * 0.25),
        aditivo: 0,
        camada: 0,
      });
  }

  /** O projétil sumiu: a cauda termina de se desfazer sozinha. */
  fimRastro(id: Id): void {
    this.rastros.fim(id);
    this.acumulos.delete(`r:${id}`);
  }

  /** Brilho de um objeto em órbita/drone neste quadro (sem rastro). */
  orbe(elemento: ElementoFx, x: number, y: number, z: number, escala = 1): void {
    cabecaProjetil(this, elemento, x, y, z, escala, 0, 0, 0, 0, true);
  }

  /** Clarão de disparo na boca (drones, estrelas, lançamentos). dx/dz = direção. */
  disparo(
    elemento: ElementoFx,
    x: number,
    y: number,
    z: number,
    dx: number,
    dz: number,
    escala = 1
  ): void {
    const pal = PALETAS[elemento];
    const L = Math.hypot(dx, dz) || 1;
    const ux = dx / L;
    const uz = dz / L;
    this.p.emitir({
      x,
      y,
      z,
      vida: 0.1,
      tam: 0.5 * escala,
      tamFim: 0.9 * escala,
      cor: pal.claro,
      brilho: 2.4,
      quadro: Q.BRILHO,
      entrada: 0,
    });
    this.p.emitir({
      x,
      y,
      z,
      vida: 0.12,
      tam: 0.6 * escala,
      cor: pal.base,
      brilho: 2,
      quadro: Q.FAISCA,
      rot: Math.atan2(uz, ux),
      entrada: 0,
    });
    const n = this.q(4);
    for (let k = 0; k < n; k++) {
      const v = sortear(4, 9);
      this.p.emitir({
        x,
        y,
        z,
        vx: (ux + sinal() * 0.35) * v,
        vy: sinal() * 1.5,
        vz: (uz + sinal() * 0.35) * v,
        vida: sortear(0.08, 0.16),
        tam: 0.05 * escala,
        cor: '#ffffff',
        corFim: pal.base,
        brilho: 2.6,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.03,
        arrasto: 5,
      });
    }
  }

  /** Explosão grande de área (fogo = impacto de meteoro com cratera e fumaça). */
  explosao(elemento: ElementoFx, x: number, z: number, raio = 2): void {
    explosao(this, elemento, x, z, raio);
  }

  /**
   * Meteoro completo: círculo de aviso no chão, queda com rastro de fogo e explosão
   * ao tocar o chão após `duracao` segundos (use o mesmo atraso do dano no jogo).
   */
  meteoro(x: number, z: number, duracao = 0.6, raio = 2.4, escala = 1): void {
    const id = `__met${this.seq++}`;
    this.planos.criar({
      estilo: ESTILO_PLANO.ALVO,
      x,
      z,
      raio,
      vida: duracao,
      cor: '#ff5a2b',
      cor2: '#ffb347',
      brilho: 1.3,
      alfa: 0.9,
      aditivo: 0.7,
      camada: 0,
      entrada: 0.15,
      curva: 0.05,
    });
    const sx = x - 4;
    const sz = z - 6;
    const sy = 16;
    this.agendar(duracao, (t) => {
      if (t < 1) {
        const px = sx + (x - sx) * t;
        const py = sy * (1 - t) + 0.4 * t;
        const pz = sz + (z - sz) * t;
        this.projetilRastro(id, 'fogo', px, py, pz, 1.3 * escala);
        this.p.desenharAgora({
          x: px,
          y: py,
          z: pz,
          tam: 1.1 * escala,
          cor: '#5a3a2a',
          aditivo: 0,
          quadro: Q.ROCHA_A,
          rot: t * 12,
        });
      } else {
        this.fimRastro(id);
        meteoroImpacto(this, x, z, raio * escala);
      }
    });
  }

  /** Relâmpago caindo do céu em (x, z), com impacto elétrico no chão. */
  relampago(x: number, z: number, cor: CorFx = '#7fb0ff', escala = 1): void {
    const ox = x + sinal() * 1.5;
    const oz = z - 2 + sinal() * 1.5;
    this.raios.relampago(ox, 14, oz, x, 0.05, z, cor, {
      largura: 0.8 * escala,
      vida: 0.32,
      ramos: 4,
      brilho: 1.5,
    });
    impacto(this, 'raio', x, 0.3, z, 1.2 * escala);
    this.planos.criar({
      estilo: ESTILO_PLANO.LUZ_CHAO,
      x,
      z,
      raio: 4 * escala,
      vida: 0.3,
      cor: '#dfe8ff',
      brilho: 1.4,
    });
    this.planos.criar({
      estilo: ESTILO_PLANO.DECAL,
      x,
      z,
      raio: 1.2 * escala,
      vida: 2,
      cor: '#1c1830',
      param: D.QUEIMADO,
      alfa: 0.6,
      aditivo: 0,
      camada: 0,
      curva: 0.6,
    });
    this.tremer(0.12);
    this.pulso('#dfe8ff', 0.18);
  }

  /** Raio entre dois pontos (raio em cadeia: chame uma vez por salto). */
  raio(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    cor: CorFx = '#ffe45c',
    largura = 0.55
  ): void {
    this.raios.relampago(x1, y1, z1, x2, y2, z2, cor, {
      largura,
      vida: 0.22,
      ramos: 1,
      brilho: 1.7,
    });
    this.p.emitir({
      x: x2,
      y: y2,
      z: z2,
      vida: 0.14,
      tam: 1,
      tamFim: 1.5,
      cor: '#fffbe0',
      brilho: 2.5,
      quadro: Q.BRILHO,
      entrada: 0,
    });
    this.p.emitir({
      x: x2,
      y: y2,
      z: z2,
      vida: 0.18,
      tam: 1.1,
      cor: '#cfe8ff',
      brilho: 2.2,
      quadro: Q.ELETRICO_A,
      rot: Math.random() * 6,
      giro: 18,
      entrada: 0,
    });
    const n = this.q(7);
    for (let k = 0; k < n; k++)
      this.p.emitir({
        x: x2,
        y: y2,
        z: z2,
        vx: sinal() * 8,
        vy: sortear(0, 6),
        vz: sinal() * 8,
        vida: sortear(0.1, 0.2),
        tam: 0.06,
        cor: '#ffffff',
        corFim: cor,
        brilho: 3,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.03,
        arrasto: 4,
        gravidade: 4,
      });
  }

  /** Laser contínuo de `origem` a `destino` (chame todo quadro enquanto durar). */
  laser(id: Id, origem: Vec3, destino: Vec3, largura = 0.35, cor: CorFx = '#ff5cf0'): void {
    const f = this.raios.laser(
      id,
      origem.x,
      origem.y,
      origem.z,
      destino.x,
      destino.y,
      destino.z,
      largura,
      cor,
      this.tempo,
      1.6
    );
    const forca = Math.max(0.25, f);
    const t = this.tempo;
    this.p.desenharAgora({
      x: origem.x,
      y: origem.y,
      z: origem.z,
      tam: largura * 5 * forca,
      cor,
      brilho: 1.8,
      quadro: Q.BRILHO,
    });
    this.p.desenharAgora({
      x: origem.x,
      y: origem.y,
      z: origem.z,
      tam: largura * 4 * forca,
      cor: '#ffffff',
      brilho: 1.6,
      quadro: Q.ESTRELA,
      rot: t * 3,
    });
    this.p.desenharAgora({
      x: destino.x,
      y: destino.y,
      z: destino.z,
      tam: largura * 6 * forca,
      cor,
      brilho: 2,
      quadro: Q.BRILHO,
    });
    this.p.desenharAgora({
      x: destino.x,
      y: destino.y,
      z: destino.z,
      tam: largura * 5 * forca,
      cor: '#ffffff',
      brilho: 2.2,
      quadro: Q.ESTRELA,
      rot: -t * 5,
    });
    this.planos.desenharAgora({
      estilo: ESTILO_PLANO.LUZ_CHAO,
      x: destino.x,
      z: destino.z,
      raio: largura * 7,
      cor,
      brilho: 1.2,
      alfa: forca * 0.8,
    });
    const n = this.taxa(`l:${id}`, 50);
    for (let k = 0; k < n; k++)
      this.p.emitir({
        x: destino.x,
        y: destino.y,
        z: destino.z,
        vx: sinal() * 5,
        vy: sortear(1, 6),
        vz: sinal() * 5,
        vida: sortear(0.15, 0.35),
        tam: 0.06,
        cor: '#ffffff',
        corFim: cor,
        brilho: 2.8,
        quadro: Q.RISCO,
        modo: MODO.ESTICADO,
        estica: 0.035,
        gravidade: 9,
        arrasto: 2,
      });
  }

  /** Onda que se expande do centro (nova). `direcao`/`abertura` (rad) para cone. */
  nova(
    x: number,
    z: number,
    raioMax: number,
    elemento: ElementoFx,
    duracao = 0.5,
    direcao = 0,
    abertura = 10
  ): void {
    nova(this, elemento, x, z, raioMax, duracao, direcao, abertura);
  }

  /** Tornado contínuo (chame todo quadro). */
  tornado(id: Id, x: number, z: number, raio = 1.8): void {
    const chave = `t:${id}`;
    this.volumes.manter(
      chave,
      {
        estilo: ESTILO_VOLUME.TORNADO,
        x,
        z,
        altura: raio * 3.4,
        raioBase: raio * 0.2,
        raioTopo: raio * 1.15,
        cor: '#f6fffb',
        cor2: '#9fcfb8',
        alfa: 0.85,
        aditivo: 0.45,
        giro: 2.4,
      },
      this.tempo
    );
    this.planos.manter(
      chave,
      {
        estilo: ESTILO_PLANO.VORTICE,
        x,
        z,
        raio: raio * 1.6,
        cor: '#d8c8a8',
        cor2: '#efe6d4',
        alfa: 0.7,
        aditivo: 0,
        camada: 0,
      },
      this.tempo
    );
    const n = this.taxa(chave, 34);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = sortear(0.3, 1) * raio;
      const tipo = Math.random();
      const base = {
        x: x + Math.cos(a) * r,
        y: sortear(0.1, 0.8),
        z: z + Math.sin(a) * r,
        orbX: x,
        orbZ: z,
        orbW: sortear(6, 9),
        orbVr: 0.35,
        vy: sortear(1.5, 4),
        vida: sortear(0.6, 0.9),
      };
      if (tipo < 0.45)
        this.p.emitir({
          ...base,
          tam: sortear(0.3, 0.6),
          tamFim: 0.9,
          cor: '#cdb38a',
          alfa: 0.55,
          aditivo: 0,
          quadro: Q.POEIRA,
          giro: 3,
          entrada: 0.2,
        });
      else if (tipo < 0.65)
        this.p.emitir({
          ...base,
          tam: 0.16,
          cor: '#8fd96a',
          corFim: '#5fae4a',
          aditivo: 0,
          quadro: Q.FOLHA,
          giro: sinal() * 10,
        });
      else if (tipo < 0.8)
        this.p.emitir({
          ...base,
          tam: 0.12,
          cor: '#7d5a3a',
          aditivo: 0,
          quadro: Q.ROCHA_B,
          giro: sinal() * 10,
        });
      else
        this.p.emitir({
          ...base,
          tam: sortear(0.8, 1.3) * raio * 0.6,
          rot: a,
          giro: 9,
          cor: '#ffffff',
          alfa: 0.6,
          aditivo: 0.5,
          quadro: Q.VENTO,
        });
    }
  }

  /** Buraco negro contínuo (chame todo quadro): disco de acreção, núcleo e espiral. */
  buracoNegro(id: Id, x: number, z: number, raio = 3): void {
    const chave = `b:${id}`;
    const t = this.tempo;
    this.planos.manter(
      `${chave}s`,
      {
        estilo: ESTILO_PLANO.LUZ_CHAO,
        x,
        z,
        raio: raio * 2.1,
        cor: '#05020c',
        alfa: 0.75,
        aditivo: 0,
        camada: 0,
      },
      t
    );
    this.planos.manter(
      `${chave}d`,
      {
        estilo: ESTILO_PLANO.ACRECAO,
        x,
        y: 0.4,
        z,
        raio: raio * 1.3,
        cor: '#4a1cc8',
        cor2: '#ff8ad8',
        brilho: 1.05,
        aditivo: 0.75,
        camada: 1,
      },
      t
    );
    this.planos.manter(
      `${chave}n`,
      {
        estilo: ESTILO_PLANO.NUCLEO,
        x,
        y: 0.55,
        z,
        raio: raio * 0.62,
        modo: 1,
        cor: '#8a6bff',
        cor2: '#f0e0ff',
        brilho: 1.4,
        aditivo: 1,
        camada: 2,
      },
      t
    );
    const n = this.taxa(chave, 60);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = sortear(1.8, 2.6) * raio;
      const vida = sortear(0.8, 1.1);
      const y0 = sortear(0.15, 1.6);
      const poeira = Math.random() < 0.2;
      this.p.emitir({
        x: x + Math.cos(a) * r0,
        y: y0,
        z: z + Math.sin(a) * r0,
        orbX: x,
        orbZ: z,
        orbW: 2.6,
        orbVr: -(r0 - raio * 0.2) / vida,
        vy: (0.5 - y0) / vida,
        vida,
        tam: poeira ? 0.3 : 0.08,
        tamFim: poeira ? 0.1 : 0.05,
        cor: poeira ? '#3a2a4a' : '#d4c8ff',
        corFim: poeira ? '#1a0a2a' : '#ffffff',
        brilho: poeira ? 1 : 2.4,
        aditivo: poeira ? 0 : 1,
        alfa: poeira ? 0.6 : 1,
        quadro: poeira ? Q.POEIRA : Q.RISCO,
        modo: poeira ? MODO.TELA : MODO.ESTICADO,
        estica: 0.06,
        entrada: 0.25,
        curva: 0.5,
      });
    }
  }

  /** Aura em volta de um ponto (chame todo quadro). */
  aura(
    x: number,
    z: number,
    raio: number,
    cor: CorFx = '#fff3c4',
    cor2: CorFx = '#ffffff',
    id: Id = 'aura'
  ): void {
    this.planos.desenharAgora({
      estilo: ESTILO_PLANO.AURA,
      x,
      z,
      raio,
      cor,
      cor2,
      brilho: 0.8,
      alfa: 0.45,
      rot: this.tempo * 0.7,
      aditivo: 1,
    });
    const n = this.taxa(`a:${id}`, 10 * raio);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * raio;
      this.p.emitir({
        x: x + Math.cos(a) * r,
        y: 0.1,
        z: z + Math.sin(a) * r,
        vy: sortear(0.6, 1.6),
        vida: sortear(0.7, 1.2),
        tam: sortear(0.07, 0.12),
        cor,
        brilho: 2.2,
        quadro: Math.random() < 0.3 ? Q.ESTRELA : Q.BRASA,
        giro: 2,
        entrada: 0.3,
      });
    }
  }

  /** Chicote ao longo de pontos (Vec3[]). Some sozinho. */
  chicote(pontos: Vec3[], cor: CorFx = '#fff3c4', largura = 0.5): void {
    const arr: number[] = [];
    for (const pt of pontos) arr.push(pt.x, pt.y, pt.z);
    this.raios.chicote(arr, cor, { largura, vida: 0.3 });
    const n = this.q(8);
    for (let k = 0; k < n; k++) {
      const pt = pontos[Math.floor(Math.random() * pontos.length)];
      this.p.emitir({
        x: pt.x,
        y: pt.y,
        z: pt.z,
        vx: sinal() * 1.5,
        vy: sortear(0.5, 2),
        vz: sinal() * 1.5,
        vida: 0.4,
        tam: 0.1,
        cor,
        brilho: 2.2,
        quadro: Q.BRASA,
        arrasto: 2,
      });
    }
  }

  /** Corte em meia-lua na frente de (x, z) — ângulo no padrão do jogo (x=cos, z=sin). */
  corte(
    x: number,
    z: number,
    angulo: number,
    comprimento: number,
    cor: CorFx = '#fff3c4',
    cor2: CorFx = '#ffd27a',
    y = 0.9
  ): void {
    const r = comprimento * 0.72;
    this.raios.corte(x, y, z, angulo, r, 2.1, cor, {
      largura: comprimento * 0.42,
      vida: 0.28,
      brilho: 1.6,
    });
    this.raios.corte(x, y + 0.02, z, angulo, r * 0.82, 1.7, cor2, {
      largura: comprimento * 0.2,
      vida: 0.22,
      brilho: 1.3,
    });
    const n = this.q(10);
    for (let k = 0; k < n; k++) {
      const a = angulo + sinal() * 1.05;
      const rr = r * sortear(0.85, 1.1);
      const tx = -Math.sin(a);
      const tz = Math.cos(a);
      this.p.emitir({
        x: x + Math.cos(a) * rr,
        y,
        z: z + Math.sin(a) * rr,
        vx: tx * 3 + Math.cos(a) * 2,
        vy: sortear(0, 1.5),
        vz: tz * 3 + Math.sin(a) * 2,
        vida: sortear(0.2, 0.4),
        tam: sortear(0.15, 0.3),
        cor: cor2,
        brilho: 2.4,
        quadro: Q.ESTRELA,
        giro: 4,
        arrasto: 3,
        entrada: 0.1,
      });
    }
  }

  /** Poça contínua do elemento (chame todo quadro): veneno borbulha, fogo vira lava. */
  poca(id: Id, x: number, z: number, raio: number, elemento: ElementoFx = 'veneno'): void {
    const [cor, cor2] = CORES_POCA[elemento];
    const chave = `p:${id}`;
    this.planos.manter(
      chave,
      {
        estilo: ESTILO_PLANO.POCA,
        x,
        z,
        raio,
        cor,
        cor2,
        alfa: 0.92,
        aditivo: 1,
        camada: 0,
        brilho: elemento === 'fogo' ? 1.5 : 1,
      },
      this.tempo
    );
    if (elemento === 'fogo')
      this.planos.manter(
        `${chave}l`,
        {
          estilo: ESTILO_PLANO.LUZ_CHAO,
          x,
          z,
          raio: raio * 1.7,
          cor: '#ff6a1a',
          brilho: 1.1,
          alfa: 0.8,
          camada: 1,
        },
        this.tempo
      );
    particulasPoca(this, elemento, x, z, raio, this.taxa(chave, 4 + raio * raio * 3));
  }

  /** Espinhos/erupção de terra em (x, z): rachadura, pedras e poeira. */
  erupcaoTerra(x: number, z: number, raio = 1.6): void {
    impacto(this, 'terra', x, 0.3, z, raio / 1.3);
    const n = this.q(5);
    for (let k = 0; k < n; k++)
      this.p.emitir({
        x: x + sinal() * raio * 0.4,
        y: 0.2,
        z: z + sinal() * raio * 0.4,
        vy: sortear(2, 4),
        vida: 0.9,
        tam: 0.5,
        tamFim: 1.4,
        cor: '#d8c09a',
        alfa: 0.55,
        aditivo: 0,
        quadro: Q.POEIRA,
        arrasto: 3,
        giro: sinal(),
        entrada: 0.15,
      });
  }

  /** Morte de inimigo: clarão, anel, pedaços na cor do inimigo e fumacinha. */
  morteInimigo(x: number, y: number, z: number, cor: CorFx, tamanho = 1): void {
    const s = tamanho;
    const p = this.p;
    const base = this.tmpCor.copy(cor instanceof THREE.Color ? cor : new THREE.Color(cor));
    const escura = base.clone().multiplyScalar(0.35);
    const clara = base.clone().lerp(new THREE.Color(1, 1, 1), 0.55);
    p.emitir({
      x,
      y,
      z,
      vida: 0.4,
      tam: 0.6 * s,
      tamFim: 1.6 * s,
      cor: escura,
      alfa: 0.5,
      aditivo: 0,
      quadro: Q.FUMACA_A,
      vy: 0.8,
      giro: sinal(),
      entrada: 0.15,
    });
    p.emitir({
      x,
      y,
      z,
      vida: 0.11,
      tam: 0.9 * s,
      tamFim: 1.9 * s,
      cor: '#ffffff',
      brilho: 2.4,
      quadro: Q.BRILHO,
      entrada: 0,
      curva: 1.5,
    });
    p.emitir({
      x,
      y,
      z,
      vida: 0.24,
      tam: 0.3 * s,
      tamFim: 2.1 * s,
      cor: '#ffffff',
      corFim: clara,
      brilho: 1.7,
      aditivo: 0.9,
      quadro: Q.ANEL,
      entrada: 0,
    });
    const n = this.q(8);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = sortear(2.5, 5.5);
      p.emitir({
        x,
        y,
        z,
        vx: Math.cos(a) * v,
        vy: sortear(2.5, 6),
        vz: Math.sin(a) * v,
        vida: sortear(0.7, 1),
        tam: sortear(0.2, 0.4) * s,
        cor: k % 3 ? base : clara,
        aditivo: 0,
        quadro: k % 2 ? Q.ROCHA_A : Q.ROCHA_B,
        rot: a,
        giro: sinal() * 12,
        gravidade: 16,
        quique: 0.35,
        curva: 0.3,
      });
    }
    const m = this.q(3);
    for (let k = 0; k < m; k++)
      p.emitir({
        x: x + sinal() * 0.4 * s,
        y: y + sortear(0, 0.5),
        z: z + sinal() * 0.4 * s,
        vida: 0.3,
        tam: 0.45 * s,
        cor: '#ffffff',
        brilho: 2.2,
        quadro: Q.ESTRELA,
        rot: Math.random(),
        giro: 3,
        entrada: 0.2,
      });
    this.planos.criar({
      estilo: ESTILO_PLANO.ANEL,
      x,
      z,
      raio: 0.2 * s,
      raioFim: 1.4 * s,
      vida: 0.28,
      cor: clara.clone(),
      cor2: base.clone(),
      brilho: 1.2,
      param: 0.3,
    });
  }

  /** Coleta de cristal de XP. */
  coletaCristal(x: number, y: number, z: number, cor: CorFx = '#9df0ff'): void {
    const p = this.p;
    p.emitir({
      x,
      y,
      z,
      vida: 0.12,
      tam: 0.6,
      tamFim: 1,
      cor,
      brilho: 2.2,
      quadro: Q.BRILHO,
      entrada: 0,
    });
    p.emitir({
      x,
      y,
      z,
      vida: 0.22,
      tam: 0.2,
      tamFim: 1,
      cor,
      brilho: 1.8,
      quadro: Q.ANEL,
      entrada: 0,
    });
    const n = this.q(4);
    for (let k = 0; k < n; k++)
      p.emitir({
        x,
        y,
        z,
        vx: sinal() * 1.2,
        vy: sortear(1.5, 3),
        vz: sinal() * 1.2,
        vida: 0.45,
        tam: 0.18,
        cor: '#ffffff',
        corFim: cor,
        brilho: 2.3,
        quadro: Q.ESTRELA,
        giro: 4,
        gravidade: 3,
        arrasto: 1.5,
      });
  }

  /** Subir de nível: pilar de luz, selo girando, anéis e espiral de faíscas. */
  subirNivel(x: number, z: number): void {
    this.volumes.criar(
      {
        estilo: ESTILO_VOLUME.PILAR,
        x,
        z,
        altura: 9,
        raioBase: 0.95,
        raioTopo: 1.5,
        cor: '#ffe08a',
        cor2: '#ff9a3c',
        brilho: 1.2,
        alfa: 0.9,
        aditivo: 0.75,
      },
      1.7
    );
    this.planos.criar({
      estilo: ESTILO_PLANO.DECAL,
      x,
      z,
      raio: 2.7,
      vida: 2.1,
      cor: '#ffc860',
      brilho: 1.15,
      param: D.SELO,
      aditivo: 0.65,
      camada: 0,
      giro: 0.8,
      entrada: 0.1,
      curva: 1.4,
    });
    this.planos.criar({
      estilo: ESTILO_PLANO.LUZ_CHAO,
      x,
      z,
      raio: 4,
      vida: 1.2,
      cor: '#ffb347',
      alfa: 0.6,
      curva: 1.2,
    });
    for (let k = 0; k < 3; k++)
      this.agendar(0.02 + k * 0.16, (t) => {
        if (t >= 1)
          this.planos.criar({
            estilo: ESTILO_PLANO.ANEL_RUNICO,
            x,
            z,
            raio: 0.6,
            raioFim: 3.2 + k * 0.9,
            vida: 0.75,
            cor: '#ffd27a',
            cor2: '#ff9a3c',
            brilho: 1.3,
            param: 0.16,
            giro: 2,
            aditivo: 0.7,
          });
      });
    const p = this.p;
    p.emitir({
      x,
      y: 1,
      z,
      vida: 0.25,
      tam: 1.8,
      tamFim: 2.8,
      cor: '#fff3c4',
      brilho: 1.6,
      quadro: Q.BRILHO,
      entrada: 0,
      curva: 1.8,
    });
    const n = this.q(40);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const r = sortear(0.8, 1.4);
      p.emitir({
        x: x + Math.cos(a) * r,
        y: sortear(0, 0.6),
        z: z + Math.sin(a) * r,
        orbX: x,
        orbZ: z,
        orbW: k % 2 ? 4 : -4,
        orbVr: -0.25,
        vy: sortear(2.5, 6.5),
        vida: sortear(0.9, 1.4),
        tam: sortear(0.1, 0.22),
        cor: '#fff8e0',
        corFim: '#ffb347',
        brilho: 2.5,
        quadro: k % 3 ? Q.BRASA : Q.ESTRELA,
        giro: 3,
        arrasto: 0.6,
      });
    }
    this.pulso('#ffe2a0', 0.5);
  }

  /** Evolução de habilidade: círculo rúnico, vórtice que suga e estouro na cor. */
  evolucao(x: number, z: number, cor: CorFx = '#c58bff'): void {
    const c = copiarCor(cor);
    this.planos.criar({
      estilo: ESTILO_PLANO.DECAL,
      x,
      z,
      raio: 3.4,
      vida: 2.4,
      cor: c,
      brilho: 1.1,
      param: D.CIRCULO,
      aditivo: 0.6,
      camada: 0,
      giro: 1.4,
      entrada: 0.12,
      curva: 1.3,
    });
    this.volumes.criar(
      {
        estilo: ESTILO_VOLUME.PILAR,
        x,
        z,
        altura: 7,
        raioBase: 1.3,
        raioTopo: 0.5,
        cor: c,
        cor2: '#ffffff',
        brilho: 1.1,
        alfa: 0.85,
        aditivo: 0.7,
      },
      1.9
    );
    const p = this.p;
    const n = this.q(44);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = sortear(2.8, 3.8);
      const vida = sortear(0.55, 0.7);
      p.emitir({
        x: x + Math.cos(a) * r,
        y: sortear(0.2, 2.2),
        z: z + Math.sin(a) * r,
        orbX: x,
        orbZ: z,
        orbW: 5,
        orbVr: -(r - 0.2) / vida,
        vy: 0.5,
        vida,
        tam: sortear(0.1, 0.2),
        cor: '#ffffff',
        corFim: c,
        brilho: 2.4,
        quadro: k % 3 ? Q.BRASA : Q.ESTRELA,
        modo: k % 3 ? MODO.ESTICADO : MODO.TELA,
        estica: 0.04,
        entrada: 0.3,
        curva: 0.4,
      });
    }
    this.agendar(0.62, (t) => {
      if (t < 1) return;
      p.emitir({
        x,
        y: 1,
        z,
        vida: 0.3,
        tam: 2.5,
        tamFim: 5,
        cor: '#ffffff',
        brilho: 2.8,
        quadro: Q.BRILHO,
        entrada: 0,
        curva: 1.6,
      });
      p.emitir({
        x,
        y: 1,
        z,
        vida: 0.5,
        tam: 2,
        tamFim: 5.5,
        cor: c,
        brilho: 2,
        quadro: Q.RAIOS,
        rot: Math.random() * 6,
        giro: 1.5,
        entrada: 0,
      });
      const m = this.q(30);
      for (let k = 0; k < m; k++) {
        const a = Math.random() * Math.PI * 2;
        const v = sortear(4, 10);
        p.emitir({
          x,
          y: 1,
          z,
          vx: Math.cos(a) * v,
          vy: sortear(1, 5),
          vz: Math.sin(a) * v,
          vida: sortear(0.5, 0.9),
          tam: sortear(0.2, 0.4),
          cor: '#ffffff',
          corFim: c,
          brilho: 2.6,
          quadro: Q.ESTRELA,
          giro: 5,
          arrasto: 2.5,
          gravidade: 2,
        });
      }
      this.planos.criar({
        estilo: ESTILO_PLANO.ANEL,
        x,
        z,
        raio: 0.5,
        raioFim: 5.5,
        vida: 0.65,
        cor: '#ffffff',
        cor2: c,
        brilho: 1.6,
        param: 0.22,
      });
      this.tremer(0.25);
      this.pulso(c, 0.6);
    });
  }

  // ------------------------------------------------------------------ tema programação

  /** Morte "deletada": varredura branca, voxels espalhando e 0/1 subindo (padrão sugerido). */
  morteDigital(x: number, y: number, z: number, cor: CorFx, tamanho = 1): void {
    codigo.morteDigital(this, x, y, z, cor, tamanho);
  }

  /** Chuva de código estilo matriz numa área (surgimento/teleporte, chefes). */
  chuvaCodigo(x: number, z: number, raio = 1.6, duracao = 1.2): void {
    codigo.chuvaCodigo(this, x, z, raio, duracao);
  }

  /** Estouro de glitch RGB (teleporte de Glitch / Null Pointer). */
  glitch(x: number, y: number, z: number, escala = 1): void {
    codigo.glitch(this, x, y, z, escala);
  }

  /** Firewall: muralha circular hexagonal em chamas. t = progresso 0..1 (chame todo quadro). */
  firewall(id: Id, x: number, z: number, raio: number, t: number): void {
    codigo.firewall(this, id, x, z, raio, t);
  }

  /** Pulso do coletor de lixo (uma vez): varre para dentro, suga e compacta. */
  coletorLixo(x: number, z: number, raio = 4): void {
    codigo.coletorLixo(this, x, z, raio);
  }

  /** Breakpoint (todo quadro, t = 0..1): marcador vermelho → campo congelado com "||". */
  breakpoint(x: number, z: number, raio: number, t: number, id: Id = 0): void {
    codigo.breakpoint(this, x, z, raio, t, id);
  }

  /** Disparo do breakpoint (uma vez, quando o campo congela). */
  breakpointAtivar(x: number, z: number, raio: number): void {
    codigo.breakpointAtivar(this, x, z, raio);
  }

  /** Projétil recursivo se dividindo: faísca fractal em Y. Rastro: projetilRastro(id, 'codigo', ...). */
  recursao(x: number, y: number, z: number, profundidade = 3, cor: CorFx = '#39ff88'): void {
    codigo.recursao(this, x, y, z, profundidade, cor);
  }

  /** Ransomware criptografou algo: cadeado + anel verde. */
  criptografar(x: number, y: number, z: number): void {
    codigo.criptografar(this, x, y, z);
  }

  /** Vazamento de memória: poça roxo-azulada com dígitos hex (chame todo quadro). */
  vazamento(id: Id, x: number, z: number, raio = 1.6): void {
    codigo.vazamento(this, id, x, z, raio);
  }

  // ------------------------------------------------------------------ quadro

  /** Avança e prepara os efeitos (chame uma vez por quadro, antes de desenhar). */
  atualizar(dt: number, camera: THREE.Camera): void {
    dt = Math.min(Math.max(dt, 0), 0.1);
    this.tempo += dt;
    this.dtQuadro = dt || 1 / 60;
    // agenda (efeitos com duração: novas, meteoros, colunas de fumaça...)
    for (let i = 0; i < this.agenda.length; i++) {
      const a = this.agenda[i];
      a.idade += dt;
      const t = Math.min(1, a.idade / a.total);
      a.fn(t, dt);
      if (t >= 1) {
        this.agenda.splice(i, 1);
        i--;
      }
    }
    this.rastros.atualizar(this.tempo, this.folga);
    this.raios.atualizar(dt, this.tempo, this.folga);
    this.fitas.iniciar(camera, this.tempo);
    this.rastros.desenhar(this.fitas, this.tempo);
    this.raios.desenhar(this.fitas, this.tempo);
    this.fitas.concluir();
    this.p.atualizar(dt);
    this.planos.atualizar(dt, this.tempo, this.folga);
    this.volumes.atualizar(dt, this.tempo, this.folga);
    this.tremorAtual *= Math.exp(-dt * 7);
    this.pos?.atualizar(dt);
    if (this.acumulos.size > 64 && Math.random() < 0.05) {
      for (const [k, a] of this.acumulos) if (this.tempo - a.toque > 2) this.acumulos.delete(k);
    }
  }

  /** Tremor de câmera sugerido (m) — some sozinho; o jogo pode somar ao seu. */
  tremor(): number {
    return this.tremorAtual;
  }

  /** Contadores para depuração/perfil. */
  estatisticas(): { particulas: number; rastros: number; drawCalls: number } {
    return { particulas: this.p.vivas, rastros: this.rastros.quantidade, drawCalls: 4 };
  }

  /** Remove todos os efeitos ativos (troca de fase, fim de partida). */
  limpar(): void {
    this.p.limpar();
    this.planos.limpar();
    this.volumes.limpar();
    this.raios.limpar();
    this.rastros.limpar();
    this.agenda.length = 0;
    this.acumulos.clear();
  }

  descartar(): void {
    this.cena.remove(this.grupo);
    this.p.descartar();
    this.fitas.descartar();
    this.planos.descartar();
    this.volumes.descartar();
    this.pos?.descartar();
    for (const t of this.texturas) t.dispose();
  }
}
