/**
 * A partida do roguelike: hordas que crescem com o tempo, cristais de experiência,
 * subida de nível com escolha de habilidades e todos os comportamentos das
 * habilidades (órbitas, projéteis, cadeias, ondas, chicotes, auras, chuvas, zonas,
 * lasers, ricochetes, bumerangues, poças e drones), com efeitos elementais.
 */
import * as THREE from 'three';
import type { ApiAudio, IdSom, OpcoesSom } from '../../audio/contrato';
import { criarAudio } from '../../audio/indice';
import { criarAleatorio } from '../../nucleo/aleatorio';
import { aproximar, aproximarAngulo } from '../../nucleo/matematica';
import type { Humor } from '../../nucleo/tipos';
import { ModeloClaude } from '../../render/modelo-claude';
import { gradienteToon, VENTO } from '../../render/materiais';
import { SistemaParticulas } from '../../render/particulas';
import { EntradaJogo } from '../../motor/entrada';
import {
  ELEMENTOS,
  HABILIDADES,
  habilidade,
  type DefHabilidade,
  type Elemento,
} from '../dados/habilidades';
import {
  INIMIGOS,
  INTERVALO_CHEFE,
  INTERVALO_HORDA,
  MAX_INIMIGOS,
  VALOR_CRISTAL,
  multDano,
  multVida,
  taxaSurgimento,
  type DefInimigo,
  type IdInimigo,
} from '../dados/inimigos';
import { personagem, type DefPersonagem, type IdPersonagem } from '../dados/personagens';
import {
  aplicarOferta,
  calcularAtributos,
  gerarOfertas,
  valoresHabilidade,
  xpParaNivel,
  type Atributos,
  type EstadoBuild,
  type Oferta,
} from '../nucleo/progresso';
import { criarArena, RAIO_ARENA, type Arena } from '../render/arena';
import { geometriaInimigo, geometriaProjetil, OLHOS, type FormaProjetil } from '../render/formas';
import { Halos, Lote } from '../render/instancias';
import type { Mensagem } from '../rede/canal';
import { Vozes } from '../voz';
import { Jogador, MAX_JOGADORES, type HabAtiva } from './jogador';

/** Ganchos que o multijogador instala na partida. */
export interface GanchosRede {
  /** Chamado a cada passo da simulação (envia posições, estado…). */
  aposPasso(dt: number): void;
  /** O anfitrião abriu um nível: manda as cartas para os convidados. */
  nivelAberto(): void;
  /** Este aparelho (convidado) escolheu/sorteou cartas. */
  escolha(i: number): void;
  rerrolar(): void;
  /** Anfitrião: a partida terminou. */
  fim(): void;
}

export type EstadoPartida = 'menu' | 'jogando' | 'nivel' | 'pausa' | 'fim';

type TipoAtaque = 'onda' | 'investida' | 'invocar' | 'abrir' | 'mirar' | 'criptografar';
const TIPOS_ATAQUE: TipoAtaque[] = [
  'onda',
  'investida',
  'invocar',
  'abrir',
  'mirar',
  'criptografar',
];

/** Poça deixada pelo Vazamento de Memória (deixa os jogadores lentos). */
interface PocaInimiga {
  x: number;
  z: number;
  raio: number;
  vida: number;
  malha: THREE.Mesh;
}

interface Inimigo {
  id: number;
  def: DefInimigo;
  x: number;
  z: number;
  y: number;
  vy: number;
  vx: number;
  vz: number;
  vida: number;
  vidaMax: number;
  dano: number;
  vel: number;
  raio: number;
  ang: number;
  lento: number;
  congelado: number;
  atordoado: number;
  queimar: number;
  queimarDps: number;
  veneno: number;
  venenoDps: number;
  flash: number;
  recarga: number;
  vivo: boolean;
  elite: boolean;
  fase: number;
  hits: Float32Array;
  ataque?: { tipo: TipoAtaque; t: number; ax: number; az: number };
  /** Vírus: quantas vezes já se copiou. */
  geracao?: number;
  /** Worm: últimas posições (para desenhar o corpo). */
  rastro?: number[];
}

interface Projetil {
  hab: number;
  inimigo: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  vida: number;
  dano: number;
  raio: number;
  perfura: number;
  forma: FormaProjetil;
  cor: THREE.Color;
  escala: number;
  giro: number;
  rot: number;
  elemento: Elemento;
  teleguiado: boolean;
  explode: number;
  atingidos: Set<Inimigo>;
  bumerangue?: { voltando: boolean; dist: number; max: number };
  ricochete?: boolean;
  arco?: { alvoX: number; alvoZ: number; t: number; total: number; ox: number; oz: number };
  fragmenta?: boolean;
  /** Recursão: quantas vezes ainda se divide ao acertar. */
  profundidade?: number;
  cdAcerto?: number;
}

interface Zona {
  tipo: 'tornado' | 'buraco' | 'poca' | 'fogo' | 'muro';
  /** Firewall evoluído: acompanha o dono. */
  segue?: boolean;
  hab: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  raio: number;
  vida: number;
  total: number;
  dano: number;
  tick: number;
  elemento: Elemento;
  lento: boolean;
  seguir?: number;
  explode?: number;
  malha: THREE.Object3D;
}

interface Onda {
  hab: number;
  x: number;
  z: number;
  raio: number;
  vel: number;
  max: number;
  dano: number;
  elemento: Elemento;
  cone?: { ang: number; abertura: number };
  congela: boolean;
  forca: number;
  atingidos: Set<Inimigo>;
  malha: THREE.Mesh;
  /** Onda do chefe: jogadores já atingidos. */
  jogadores?: Set<number>;
}

interface Aviso {
  x: number;
  z: number;
  raio: number;
  t: number;
  total: number;
  cor: string;
  aoFim: () => void;
  malha: THREE.Mesh;
}

interface EfeitoVisual {
  malha: THREE.Object3D;
  vida: number;
  total: number;
  atualizar?: (t: number) => void;
}

interface Item {
  id: number;
  tipo: 'coracao' | 'ima' | 'bomba' | 'bau';
  x: number;
  z: number;
  malha: THREE.Object3D;
}

/** Cristal de experiência no chão; `alvo` = jogador que o está puxando. */
export interface Cristal {
  x: number;
  z: number;
  t: number;
  atraido: boolean;
  fase: number;
  alvo?: number;
}

export interface NumeroDano {
  x: number;
  y: number;
  z: number;
  valor: number;
  critico: boolean;
  vida: number;
  cor: string;
}

const CORES_CRISTAL = ['#5fd8ff', '#6dff9a', '#ffcf4a', '#ffffff'];
const TAM_CRISTAL = [0.2, 0.3, 0.44, 0.7];
const HALO_CRISTAL = [0.7, 1.15, 2.1, 4.2];
const BRILHO_CRISTAL = [0.55, 0.85, 1.35, 2.3];

export class Partida {
  readonly renderizador: THREE.WebGLRenderer;
  readonly cena = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly entrada: EntradaJogo;
  readonly audio: ApiAudio;
  readonly vozes: Vozes;
  readonly arena: Arena;
  readonly poeira = new SistemaParticulas(1400, false);
  readonly brilhos = new SistemaParticulas(2600, true);
  readonly halos = new Halos(3200);
  private sol: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  qualidade: 'alta' | 'media' | 'baixa';

  estado: EstadoPartida = 'menu';

  // jogadores: no solo há um; no multijogador local, até quatro
  jogadores: Jogador[] = [new Jogador(0, 'claude', true)];
  /** O jogador deste aparelho. */
  local: Jogador = this.jogadores[0];
  /** Jogador em contexto: os campos abaixo (x, vida, habs…) apontam para ele. */
  j: Jogador = this.local;
  /** Multijogador: papel deste aparelho e ganchos da rede. */
  papel: 'solo' | 'anfitriao' | 'convidado' = 'solo';
  rede: GanchosRede | null = null;

  get x(): number {
    return this.j.x;
  }
  set x(v: number) {
    this.j.x = v;
  }

  get z(): number {
    return this.j.z;
  }
  set z(v: number) {
    this.j.z = v;
  }

  get vx(): number {
    return this.j.vx;
  }
  set vx(v: number) {
    this.j.vx = v;
  }

  get vz(): number {
    return this.j.vz;
  }
  set vz(v: number) {
    this.j.vz = v;
  }

  get angulo(): number {
    return this.j.angulo;
  }
  set angulo(v: number) {
    this.j.angulo = v;
  }

  get dirX(): number {
    return this.j.dirX;
  }
  set dirX(v: number) {
    this.j.dirX = v;
  }

  get dirZ(): number {
    return this.j.dirZ;
  }
  set dirZ(v: number) {
    this.j.dirZ = v;
  }

  get vida(): number {
    return this.j.vida;
  }
  set vida(v: number) {
    this.j.vida = v;
  }

  get invencivel(): number {
    return this.j.invencivel;
  }
  set invencivel(v: number) {
    this.j.invencivel = v;
  }

  get dash(): number {
    return this.j.dash;
  }
  set dash(v: number) {
    this.j.dash = v;
  }

  get recargaDash(): number {
    return this.j.recargaDash;
  }
  set recargaDash(v: number) {
    this.j.recargaDash = v;
  }

  get dashX(): number {
    return this.j.dashX;
  }
  set dashX(v: number) {
    this.j.dashX = v;
  }

  get dashZ(): number {
    return this.j.dashZ;
  }
  set dashZ(v: number) {
    this.j.dashZ = v;
  }

  get humor(): Humor {
    return this.j.humor;
  }
  set humor(v: Humor) {
    this.j.humor = v;
  }

  get humorT(): number {
    return this.j.humorT;
  }
  set humorT(v: number) {
    this.j.humorT = v;
  }

  get atributos(): Atributos {
    return this.j.atributos;
  }
  set atributos(v: Atributos) {
    this.j.atributos = v;
  }

  get build(): EstadoBuild {
    return this.j.build;
  }
  set build(v: EstadoBuild) {
    this.j.build = v;
  }

  get habs(): HabAtiva[] {
    return this.j.habs;
  }
  set habs(v: HabAtiva[]) {
    this.j.habs = v;
  }

  get ofertas(): Oferta[] {
    return this.j.ofertas;
  }
  set ofertas(v: Oferta[]) {
    this.j.ofertas = v;
  }

  get rerrolagens(): number {
    return this.j.rerrolagens;
  }
  set rerrolagens(v: number) {
    this.j.rerrolagens = v;
  }

  get ultimaFalaDano(): number {
    return this.j.ultimaFalaDano;
  }
  set ultimaFalaDano(v: number) {
    this.j.ultimaFalaDano = v;
  }

  get def(): DefPersonagem {
    return this.j.def;
  }
  set def(v: DefPersonagem) {
    this.j.def = v;
  }

  get modelo(): ModeloClaude {
    return this.j.modelo;
  }
  set modelo(v: ModeloClaude) {
    this.j.modelo = v;
  }

  get personagemId(): IdPersonagem {
    return this.j.personagemId;
  }
  set personagemId(v: IdPersonagem) {
    this.j.personagemId = v;
  }

  nivel = 1;
  xp = 0;
  xpProximo = xpParaNivel(1);
  niveisPendentes = 0;
  tempo = 0;
  abates = 0;
  ouro = 0;
  danoCausado = 0;
  melhorTempo = 0;
  proximaHorda = INTERVALO_HORDA;
  proximoChefe = INTERVALO_CHEFE;
  chefesDerrotados = 0;
  chefeAtual: Inimigo | null = null;
  banner: { texto: string; sub: string; cor: string; vida: number } | null = null;
  numeros: NumeroDano[] = [];
  aoMudar: () => void = () => {};

  private inimigos: Inimigo[] = [];
  private projeteis: Projetil[] = [];
  private zonas: Zona[] = [];
  private ondas: Onda[] = [];
  private avisos: Aviso[] = [];
  private efeitos: EfeitoVisual[] = [];
  private itens: Item[] = [];
  private cristais: Cristal[] = [];
  private acumulado = 0;
  private proximoId = 1;
  private rnd = criarAleatorio(Date.now() & 0xffff);
  private grade = new Map<number, Inimigo[]>();
  private lotesInimigos = new Map<IdInimigo, Lote>();
  private loteOlhos: Lote;
  private lotesProj = new Map<FormaProjetil, Lote>();
  private lotesCristal: Lote[] = [];
  private loteOrbita: Lote;
  /** Corpo segmentado dos Worms. */
  private loteSegmentos: Lote;
  private aura: THREE.Mesh;
  private matAura: THREE.MeshBasicMaterial;
  private alvoCam = new THREE.Vector3();
  private tremor = 0;
  private congelado = 0;
  private sonsT = new Map<string, number>();
  private corTmp = new THREE.Color();
  private qTmp = new THREE.Quaternion();
  private eTmp = new THREE.Euler();
  private menuGiro = 0;
  private nivelDesde = 0;
  private chefesSurgidos = 0;
  private noite = 0;
  private anelMagnetico: THREE.Mesh;
  private aurasJogador = new Map<Jogador, THREE.Mesh>();
  private pocasInimigas: PocaInimiga[] = [];
  private geoPoca = new THREE.CircleGeometry(1, 28);
  private matPoca = new THREE.MeshBasicMaterial({
    color: '#7a5cff',
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
  });
  /** Tipos de inimigo já apresentados nesta partida (aviso na primeira aparição). */
  private tiposVistos = new Set<IdInimigo>();

  constructor(
    private canvas: HTMLCanvasElement,
    qualidade?: 'alta' | 'media' | 'baixa'
  ) {
    const grosso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this.qualidade = qualidade ?? (grosso ? 'media' : 'alta');
    this.renderizador = new THREE.WebGLRenderer({
      canvas,
      antialias: this.qualidade !== 'baixa',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderizador.setClearColor(0, 0);
    this.renderizador.outputColorSpace = THREE.SRGBColorSpace;
    this.renderizador.shadowMap.enabled = this.qualidade !== 'baixa';
    this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.5, 220);
    this.cena.fog = new THREE.Fog('#f3e3cf', 30, 70);
    this.hemi = new THREE.HemisphereLight('#dff1ff', '#8a7a62', 1.7);
    this.sol = new THREE.DirectionalLight('#fff0d6', 2.3);
    this.sol.castShadow = this.qualidade !== 'baixa';
    this.sol.shadow.mapSize.set(
      this.qualidade === 'alta' ? 2048 : 1024,
      this.qualidade === 'alta' ? 2048 : 1024
    );
    const s = this.sol.shadow.camera;
    s.left = s.bottom = -26;
    s.right = s.top = 26;
    s.near = 1;
    s.far = 80;
    this.sol.shadow.bias = -0.0008;
    this.sol.shadow.normalBias = 0.03;
    this.cena.add(this.hemi, this.sol, this.sol.target);

    this.entrada = new EntradaJogo(canvas);
    this.audio = criarAudio();
    this.vozes = new Vozes(this.audio);
    this.arena = criarArena(this.qualidade);
    this.cena.add(this.arena.grupo, this.poeira.pontos, this.brilhos.pontos, this.halos.pontos);

    const matInimigo = new THREE.MeshToonMaterial({
      color: '#ffffff',
      gradientMap: gradienteToon(),
    });
    for (const id of Object.keys(INIMIGOS) as IdInimigo[]) {
      const lote = new Lote(
        geometriaInimigo(id),
        matInimigo,
        INIMIGOS[id].comportamento === 'chefe' ? 4 : MAX_INIMIGOS,
        this.qualidade === 'alta'
      );
      this.lotesInimigos.set(id, lote);
      this.cena.add(lote.malha);
    }
    this.loteOlhos = new Lote(
      new THREE.SphereGeometry(1, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      MAX_INIMIGOS * 2 + 8
    );
    this.cena.add(this.loteOlhos.malha);
    const matProj = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.95,
    });
    for (const f of [
      'orbe',
      'lanca',
      'lamina',
      'disco',
      'serra',
      'cristal',
      'estrela',
      'gota',
    ] as FormaProjetil[]) {
      const lote = new Lote(
        geometriaProjetil(f),
        f === 'serra' || f === 'disco'
          ? new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradienteToon() })
          : matProj,
        700
      );
      this.lotesProj.set(f, lote);
      this.cena.add(lote.malha);
    }
    this.loteSegmentos = new Lote(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: gradienteToon() }),
      MAX_INIMIGOS,
      this.qualidade === 'alta'
    );
    this.cena.add(this.loteSegmentos.malha);
    this.loteOrbita = new Lote(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      200
    );
    this.cena.add(this.loteOrbita.malha);
    for (let t = 0; t < 4; t++) {
      const lote = new Lote(
        new THREE.OctahedronGeometry(1, 0),
        new THREE.MeshToonMaterial({
          color: '#ffffff',
          gradientMap: gradienteToon(),
          emissive: CORES_CRISTAL[t],
          emissiveIntensity: 0.35 + t * 0.25,
        }),
        2400
      );
      this.lotesCristal.push(lote);
      this.cena.add(lote.malha);
    }
    this.matAura = new THREE.MeshBasicMaterial({
      color: '#fff3c4',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.aura = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 64), this.matAura);
    this.aura.rotation.x = -Math.PI / 2;
    this.cena.add(this.aura);
    this.anelMagnetico = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 64),
      new THREE.MeshBasicMaterial({
        color: '#9df0ff',
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
    );
    this.anelMagnetico.rotation.x = -Math.PI / 2;
    this.cena.add(this.anelMagnetico);

    this.escolherPersonagem('claude');
    this.semearCristais();
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
  }

  // ------------------------------------------------------------------ utilidades

  redimensionar(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      this.qualidade === 'alta' ? 2 : this.qualidade === 'media' ? 1.5 : 1
    );
    this.renderizador.setPixelRatio(dpr);
    this.renderizador.setSize(w, h, false);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.poeira.definirEscala(h * dpr);
    this.brilhos.definirEscala(h * dpr);
    this.halos.definirEscala(h * dpr);
  }

  paraTela(x: number, y: number, z: number): { x: number; y: number; visivel: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
      visivel: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1,
    };
  }

  private som(id: IdSom, o: OpcoesSom = {}, intervalo = 0.06): void {
    const agora = this.tempoReal();
    const u = this.sonsT.get(id) ?? 0;
    if (agora - u < intervalo) return;
    this.sonsT.set(id, agora);
    this.audio.tocar(id, o.x === undefined ? o : { ...o, x: o.x, y: o.y });
  }

  private tempoReal(): number {
    return performance.now() / 1000;
  }

  private sentir(h: Humor, d = 2): void {
    this.humor = h;
    this.humorT = d;
    const emote: Partial<Record<Humor, Parameters<ModeloClaude['emote']['mostrar']>[0]>> = {
      surpreso: 'exclamacao',
      feliz: 'nota',
      determinado: 'estrela',
      medo: 'suor',
      raiva: 'raiva',
      carinho: 'coracao',
    };
    const e = emote[h];
    if (e) this.modelo.emote.mostrar(e, 1.2);
  }

  falar(tipo: keyof DefPersonagem['falas'], prioridade = false): void {
    if (!this.j.local) return;
    const l = this.def.falas[tipo];
    this.vozes.falar(l[Math.floor(Math.random() * l.length)], this.def.voz, prioridade);
  }

  tremer(f: number): void {
    this.tremor = Math.max(this.tremor, f);
  }

  // ------------------------------------------------------------------ início

  escolherPersonagem(id: IdPersonagem): void {
    this.trocarModelo(this.local, id);
  }

  private trocarModelo(jg: Jogador, id: IdPersonagem): void {
    this.cena.remove(jg.modelo.raiz, jg.modelo.sombraContato);
    jg.trocarPersonagem(id);
    this.cena.add(jg.modelo.raiz, jg.modelo.sombraContato);
    jg.modelo.raiz.position.set(jg.x, 0, jg.z);
  }

  /** Multijogador: define quem está na partida (índice 0 = anfitrião). */
  configurarJogadores(
    lista: { indice: number; personagem: IdPersonagem }[],
    meuIndice: number,
    papel: 'solo' | 'anfitriao' | 'convidado'
  ): void {
    for (const jg of this.jogadores) this.cena.remove(jg.modelo.raiz, jg.modelo.sombraContato);
    for (const m of this.aurasJogador.values()) this.cena.remove(m);
    this.aurasJogador.clear();
    this.papel = papel;
    this.jogadores = lista
      .slice()
      .sort((a, b) => a.indice - b.indice)
      .map((d) => new Jogador(d.indice, d.personagem, d.indice === meuIndice));
    this.local = this.jogadores.find((jg) => jg.local) ?? this.jogadores[0];
    this.j = this.local;
    for (const jg of this.jogadores) this.cena.add(jg.modelo.raiz, jg.modelo.sombraContato);
    this.aoMudar();
  }

  /** Volta ao jogo solo com o personagem do jogador local. */
  modoSolo(): void {
    const id = this.local.personagemId;
    this.rede = null;
    this.configurarJogadores([{ indice: 0, personagem: id }], 0, 'solo');
  }

  /** Jogador dono de uma habilidade (pelo código `idx`). */
  private donoHab(codigo: number): Jogador | undefined {
    if (codigo < 0) return undefined;
    const indice = Math.floor(codigo / HABILIDADES.length);
    return this.jogadores.find((jg) => jg.indice === indice);
  }

  private habDe(codigo: number): HabAtiva | undefined {
    return this.donoHab(codigo)?.habs.find((h) => h.idx === codigo);
  }

  /** Jogadores que podem agir (não caídos nem ausentes). */
  private ativos(): Jogador[] {
    return this.jogadores.filter((jg) => !jg.caido && !jg.ausente);
  }

  private maisProximoJogador(x: number, z: number): Jogador | null {
    let melhor: Jogador | null = null;
    let md = Infinity;
    for (const jg of this.jogadores) {
      if (jg.caido || jg.ausente) continue;
      const d = (jg.x - x) ** 2 + (jg.z - z) ** 2;
      if (d < md) {
        md = d;
        melhor = jg;
      }
    }
    return melhor;
  }

  get autoridade(): boolean {
    return this.papel !== 'convidado';
  }

  /** Pausa só deste aparelho (multijogador: o jogo segue para os outros). */
  get pausaLocal(): boolean {
    return this.papel !== 'solo' && this.local.ausente;
  }

  private semearCristais(): void {
    this.cristais = [];
    for (let i = 0; i < 900; i++) {
      const a = this.rnd() * Math.PI * 2;
      const d = 6 + Math.sqrt(this.rnd()) * (RAIO_ARENA - 8);
      const r = this.rnd();
      const t = r < 0.8 ? 0 : r < 0.96 ? 1 : r < 0.995 ? 2 : 3;
      this.cristais.push({
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        t,
        atraido: false,
        fase: this.rnd() * 6,
      });
    }
    // aglomerados brilhantes
    // aglomerados brilhantes, mais ricos quanto mais longe do centro
    for (let k = 0; k < 14; k++) {
      const a = this.rnd() * Math.PI * 2;
      const d = 18 + this.rnd() * (RAIO_ARENA - 28);
      const cx = Math.cos(a) * d;
      const cz = Math.sin(a) * d;
      const rico = d > 60;
      for (let i = 0; i < 10; i++)
        this.cristais.push({
          x: cx + (this.rnd() - 0.5) * 5,
          z: cz + (this.rnd() - 0.5) * 5,
          t: i === 0 ? (rico ? 3 : 2) : this.rnd() < 0.25 ? 2 : 1,
          atraido: false,
          fase: this.rnd() * 6,
        });
    }
  }

  iniciar(): void {
    for (const i of this.inimigos) i.vivo = false;
    this.inimigos = [];
    for (const z of this.zonas) this.cena.remove(z.malha);
    for (const o of this.ondas) this.cena.remove(o.malha);
    for (const a of this.avisos) this.cena.remove(a.malha);
    for (const e of this.efeitos) this.cena.remove(e.malha);
    for (const it of this.itens) this.cena.remove(it.malha);
    for (const p of this.pocasInimigas) this.cena.remove(p.malha);
    this.pocasInimigas = [];
    this.tiposVistos.clear();
    this.chefesSurgidos = 0;
    this.zonas = [];
    this.ondas = [];
    this.avisos = [];
    this.efeitos = [];
    this.itens = [];
    this.projeteis = [];
    this.numeros = [];
    this.semearCristais();
    this.limparLotesSimulacao();
    this.halos.marcar();
    for (const jg of this.jogadores) {
      this.j = jg;
      // em grupo, cada um começa num ponto de um pequeno círculo
      const n = this.jogadores.length;
      const a = (jg.indice / Math.max(1, n)) * Math.PI * 2;
      this.x = n > 1 ? Math.cos(a) * 2.5 : 0;
      this.z = n > 1 ? Math.sin(a) * 2.5 : 0;
      this.vx = this.vz = 0;
      jg.rede = { x: this.x, z: this.z, vx: 0, vz: 0, angulo: 0, dash: false, t: 0 };
      this.habs = [];
      this.build = { ativas: [{ id: this.def.habilidadeInicial, nivel: 1 }], passivas: [] };
      this.atualizarBuild();
      this.vida = this.atributos.vidaMaxima;
      this.rerrolagens = 2;
      this.invencivel = 1.5;
      jg.caido = false;
      jg.resgate = 0;
      jg.escolheu = true;
      jg.ausente = false;
    }
    this.j = this.local;
    this.nivel = 1;
    this.xp = 0;
    this.xpProximo = xpParaNivel(1);
    this.niveisPendentes = 0;
    this.tempo = 0;
    this.abates = 0;
    this.ouro = 0;
    this.danoCausado = 0;
    this.proximaHorda = INTERVALO_HORDA;
    this.proximoChefe = INTERVALO_CHEFE;
    this.chefesDerrotados = 0;
    this.chefeAtual = null;
    this.estado = 'jogando';
    this.audio.musica('jardim');
    this.mostrarBanner('Sobreviva ao Ruído', `${this.def.nome} — ${this.def.titulo}`, this.def.cor);
    this.falar('inicio', true);
    this.sentir('determinado', 2.5);
    try {
      this.melhorTempo = Number(
        localStorage.getItem(`centelha-sobrevivencia:melhor:${this.personagemId}`) ?? 0
      );
    } catch {
      this.melhorTempo = 0;
    }
    this.aoMudar();
  }

  private atualizarBuild(): void {
    this.atributos = calcularAtributos(this.def.atributos, this.build);
    const antigos = new Map(this.habs.map((h) => [h.def.id, h]));
    this.habs = this.build.ativas.map((s) => {
      const def = habilidade(s.id);
      const ant = antigos.get(s.id);
      return ant
        ? { ...ant, nivel: s.nivel }
        : {
            def,
            idx: this.j.indice * HABILIDADES.length + HABILIDADES.indexOf(def),
            nivel: s.nivel,
            timer: 0.3,
            ativaAte: 0,
            fase: 0,
            danoTotal: 0,
            disparos: 0,
          };
    });
    this.vida = Math.min(this.vida, this.atributos.vidaMaxima);
  }

  mostrarBanner(texto: string, sub: string, cor: string, vida = 3): void {
    this.banner = { texto, sub, cor, vida };
  }

  // ------------------------------------------------------------------ níveis

  private ganharXp(v: number): void {
    if (!this.autoridade) return;
    // em grupo a experiência é de todos: usa o melhor bônus de sabedoria do time
    const mult = Math.max(...this.jogadores.map((jg) => jg.atributos.xp));
    this.xp += v * mult;
    while (this.xp >= this.xpProximo) {
      this.xp -= this.xpProximo;
      this.nivel++;
      this.xpProximo = xpParaNivel(this.nivel);
      this.niveisPendentes++;
    }
    if (this.niveisPendentes > 0 && this.estado === 'jogando') this.abrirNivel();
  }

  private abrirNivel(): void {
    this.estado = 'nivel';
    this.nivelDesde = this.tempoReal();
    for (const jg of this.jogadores) {
      if (jg.caido) {
        jg.escolheu = true;
        jg.ofertas = [];
        continue;
      }
      const qtd = this.rnd() < jg.atributos.sorte * 2 ? 4 : 3;
      jg.ofertas = gerarOfertas(jg.build, this.rnd, qtd);
      jg.escolheu = false;
    }
    this.j = this.local;
    this.rede?.nivelAberto();
    this.audio.tocar('comemoracao');
    this.brilhos.explosao(this.x, 1, this.z, 40, {
      cor: '#ffd27a',
      tamanho: 0.3,
      vida: 1,
      velocidade: 6,
      gravidade: -2,
    });
    this.sentir('feliz', 2);
    this.falar('nivel');
    this.aoMudar();
  }

  escolherOferta(i: number): void {
    if (this.estado !== 'nivel' || this.local.escolheu) return;
    if (this.papel === 'convidado') {
      if (!this.local.ofertas[i]) return;
      this.local.escolheu = true;
      this.audio.tocar('uiConfirmar');
      this.rede?.escolha(i);
      this.aoMudar();
      return;
    }
    this.aplicarEscolha(this.local, i);
  }

  /** Anfitrião/solo: aplica a carta escolhida por um jogador. */
  aplicarEscolha(jg: Jogador, i: number): void {
    if (this.estado !== 'nivel' || jg.escolheu) return;
    this.j = jg;
    const o = this.ofertas[i];
    if (!o) {
      this.j = this.local;
      return;
    }
    jg.escolheu = true;
    if (o.tipo === 'cura')
      this.vida = Math.min(this.atributos.vidaMaxima, this.vida + this.atributos.vidaMaxima * 0.3);
    else if (o.tipo === 'ouro') this.ouro += 25;
    else {
      const n = aplicarOferta(this.build, o);
      this.atualizarBuild();
      if (o.tipo === 'ativa' && (n === 5 || n === 10)) {
        const def = habilidade(o.id);
        this.mostrarBanner(
          n === 10 ? 'EVOLUÇÃO FINAL!' : 'EVOLUÇÃO!',
          `${def.nome}: ${n === 10 ? def.evolucao10 : def.evolucao5}`,
          def.cor,
          3.5
        );
        if (jg.local)
          this.vozes.falar(
            this.def.falas.evolucao[Math.floor(Math.random() * this.def.falas.evolucao.length)],
            this.def.voz,
            true
          );
        this.sentir('determinado', 3);
        this.ondaVisual(this.x, this.z, def.cor, 9, 0.8);
        this.brilhos.explosao(this.x, 1, this.z, 90, {
          cor: def.cor,
          tamanho: 0.35,
          vida: 1.4,
          velocidade: 9,
          gravidade: -1,
        });
        this.tremer(0.4);
        this.audio.tocar('restauracao');
      } else this.audio.tocar('uiConfirmar');
      if (o.tipo === 'passiva' && o.id === 'vigor') this.vida += 12;
    }
    this.j = this.local;
    if (this.jogadores.some((x) => !x.escolheu)) {
      this.rede?.nivelAberto();
      this.aoMudar();
      return;
    }
    this.niveisPendentes--;
    if (this.niveisPendentes > 0) this.abrirNivel();
    else {
      this.estado = 'jogando';
      for (const x of this.jogadores) x.invencivel = Math.max(x.invencivel, 0.6);
      this.rede?.nivelAberto();
    }
    this.aoMudar();
  }

  rerrolar(): void {
    if (this.estado !== 'nivel' || this.local.escolheu || this.local.rerrolagens <= 0) return;
    if (this.papel === 'convidado') {
      this.rede?.rerrolar();
      return;
    }
    this.rerrolarJogador(this.local);
  }

  /** Anfitrião/solo: sorteia de novo as cartas de um jogador. */
  rerrolarJogador(jg: Jogador): void {
    if (this.estado !== 'nivel' || jg.escolheu || jg.rerrolagens <= 0) return;
    jg.rerrolagens--;
    jg.ofertas = gerarOfertas(jg.build, this.rnd, jg.ofertas.length);
    if (jg.local) this.audio.tocar('uiNavegar');
    this.rede?.nivelAberto();
    this.aoMudar();
  }

  pausar(p: boolean): void {
    if (this.papel !== 'solo') {
      // em grupo a partida não para: só este jogador fica de fora (e protegido)
      if (this.estado === 'jogando' || this.estado === 'nivel') this.local.ausente = p;
      this.aoMudar();
      return;
    }
    if (p && this.estado === 'jogando') this.estado = 'pausa';
    else if (!p && this.estado === 'pausa') this.estado = 'jogando';
    this.aoMudar();
  }

  voltarMenu(): void {
    this.estado = 'menu';
    this.limparLotesSimulacao();
    this.halos.marcar();
    this.vozes.silenciar();
    this.audio.musica('titulo');
    this.aoMudar();
  }

  // ------------------------------------------------------------------ passo

  passo(dt: number): void {
    this.entrada.iniciarPasso();
    VENTO.tempo.value += dt;
    VENTO.forca.value = 0.55 + Math.sin(VENTO.tempo.value * 0.15) * 0.25;
    const ent = this.entrada;
    if (ent.apertou('pausa')) {
      if (this.papel !== 'solo') this.pausar(!this.local.ausente);
      else if (this.estado === 'jogando') this.pausar(true);
      else if (this.estado === 'pausa') this.pausar(false);
    }
    if (this.estado === 'nivel') {
      for (let k = 0; k < 4; k++)
        if (ent.apertou(`arma${k + 1}` as 'arma1')) this.escolherOferta(k);
      if (ent.apertou('conectar')) this.rerrolar();
      // grupo: quem demora demais recebe a primeira carta
      if (this.papel === 'anfitriao' && this.tempoReal() - this.nivelDesde > 30)
        for (const jg of this.jogadores) if (!jg.escolheu) this.aplicarEscolha(jg, 0);
    }
    if (this.estado === 'jogando') {
      if (this.congelado > 0) this.congelado -= dt;
      else {
        // a simulação põe órbitas, projéteis e brilhos; o desenho só acrescenta por cima
        this.limparLotesSimulacao();
        this.simular(dt);
        this.halos.marcar();
      }
    }
    if (this.estado !== 'menu') this.rede?.aposPasso(dt);
    if (this.banner) {
      this.banner.vida -= dt;
      if (this.banner.vida <= 0) this.banner = null;
    }
    this.entrada.finalizarPasso();
  }

  private limparLotesSimulacao(): void {
    this.halos.iniciar();
    this.loteOrbita.iniciar();
    for (const l of this.lotesProj.values()) l.iniciar();
  }

  private simular(dt: number): void {
    this.tempo += dt;
    // ------------------- jogadores
    for (const jg of this.jogadores) {
      this.j = jg;
      if (jg.local) this.moverLocal(dt);
      else this.moverRemoto(dt);
    }
    this.j = this.local;
    if (this.autoridade) this.atualizarResgates(dt);

    // ------------------- tempo: hordas, chefes, noite
    this.noite = Math.min(1, Math.max(0, (this.tempo - 200) / 360));
    if (this.tempo >= this.proximaHorda) {
      this.proximaHorda += INTERVALO_HORDA;
      this.horda();
    }
    if (this.tempo >= this.proximoChefe) {
      this.proximoChefe += INTERVALO_CHEFE;
      this.surgirChefe();
    }
    this.acumulado += taxaSurgimento(this.tempo) * dt;
    while (this.acumulado >= 1) {
      this.acumulado -= 1;
      this.surgirAleatorio();
    }

    // ------------------- grade espacial
    this.grade.clear();
    for (const i of this.inimigos) {
      const k = this.chave(i.x, i.z);
      let l = this.grade.get(k);
      if (!l) this.grade.set(k, (l = []));
      l.push(i);
    }

    // ------------------- habilidades (de cada jogador, no contexto dele)
    for (const jg of this.jogadores) {
      if (jg.caido || jg.ausente) continue;
      this.j = jg;
      for (const h of jg.habs) this.atualizarHabilidade(h, dt);
    }
    this.j = this.local;

    // ------------------- inimigos, projéteis, zonas, ondas, avisos
    this.atualizarInimigos(dt);
    this.atualizarProjeteis(dt);
    this.atualizarZonas(dt);
    this.atualizarPocasInimigas(dt);
    this.atualizarOndas(dt);
    this.atualizarAvisos(dt);
    this.atualizarCristais(dt);
    this.atualizarItens(dt);
    for (const n of this.numeros) {
      n.vida -= dt;
      n.y += dt * 1.4;
    }
    this.numeros = this.numeros.filter((n) => n.vida > 0);
    if (this.numeros.length > 70) this.numeros.splice(0, this.numeros.length - 70);

    this.j = this.local;
    if (this.autoridade)
      for (const jg of this.jogadores)
        if (!jg.caido && jg.vida <= 0) {
          if (this.papel === 'solo') {
            this.morrer();
            return;
          }
          this.cair(jg);
        }
  }

  /** Movimento do jogador deste aparelho (teclado/toque). */
  private moverLocal(dt: number): void {
    const at = this.atributos;
    const ent = this.entrada;
    const parado = this.j.caido || this.j.ausente;
    const m = parado ? { x: 0, y: 0 } : ent.movimento();
    const mag = Math.min(1, Math.hypot(m.x, m.y));
    const lentoPoca = this.naPoca(this.x, this.z);
    const vel =
      6 *
      at.velocidade *
      (ent.correndo() ? 1.1 : 1) *
      (this.j.caido ? 0 : 1) *
      (lentoPoca ? 0.55 : 1);
    this.recargaDash = Math.max(0, this.recargaDash - dt);
    this.invencivel = Math.max(0, this.invencivel - dt);
    if (!parado && (ent.apertou('pular') || ent.apertou('esquivar')) && this.recargaDash <= 0) {
      const d = mag > 0.2 ? { x: m.x / mag, z: m.y / mag } : { x: this.dirX, z: this.dirZ };
      this.dash = 0.2;
      this.dashX = d.x;
      this.dashZ = d.z;
      this.recargaDash = 1.4;
      this.som('esquiva');
      this.poeira.explosao(this.x, 0.1, this.z, 8, {
        cor: '#efe2cc',
        tamanho: 0.35,
        vida: 0.4,
        velocidade: 3,
      });
    }
    if (this.dash > 0) {
      this.dash -= dt;
      this.vx = this.dashX * 22;
      this.vz = this.dashZ * 22;
      this.brilhos.emitir({
        x: this.x,
        y: 0.7,
        z: this.z,
        vida: 0.3,
        tamanho: 0.5,
        cor: this.def.cor,
      });
    } else {
      const ax = mag > 0.15 ? (m.x / Math.max(mag, 1e-3)) * vel * Math.max(0.4, mag) : 0;
      const az = mag > 0.15 ? (m.y / Math.max(mag, 1e-3)) * vel * Math.max(0.4, mag) : 0;
      this.vx = aproximar(this.vx, ax, 14, dt);
      this.vz = aproximar(this.vz, az, 14, dt);
    }
    if (mag > 0.15) {
      this.dirX = m.x / mag;
      this.dirZ = m.y / mag;
      this.angulo = Math.atan2(this.dirX, this.dirZ);
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.colidirObstaculos(this, 0.42);
    const dc = Math.hypot(this.x, this.z);
    if (dc > RAIO_ARENA) {
      this.x *= RAIO_ARENA / dc;
      this.z *= RAIO_ARENA / dc;
    }
    this.cuidarVida(dt);
  }

  /** Jogador de outro aparelho: segue a última posição recebida, com suavização. */
  private moverRemoto(dt: number): void {
    const r = this.j.rede;
    this.invencivel = Math.max(0, this.invencivel - dt);
    // extrapola um pouco com a velocidade e aproxima suavemente
    const idade = Math.min(0.25, r.t);
    r.t += dt;
    const ax = r.x + r.vx * idade;
    const az = r.z + r.vz * idade;
    const k = 1 - Math.exp(-14 * dt);
    const dx = ax - this.x;
    const dz = az - this.z;
    if (dx * dx + dz * dz > 36) {
      this.x = ax;
      this.z = az;
    } else {
      this.x += dx * k;
      this.z += dz * k;
    }
    this.vx = r.vx;
    this.vz = r.vz;
    this.angulo = r.angulo;
    this.dirX = Math.sin(r.angulo);
    this.dirZ = Math.cos(r.angulo);
    this.dash = r.dash ? 0.1 : 0;
    this.cuidarVida(dt);
  }

  private cuidarVida(dt: number): void {
    const at = this.atributos;
    if (this.autoridade && !this.j.caido)
      this.vida = Math.min(at.vidaMaxima, this.vida + at.regeneracao * dt);
    this.humorT -= dt;
    if (this.humorT <= 0) this.humor = this.vida < at.vidaMaxima * 0.3 ? 'medo' : 'neutro';
  }

  /** Grupo: um jogador cai; os outros podem levantá-lo. Se todos caírem, acaba. */
  private cair(jg: Jogador): void {
    jg.caido = true;
    jg.vida = 0;
    jg.resgate = 0;
    jg.dash = 0;
    this.mostrarBanner(`${jg.def.nome} caiu!`, 'Fique perto para levantar', '#ff6b5a', 2.5);
    this.audio.tocar('derrota');
    if (this.jogadores.every((x) => x.caido)) this.morrer();
  }

  private atualizarResgates(dt: number): void {
    for (const jg of this.jogadores) {
      if (!jg.caido) continue;
      const perto = this.jogadores.some(
        (o) => o !== jg && !o.caido && (o.x - jg.x) ** 2 + (o.z - jg.z) ** 2 < 2.4 * 2.4
      );
      jg.resgate = perto ? jg.resgate + dt / 3 : Math.max(0, jg.resgate - dt * 0.5);
      if (jg.resgate >= 1) {
        jg.caido = false;
        jg.resgate = 0;
        jg.vida = jg.atributos.vidaMaxima * 0.4;
        jg.invencivel = 2;
        this.mostrarBanner(`${jg.def.nome} voltou!`, 'Trabalho em equipe', '#7affc1', 2);
        this.audio.tocar('restauracao');
        this.brilhos.explosao(jg.x, 1, jg.z, 50, {
          cor: '#7affc1',
          tamanho: 0.3,
          vida: 1,
          velocidade: 6,
          gravidade: -2,
        });
      }
    }
  }

  private chave(x: number, z: number): number {
    return (Math.floor(x / 3) + 512) * 1024 + (Math.floor(z / 3) + 512);
  }

  /** Inimigos num raio (usa a grade). */
  private vizinhos(x: number, z: number, r: number, saida: Inimigo[] = []): Inimigo[] {
    saida.length = 0;
    const c0 = Math.floor((x - r) / 3);
    const c1 = Math.floor((x + r) / 3);
    const l0 = Math.floor((z - r) / 3);
    const l1 = Math.floor((z + r) / 3);
    for (let cx = c0; cx <= c1; cx++)
      for (let cz = l0; cz <= l1; cz++) {
        const l = this.grade.get((cx + 512) * 1024 + (cz + 512));
        if (!l) continue;
        for (const i of l)
          if (i.vivo && (i.x - x) ** 2 + (i.z - z) ** 2 <= (r + i.raio) ** 2) saida.push(i);
      }
    return saida;
  }

  private maisProximo(
    x: number,
    z: number,
    alcance: number,
    excluir?: Set<Inimigo>
  ): Inimigo | null {
    let melhor: Inimigo | null = null;
    let md = alcance * alcance;
    for (const i of this.vizinhos(x, z, alcance, this.tmpLista)) {
      if (excluir?.has(i)) continue;
      const d = (i.x - x) ** 2 + (i.z - z) ** 2;
      if (d < md) {
        md = d;
        melhor = i;
      }
    }
    return melhor;
  }
  private tmpLista: Inimigo[] = [];
  private tmpLista2: Inimigo[] = [];

  private colidirObstaculos(e: { x: number; z: number }, r: number): void {
    for (const o of this.arena.obstaculosPerto(e.x, e.z)) {
      const dx = e.x - o.x;
      const dz = e.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + r;
      if (d < min && d > 1e-4) {
        e.x = o.x + (dx / d) * min;
        e.z = o.z + (dz / d) * min;
      }
    }
  }

  // ------------------------------------------------------------------ surgimento

  private criarInimigo(def: DefInimigo, x: number, z: number, elite = false): Inimigo | null {
    if (!this.autoridade) return null;
    if (this.inimigos.length >= MAX_INIMIGOS && def.comportamento !== 'chefe') return null;
    const mv = multVida(this.tempo) * (elite ? 6 : 1);
    const vida =
      def.vida * mv * (def.comportamento === 'chefe' ? 1 + this.chefesDerrotados * 0.8 : 1);
    const i: Inimigo = {
      id: this.proximoId++,
      def,
      x,
      z,
      y: 0,
      vy: 0,
      vx: 0,
      vz: 0,
      vida,
      vidaMax: vida,
      dano: def.dano * multDano(this.tempo) * (elite ? 1.5 : 1),
      vel: def.velocidade * (0.9 + this.rnd() * 0.2) * (1 + Math.min(0.35, this.tempo / 1200)),
      raio: def.raio * (elite ? 1.5 : 1),
      ang: 0,
      lento: 0,
      congelado: 0,
      atordoado: 0,
      queimar: 0,
      queimarDps: 0,
      veneno: 0,
      venenoDps: 0,
      flash: 0,
      recarga: 2 + this.rnd() * 2,
      vivo: true,
      elite,
      fase: this.rnd() * 10,
      hits: new Float32Array(HABILIDADES.length * MAX_JOGADORES),
    };
    this.inimigos.push(i);
    if (def.descricao && !this.tiposVistos.has(def.id)) {
      this.tiposVistos.add(def.id);
      this.mostrarBanner(`NOVO: ${def.nome.toUpperCase()}`, def.descricao, def.cor, 3);
    }
    return i;
  }

  private pontoBorda(dist: number): { x: number; z: number } {
    for (let k = 0; k < 6; k++) {
      const a = this.rnd() * Math.PI * 2;
      const x = this.x + Math.cos(a) * dist;
      const z = this.z + Math.sin(a) * dist;
      if (Math.hypot(x, z) < RAIO_ARENA - 1) return { x, z };
    }
    const a = Math.atan2(-this.z, -this.x) + (this.rnd() - 0.5);
    return { x: this.x + Math.cos(a) * dist, z: this.z + Math.sin(a) * dist };
  }

  private surgirAleatorio(): void {
    if (!this.autoridade) return;
    // em grupo, os inimigos surgem em volta de um jogador sorteado
    const vivos = this.ativos();
    if (vivos.length) this.j = vivos[Math.floor(this.rnd() * vivos.length)];
    const t = this.tempo;
    const tipos = (Object.values(INIMIGOS) as DefInimigo[]).filter(
      (d) => d.peso > 0 && d.aparece <= t
    );
    const total = tipos.reduce((s, d) => s + d.peso, 0);
    let r = this.rnd() * total;
    let def = tipos[0];
    for (const d of tipos) {
      r -= d.peso;
      if (r <= 0) {
        def = d;
        break;
      }
    }
    const p = this.pontoBorda(21 + this.rnd() * 5);
    if (def.comportamento === 'enxame') {
      const n = 5 + Math.floor(this.rnd() * 5);
      for (let k = 0; k < n; k++)
        this.criarInimigo(def, p.x + (this.rnd() - 0.5) * 3, p.z + (this.rnd() - 0.5) * 3);
      if (this.rnd() < 0.2) this.vozes.resmungar(def.voz, p.x, p.z);
    } else this.criarInimigo(def, p.x, p.z, def.id !== 'trollBug' && t > 240 && this.rnd() < 0.015);
    this.j = this.local;
  }

  private horda(): void {
    const vivos = this.ativos();
    const def = this.tempo > 200 && this.rnd() < 0.5 ? INIMIGOS.zumbido : INIMIGOS.chiado;
    // um anel em volta de cada jogador (um pouco menor por pessoa em grupo)
    const n = Math.round(
      Math.min(70, 26 + Math.floor(this.tempo / 15)) / Math.sqrt(Math.max(1, vivos.length))
    );
    for (const jg of vivos)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const x = jg.x + Math.cos(a) * 17;
        const z = jg.z + Math.sin(a) * 17;
        if (Math.hypot(x, z) < RAIO_ARENA) this.criarInimigo(def, x, z);
      }
    this.mostrarBanner('HORDA!', 'O Ruído cercou você', '#ff6b5a', 2.5);
    this.som('inimigoAlerta', {}, 0);
    this.vozes.resmungar(def.voz, this.x, this.z);
    this.sentir('surpreso', 1.5);
  }

  private surgirChefe(): void {
    // os chefes se alternam: Grande Ruído, Ransomware, Grande Ruído...
    const n = Math.round(this.proximoChefe / INTERVALO_CHEFE) - 2;
    const ransom = n % 2 === 1;
    if (this.autoridade) {
      const p = this.pontoBorda(18);
      const c = this.criarInimigo(ransom ? INIMIGOS.ransomware : INIMIGOS.chefe, p.x, p.z);
      if (!c) return;
      this.chefeAtual = c;
    }
    if (ransom)
      this.mostrarBanner(
        'RANSOMWARE INVADIU!',
        'Ele criptografa suas habilidades. Derrube-o rápido!',
        '#39ff88',
        4
      );
    else
      this.mostrarBanner('O GRANDE RUÍDO CHEGOU', 'Derrote-o para um baú de ideias', '#c58bff', 4);
    this.audio.musica('chefe');
    this.audio.tocar('chefeRugido');
    this.vozes.falar(
      ransom
        ? 'Seus arquivos agora são meus! Pague o resgate!'
        : 'Eu sou o Ruído! Ninguém vai me ouvir... mas vão me sentir!',
      { tom: 0.3, ritmo: 0.85, bipe: 'chefe' },
      true
    );
    window.setTimeout(() => this.falar('chefe', true), 4200);
    this.tremer(0.7);
  }

  // ------------------------------------------------------------------ dano

  private causarDano(
    i: Inimigo,
    dano: number,
    hab: number,
    elemento: Elemento,
    ex = 0,
    ez = 0,
    forca = 0,
    opcoes: { congela?: boolean; lento?: boolean } = {}
  ): void {
    if (!i.vivo) return;
    const dono = this.donoHab(hab) ?? this.j;
    let crit = this.rnd() < dono.atributos.sorte + (elemento === 'luz' ? 0.1 : 0);
    let d = dano * (crit ? 2 : 1) * (0.92 + this.rnd() * 0.16);
    if (i.congelado > 0 && elemento !== 'gelo') {
      d *= 1.3;
      crit = crit || this.rnd() < 0.2;
    }
    i.vida -= d;
    i.flash = 0.1;
    this.danoCausado += d;
    if (hab >= 0) {
      const h = this.habDe(hab);
      if (h) h.danoTotal += d;
    }
    // efeitos elementais
    switch (elemento) {
      case 'fogo':
        i.queimar = 3;
        i.queimarDps = Math.max(i.queimarDps, dano * 0.25);
        break;
      case 'gelo':
        i.lento = Math.max(i.lento, 2);
        if (opcoes.congela) i.congelado = Math.max(i.congelado, 1);
        break;
      case 'raio':
        i.atordoado = Math.max(i.atordoado, 0.25);
        break;
      case 'terra':
        if (i.def.comportamento !== 'chefe') {
          i.vy = 7;
          i.atordoado = Math.max(i.atordoado, 0.6);
        }
        break;
      case 'veneno':
        i.veneno = 4;
        i.venenoDps = Math.min(dano * 0.45, i.venenoDps + dano * 0.15);
        break;
      case 'agua':
        i.lento = Math.max(i.lento, 1.5);
        break;
      case 'codigo':
        i.atordoado = Math.max(i.atordoado, 0.3);
        break;
    }
    if (opcoes.lento) i.lento = Math.max(i.lento, 1);
    if (forca > 0) {
      const res =
        i.def.comportamento === 'chefe' ? 0.08 : i.elite || i.def.id === 'trollBug' ? 0.35 : 1;
      i.vx += ex * forca * res;
      i.vz += ez * forca * res;
    }
    if (this.numeros.length < 70 && (crit || d > 3 || this.rnd() < 0.5)) {
      this.numeros.push({
        x: i.x + (this.rnd() - 0.5) * 0.5,
        y: i.def.altura * (i.raio / i.def.raio) + 0.4,
        z: i.z,
        valor: Math.round(d),
        critico: crit,
        vida: 0.8,
        cor: crit ? '#ffd27a' : ELEMENTOS[elemento].cor,
      });
    }
    if (this.rnd() < 0.35)
      this.som('acerto', { x: i.x, y: i.z, volume: 0.4, tom: 0.9 + this.rnd() * 0.3 }, 0.05);
    if (i.vida <= 0) this.matar(i);
  }

  private matar(i: Inimigo): void {
    i.vivo = false;
    if (!this.autoridade) {
      // convidado: só o efeito; o anfitrião decide cristais, itens e contagem
      this.brilhos.explosao(i.x, 0.6, i.z, i.def.comportamento === 'chefe' ? 120 : 10, {
        cor: i.def.cor,
        tamanho: 0.28,
        vida: 0.6,
        velocidade: i.def.comportamento === 'chefe' ? 12 : 5,
      });
      this.som('inimigoDerrotado', { x: i.x, y: i.z, volume: 0.5 }, 0.07);
      return;
    }
    this.abates++;
    if (i.def.id === 'pilha')
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2 + this.rnd();
        const b = this.criarInimigo(
          INIMIGOS.bloco,
          i.x + Math.cos(a) * 0.9,
          i.z + Math.sin(a) * 0.9
        );
        if (b) b.vy = 5;
      }
    const cor = i.def.cor;
    this.brilhos.explosao(i.x, 0.6, i.z, i.def.comportamento === 'chefe' ? 120 : 10, {
      cor,
      tamanho: 0.28,
      vida: 0.6,
      velocidade: i.def.comportamento === 'chefe' ? 12 : 5,
    });
    if (i.def.id !== 'spam' || this.rnd() < 0.4)
      this.poeira.explosao(i.x, 0.5, i.z, 4, {
        cor: '#5a4a7a',
        tamanho: 0.35,
        vida: 0.5,
        velocidade: 3,
        gravidade: 5,
      });
    this.som('inimigoDerrotado', { x: i.x, y: i.z, volume: 0.5 }, 0.07);
    if (this.rnd() < 0.08) this.vozes.resmungar(i.def.voz, i.x, i.z);
    // cristal
    const t = i.elite ? 2 : i.def.cristal;
    if (i.def.comportamento === 'chefe') {
      for (let k = 0; k < 12; k++)
        this.soltarCristal(
          i.x + (this.rnd() - 0.5) * 4,
          i.z + (this.rnd() - 0.5) * 4,
          k < 3 ? 3 : 2
        );
      this.soltarItem('bau', i.x, i.z);
      this.chefesDerrotados++;
      this.chefeAtual = null;
      this.audio.tocar('chefeDerrotado');
      this.audio.musica(this.noite > 0.5 ? 'vale' : 'jardim');
      this.mostrarBanner(
        i.def.id === 'ransomware' ? 'RANSOMWARE REMOVIDO!' : 'GRANDE RUÍDO SILENCIADO!',
        i.def.id === 'ransomware' ? 'Arquivos liberados. Pegue o baú!' : 'Pegue o baú de ideias',
        '#ffd27a',
        3.5
      );
      for (const jg of this.jogadores) jg.bloqueios.clear();
      this.falar('vitoria', true);
      this.sentir('feliz', 3);
      this.tremer(1);
      this.congelado = 0.25;
    } else {
      this.soltarCristal(i.x, i.z, t);
      if (i.elite || i.def.id === 'trollBug') this.soltarItem('bau', i.x, i.z);
      const r = this.rnd();
      if (r < 0.012) this.soltarItem('coracao', i.x, i.z);
      else if (r < 0.015) this.soltarItem('ima', i.x, i.z);
      else if (r < 0.0175) this.soltarItem('bomba', i.x, i.z);
    }
    // praga: veneno passa adiante
    const praga = this.jogadores
      .flatMap((jg) => jg.habs)
      .find((h) => h.def.id === 'nuvemToxica' && h.nivel >= 10);
    if (praga && i.veneno > 0)
      for (const v of this.vizinhos(i.x, i.z, 2.5, this.tmpLista2))
        if (v !== i) this.causarDano(v, i.venenoDps, praga.idx, 'veneno');
  }

  private soltarCristal(x: number, z: number, t: number): void {
    if (this.cristais.length > 2200) {
      // funde em um cristal próximo, deixando-o maior
      const alvo = this.cristais.find(
        (c) => !c.atraido && Math.abs(c.x - x) < 3 && Math.abs(c.z - z) < 3 && c.t < 3
      );
      if (alvo) {
        alvo.t = Math.min(3, Math.max(alvo.t, t) + (this.rnd() < 0.3 ? 1 : 0));
        return;
      }
    }
    this.cristais.push({ x, z, t, atraido: false, fase: this.rnd() * 6 });
  }

  private soltarItem(tipo: Item['tipo'], x: number, z: number): void {
    const g = new THREE.Group();
    const cores = { coracao: '#ff5f7e', ima: '#9df0ff', bomba: '#ffb347', bau: '#ffd27a' };
    if (tipo === 'bau') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.55, 0.6),
        new THREE.MeshToonMaterial({ color: '#a8693f', gradientMap: gradienteToon() })
      );
      base.position.y = 0.3;
      const tampa = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.18, 0.65),
        new THREE.MeshToonMaterial({
          color: '#ffd27a',
          gradientMap: gradienteToon(),
          emissive: '#7a5a10',
        })
      );
      tampa.position.y = 0.66;
      g.add(base, tampa);
    } else {
      const m = new THREE.Mesh(
        tipo === 'coracao'
          ? new THREE.SphereGeometry(0.32, 12, 10)
          : tipo === 'ima'
            ? new THREE.TorusGeometry(0.3, 0.1, 6, 14, Math.PI * 1.4)
            : new THREE.IcosahedronGeometry(0.33, 1),
        new THREE.MeshBasicMaterial({ color: cores[tipo] })
      );
      m.position.y = 0.6;
      g.add(m);
    }
    g.position.set(x, 0, z);
    this.cena.add(g);
    this.itens.push({ id: this.proximoId++, tipo, x, z, malha: g });
  }

  private danoJogador(d: number, fonteX: number, fonteZ: number): void {
    if (!this.autoridade || this.j.caido || this.j.ausente) return;
    if (this.invencivel > 0 || this.dash > 0) return;
    const real = Math.max(1, d - this.atributos.armadura);
    this.vida -= real;
    this.invencivel = 0.7;
    this.sentirDano(this.j);
    if (!this.j.local) return;
    const dx = this.x - fonteX;
    const dz = this.z - fonteZ;
    const dd = Math.hypot(dx, dz) || 1;
    this.vx += (dx / dd) * 6;
    this.vz += (dz / dd) * 6;
    this.sentir(this.vida < this.atributos.vidaMaxima * 0.3 ? 'medo' : 'dor', 0.8);
    if (performance.now() - this.ultimaFalaDano > 9000) {
      this.ultimaFalaDano = performance.now();
      this.falar('dano');
    }
  }

  /** Efeito de levar dano (o convidado chama quando a vida dele cai na sincronização). */
  sentirDano(jg: Jogador): void {
    jg.modelo.piscarBranco();
    jg.modelo.impulso(-2);
    if (!jg.local) return;
    this.tremer(0.25);
    this.som('danoRecebido', {}, 0.1);
  }

  private morrer(): void {
    this.estado = 'fim';
    if (this.papel === 'solo') this.vida = 0;
    this.rede?.fim();
    this.audio.tocar('derrota');
    this.falar('morte', true);
    try {
      const chave = `centelha-sobrevivencia:melhor:${this.personagemId}`;
      const antes = Number(localStorage.getItem(chave) ?? 0);
      if (this.tempo > antes) localStorage.setItem(chave, String(Math.floor(this.tempo)));
      this.melhorTempo = Math.max(antes, this.tempo);
    } catch {
      /* sem armazenamento */
    }
    this.aoMudar();
  }

  /** Relatório do fim da partida. */
  relatorio(): { nome: string; icone: string; cor: string; nivel: number; dano: number }[] {
    return this.habs
      .map((h) => ({
        nome: h.def.nome,
        icone: h.def.icone,
        cor: h.def.cor,
        nivel: h.nivel,
        dano: Math.round(h.danoTotal),
      }))
      .sort((a, b) => b.dano - a.dano);
  }

  // ------------------------------------------------------------------ habilidades

  private atualizarHabilidade(h: HabAtiva, dt: number): void {
    const trava = this.j.bloqueios.get(h.idx);
    if (trava !== undefined) {
      if (trava > this.tempo) {
        if (this.rnd() < dt * 3)
          this.brilhos.emitir({
            x: this.x,
            y: 2,
            z: this.z,
            vy: 1,
            vida: 0.5,
            tamanho: 0.2,
            cor: '#39ff88',
          });
        return;
      }
      this.j.bloqueios.delete(h.idx);
    }
    const v = valoresHabilidade(h.def, h.nivel, this.atributos);
    h.timer -= dt;
    h.fase += dt;
    const c = h.def.comportamento;
    // comportamentos contínuos
    if (c === 'orbita') return this.orbita(h, v);
    if (c === 'aura') return this.auraHab(h, v, dt);
    if (c === 'laser') return this.laser(h, v, dt);
    if (c === 'drone') return this.drone(h, v, dt);
    if (h.timer > 0) return;
    h.timer = v.recarga;
    h.disparos++;
    switch (c) {
      case 'projetil':
        this.dispararProjetil(h, v);
        break;
      case 'cadeia':
        this.cadeia(h, v);
        break;
      case 'nova':
        this.nova(h, v);
        break;
      case 'chicote':
        this.chicote(h, v);
        break;
      case 'chuva':
        this.chuva(h, v);
        break;
      case 'zona':
        this.zona(h, v);
        break;
      case 'ricochete':
        this.ricochete(h, v);
        break;
      case 'bumerangue':
        this.bumerangue(h, v);
        break;
      case 'poca':
        this.poca(h, v);
        break;
      case 'muro':
        this.firewall(h, v);
        break;
      case 'coletor':
        this.coletorLixo(h, v);
        break;
      case 'breakpoint':
        this.breakpoint(h, v);
        break;
    }
  }

  private corHab(h: HabAtiva): THREE.Color {
    return new THREE.Color(h.def.cor);
  }

  private orbita(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const permanente = v.evo10;
    if (h.timer <= 0 && !permanente) {
      h.timer = v.recarga + v.duracao;
      h.ativaAte = this.tempo + v.duracao;
      this.som('energizar', { volume: 0.4, tom: 1.3 }, 0.3);
    }
    const ativa = permanente || this.tempo < h.ativaAte;
    if (!ativa) return;
    const sentido = Math.sign(h.def.base.velocidade) || 1;
    const aneis: { r: number; s: number; n: number }[] = [
      { r: v.area, s: sentido, n: v.quantidade },
    ];
    if (v.evo5 && h.def.id === 'centelhaOrbital')
      aneis.push({ r: v.area * 0.6, s: -sentido, n: Math.max(2, v.quantidade - 1) });
    const forma: FormaProjetil =
      h.def.id === 'serraCircular' ? 'serra' : h.def.id === 'escudoCristal' ? 'cristal' : 'estrela';
    const escala =
      h.def.id === 'serraCircular'
        ? 1.1 * (v.evo5 ? 1.5 : 1)
        : h.def.id === 'escudoCristal'
          ? 0.5
          : 0.55;
    const raioAcerto = escala * 0.65 + 0.2;
    const cor = this.corHab(h);
    for (const a of aneis) {
      for (let k = 0; k < a.n; k++) {
        const ang = h.fase * Math.abs(v.velocidade) * a.s + (k / a.n) * Math.PI * 2;
        const ox = this.x + Math.cos(ang) * a.r;
        const oz = this.z + Math.sin(ang) * a.r;
        const lote = forma === 'estrela' ? this.loteOrbita : this.lotesProj.get(forma)!;
        lote.por(
          ox,
          0.8,
          oz,
          escala,
          forma === 'serra' ? escala : escala,
          escala,
          0,
          h.fase * 9,
          0,
          cor
        );
        this.halos.por(ox, 0.8, oz, escala * 2.4, h.def.cor2, 1.1);
        if (this.rnd() < 0.3)
          this.brilhos.emitir({ x: ox, y: 0.8, z: oz, vida: 0.3, tamanho: 0.15, cor: h.def.cor });
        for (const i of this.vizinhos(ox, oz, raioAcerto, this.tmpLista)) {
          if (i.hits[h.idx] > this.tempo) continue;
          i.hits[h.idx] = this.tempo + 0.45;
          const dx = i.x - this.x;
          const dz = i.z - this.z;
          const d = Math.hypot(dx, dz) || 1;
          this.causarDano(
            i,
            v.dano,
            h.idx,
            h.def.elemento,
            dx / d,
            dz / d,
            h.def.id === 'escudoCristal' ? 9 : 3
          );
        }
        // escudo bloqueia tiros inimigos
        if (h.def.id === 'escudoCristal') {
          for (const p of this.projeteis) {
            if (!p.inimigo || p.vida <= 0) continue;
            if ((p.x - ox) ** 2 + (p.z - oz) ** 2 < 0.6) {
              if (v.evo5) {
                p.inimigo = false;
                p.vx *= -1.4;
                p.vz *= -1.4;
                p.hab = h.idx;
                p.dano = v.dano * 2;
              } else p.vida = 0;
              this.brilhos.explosao(ox, 0.8, oz, 6, { cor: '#d6f4ff', tamanho: 0.2, vida: 0.3 });
            }
          }
        }
      }
    }
  }

  /** Anel da aura de cada jogador (cada um tem o seu). */
  private auraDe(jg: Jogador): THREE.Mesh {
    let m = this.aurasJogador.get(jg);
    if (!m) {
      m = new THREE.Mesh(this.aura.geometry, this.matAura.clone());
      m.rotation.x = -Math.PI / 2;
      this.cena.add(m);
      this.aurasJogador.set(jg, m);
    }
    return m;
  }

  private auraHab(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>, dt: number): void {
    const aura = this.auraDe(this.j);
    const mat = aura.material as THREE.MeshBasicMaterial;
    aura.position.set(this.x, 0.06, this.z);
    aura.scale.setScalar(v.area);
    mat.opacity = 0.35 + Math.sin(this.tempo * 4) * 0.12;
    mat.color.set(h.def.cor);
    if (this.rnd() < dt * 20) {
      const a = this.rnd() * Math.PI * 2;
      const r = this.rnd() * v.area;
      this.brilhos.emitir({
        x: this.x + Math.cos(a) * r,
        y: 0.1,
        z: this.z + Math.sin(a) * r,
        vy: 1.2,
        vida: 0.8,
        tamanho: 0.18,
        cor: h.def.cor2,
      });
    }
    if (h.timer > 0) return;
    h.timer = v.recarga;
    let cura = 0;
    for (const i of this.vizinhos(this.x, this.z, v.area, this.tmpLista)) {
      this.causarDano(i, v.dano, h.idx, h.def.elemento, 0, 0, 0, { lento: v.evo5 });
      if (v.evo10) cura += 0.25;
    }
    if (cura > 0) this.vida = Math.min(this.atributos.vidaMaxima, this.vida + Math.min(3, cura));
  }

  private laser(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>, dt: number): void {
    const permanente = v.evo10;
    if (h.timer <= 0 && !permanente) {
      h.timer = v.recarga + v.duracao;
      h.ativaAte = this.tempo + v.duracao;
      this.som('refletir', { volume: 0.6, tom: 0.7 }, 0.3);
    }
    if (!permanente && this.tempo >= h.ativaAte) return;
    const largura = v.evo5 ? 0.9 : 0.55;
    const cores = v.evo5 ? ['#ff5cf0', '#5cc8ff', '#ffe45c', '#7dffb0'] : [h.def.cor];
    for (let k = 0; k < v.quantidade; k++) {
      const ang = h.fase * v.velocidade + (k / v.quantidade) * Math.PI * 2;
      const cx = Math.cos(ang);
      const cz = Math.sin(ang);
      const cor = cores[k % cores.length];
      // visual: cadeia de halos ao longo do feixe
      const passos = Math.ceil(v.area / 0.5);
      for (let p = 1; p <= passos; p++) {
        const d = (p / passos) * v.area;
        this.halos.por(this.x + cx * d, 0.9, this.z + cz * d, largura * 2.2, cor, 1.4);
      }
      this.halos.por(this.x + cx * v.area, 0.9, this.z + cz * v.area, largura * 4, '#ffffff', 1.6);
      if (this.rnd() < dt * 30)
        this.brilhos.emitir({
          x: this.x + cx * v.area,
          y: 0.9,
          z: this.z + cz * v.area,
          vy: 1,
          vida: 0.3,
          tamanho: 0.2,
          cor,
        });
      for (const i of this.vizinhos(
        this.x + (cx * v.area) / 2,
        this.z + (cz * v.area) / 2,
        v.area / 2 + 1,
        this.tmpLista
      )) {
        if (i.hits[h.idx] > this.tempo) continue;
        const rx = i.x - this.x;
        const rz = i.z - this.z;
        const proj = rx * cx + rz * cz;
        if (proj < 0 || proj > v.area) continue;
        const perp = Math.abs(rx * cz - rz * cx);
        if (perp > largura / 2 + i.raio) continue;
        i.hits[h.idx] = this.tempo + 0.2;
        this.causarDano(i, v.dano, h.idx, h.def.elemento);
      }
    }
  }

  private drone(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>, _dt: number): void {
    const estrelas = h.def.id === 'estrelasGemeas';
    const cor = this.corHab(h);
    for (let k = 0; k < v.quantidade; k++) {
      const ang = h.fase * (estrelas ? 2.2 : 0.9) + (k / v.quantidade) * Math.PI * 2;
      const r = estrelas ? 1.4 : 1.9;
      const ox = this.x + Math.cos(ang) * r;
      const oz = this.z + Math.sin(ang) * r;
      const oy = estrelas ? 1.5 : 2 + Math.sin(h.fase * 3 + k) * 0.2;
      (estrelas ? this.loteOrbita : this.lotesProj.get('disco')!).por(
        ox,
        oy,
        oz,
        estrelas ? 0.4 : 0.55,
        estrelas ? 0.4 : 0.55,
        estrelas ? 0.4 : 0.55,
        estrelas ? 0 : 0.2,
        h.fase * 4,
        0,
        cor
      );
      this.halos.por(ox, oy, oz, estrelas ? 1.6 : 1.2, h.def.cor2, 1.2);
      if (h.timer > 0) continue;
      const alvo = this.maisProximo(ox, oz, v.alcance);
      if (!alvo && !(estrelas && v.evo10)) continue;
      const tiros = estrelas ? (v.evo10 ? 6 : v.evo5 ? 2 : 1) : v.evo5 ? 3 : 1;
      for (let t = 0; t < tiros; t++) {
        let ax: number;
        let az: number;
        if (estrelas && v.evo10) {
          const a2 = (t / tiros) * Math.PI * 2 + h.fase;
          ax = Math.cos(a2);
          az = Math.sin(a2);
        } else {
          const dx = alvo!.x - ox;
          const dz = alvo!.z - oz;
          const d = Math.hypot(dx, dz) || 1;
          const desv = (t - (tiros - 1) / 2) * 0.12;
          ax = Math.cos(Math.atan2(dz, dx) + desv);
          az = Math.sin(Math.atan2(dz, dx) + desv);
          void d;
        }
        this.novoProjetil(h, v, ox, oy - 0.4, oz, ax, az, {
          forma: estrelas ? 'estrela' : 'orbe',
          escala: estrelas ? 0.42 : 0.32,
          perfura: v.evo10 ? 99 : v.perfura,
        });
      }
      this.som('ataqueCajado', { volume: 0.25, tom: estrelas ? 1.6 : 1.9 }, 0.08);
    }
    if (h.timer <= 0) h.timer = v.recarga;
  }

  private novoProjetil(
    h: HabAtiva,
    v: ReturnType<typeof valoresHabilidade>,
    x: number,
    y: number,
    z: number,
    dx: number,
    dz: number,
    o: Partial<Projetil> = {}
  ): Projetil {
    const p: Projetil = {
      hab: h.idx,
      inimigo: false,
      x,
      y,
      z,
      vx: dx * v.velocidade,
      vz: dz * v.velocidade,
      vida: (v.alcance / Math.max(1, v.velocidade)) * 1.5 + 0.3,
      dano: v.dano,
      raio: Math.max(0.3, v.area * 0.5),
      perfura: v.perfura,
      forma: 'orbe',
      cor: this.corHab(h),
      escala: v.area,
      giro: 0,
      rot: Math.atan2(dx, dz),
      elemento: h.def.elemento,
      teleguiado: false,
      explode: 0,
      atingidos: new Set(),
      ...o,
    };
    this.projeteis.push(p);
    return p;
  }

  private dispararProjetil(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const id = h.def.id;
    if (id === 'recursao') {
      for (let k = 0; k < v.quantidade; k++) {
        const alvo = this.maisProximo(this.x, this.z, v.alcance);
        const base = alvo
          ? Math.atan2(alvo.z - this.z, alvo.x - this.x)
          : Math.atan2(this.dirZ, this.dirX);
        const a = base + (k - (v.quantidade - 1) / 2) * 0.25;
        this.novoProjetil(h, v, this.x, 0.9, this.z, Math.cos(a), Math.sin(a), {
          forma: 'cristal',
          escala: 0.55,
          raio: 0.45,
          profundidade: 2 + (v.evo5 ? 1 : 0),
          perfura: 1,
        });
      }
      this.som('ataqueCajado', { volume: 0.3, tom: 2 }, 0.08);
      return;
    }
    if (id === 'lancaGelo') {
      const n = v.quantidade + (v.evo10 ? 2 : 0);
      const base = Math.atan2(this.dirZ, this.dirX);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * (v.evo10 ? 0.22 : 0.12);
        this.novoProjetil(h, v, this.x, 0.9, this.z, Math.cos(a), Math.sin(a), {
          forma: 'lanca',
          escala: 1,
          raio: 0.45,
          fragmenta: v.evo10,
        });
      }
      this.som('criarEscudo', { volume: 0.35, tom: 1.5 }, 0.1);
      return;
    }
    const alvo = this.maisProximo(this.x, this.z, v.alcance);
    if (!alvo && id !== 'misseis') {
      h.timer = 0.3;
      return;
    }
    const baseAng = alvo ? Math.atan2(alvo.z - this.z, alvo.x - this.x) : this.rnd() * Math.PI * 2;
    if (id === 'bolaFogo') {
      for (let k = 0; k < v.quantidade; k++) {
        const a = baseAng + (k - (v.quantidade - 1) / 2) * 0.2;
        this.novoProjetil(h, v, this.x, 1, this.z, Math.cos(a), Math.sin(a), {
          forma: 'orbe',
          escala: v.evo10 ? 1.3 : 0.7,
          raio: v.evo10 ? 0.9 : 0.5,
          explode: v.area,
          perfura: v.evo10 ? 99 : 1,
        });
      }
      this.som('ataqueCajado', { volume: 0.5, tom: 0.8 }, 0.1);
    } else if (id === 'misseis') {
      const n = v.quantidade * (v.evo10 ? 2 : 1);
      for (let k = 0; k < n; k++) {
        const a = v.evo10 ? (k / n) * Math.PI * 2 + h.fase : baseAng + (this.rnd() - 0.5) * 1.6;
        this.novoProjetil(h, v, this.x, 1.1, this.z, Math.cos(a), Math.sin(a), {
          forma: 'estrela',
          escala: 0.5,
          raio: 0.4,
          teleguiado: true,
          fragmenta: v.evo5,
          vida: 3,
        });
      }
      this.som('ataqueCajado', { volume: 0.35, tom: 1.4 }, 0.1);
    } else if (id === 'cuspeToxico') {
      const n = v.quantidade + (v.evo10 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const alvoK =
          k === 0
            ? alvo!
            : (this.maisProximo(
                alvo!.x + (this.rnd() - 0.5) * 6,
                alvo!.z + (this.rnd() - 0.5) * 6,
                6
              ) ?? alvo!);
        const p = this.novoProjetil(h, v, this.x, 1, this.z, 0, 0, {
          forma: 'gota',
          escala: 0.45,
          raio: 0.4,
        });
        const dist = Math.hypot(alvoK.x - this.x, alvoK.z - this.z);
        p.arco = {
          alvoX: alvoK.x,
          alvoZ: alvoK.z,
          t: 0,
          total: Math.max(0.35, dist / v.velocidade),
          ox: this.x,
          oz: this.z,
        };
        p.vida = p.arco.total + 0.05;
      }
      this.som('passoAgua', { volume: 0.6 }, 0.1);
    }
  }

  private cadeia(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const cadeias = v.evo5 ? 2 : 1;
    const usados = new Set<Inimigo>();
    let disparou = false;
    for (let c = 0; c < cadeias; c++) {
      let atual = this.maisProximo(this.x, this.z, v.alcance, usados);
      if (!atual) break;
      disparou = true;
      let px = this.x;
      let pz = this.z;
      let py = 1;
      for (let s = 0; s < v.quantidade && atual; s++) {
        usados.add(atual);
        this.raioVisual(px, py, pz, atual.x, 0.8, atual.z, h.def.cor);
        this.causarDano(atual, v.dano * (1 - s * 0.04), h.idx, 'raio');
        if (v.evo10) {
          for (const n of this.vizinhos(atual.x, atual.z, 1.6, this.tmpLista2))
            if (n !== atual) this.causarDano(n, v.dano * 0.4, h.idx, 'raio');
          this.brilhos.explosao(atual.x, 0.8, atual.z, 10, {
            cor: '#ffe45c',
            tamanho: 0.2,
            vida: 0.4,
            velocidade: 5,
          });
        }
        px = atual.x;
        pz = atual.z;
        py = 0.8;
        atual = this.maisProximo(px, pz, v.area, usados);
      }
    }
    if (disparou) this.som('energizar', { volume: 0.5, tom: 1.6 }, 0.08);
    else h.timer = 0.25;
  }

  private nova(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const id = h.def.id;
    let cone: Onda['cone'];
    if (id === 'pulsoSonico' && !v.evo10)
      cone = { ang: Math.atan2(this.dirZ, this.dirX), abertura: 1.25 };
    if (id === 'ondaProfunda' && !v.evo5)
      cone = { ang: Math.atan2(this.dirZ, this.dirX), abertura: 1.8 };
    const ondas = id === 'novaGlacial' && v.evo10 ? 3 : id === 'pulsoSonico' && v.evo5 ? 2 : 1;
    for (let k = 0; k < ondas; k++) {
      window.setTimeout(() => {
        if (this.estado === 'menu') return;
        this.criarOnda(h, v, cone);
      }, k * 350);
    }
    this.som(
      id === 'novaGlacial' ? 'criarEscudo' : 'chefeOnda',
      { volume: 0.5, tom: id === 'pulsoSonico' ? 1.6 : 1.1 },
      0.1
    );
  }

  private criarOnda(
    h: HabAtiva,
    v: ReturnType<typeof valoresHabilidade>,
    cone?: Onda['cone']
  ): void {
    const geo = cone
      ? new THREE.RingGeometry(0.88, 1, 48, 1, -cone.ang - cone.abertura / 2, cone.abertura)
      : new THREE.RingGeometry(0.88, 1, 64);
    const malha = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: h.def.cor,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    malha.rotation.x = -Math.PI / 2;
    malha.position.set(this.x, 0.15, this.z);
    this.cena.add(malha);
    const max = v.area * (h.def.id === 'ondaProfunda' && v.evo10 ? 1.5 : 1);
    this.ondas.push({
      hab: h.idx,
      x: this.x,
      z: this.z,
      raio: 0.5,
      vel: v.velocidade,
      max,
      dano: v.dano * (h.def.id === 'ondaProfunda' && v.evo10 ? 1.5 : 1),
      elemento: h.def.elemento,
      cone,
      congela: h.def.id === 'novaGlacial' && v.evo5,
      forca: h.def.id === 'pulsoSonico' ? 12 : h.def.id === 'ondaProfunda' ? 9 : 2,
      atingidos: new Set(),
      malha,
    });
  }

  private chicote(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const base = Math.atan2(this.dirZ, this.dirX);
    const direcoes = v.evo10
      ? [0, Math.PI / 2, Math.PI, -Math.PI / 2]
      : v.evo5
        ? [0, Math.PI]
        : [0];
    for (let q = 0; q < v.quantidade; q++) {
      window.setTimeout(() => {
        if (this.estado !== 'jogando' && this.estado !== 'nivel') return;
        for (const off of direcoes) {
          const a = base + off;
          const cx = Math.cos(a);
          const cz = Math.sin(a);
          const desloc = (q % 2 === 0 ? 1 : -1) * 0.5 * Math.min(1, q);
          const ox = this.x - cz * desloc;
          const oz = this.z + cx * desloc;
          this.cortarVisual(ox, oz, a, v.area, h.def.cor, h.def.cor2);
          for (const i of this.vizinhos(
            ox + (cx * v.area) / 2,
            oz + (cz * v.area) / 2,
            v.area / 2 + 1,
            this.tmpLista
          )) {
            const rx = i.x - ox;
            const rz = i.z - oz;
            const proj = rx * cx + rz * cz;
            const perp = Math.abs(rx * cz - rz * cx);
            if (proj < -0.3 || proj > v.area || perp > 1.1 + i.raio) continue;
            this.causarDano(i, v.dano, h.idx, 'luz', cx, cz, 3);
          }
        }
        this.som('ataqueEspada', { volume: 0.45, tom: 1.2 + q * 0.1 }, 0.05);
      }, q * 130);
    }
  }

  private chuva(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const id = h.def.id;
    const alvos: { x: number; z: number }[] = [];
    const proximos = this.vizinhos(this.x, this.z, v.alcance, this.tmpLista).slice();
    if (proximos.length === 0) {
      h.timer = 0.4;
      return;
    }
    if (id === 'espinhosTerra' && v.evo10) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        alvos.push({ x: this.x + Math.cos(a) * 3.5, z: this.z + Math.sin(a) * 3.5 });
      }
    }
    for (let k = 0; k < v.quantidade; k++) {
      const alvo = proximos[Math.floor(this.rnd() * proximos.length)];
      if (id === 'espinhosTerra' && v.evo5) {
        const a = Math.atan2(alvo.z - this.z, alvo.x - this.x);
        for (let s = 1; s <= 5; s++)
          alvos.push({ x: this.x + Math.cos(a) * s * 1.6, z: this.z + Math.sin(a) * s * 1.6 });
      } else
        alvos.push({ x: alvo.x + (this.rnd() - 0.5) * 0.6, z: alvo.z + (this.rnd() - 0.5) * 0.6 });
    }
    const escala =
      id === 'chuvaMeteoros' && v.evo10 ? 1.8 : id === 'relampagoCeleste' && v.evo5 ? 1.6 : 1;
    alvos.forEach((p, k) => {
      const raio = v.area * escala;
      window.setTimeout(
        () => {
          if (this.estado === 'menu') return;
          this.aviso(p.x, p.z, raio, v.duracao, h.def.cor, () =>
            this.impacto(h, v, p.x, p.z, raio)
          );
          if (id === 'chuvaMeteoros') this.meteoroVisual(p.x, p.z, v.duracao, escala, h.def.cor);
        },
        id === 'espinhosTerra' && v.evo5 ? (k % 5) * 70 : k * 60
      );
    });
  }

  private impacto(
    h: HabAtiva,
    v: ReturnType<typeof valoresHabilidade>,
    x: number,
    z: number,
    raio: number
  ): void {
    const id = h.def.id;
    for (const i of this.vizinhos(x, z, raio, this.tmpLista)) {
      const dx = i.x - x;
      const dz = i.z - z;
      const d = Math.hypot(dx, dz) || 1;
      this.causarDano(
        i,
        v.dano,
        h.idx,
        h.def.elemento,
        dx / d,
        dz / d,
        id === 'chuvaMeteoros' ? 6 : 1
      );
      if (id === 'relampagoCeleste' && v.evo5) i.atordoado = Math.max(i.atordoado, 0.8);
    }
    if (id === 'chuvaMeteoros') {
      this.brilhos.explosao(x, 0.4, z, 26, {
        cor: '#ff7a3d',
        tamanho: 0.4,
        vida: 0.7,
        velocidade: 7,
        gravidade: 4,
      });
      this.poeira.explosao(x, 0.3, z, 12, {
        cor: '#6b4a3a',
        tamanho: 0.6,
        crescer: 2,
        vida: 0.9,
        velocidade: 4,
      });
      this.ondaVisual(x, z, '#ffb347', raio * 1.2, 0.35);
      this.tremer(0.18);
      this.som('paredeQuebrada', { x, y: z, volume: 0.6 }, 0.08);
      if (v.evo5) this.criarZona(h, 'fogo', x, z, raio * 0.8, 2.5, v.dano * 0.2);
    } else if (id === 'espinhosTerra') {
      this.espinhosVisual(x, z, raio, h.def.cor);
      this.som('espinhoCortado', { x, y: z, volume: 0.4 }, 0.06);
    } else if (id === 'relampagoCeleste') {
      this.raioVisual(x, 14, z, x, 0, z, h.def.cor, 0.22);
      this.ondaVisual(x, z, '#ffffff', raio * 1.3, 0.25);
      this.brilhos.explosao(x, 0.3, z, 14, {
        cor: '#9fd8ff',
        tamanho: 0.25,
        vida: 0.4,
        velocidade: 6,
      });
      this.som('energizar', { x, y: z, volume: 0.6, tom: 0.8 }, 0.06);
      if (v.evo10 && this.rnd() < 0.6) {
        const prox = this.maisProximo(x, z, 6);
        if (prox) window.setTimeout(() => this.impacto(h, v, prox.x, prox.z, raio), 140);
      }
    }
  }

  private zona(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    if (h.def.id === 'tornado') {
      for (let k = 0; k < v.quantidade; k++) {
        const a = this.rnd() * Math.PI * 2;
        const z = this.criarZona(
          h,
          'tornado',
          this.x + Math.cos(a) * 1.5,
          this.z + Math.sin(a) * 1.5,
          v.area * (v.evo5 ? 1.35 : 1),
          v.duracao,
          v.dano
        );
        const vel = v.velocidade * (v.evo5 ? 1.4 : 1);
        z.vx = Math.cos(a) * vel;
        z.vz = Math.sin(a) * vel;
        if (v.evo10) z.seguir = (k / v.quantidade) * Math.PI * 2;
      }
      this.som('esquiva', { volume: 0.6, tom: 0.6 }, 0.1);
    } else {
      // buraco negro no maior grupo
      let melhor: { x: number; z: number } | null = null;
      let maior = 0;
      for (const [k, l] of this.grade) {
        if (l.length <= maior) continue;
        const i = l[0];
        if (Math.hypot(i.x - this.x, i.z - this.z) > v.alcance) continue;
        maior = l.length;
        melhor = { x: i.x, z: i.z };
        void k;
      }
      if (!melhor) {
        h.timer = 0.5;
        return;
      }
      const z = this.criarZona(
        h,
        'buraco',
        melhor.x,
        melhor.z,
        v.area * (v.evo5 ? 1.6 : 1),
        v.duracao,
        v.dano
      );
      if (v.evo10) z.explode = v.dano * 10;
      this.som('chefeOnda', { volume: 0.6, tom: 0.5 }, 0.2);
    }
  }

  private criarZona(
    h: HabAtiva,
    tipo: Zona['tipo'],
    x: number,
    z: number,
    raio: number,
    duracao: number,
    dano: number
  ): Zona {
    let malha: THREE.Object3D;
    if (tipo === 'tornado') {
      const g = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const anel = new THREE.Mesh(
          new THREE.TorusGeometry(0.4 + k * 0.28, 0.06, 4, 20),
          new THREE.MeshBasicMaterial({
            color: k % 2 ? h.def.cor : h.def.cor2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        anel.rotation.x = Math.PI / 2;
        anel.position.y = 0.3 + k * 0.7;
        g.add(anel);
      }
      g.scale.setScalar(raio / 1.6);
      malha = g;
    } else if (tipo === 'muro') {
      const g = new THREE.Group();
      const mat = new THREE.MeshBasicMaterial({
        color: h.def.cor,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const parede = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 48, 1, true), mat);
      parede.position.y = 0.7;
      const base = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.05, 48),
        new THREE.MeshBasicMaterial({
          color: h.def.cor2,
          transparent: true,
          opacity: 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      base.rotation.x = -Math.PI / 2;
      base.position.y = 0.05;
      g.add(parede, base);
      g.scale.set(raio, 1, raio);
      malha = g;
    } else if (tipo === 'buraco') {
      const g = new THREE.Group();
      const nucleo = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 16, 12),
        new THREE.MeshBasicMaterial({ color: '#05020c' })
      );
      nucleo.position.y = 1;
      const disco = new THREE.Mesh(
        new THREE.RingGeometry(0.7, 1.6, 48),
        new THREE.MeshBasicMaterial({
          color: h.def.cor,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      disco.rotation.x = -Math.PI / 2.2;
      disco.position.y = 1;
      g.add(nucleo, disco);
      g.scale.setScalar(raio / 2);
      malha = g;
    } else {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 32),
        new THREE.MeshBasicMaterial({
          color: tipo === 'fogo' ? '#ff7a3d' : h.def.cor,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.05;
      m.scale.setScalar(raio);
      malha = m;
    }
    malha.position.x = x;
    malha.position.z = z;
    this.cena.add(malha);
    const zona: Zona = {
      tipo,
      hab: h.idx,
      x,
      z,
      vx: 0,
      vz: 0,
      raio,
      vida: duracao,
      total: duracao,
      dano,
      tick: 0,
      elemento: tipo === 'fogo' ? 'fogo' : h.def.elemento,
      lento: h.def.id === 'nuvemToxica' && h.nivel >= 5,
      malha,
    };
    this.zonas.push(zona);
    return zona;
  }

  private ricochete(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const ativos = this.projeteis.filter(
      (p) => p.hab === h.idx && p.ricochete && p.vida > 0
    ).length;
    const n = v.evo10 ? Math.max(0, v.quantidade - ativos) : v.quantidade;
    for (let k = 0; k < n; k++) {
      const a = this.rnd() * Math.PI * 2;
      this.novoProjetil(h, v, this.x, 0.8, this.z, Math.cos(a), Math.sin(a), {
        forma: 'disco',
        escala: v.area * (v.evo5 ? 1.7 : 1) * 1.4,
        raio: v.area * (v.evo5 ? 1.7 : 1),
        ricochete: true,
        vida: v.evo10 ? 1e9 : v.duracao,
        perfura: 999,
        cdAcerto: 0.4,
      });
    }
    if (n > 0) this.som('ataqueColher', { volume: 0.4, tom: 1.4 }, 0.1);
  }

  private bumerangue(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const alvo = this.maisProximo(this.x, this.z, v.alcance + 4);
    const base = alvo
      ? Math.atan2(alvo.z - this.z, alvo.x - this.x)
      : Math.atan2(this.dirZ, this.dirX);
    const escala = v.area * (v.evo10 ? 2.2 : v.evo5 ? 1.3 : 1) * 1.6;
    for (let k = 0; k < v.quantidade; k++) {
      const a = base + (k - (v.quantidade - 1) / 2) * 0.35;
      this.novoProjetil(h, v, this.x, 0.9, this.z, Math.cos(a), Math.sin(a), {
        forma: 'lamina',
        escala,
        raio: escala * 0.45,
        perfura: 999,
        bumerangue: { voltando: false, dist: 0, max: v.alcance },
        vida: 6,
        cdAcerto: 0.35,
      });
    }
    this.som('esquiva', { volume: 0.5, tom: 1.5 }, 0.1);
  }

  private poca(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const proximos = this.vizinhos(this.x, this.z, v.alcance, this.tmpLista).slice();
    if (!proximos.length) {
      h.timer = 0.5;
      return;
    }
    for (let k = 0; k < v.quantidade; k++) {
      const a = proximos[Math.floor(this.rnd() * proximos.length)];
      this.criarZona(h, 'poca', a.x, a.z, v.area * (v.evo5 ? 1.4 : 1), v.duracao, v.dano);
    }
    this.som('passoAgua', { volume: 0.5, tom: 0.7 }, 0.1);
  }

  // ------------------------------------------------------------------ efeitos visuais

  private ondaVisual(x: number, z: number, cor: string, raio: number, duracao: number): void {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1, 48),
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.12, z);
    this.cena.add(m);
    this.efeitos.push({
      malha: m,
      vida: duracao,
      total: duracao,
      atualizar: (t) => {
        m.scale.setScalar(0.2 + t * raio);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
      },
    });
  }

  private raioVisual(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
    cor: string,
    duracao = 0.18
  ): void {
    const pts: THREE.Vector3[] = [];
    const n = 8;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const j = k === 0 || k === n ? 0 : 0.35;
      pts.push(
        new THREE.Vector3(
          x1 + (x2 - x1) * t + (this.rnd() - 0.5) * j,
          y1 + (y2 - y1) * t + (this.rnd() - 0.5) * j,
          z1 + (z2 - z1) * t + (this.rnd() - 0.5) * j
        )
      );
    }
    const g = new THREE.Group();
    const linha = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 1 })
    );
    const tubo = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.07, 4),
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    g.add(linha, tubo);
    this.cena.add(g);
    this.efeitos.push({
      malha: g,
      vida: duracao,
      total: duracao,
      atualizar: (t) => {
        (tubo.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - t);
        (linha.material as THREE.LineBasicMaterial).opacity = 1 - t;
      },
    });
    this.halos.por(x2, y2, z2, 2.2, cor, 1.5);
  }

  private cortarVisual(
    x: number,
    z: number,
    ang: number,
    comp: number,
    cor: string,
    cor2: string
  ): void {
    const geo = new THREE.RingGeometry(
      comp * 0.45,
      comp * 0.55,
      32,
      1,
      -Math.PI / 2.6,
      Math.PI / 1.3
    );
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -ang;
    m.position.set(x + Math.cos(ang) * comp * 0.3, 0.9, z + Math.sin(ang) * comp * 0.3);
    this.cena.add(m);
    this.efeitos.push({
      malha: m,
      vida: 0.22,
      total: 0.22,
      atualizar: (t) => {
        m.scale.setScalar(0.7 + t * 0.6);
        (m.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t);
      },
    });
    for (let k = 0; k < 8; k++) {
      const d = this.rnd() * comp;
      this.brilhos.emitir({
        x: x + Math.cos(ang) * d,
        y: 0.9,
        z: z + Math.sin(ang) * d,
        vida: 0.3,
        tamanho: 0.18,
        cor: cor2,
      });
    }
  }

  private meteoroVisual(x: number, z: number, duracao: number, escala: number, cor: string): void {
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.6 * escala, 0),
      new THREE.MeshBasicMaterial({ color: cor })
    );
    this.cena.add(m);
    const ox = x - 4;
    const oz = z - 6;
    this.efeitos.push({
      malha: m,
      vida: duracao,
      total: duracao,
      atualizar: (t) => {
        m.position.set(ox + (x - ox) * t, 16 * (1 - t), oz + (z - oz) * t);
        m.rotation.set(t * 8, t * 6, 0);
        this.halos.por(m.position.x, m.position.y, m.position.z, 3 * escala, '#ffb347', 1.4);
        if (this.rnd() < 0.8)
          this.brilhos.emitir({
            x: m.position.x,
            y: m.position.y,
            z: m.position.z,
            vida: 0.5,
            tamanho: 0.5 * escala,
            crescer: 0.3,
            cor: '#ff7a3d',
          });
      },
    });
  }

  private espinhosVisual(x: number, z: number, raio: number, cor: string): void {
    const g = new THREE.Group();
    const mat = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon() });
    for (let k = 0; k < 5; k++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22 * raio, 1.4 * raio, 5), mat);
      c.position.set((this.rnd() - 0.5) * raio, 0, (this.rnd() - 0.5) * raio);
      c.rotation.set((this.rnd() - 0.5) * 0.5, 0, (this.rnd() - 0.5) * 0.5);
      g.add(c);
    }
    g.position.set(x, 0, z);
    this.cena.add(g);
    this.efeitos.push({
      malha: g,
      vida: 0.6,
      total: 0.6,
      atualizar: (t) => {
        const s = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
        g.scale.set(1, Math.max(0.01, s), 1);
        g.position.y = 0.6 * raio * s - 0.2;
      },
    });
    this.poeira.explosao(x, 0.2, z, 8, {
      cor: '#c99a5b',
      tamanho: 0.4,
      vida: 0.6,
      velocidade: 3,
      gravidade: 6,
    });
  }

  /** Ransomware: trava uma habilidade de cada jogador perto por alguns segundos. */
  private criptografar(i: Inimigo): void {
    this.ondaVisual(i.x, i.z, '#39ff88', 9, 0.6);
    this.brilhos.explosao(i.x, 2, i.z, 60, {
      cor: '#39ff88',
      tamanho: 0.3,
      vida: 0.8,
      velocidade: 9,
    });
    this.som('runaErro', {}, 0);
    this.tremer(0.5);
    if (!this.autoridade) return;
    for (const jg of this.ativos()) {
      if ((jg.x - i.x) ** 2 + (jg.z - i.z) ** 2 > 9 * 9) continue;
      const livres = jg.habs.filter((h) => !((jg.bloqueios.get(h.idx) ?? 0) > this.tempo));
      if (!livres.length) continue;
      const h = livres[Math.floor(this.rnd() * livres.length)];
      jg.bloqueios.set(h.idx, this.tempo + 8);
      this.brilhos.explosao(jg.x, 1.4, jg.z, 30, { cor: '#39ff88', tamanho: 0.25, vida: 0.6 });
      if (jg.local)
        this.mostrarBanner(
          'ARQUIVO CRIPTOGRAFADO!',
          `${h.def.nome} travou por 8 segundos`,
          '#39ff88',
          2.5
        );
    }
  }

  // ------------------------------------------------------------------ habilidades de código

  private firewall(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const aneis = v.evo10 ? [v.area, v.area * 0.55] : [v.area];
    for (const r of aneis) {
      const z = this.criarZona(h, 'muro', this.x, this.z, r, v.duracao, v.dano);
      z.segue = v.evo5;
      z.tick = 0;
    }
    this.som('energizar', { volume: 0.5, tom: 0.8 }, 0.2);
  }

  private coletorLixo(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const limiar = v.evo10 ? 0.25 : 0.1 + h.nivel * 0.008;
    let apagados = 0;
    for (const i of this.vizinhos(this.x, this.z, v.area, this.tmpLista).slice()) {
      const dx = this.x - i.x;
      const dz = this.z - i.z;
      const d = Math.hypot(dx, dz) || 1;
      const chefe = i.def.comportamento === 'chefe';
      if (!chefe && i.vida / i.vidaMax <= limiar) {
        // "lixo": apagado da memória
        this.causarDano(i, i.vida + 1, h.idx, 'codigo');
        apagados++;
        continue;
      }
      this.causarDano(i, v.dano, h.idx, 'codigo', dx / d, dz / d, chefe ? 0 : 7);
    }
    if (v.evo5)
      for (const c of this.cristais)
        if (!c.atraido && (c.x - this.x) ** 2 + (c.z - this.z) ** 2 < v.area * v.area * 2.2) {
          c.atraido = true;
          c.alvo = this.j.indice;
        }
    // visual: varredura que entra em direção ao jogador
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      this.brilhos.emitir({
        x: this.x + Math.cos(a) * v.area,
        y: 0.4,
        z: this.z + Math.sin(a) * v.area,
        vx: -Math.cos(a) * v.area * 2.2,
        vz: -Math.sin(a) * v.area * 2.2,
        vida: 0.45,
        tamanho: 0.22,
        cor: k % 3 ? h.def.cor : h.def.cor2,
        arrasto: 0,
      });
    }
    this.ondaVisual(this.x, this.z, h.def.cor, v.area, 0.35);
    if (apagados > 0) {
      this.brilhos.explosao(this.x, 1.2, this.z, 10 + apagados * 3, {
        cor: '#c8ffd9',
        tamanho: 0.25,
        vida: 0.6,
        velocidade: 5,
        gravidade: -2,
      });
      this.som('faiscaObtida', { tom: 0.7, volume: 0.5 }, 0.1);
    }
    this.som('chefeOnda', { volume: 0.35, tom: 1.6 }, 0.2);
  }

  private breakpoint(h: HabAtiva, v: ReturnType<typeof valoresHabilidade>): void {
    const alvos = this.gruposMaiores(v.alcance, v.evo10 ? 3 : v.quantidade);
    if (!alvos.length) {
      h.timer = 0.5;
      return;
    }
    const dono = this.j;
    for (const a of alvos) {
      this.aviso(a.x, a.z, v.area, 0.6, h.def.cor, () => {
        const antes = this.j;
        this.j = dono;
        for (const i of this.vizinhos(a.x, a.z, v.area, this.tmpLista).slice()) {
          this.causarDano(i, v.dano * (v.evo5 ? 1.4 : 1), h.idx, 'codigo');
          if (i.vivo && i.def.comportamento !== 'chefe') {
            i.congelado = Math.max(i.congelado, v.duracao);
            i.atordoado = Math.max(i.atordoado, v.duracao);
          }
        }
        this.ondaVisual(a.x, a.z, h.def.cor2, v.area * 1.2, 0.5);
        this.brilhos.explosao(a.x, 1, a.z, 30, {
          cor: h.def.cor2,
          tamanho: 0.25,
          vida: 0.6,
          velocidade: 4,
        });
        this.som('criarEscudo', { x: a.x, y: a.z, volume: 0.5, tom: 1.4 }, 0.1);
        this.j = antes;
      });
    }
    this.som('inimigoTelegrafo', { volume: 0.35, tom: 1.8 }, 0.2);
  }

  /** Centros dos maiores grupos de inimigos ao alcance. */
  private gruposMaiores(alcance: number, n: number): { x: number; z: number }[] {
    const lista: { x: number; z: number; q: number }[] = [];
    for (const l of this.grade.values()) {
      const i = l[0];
      if (!i || (i.x - this.x) ** 2 + (i.z - this.z) ** 2 > alcance * alcance) continue;
      lista.push({ x: i.x, z: i.z, q: l.length });
    }
    lista.sort((a, b) => b.q - a.q);
    const r: { x: number; z: number }[] = [];
    for (const g of lista) {
      if (r.some((o) => (o.x - g.x) ** 2 + (o.z - g.z) ** 2 < 25)) continue;
      r.push(g);
      if (r.length >= n) break;
    }
    return r;
  }

  private contarTipo(id: IdInimigo): number {
    let n = 0;
    for (const i of this.inimigos) if (i.vivo && i.def.id === id) n++;
    return n;
  }

  /** Cavalo de Troia: o "presente" abre e solta vírus. */
  private abrirTrojan(i: Inimigo): void {
    i.vivo = false;
    i.ataque = undefined;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      this.criarInimigo(INIMIGOS.virus, i.x + Math.cos(a) * 1.3, i.z + Math.sin(a) * 1.3);
    }
    this.brilhos.explosao(i.x, 0.8, i.z, 50, {
      cor: '#ffd27a',
      tamanho: 0.3,
      vida: 0.8,
      velocidade: 7,
      gravidade: 4,
    });
    this.brilhos.explosao(i.x, 0.8, i.z, 30, {
      cor: '#39ff88',
      tamanho: 0.25,
      vida: 0.7,
      velocidade: 5,
    });
    this.ondaVisual(i.x, i.z, '#39ff88', 4, 0.5);
    this.audio.tocar('bauAbrir');
    this.som('inimigoAlerta', {}, 0.5);
    this.mostrarBanner('ERA UM CAVALO DE TROIA!', 'Vírus à solta', '#39ff88', 2);
  }

  /** Ponteiro Nulo: some e reaparece na marca, ferindo quem estiver nela. */
  private saltoPonteiro(i: Inimigo): void {
    const a = i.ataque!;
    i.ataque = undefined;
    this.brilhos.explosao(i.x, 0.8, i.z, 14, { cor: '#ff5c5c', tamanho: 0.25, vida: 0.4 });
    if (this.autoridade) {
      i.x = a.ax;
      i.z = a.az;
    }
    this.brilhos.explosao(a.ax, 0.8, a.az, 26, {
      cor: '#ff5c5c',
      tamanho: 0.3,
      vida: 0.5,
      velocidade: 6,
    });
    this.ondaVisual(a.ax, a.az, '#ff5c5c', 1.9, 0.35);
    this.som('runaErro', { x: a.ax, y: a.az, volume: 0.5 }, 0.1);
    const antes = this.j;
    for (const jg of this.jogadores) {
      if ((jg.x - a.ax) ** 2 + (jg.z - a.az) ** 2 > 1.7 * 1.7) continue;
      this.j = jg;
      this.danoJogador(i.dano, a.ax, a.az);
    }
    this.j = antes;
  }

  private criarPocaInimiga(x: number, z: number, raio: number): void {
    if (this.pocasInimigas.length > 30) {
      const velha = this.pocasInimigas.shift()!;
      this.cena.remove(velha.malha);
    }
    const malha = new THREE.Mesh(this.geoPoca, this.matPoca.clone());
    malha.rotation.x = -Math.PI / 2;
    malha.position.set(x, 0.04, z);
    malha.scale.setScalar(raio);
    this.cena.add(malha);
    this.pocasInimigas.push({ x, z, raio, vida: 7, malha });
  }

  private atualizarPocasInimigas(dt: number): void {
    for (const p of this.pocasInimigas) {
      p.vida -= dt;
      const m = p.malha.material as THREE.MeshBasicMaterial;
      m.opacity = Math.min(0.55, p.vida * 0.3) * (0.85 + Math.sin(this.tempo * 3 + p.x) * 0.15);
      if (p.vida <= 0) this.cena.remove(p.malha);
      else if (this.rnd() < dt * 2)
        this.poeira.emitir({
          x: p.x + (this.rnd() - 0.5) * p.raio,
          y: 0.1,
          z: p.z + (this.rnd() - 0.5) * p.raio,
          vy: 0.8,
          vida: 0.7,
          tamanho: 0.16,
          cor: '#a58bff',
        });
    }
    this.pocasInimigas = this.pocasInimigas.filter((p) => p.vida > 0);
  }

  /** O jogador local está pisando numa poça de memória vazada? */
  private naPoca(x: number, z: number): boolean {
    return this.pocasInimigas.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < p.raio * p.raio);
  }

  private aviso(
    x: number,
    z: number,
    raio: number,
    duracao: number,
    cor: string,
    aoFim: () => void
  ): void {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0, 1, 32),
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -5,
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.07, z);
    m.scale.setScalar(raio);
    this.cena.add(m);
    this.avisos.push({ x, z, raio, t: 0, total: duracao, cor, aoFim, malha: m });
  }

  // ------------------------------------------------------------------ atualizações

  private atualizarInimigos(dt: number): void {
    const contato = new Map<Jogador, { dano: number; x: number; z: number }>();
    for (const i of this.inimigos) {
      if (!i.vivo) continue;
      this.j = this.maisProximoJogador(i.x, i.z) ?? this.local;
      i.fase += dt;
      i.flash = Math.max(0, i.flash - dt);
      i.lento = Math.max(0, i.lento - dt);
      i.congelado = Math.max(0, i.congelado - dt);
      i.atordoado = Math.max(0, i.atordoado - dt);
      // dano contínuo
      if (i.queimar > 0) {
        i.queimar -= dt;
        i.vida -= i.queimarDps * dt;
        if (this.rnd() < dt * 8)
          this.brilhos.emitir({
            x: i.x + (this.rnd() - 0.5) * i.raio,
            y: 0.6,
            z: i.z + (this.rnd() - 0.5) * i.raio,
            vy: 2,
            vida: 0.4,
            tamanho: 0.22,
            cor: '#ff7a3d',
          });
      }
      if (i.veneno > 0) {
        i.veneno -= dt;
        i.vida -= i.venenoDps * dt;
        if (this.rnd() < dt * 5)
          this.poeira.emitir({
            x: i.x,
            y: 0.8,
            z: i.z,
            vy: 1,
            vida: 0.6,
            tamanho: 0.18,
            cor: '#9dff5c',
          });
      } else i.venenoDps = 0;
      if (i.vida <= 0) {
        this.matar(i);
        continue;
      }
      if (i.congelado > 0 && this.rnd() < dt * 3)
        this.brilhos.emitir({
          x: i.x,
          y: 0.9,
          z: i.z,
          vy: 0.5,
          vida: 0.5,
          tamanho: 0.2,
          cor: '#bdf2ff',
        });
      // vertical (lançado pela terra)
      if (i.vy !== 0 || i.y > 0) {
        i.vy -= 25 * dt;
        i.y += i.vy * dt;
        if (i.y <= 0) {
          i.y = 0;
          i.vy = 0;
        }
      }
      const dx = this.x - i.x;
      const dz = this.z - i.z;
      const d = Math.hypot(dx, dz) || 1;
      const parado = i.congelado > 0 || i.atordoado > 0;
      let fator = i.lento > 0 ? 0.5 : 1;
      if (parado) fator = 0;
      let dirX = dx / d;
      let dirZ = dz / d;
      const c = i.def.comportamento;
      if (c === 'atirador') {
        if (d < 8) {
          dirX = -dirX;
          dirZ = -dirZ;
        } else if (d < 11) fator *= 0.15;
        i.recarga -= dt;
        if (i.recarga <= 0 && d < 15 && !parado) {
          i.recarga = 2.6;
          this.projeteis.push({
            hab: -1,
            inimigo: true,
            x: i.x,
            y: 1,
            z: i.z,
            vx: (dx / d) * 7,
            vz: (dz / d) * 7,
            vida: 3,
            dano: i.dano,
            raio: 0.35,
            perfura: 1,
            forma: 'orbe',
            cor: new THREE.Color('#ff5cc8'),
            escala: 0.5,
            giro: 0,
            rot: 0,
            elemento: 'arcano',
            teleguiado: false,
            explode: 0,
            atingidos: new Set(),
          });
          this.som('projetilEco', { x: i.x, y: i.z, volume: 0.35 }, 0.15);
        }
      } else if (c === 'teleporte') {
        i.recarga -= dt;
        if (i.recarga <= 0 && d > 7 && !parado) {
          i.recarga = 4 + this.rnd() * 2;
          this.brilhos.explosao(i.x, 0.6, i.z, 12, { cor: '#5cffd0', tamanho: 0.25, vida: 0.4 });
          const a = this.rnd() * Math.PI * 2;
          i.x = this.x + Math.cos(a) * 5;
          i.z = this.z + Math.sin(a) * 5;
          this.brilhos.explosao(i.x, 0.6, i.z, 12, { cor: '#5cffd0', tamanho: 0.25, vida: 0.4 });
          this.som('runaErro', { x: i.x, y: i.z, volume: 0.3 }, 0.2);
        }
      } else if (c === 'chefe') this.ataqueChefe(i, dt, d, dx, dz);
      else if (c === 'replicar') {
        i.recarga -= dt;
        if (i.recarga <= 0) {
          i.recarga = 6 + this.rnd() * 3;
          if (this.autoridade && (i.geracao ?? 0) < 2 && this.contarTipo('virus') < 90) {
            i.geracao = (i.geracao ?? 0) + 1;
            const a = this.rnd() * Math.PI * 2;
            const copia = this.criarInimigo(i.def, i.x + Math.cos(a), i.z + Math.sin(a), i.elite);
            if (copia) {
              copia.geracao = i.geracao;
              copia.vida = i.vida;
              copia.recarga = 6 + this.rnd() * 3;
            }
            this.brilhos.explosao(i.x, 0.6, i.z, 12, {
              cor: '#39ff88',
              tamanho: 0.2,
              vida: 0.45,
              velocidade: 3,
            });
            this.som('runaErro', { x: i.x, y: i.z, volume: 0.25, tom: 1.6 }, 0.3);
          }
        }
      } else if (c === 'serpente') {
        const ang = Math.sin(i.fase * 4) * 0.9;
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        const nx = dirX * cs - dirZ * sn;
        dirZ = dirX * sn + dirZ * cs;
        dirX = nx;
        // guarda o caminho para o corpo segmentado seguir a cabeça
        const r = (i.rastro ??= []);
        const ux = r.length ? r[0] : i.x;
        const uz = r.length ? r[1] : i.z;
        if ((i.x - ux) ** 2 + (i.z - uz) ** 2 > 0.09) {
          r.unshift(i.x, i.z);
          if (r.length > 24) r.length = 24;
        }
      } else if (c === 'disfarce') {
        fator = 0;
        if (!i.ataque && d < 4.5 && i.y < 0.5) {
          i.ataque = { tipo: 'abrir', t: 0, ax: 0, az: 0 };
          this.audio.tocar('inimigoTelegrafo', { x: i.x, y: i.z, tom: 1.4 });
        }
        if (i.ataque?.tipo === 'abrir') {
          i.ataque.t += dt;
          if (i.ataque.t >= 0.7) {
            this.abrirTrojan(i);
            continue;
          }
        }
      } else if (c === 'orbitar') {
        const rr = Math.max(2.4, 7.5 - i.fase * 0.12);
        const a = Math.atan2(i.z - this.z, i.x - this.x) + 0.9;
        const tx = this.x + Math.cos(a) * rr - i.x;
        const tz = this.z + Math.sin(a) * rr - i.z;
        const td = Math.hypot(tx, tz) || 1;
        dirX = tx / td;
        dirZ = tz / td;
      } else if (c === 'vazar') {
        i.recarga -= dt;
        if (i.recarga <= 0) {
          i.recarga = 1.5;
          this.criarPocaInimiga(i.x, i.z, i.raio * 1.6);
        }
        i.raio = Math.min(i.def.raio * (i.elite ? 1.5 : 1) * 1.8, i.raio + dt * 0.006);
      } else if (c === 'mirar') {
        if (i.ataque?.tipo === 'mirar') {
          fator = 0;
          i.ataque.t += dt;
          if (i.ataque.t >= 1.1) {
            this.saltoPonteiro(i);
            continue;
          }
        } else {
          i.recarga -= dt;
          if (i.recarga <= 0 && d < 13 && !parado && this.autoridade) {
            i.recarga = 5 + this.rnd() * 2;
            i.ataque = { tipo: 'mirar', t: 0, ax: this.x, az: this.z };
            this.aviso(this.x, this.z, 1.7, 1.1, '#ff3b3b', () => {});
            this.som('inimigoTelegrafo', { x: i.x, y: i.z, tom: 1.2 });
            if (this.rnd() < 0.3) this.vozes.resmungar(i.def.voz, i.x, i.z);
          }
        }
      } else if (c === 'voador') {
        dirX += Math.sin(i.fase * 3) * 0.3;
        dirZ += Math.cos(i.fase * 3) * 0.3;
      }
      // empurrões decaem, movimento de perseguição
      i.vx *= Math.exp(-6 * dt);
      i.vz *= Math.exp(-6 * dt);
      const vel = i.vel * fator * (i.ataque?.tipo === 'investida' && i.ataque.t > 0.8 ? 3.5 : 1);
      i.x += (dirX * vel + i.vx) * dt;
      i.z += (dirZ * vel + i.vz) * dt;
      if (!parado) i.ang = aproximarAngulo(i.ang, Math.atan2(dirX, dirZ), 8, dt);
      // separação simples
      const vizinhos = this.vizinhos(i.x, i.z, i.raio * 1.6, this.tmpLista2);
      let sepN = 0;
      for (const o of vizinhos) {
        if (o === i || sepN > 6) continue;
        const sx = i.x - o.x;
        const sz = i.z - o.z;
        const sd = Math.hypot(sx, sz);
        const min = i.raio + o.raio;
        if (sd < min && sd > 1e-4) {
          const empurro = ((min - sd) / sd) * 0.5;
          i.x += sx * empurro;
          i.z += sz * empurro;
          sepN++;
        }
      }
      if (i.def.comportamento !== 'voador') this.colidirObstaculos(i, i.raio);
      const dc = Math.hypot(i.x, i.z);
      if (dc > RAIO_ARENA + 2) {
        i.x *= (RAIO_ARENA + 2) / dc;
        i.z *= (RAIO_ARENA + 2) / dc;
      }
      // contato
      if (d < i.raio + 0.45 && i.y < 1 && !parado) {
        const c = contato.get(this.j);
        if (!c || i.dano > c.dano) contato.set(this.j, { dano: i.dano, x: i.x, z: i.z });
      }
      // longe demais: reaparece perto (mantém a pressão)
      if (d > 45 && c !== 'chefe' && c !== 'disfarce' && this.autoridade) {
        const p = this.pontoBorda(22);
        i.x = p.x;
        i.z = p.z;
      }
    }
    for (const [jg, c] of contato) {
      this.j = jg;
      this.danoJogador(c.dano, c.x, c.z);
    }
    this.j = this.local;
    this.inimigos = this.inimigos.filter((i) => i.vivo);
  }

  private ataqueChefe(i: Inimigo, dt: number, d: number, dx: number, dz: number): void {
    if (i.ataque) {
      i.ataque.t += dt;
      const a = i.ataque;
      if (a.tipo === 'onda' && a.t >= 1) {
        // anel que se expande: escape com a esquiva
        const malha = new THREE.Mesh(
          new THREE.TorusGeometry(1, 0.18, 6, 64),
          new THREE.MeshBasicMaterial({ color: '#ff5cf0', transparent: true, opacity: 0.9 })
        );
        malha.rotation.x = Math.PI / 2;
        malha.position.set(i.x, 0.4, i.z);
        this.cena.add(malha);
        this.ondas.push({
          hab: -2,
          x: i.x,
          z: i.z,
          raio: 1,
          vel: 7,
          max: 16,
          dano: i.dano,
          elemento: 'som',
          congela: false,
          forca: 0,
          atingidos: new Set(),
          malha,
        });
        this.tremer(0.4);
        this.som('chefeOnda', {}, 0);
        i.ataque = undefined;
      } else if (a.tipo === 'investida' && a.t >= 1.6) i.ataque = undefined;
      else if (a.tipo === 'criptografar' && a.t >= 1.2) {
        this.criptografar(i);
        i.ataque = undefined;
      } else if (a.tipo === 'invocar' && a.t >= 0.8) {
        const ransom = i.def.id === 'ransomware';
        for (let k = 0; k < (ransom ? 8 : 10); k++) {
          const ang = (k / 10) * Math.PI * 2;
          this.criarInimigo(
            ransom ? INIMIGOS.virus : INIMIGOS.spam,
            i.x + Math.cos(ang) * 3,
            i.z + Math.sin(ang) * 3
          );
        }
        this.brilhos.explosao(i.x, 2, i.z, 40, {
          cor: '#ff6b8a',
          tamanho: 0.3,
          vida: 0.7,
          velocidade: 7,
        });
        i.ataque = undefined;
      }
      return;
    }
    i.recarga -= dt;
    if (i.recarga <= 0) {
      i.recarga = 3.6;
      const r = this.rnd();
      const tipo: TipoAtaque =
        i.def.id === 'ransomware'
          ? r < 0.35
            ? 'criptografar'
            : r < 0.65
              ? 'investida'
              : r < 0.85
                ? 'invocar'
                : 'onda'
          : r < 0.4
            ? 'onda'
            : r < 0.75
              ? 'investida'
              : 'invocar';
      i.ataque = { tipo, t: 0, ax: dx / (d || 1), az: dz / (d || 1) };
      if (tipo === 'criptografar') {
        this.mostrarBanner('CRIPTOGRAFANDO…', 'Fique longe do cadeado!', '#39ff88', 1.2);
        this.aviso(i.x, i.z, 9, 1.2, '#39ff88', () => {});
      }
      if (tipo === 'onda') this.aviso(i.x, i.z, 3.5, 1, '#ff3b3b', () => {});
      if (tipo === 'investida') {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(2.4, Math.min(d + 4, 18)),
          new THREE.MeshBasicMaterial({
            color: '#ff3b3b',
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          })
        );
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = -Math.atan2(dx, dz) + Math.PI;
        const comp = Math.min(d + 4, 18);
        m.position.set(i.x + (dx / d) * comp * 0.5, 0.08, i.z + (dz / d) * comp * 0.5);
        this.cena.add(m);
        this.efeitos.push({
          malha: m,
          vida: 0.8,
          total: 0.8,
          atualizar: (t) => ((m.material as THREE.MeshBasicMaterial).opacity = 0.2 + t * 0.4),
        });
      }
      this.audio.tocar('inimigoTelegrafo', { x: i.x, y: i.z, tom: 0.5 });
      if (this.rnd() < 0.4)
        this.vozes.falar(
          ['Barulho!', 'Ninguém escuta!', 'Mais alto!'][Math.floor(this.rnd() * 3)],
          { tom: 0.3, ritmo: 0.9, bipe: 'chefe' },
          false,
          0.8
        );
    }
  }

  private atualizarProjeteis(dt: number): void {
    for (const p of this.projeteis) {
      if (p.vida <= 0) continue;
      p.vida -= dt;
      p.giro += dt;
      this.j = this.donoHab(p.hab) ?? this.local;
      if (p.inimigo) {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        this.lotesProj
          .get('orbe')!
          .por(p.x, p.y, p.z, p.escala, p.escala, p.escala, 0, 0, 0, p.cor);
        this.halos.por(p.x, p.y, p.z, 1.6, '#ff5cc8', 1.2);
        for (const jg of this.jogadores) {
          if (jg.caido || (p.x - jg.x) ** 2 + (p.z - jg.z) ** 2 >= (p.raio + 0.4) ** 2) continue;
          this.j = jg;
          this.danoJogador(p.dano, p.x, p.z);
          p.vida = 0;
          break;
        }
        continue;
      }
      // trajetória
      if (p.arco) {
        const a = p.arco;
        a.t += dt;
        const t = Math.min(1, a.t / a.total);
        p.x = a.ox + (a.alvoX - a.ox) * t;
        p.z = a.oz + (a.alvoZ - a.oz) * t;
        p.y = 1 + Math.sin(t * Math.PI) * 3;
        if (t >= 1) {
          const h = this.habDe(p.hab);
          if (h) {
            const v = valoresHabilidade(h.def, h.nivel, this.atributos);
            this.criarZona(h, 'poca', p.x, p.z, v.area, 2.5, v.dano * (v.evo5 ? 0.5 : 0.25));
            for (const i of this.vizinhos(p.x, p.z, v.area * 0.7, this.tmpLista))
              this.causarDano(i, p.dano, p.hab, 'veneno');
          }
          this.poeira.explosao(p.x, 0.2, p.z, 8, {
            cor: '#9dff5c',
            tamanho: 0.25,
            vida: 0.5,
            velocidade: 3,
          });
          p.vida = 0;
        }
      } else if (p.bumerangue) {
        const b = p.bumerangue;
        const vel = Math.hypot(p.vx, p.vz);
        if (!b.voltando) {
          b.dist += vel * dt;
          if (b.dist >= b.max) {
            b.voltando = true;
            p.atingidos.clear();
          }
        } else {
          const dx = this.x - p.x;
          const dz = this.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          p.vx = (dx / d) * vel;
          p.vz = (dz / d) * vel;
          if (d < 0.8) p.vida = 0;
        }
        p.x += p.vx * dt;
        p.z += p.vz * dt;
      } else if (p.ricochete) {
        p.x += p.vx * dt;
        p.z += p.vz * dt;
        if (Math.abs(p.x - this.x) > 13) {
          p.vx = -Math.sign(p.x - this.x) * Math.abs(p.vx);
          p.x = this.x + Math.sign(p.x - this.x) * 13;
        }
        if (Math.abs(p.z - this.z) > 9) {
          p.vz = -Math.sign(p.z - this.z) * Math.abs(p.vz);
          p.z = this.z + Math.sign(p.z - this.z) * 9;
        }
      } else {
        if (p.teleguiado) {
          const alvo = this.maisProximo(p.x, p.z, 10, p.atingidos);
          if (alvo) {
            const v = Math.hypot(p.vx, p.vz);
            const dx = alvo.x - p.x;
            const dz = alvo.z - p.z;
            const d = Math.hypot(dx, dz) || 1;
            p.vx += ((dx / d) * v - p.vx) * Math.min(1, dt * 6);
            p.vz += ((dz / d) * v - p.vz) * Math.min(1, dt * 6);
          }
        }
        p.x += p.vx * dt;
        p.z += p.vz * dt;
      }
      p.rot = Math.atan2(p.vx, p.vz);
      // desenho
      const lote = this.lotesProj.get(p.forma)!;
      const s = p.escala;
      if (p.forma === 'lanca') lote.por(p.x, p.y, p.z, s, s, s, 0, p.rot, 0, p.cor);
      else if (p.forma === 'lamina' || p.forma === 'disco' || p.forma === 'serra')
        lote.por(p.x, p.y, p.z, s, s, s, 0, p.giro * 14, 0, p.cor);
      else lote.por(p.x, p.y, p.z, s, s, s, p.giro * 5, p.giro * 7, 0, p.cor);
      const h = this.habDe(p.hab);
      this.halos.por(p.x, p.y, p.z, s * 2.6, h?.def.cor2 ?? '#ffffff', 1.2);
      if (this.rnd() < 0.5)
        this.brilhos.emitir({
          x: p.x,
          y: p.y,
          z: p.z,
          vida: 0.3,
          tamanho: s * 0.35,
          cor: h?.def.cor ?? '#ffffff',
        });
      if (p.arco) continue;
      // colisão
      for (const i of this.vizinhos(p.x, p.z, p.raio, this.tmpLista)) {
        if (p.vida <= 0) break;
        if (p.cdAcerto) {
          if (i.hits[p.hab] > this.tempo) continue;
          i.hits[p.hab] = this.tempo + p.cdAcerto;
        } else if (p.atingidos.has(i)) continue;
        p.atingidos.add(i);
        const vel = Math.hypot(p.vx, p.vz) || 1;
        const hDef = h?.def;
        const congela = hDef?.id === 'lancaGelo' && (h?.nivel ?? 0) >= 5;
        this.causarDano(
          i,
          p.dano,
          p.hab,
          p.elemento,
          p.vx / vel,
          p.vz / vel,
          p.forma === 'lamina' && (h?.nivel ?? 0) >= 10 ? 8 : 2,
          { congela }
        );
        if (p.explode > 0) this.explodir(p, h);
        if ((p.profundidade ?? 0) > 0) {
          const ramos = (h?.nivel ?? 0) >= 10 ? 3 : 2;
          for (let k = 0; k < ramos; k++) {
            const a = p.rot + (k - (ramos - 1) / 2) * 0.9;
            this.projeteis.push({
              ...p,
              vx: Math.sin(a) * vel,
              vz: Math.cos(a) * vel,
              escala: p.escala * 0.8,
              dano: p.dano * 0.75,
              profundidade: (p.profundidade ?? 1) - 1,
              perfura: 1,
              vida: 0.9,
              atingidos: new Set([i]),
            });
          }
          this.brilhos.explosao(p.x, p.y, p.z, 8, {
            cor: '#39ff88',
            tamanho: 0.18,
            vida: 0.35,
            velocidade: 4,
          });
        }
        if (p.fragmenta && hDef?.id === 'misseis') {
          for (let k = 0; k < 2; k++) {
            const a = p.rot + (k ? 0.8 : -0.8);
            this.projeteis.push({
              ...p,
              x: p.x,
              z: p.z,
              vx: Math.sin(a) * vel,
              vz: Math.cos(a) * vel,
              escala: p.escala * 0.6,
              dano: p.dano * 0.5,
              fragmenta: false,
              vida: 1,
              atingidos: new Set([i]),
            });
          }
        }
        p.perfura--;
        if (p.perfura <= 0) p.vida = 0;
      }
      if (p.vida <= 0 && p.fragmenta && h?.def.id === 'lancaGelo') {
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2;
          this.projeteis.push({
            ...p,
            vx: Math.cos(a) * 12,
            vz: Math.sin(a) * 12,
            escala: 0.5,
            dano: p.dano * 0.4,
            fragmenta: false,
            perfura: 1,
            vida: 0.4,
            atingidos: new Set(),
          });
        }
      }
      if (p.vida <= 0 && p.explode > 0 && !p.atingidos.size) this.explodir(p, h);
    }
    this.projeteis = this.projeteis.filter((p) => p.vida > 0);
  }

  private explodir(p: Projetil, h: HabAtiva | undefined): void {
    const r = p.explode;
    for (const i of this.vizinhos(p.x, p.z, r, this.tmpLista2))
      this.causarDano(i, p.dano * 0.6, p.hab, 'fogo');
    this.brilhos.explosao(p.x, p.y, p.z, 22, {
      cor: '#ff7a3d',
      tamanho: 0.35,
      vida: 0.5,
      velocidade: 6,
    });
    this.ondaVisual(p.x, p.z, '#ffb347', r, 0.3);
    this.som('ataqueMartelo', { x: p.x, y: p.z, volume: 0.35, tom: 0.7 }, 0.08);
    if (h && h.nivel >= 5) this.criarZona(h, 'fogo', p.x, p.z, r * 0.8, 2, p.dano * 0.15);
  }

  private atualizarZonas(dt: number): void {
    for (const z of this.zonas) {
      this.j = this.donoHab(z.hab) ?? this.local;
      z.vida -= dt;
      z.tick -= dt;
      const t = 1 - z.vida / z.total;
      if (z.tipo === 'tornado') {
        if (z.seguir !== undefined) {
          z.seguir += dt * 1.6;
          const alvoX = this.x + Math.cos(z.seguir) * 4;
          const alvoZ = this.z + Math.sin(z.seguir) * 4;
          z.x += (alvoX - z.x) * Math.min(1, dt * 4);
          z.z += (alvoZ - z.z) * Math.min(1, dt * 4);
        } else {
          z.vx += (this.rnd() - 0.5) * 6 * dt;
          z.vz += (this.rnd() - 0.5) * 6 * dt;
          z.x += z.vx * dt;
          z.z += z.vz * dt;
        }
        z.malha.position.set(z.x, 0, z.z);
        z.malha.rotation.y += dt * 9;
        z.malha.children.forEach((c, k) => (c.position.x = Math.sin(t * 20 + k) * 0.15));
        for (const i of this.vizinhos(z.x, z.z, z.raio * 1.7, this.tmpLista)) {
          const dx = z.x - i.x;
          const dz = z.z - i.z;
          const d = Math.hypot(dx, dz) || 1;
          i.vx += (dx / d) * 18 * dt - (dz / d) * 10 * dt;
          i.vz += (dz / d) * 18 * dt + (dx / d) * 10 * dt;
        }
        if (this.rnd() < dt * 25)
          this.poeira.emitir({
            x: z.x + (this.rnd() - 0.5) * z.raio,
            y: this.rnd() * 3,
            z: z.z + (this.rnd() - 0.5) * z.raio,
            vy: 2,
            vida: 0.6,
            tamanho: 0.3,
            cor: '#d8fff0',
            ondular: 4,
          });
      } else if (z.tipo === 'muro') {
        if (z.segue) {
          z.x += (this.x - z.x) * Math.min(1, dt * 8);
          z.z += (this.z - z.z) * Math.min(1, dt * 8);
          z.malha.position.set(z.x, 0, z.z);
        }
        const fade = Math.min(1, z.vida * 2, t * 6);
        z.malha.scale.set(
          z.raio * (0.6 + fade * 0.4),
          0.3 + fade * 0.7,
          z.raio * (0.6 + fade * 0.4)
        );
        ((z.malha.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          (0.35 + Math.sin(this.tempo * 18) * 0.08) * fade;
        // barreira: quem está do lado de fora não atravessa
        for (const i of this.vizinhos(z.x, z.z, z.raio + 1.2, this.tmpLista)) {
          // chefes e inimigos grandes atravessam (só queimam)
          if (i.def.comportamento === 'chefe' || i.raio > 0.8) {
            if (z.tick <= 0 && Math.abs(Math.hypot(i.x - z.x, i.z - z.z) - z.raio) < 1)
              this.causarDano(i, z.dano, z.hab, 'fogo');
            continue;
          }
          const dx = i.x - z.x;
          const dz = i.z - z.z;
          const d = Math.hypot(dx, dz) || 1;
          if (Math.abs(d - z.raio) < 0.7 + i.raio * 0.5) {
            const fora = d >= z.raio;
            const alvo = fora ? z.raio + 0.7 + i.raio * 0.5 : z.raio - 0.7 - i.raio * 0.5;
            i.x = z.x + (dx / d) * alvo;
            i.z = z.z + (dz / d) * alvo;
            if (z.tick <= 0)
              this.causarDano(i, z.dano, z.hab, 'fogo', dx / d, dz / d, fora ? 4 : -4);
          }
        }
        if (this.rnd() < dt * 40) {
          const a = this.rnd() * Math.PI * 2;
          this.brilhos.emitir({
            x: z.x + Math.cos(a) * z.raio,
            y: 0.2 + this.rnd() * 0.8,
            z: z.z + Math.sin(a) * z.raio,
            vy: 2 + this.rnd() * 2,
            vida: 0.45,
            tamanho: 0.28,
            cor: this.rnd() < 0.5 ? '#ff6a2b' : '#ffd27a',
          });
        }
        if (z.tick <= 0) z.tick = 0.3;
        if (z.vida <= 0) this.cena.remove(z.malha);
        continue;
      } else if (z.tipo === 'buraco') {
        z.malha.rotation.y += dt * 4;
        z.malha.scale.setScalar(
          (z.raio / 2) * (0.6 + Math.min(1, t * 4) * 0.4) * (1 + Math.sin(this.tempo * 10) * 0.05)
        );
        for (const i of this.vizinhos(z.x, z.z, z.raio * 2.2, this.tmpLista)) {
          const dx = z.x - i.x;
          const dz = z.z - i.z;
          const d = Math.hypot(dx, dz) || 1;
          const res = i.def.comportamento === 'chefe' ? 0.1 : 1;
          i.vx += (dx / d) * 30 * dt * res;
          i.vz += (dz / d) * 30 * dt * res;
        }
        if (this.rnd() < dt * 40) {
          const a = this.rnd() * Math.PI * 2;
          const r = z.raio * 2;
          this.brilhos.emitir({
            x: z.x + Math.cos(a) * r,
            y: 1,
            z: z.z + Math.sin(a) * r,
            vx: -Math.cos(a) * r * 2,
            vz: -Math.sin(a) * r * 2,
            vida: 0.5,
            tamanho: 0.2,
            cor: '#c58bff',
            arrasto: 0,
          });
        }
        this.halos.por(z.x, 1, z.z, z.raio * 1.3, '#8a6bff', 0.45);
        if (z.vida <= 0 && z.explode) {
          for (const i of this.vizinhos(z.x, z.z, z.raio * 2.5, this.tmpLista))
            this.causarDano(i, z.explode, z.hab, 'gravidade');
          this.ondaVisual(z.x, z.z, '#c58bff', z.raio * 3, 0.5);
          this.brilhos.explosao(z.x, 1, z.z, 70, {
            cor: '#c58bff',
            tamanho: 0.4,
            vida: 0.8,
            velocidade: 12,
          });
          this.tremer(0.5);
          this.som('chefeOnda', {}, 0.1);
        }
      } else {
        const m = (z.malha as THREE.Mesh).material as THREE.MeshBasicMaterial;
        m.opacity = 0.45 * Math.min(1, z.vida * 2) * (0.8 + Math.sin(this.tempo * 6) * 0.2);
        if (this.rnd() < dt * 10)
          this.poeira.emitir({
            x: z.x + (this.rnd() - 0.5) * z.raio * 1.4,
            y: 0.1,
            z: z.z + (this.rnd() - 0.5) * z.raio * 1.4,
            vy: 1.2,
            vida: 0.7,
            tamanho: 0.25,
            cor: z.tipo === 'fogo' ? '#ffb347' : '#9dff5c',
          });
      }
      if (z.tick <= 0) {
        z.tick = z.tipo === 'buraco' ? 0.25 : 0.4;
        for (const i of this.vizinhos(z.x, z.z, z.raio, this.tmpLista))
          this.causarDano(i, z.dano, z.hab, z.elemento, 0, 0, 0, { lento: z.lento });
      }
      if (z.vida <= 0) this.cena.remove(z.malha);
    }
    this.zonas = this.zonas.filter((z) => z.vida > 0);
  }

  private atualizarOndas(dt: number): void {
    for (const o of this.ondas) {
      o.raio += o.vel * dt;
      o.malha.position.set(o.x, o.malha.position.y, o.z);
      o.malha.scale.setScalar(o.raio);
      const mat = o.malha.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.9 * (1 - o.raio / o.max);
      if (o.hab === -2) {
        // onda do chefe: atinge o jogador quando passa (esquive!)
        for (const jg of this.jogadores) {
          o.jogadores ??= new Set();
          if (o.jogadores.has(jg.indice)) continue;
          const d = Math.hypot(jg.x - o.x, jg.z - o.z);
          if (Math.abs(d - o.raio) >= 0.5) continue;
          o.jogadores.add(jg.indice);
          this.j = jg;
          this.danoJogador(o.dano, o.x, o.z);
        }
        continue;
      }
      for (const i of this.vizinhos(o.x, o.z, o.raio, this.tmpLista)) {
        if (o.atingidos.has(i)) continue;
        const dx = i.x - o.x;
        const dz = i.z - o.z;
        const d = Math.hypot(dx, dz) || 1;
        if (d < o.raio - 1.2) continue;
        if (o.cone) {
          let da = Math.atan2(dz, dx) - o.cone.ang;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          if (Math.abs(da) > o.cone.abertura / 2) continue;
        }
        o.atingidos.add(i);
        this.causarDano(i, o.dano, o.hab, o.elemento, dx / d, dz / d, o.forca, {
          congela: o.congela,
        });
      }
    }
    for (const o of this.ondas) if (o.raio >= o.max) this.cena.remove(o.malha);
    this.ondas = this.ondas.filter((o) => o.raio < o.max);
  }

  private atualizarAvisos(dt: number): void {
    for (const a of this.avisos) {
      a.t += dt;
      const p = Math.min(1, a.t / a.total);
      const m = a.malha.material as THREE.MeshBasicMaterial;
      m.opacity = 0.15 + p * 0.45;
      a.malha.scale.setScalar(a.raio * (0.3 + p * 0.7));
      if (a.t >= a.total) {
        this.cena.remove(a.malha);
        a.aoFim();
      }
    }
    this.avisos = this.avisos.filter((a) => a.t < a.total);
  }

  private atualizarCristais(dt: number): void {
    let coletou = 0;
    const ativos = this.ativos();
    for (const c of this.cristais) {
      if (!c.atraido) {
        for (const jg of ativos) {
          const r = jg.atributos.ima + c.t * 0.25;
          if ((jg.x - c.x) ** 2 + (jg.z - c.z) ** 2 < r * r) {
            c.atraido = true;
            c.alvo = jg.indice;
            break;
          }
        }
        if (!c.atraido) continue;
      }
      const alvo =
        this.jogadores.find((jg) => jg.indice === c.alvo && !jg.caido) ??
        this.maisProximoJogador(c.x, c.z) ??
        this.local;
      c.alvo = alvo.indice;
      const dx = alvo.x - c.x;
      const dz = alvo.z - c.z;
      const d2 = dx * dx + dz * dz;
      {
        const d = Math.sqrt(d2) || 1;
        const vel = 10 + Math.max(0, 14 - d) * 1.2;
        c.x += (dx / d) * vel * dt;
        c.z += (dz / d) * vel * dt;
        if (d < 0.7) {
          const tier = c.t;
          c.t = -1;
          coletou++;
          this.ganharXpCristal(tier, c.x, c.z);
        }
      }
    }
    if (coletou) this.cristais = this.cristais.filter((c) => c.t >= 0);
  }

  private ganharXpCristal(tier: number, x: number, z: number): void {
    this.ganharXp(VALOR_CRISTAL[tier]);
    this.som(
      'faiscaObtida',
      { tom: 1 + tier * 0.15 + this.rnd() * 0.08, volume: 0.25 + tier * 0.1 },
      0.03
    );
    this.brilhos.explosao(x, 0.8, z, 3 + tier * 5, {
      cor: CORES_CRISTAL[tier],
      tamanho: 0.18 + tier * 0.06,
      vida: 0.45,
      velocidade: 2 + tier,
      gravidade: -1,
    });
  }

  private atualizarItens(dt: number): void {
    for (const it of this.itens) {
      it.malha.rotation.y += dt * 2;
      it.malha.position.y = Math.sin(this.tempo * 3 + it.x) * 0.1;
      this.halos.por(
        it.x,
        0.7,
        it.z,
        it.tipo === 'bau' ? 3 : 2,
        it.tipo === 'coracao' ? '#ff5f7e' : it.tipo === 'ima' ? '#9df0ff' : '#ffd27a',
        1
      );
      if (!this.autoridade) continue;
      const quem = this.ativos().find((jg) => Math.hypot(it.x - jg.x, it.z - jg.z) < 1.2);
      if (quem) {
        this.cena.remove(it.malha);
        this.j = quem;
        this.pegarItem(it);
        this.j = this.local;
        it.x = 1e9;
      }
    }
    this.itens = this.itens.filter((it) => it.x < 1e8);
  }

  private pegarItem(it: Item): void {
    if (it.tipo === 'coracao') {
      this.vida = Math.min(this.atributos.vidaMaxima, this.vida + this.atributos.vidaMaxima * 0.25);
      this.audio.tocar('coracaoObtido');
      this.sentir('carinho', 1.5);
    } else if (it.tipo === 'ima') {
      // puxa os cristais da região (não o mapa inteiro, senão a progressão explode)
      for (const c of this.cristais)
        if (Math.abs(c.x - this.x) < 26 && Math.abs(c.z - this.z) < 26) {
          c.atraido = true;
          c.alvo = this.j.indice;
        }
      this.audio.tocar('revelar');
      this.mostrarBanner('ÍMÃ DE IDEIAS!', 'Os cristais por perto vêm até você', '#9df0ff', 2);
    } else if (it.tipo === 'bomba') {
      for (const i of this.vizinhos(this.x, this.z, 20, this.tmpLista).slice())
        this.causarDano(i, i.def.comportamento === 'chefe' ? i.vidaMax * 0.1 : 9999, -1, 'luz');
      this.ondaVisual(this.x, this.z, '#ffffff', 22, 0.7);
      this.tremer(0.8);
      this.audio.tocar('chefeDerrotado');
      this.mostrarBanner('CONTEXTO LIMPO!', 'O ruído ao redor sumiu', '#ffffff', 2);
    } else {
      this.audio.tocar('bauAbrir');
      this.brilhos.explosao(this.x, 1, this.z, 60, {
        cor: '#ffd27a',
        tamanho: 0.35,
        vida: 1.2,
        velocidade: 6,
        gravidade: -2,
      });
      this.niveisPendentes++;
      this.abrirNivel();
    }
  }

  // ------------------------------------------------------------------ desenho

  desenhar(dt: number): void {
    const menu = this.estado === 'menu';
    this.j = this.local;
    // jogadores
    for (const jg of this.jogadores) {
      const visivelMenu = !menu || jg === this.local;
      jg.modelo.raiz.position.set(jg.x, 0, jg.z);
      const piscar =
        jg.invencivel > 0 && jg.invencivel < 0.7 && Math.floor(jg.invencivel * 16) % 2 === 0;
      jg.modelo.raiz.visible = visivelMenu && !piscar;
      jg.modelo.sombraContato.visible = visivelMenu;
      jg.modelo.atualizar(dt, {
        velocidade: menu || jg.caido ? 0 : Math.hypot(jg.vx, jg.vz),
        noChao: true,
        vy: 0,
        angulo: menu ? Math.sin(this.menuGiro) * 0.55 : jg.angulo,
        golpe: -1,
        anguloGolpe: 0,
        esquiva: jg.dash > 0 ? 1 - jg.dash / 0.2 : -1,
        ferido: jg.caido ? 1 : jg.invencivel > 0.3 && this.estado === 'jogando' ? 0.6 : 0,
        humor: menu ? 'feliz' : jg.caido ? 'medo' : jg.humor,
        escondido: false,
        defendendo: false,
        falando: false,
        conjurando: 0,
      });
      // caído: deitado e transparente até alguém levantar
      jg.modelo.raiz.rotation.z = jg.caido ? Math.PI / 2.2 : 0;
      jg.modelo.posicionarSombra(jg.x, 0, jg.z, 0);
      const anel = jg.modelo.raiz.getObjectByName('anelGiro');
      if (anel) anel.rotation.z += dt * 2;
      const aura = this.aurasJogador.get(jg);
      if (aura && (menu || jg.caido || !jg.habs.some((h) => h.def.comportamento === 'aura')))
        (aura.material as THREE.MeshBasicMaterial).opacity = 0;
    }
    VENTO.jogador.value.set(this.x, 0, this.z);

    // lotes por quadro (órbitas, projéteis e brilhos da simulação já foram postos no passo)
    this.halos.voltarMarca();
    if (!menu)
      for (const jg of this.jogadores)
        if (jg.caido)
          this.halos.por(jg.x, 0.6, jg.z, 2.4 + jg.resgate * 3, '#7affc1', 0.4 + jg.resgate);
    for (const l of this.lotesInimigos.values()) l.iniciar();
    this.loteOlhos.iniciar();
    this.loteSegmentos.iniciar();
    for (const l of this.lotesCristal) l.iniciar();
    const cor = this.corTmp;
    const olhoCor = new THREE.Color(this.noite > 0.4 ? '#ff6b5a' : '#fff27a');
    for (const i of this.inimigos) {
      const lote = this.lotesInimigos.get(i.def.id)!;
      const esc = i.raio / i.def.raio;
      cor.set(i.def.cor);
      if (i.elite) cor.lerp(new THREE.Color('#ffd27a'), 0.35);
      if (i.congelado > 0) cor.lerp(new THREE.Color('#bdf2ff'), 0.7);
      else if (i.lento > 0) cor.lerp(new THREE.Color('#8fe3ff'), 0.3);
      if (i.queimar > 0) cor.lerp(new THREE.Color('#ff7a3d'), 0.25);
      if (i.veneno > 0) cor.lerp(new THREE.Color('#9dff5c'), 0.25);
      if (i.flash > 0) {
        if (i.def.comportamento === 'chefe') cor.lerp(new THREE.Color('#ffffff'), 0.35);
        else cor.setRGB(1, 1, 1);
      }
      if (i.ataque) cor.lerp(new THREE.Color('#ff3b3b'), 0.4 + Math.sin(this.tempo * 30) * 0.2);
      const pulo =
        i.def.comportamento === 'perseguir' || i.def.comportamento === 'enxame'
          ? Math.abs(Math.sin(i.fase * 9)) * 0.12
          : 0;
      const voo = i.def.comportamento === 'voador' ? Math.sin(i.fase * 4) * 0.15 : 0;
      const sq = 1 + Math.sin(i.fase * 9) * 0.06;
      const y = i.y + pulo + voo;
      const glitch =
        i.def.comportamento === 'teleporte' && Math.sin(i.fase * 23) > 0.92
          ? (this.rnd() - 0.5) * 0.4
          : 0;
      // Cavalo de Troia: tremendo quando vai abrir; brilha como um presente
      const tremor = i.ataque?.tipo === 'abrir' ? (this.rnd() - 0.5) * 0.25 : 0;
      lote.por(
        i.x + glitch + tremor,
        y,
        i.z,
        esc * (2 - sq),
        esc * sq,
        esc * (2 - sq),
        0,
        i.def.comportamento === 'disfarce' ? this.tempo * 0.6 : i.ang,
        0,
        cor
      );
      if (i.def.comportamento === 'disfarce')
        this.halos.por(i.x, 0.8, i.z, 3 + Math.sin(this.tempo * 3) * 0.4, '#ffd27a', 1.1);
      else if (i.def.id === 'ransomware' || i.def.id === 'virus')
        this.halos.por(
          i.x,
          y + i.def.altura * 0.5 * esc,
          i.z,
          i.raio * (i.def.id === 'virus' ? 2.4 : 1.6),
          '#39ff88',
          i.def.id === 'virus' ? 0.35 : 0.18
        );
      if (i.rastro) {
        // corpo do Worm: segmentos seguindo o caminho da cabeça
        const seg = cor.clone().multiplyScalar(0.85);
        for (let k = 1; k <= 5; k++) {
          const idx = Math.min(i.rastro.length - 2, k * 4);
          if (idx < 0) break;
          const sx = i.rastro[idx - (idx % 2)];
          const sz = i.rastro[idx - (idx % 2) + 1];
          const r = esc * (0.36 - k * 0.04);
          this.loteSegmentos.por(
            sx,
            r + Math.abs(Math.sin(i.fase * 9 + k)) * 0.08,
            sz,
            r,
            r,
            r,
            0,
            0,
            0,
            seg
          );
        }
      }
      const o = OLHOS[i.def.id];
      const cs = Math.cos(i.ang);
      const sn = Math.sin(i.ang);
      for (const lado of [-1, 1]) {
        const lx = lado * o.sep * esc;
        const lz = o.z * esc;
        this.loteOlhos.por(
          i.x + lx * cs + lz * sn,
          y + o.y * esc * sq,
          i.z - lx * sn + lz * cs,
          o.tam * esc,
          o.tam * esc * 1.3,
          o.tam * esc * 0.6,
          0,
          i.ang,
          0,
          olhoCor
        );
      }
      if (this.noite > 0.3 && this.rnd() < 0.3)
        this.halos.por(i.x, y + o.y * esc, i.z, 0.6 * esc, '#ff6b5a', this.noite * 0.6);
    }
    // cristais (os maiores brilham mais)
    const raioVisivel = 36;
    for (const c of this.cristais) {
      if (Math.abs(c.x - this.x) > raioVisivel || Math.abs(c.z - this.z) > raioVisivel) continue;
      const t = c.t;
      const s = TAM_CRISTAL[t];
      const y = 0.45 + Math.sin(this.tempo * 2.5 + c.fase) * 0.12 + s;
      let corC: THREE.ColorRepresentation = CORES_CRISTAL[t];
      if (t === 3) corC = new THREE.Color().setHSL((this.tempo * 0.2 + c.fase) % 1, 0.8, 0.82);
      this.lotesCristal[t].por(
        c.x,
        y,
        c.z,
        s,
        s * 1.5,
        s,
        0,
        this.tempo * (1 + t * 0.5) + c.fase,
        0,
        corC
      );
      this.halos.por(
        c.x,
        y,
        c.z,
        HALO_CRISTAL[t] * (1 + Math.sin(this.tempo * 4 + c.fase) * 0.12),
        t === 3 ? corC : CORES_CRISTAL[t],
        BRILHO_CRISTAL[t] * (1 + this.noite * 0.6)
      );
    }
    for (const l of this.lotesInimigos.values()) l.concluir();
    this.loteOlhos.concluir();
    this.loteSegmentos.concluir();
    this.loteOrbita.concluir();
    for (const l of this.lotesProj.values()) l.concluir();
    for (const l of this.lotesCristal) l.concluir();

    // efeitos
    for (const e of this.efeitos) {
      e.vida -= dt;
      e.atualizar?.(1 - Math.max(0, e.vida) / e.total);
      if (e.vida <= 0) this.cena.remove(e.malha);
    }
    this.efeitos = this.efeitos.filter((e) => e.vida > 0);
    this.matAura.opacity = 0;
    this.anelMagnetico.position.set(this.x, 0.05, this.z);
    this.anelMagnetico.scale.setScalar(this.atributos.ima);
    this.anelMagnetico.visible = !menu && !this.local.caido;

    // céu: o dia vira noite com o tempo
    const n = this.noite;
    const ceuA = new THREE.Color('#8fd3f4').lerp(new THREE.Color('#1b1640'), n);
    const ceuB = new THREE.Color('#fde6c8').lerp(new THREE.Color('#5a3b7a'), n);
    const nevoa = new THREE.Color('#f3e3cf').lerp(new THREE.Color('#2e2350'), n);
    (this.cena.fog as THREE.Fog).color.copy(nevoa);
    document.body.style.background = `linear-gradient(180deg, #${ceuA.getHexString()} 0%, #${ceuB.getHexString()} 62%, #${nevoa.getHexString()} 100%)`;
    this.sol.intensity = 2.3 - n * 1.4;
    this.sol.color.set('#fff0d6').lerp(new THREE.Color('#9fa8ff'), n);
    this.hemi.intensity = 1.7 - n * 0.8;
    this.arena.atualizar(dt, this.tempo, this.x, this.z, n);

    // câmera
    if (menu) {
      this.menuGiro += dt * 0.6;
      if (this.camera.aspect < 1) {
        // retrato: o personagem fica no alto, acima do painel de escolha
        this.camera.position.set(this.x, 2.6, this.z + 7.6);
        this.camera.lookAt(this.x, -0.55, this.z);
      } else {
        this.camera.position.set(this.x + 0.2, 2.2, this.z + 5.2);
        this.camera.lookAt(this.x - 1.1, 0.95, this.z);
      }
    } else {
      const k = 1 - Math.exp(-6 * dt);
      this.alvoCam.x += (this.x + this.vx * 0.15 - this.alvoCam.x) * k;
      this.alvoCam.z += (this.z + this.vz * 0.15 - this.alvoCam.z) * k;
      const retrato = this.camera.aspect < 1 ? 1 + (1 - this.camera.aspect) * 0.8 : 1;
      this.camera.position.set(this.alvoCam.x, 15 * retrato, this.alvoCam.z + 10.5 * retrato);
      if (this.tremor > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.tremor;
        this.camera.position.y += (Math.random() - 0.5) * this.tremor;
        this.tremor = Math.max(0, this.tremor - dt * 2.5);
      }
      this.camera.lookAt(this.alvoCam.x, 0, this.alvoCam.z);
    }
    this.sol.position.set(this.x + 14, 28, this.z + 12);
    this.sol.target.position.set(this.x, 0, this.z);
    this.poeira.atualizar(dt, this.tempo);
    this.brilhos.atualizar(dt, this.tempo);
    this.halos.concluir();
    this.renderizador.render(this.cena, this.camera);
  }

  // ------------------------------------------------------------------ rede (multijogador)

  /** Anfitrião → convidados: estado da partida (≈5 vezes por segundo). */
  exportarEstado(): Mensagem {
    const tipos = Object.keys(INIMIGOS) as IdInimigo[];
    const ini: number[] = [];
    for (const i of this.inimigos) {
      if (!i.vivo) continue;
      const f =
        (i.elite ? 1 : 0) |
        (i.congelado > 0 ? 2 : 0) |
        (i.lento > 0 ? 4 : 0) |
        (i.queimar > 0 ? 8 : 0) |
        (i.veneno > 0 ? 16 : 0) |
        (i.atordoado > 0 ? 32 : 0);
      const at = i.ataque ? TIPOS_ATAQUE.indexOf(i.ataque.tipo) + 1 : 0;
      ini.push(
        i.id,
        tipos.indexOf(i.def.id),
        Math.round(i.x * 100),
        Math.round(i.z * 100),
        Math.round(i.y * 100),
        Math.round(i.vida * 10),
        Math.round(i.vidaMax * 10),
        f,
        Math.round(i.ang * 100),
        Math.round(i.raio * 100),
        at,
        i.ataque ? Math.round(i.ataque.t * 100) : 0,
        Math.round(i.vel * 100),
        Math.round(i.dano * 10),
        i.ataque ? Math.round(i.ataque.ax * 100) : 0,
        i.ataque ? Math.round(i.ataque.az * 100) : 0
      );
    }
    const itTipos: Item['tipo'][] = ['coracao', 'ima', 'bomba', 'bau'];
    return {
      t: 'estado',
      tp: Math.round(this.tempo * 100) / 100,
      ph: this.proximaHorda,
      pc: this.proximoChefe,
      xp: Math.round(this.xp * 10) / 10,
      nv: this.nivel,
      xpp: this.xpProximo,
      ab: this.abates,
      cd: this.chefesDerrotados,
      ch: this.chefeAtual?.id ?? 0,
      est: this.estado,
      jg: this.jogadores.map((jg) => [
        jg.indice,
        Math.round(jg.vida * 10) / 10,
        jg.caido ? 1 : 0,
        Math.round(jg.resgate * 100),
        jg.ausente ? 1 : 0,
        Math.round(jg.invencivel * 100),
        [...jg.bloqueios].flat(),
      ]),
      ini,
      it: this.itens.map((it) => [
        it.id,
        itTipos.indexOf(it.tipo),
        Math.round(it.x * 100),
        Math.round(it.z * 100),
      ]),
      bn: this.banner
        ? [this.banner.texto, this.banner.sub, this.banner.cor, this.banner.vida]
        : null,
    };
  }

  /** Convidado: aplica o estado recebido do anfitrião. */
  importarEstado(m: Record<string, unknown>): void {
    this.tempo = Number(m.tp);
    this.proximaHorda = Number(m.ph);
    this.proximoChefe = Number(m.pc);
    this.xp = Number(m.xp);
    this.nivel = Number(m.nv);
    this.xpProximo = Number(m.xpp);
    this.abates = Number(m.ab);
    this.chefesDerrotados = Number(m.cd);
    for (const [indice, vida, caido, resgate, ausente, inv, travas] of m.jg as [
      number,
      number,
      number,
      number,
      number,
      number,
      number[],
    ][]) {
      const jg = this.jogadores.find((x) => x.indice === indice);
      if (!jg) continue;
      const antes = jg.bloqueios.size;
      jg.bloqueios.clear();
      for (let k = 0; k + 1 < (travas?.length ?? 0); k += 2)
        jg.bloqueios.set(travas[k], travas[k + 1]);
      if (jg.local && jg.bloqueios.size > antes) this.som('runaErro', {}, 0.2);
      if (vida < jg.vida - 0.5 && !caido) this.sentirDano(jg);
      jg.vida = vida;
      if (caido && !jg.caido && jg.local) this.audio.tocar('derrota');
      jg.caido = !!caido;
      jg.resgate = resgate / 100;
      if (!jg.local) {
        jg.ausente = !!ausente;
        jg.invencivel = inv / 100;
      } else if (inv / 100 > jg.invencivel + 0.3) jg.invencivel = inv / 100;
    }
    // inimigos: atualiza os que já existem, cria os novos e tira os que sumiram
    const tipos = Object.keys(INIMIGOS) as IdInimigo[];
    const ini = m.ini as number[];
    const porId = new Map(this.inimigos.map((i) => [i.id, i]));
    const vistos = new Set<number>();
    const N = 16;
    for (let k = 0; k + N <= ini.length; k += N) {
      const id = ini[k];
      vistos.add(id);
      let i = porId.get(id);
      const def = INIMIGOS[tipos[ini[k + 1]]];
      if (!def) continue;
      if (!i) {
        i = {
          id,
          def,
          x: 0,
          z: 0,
          y: 0,
          vy: 0,
          vx: 0,
          vz: 0,
          vida: 1,
          vidaMax: 1,
          dano: 1,
          vel: 1,
          raio: def.raio,
          ang: 0,
          lento: 0,
          congelado: 0,
          atordoado: 0,
          queimar: 0,
          queimarDps: 0,
          veneno: 0,
          venenoDps: 0,
          flash: 0,
          recarga: 3,
          vivo: true,
          elite: false,
          fase: this.rnd() * 10,
          hits: new Float32Array(HABILIDADES.length * MAX_JOGADORES),
        };
        this.inimigos.push(i);
      }
      i.vivo = true;
      i.x = ini[k + 2] / 100;
      i.z = ini[k + 3] / 100;
      i.y = ini[k + 4] / 100;
      i.vida = ini[k + 5] / 10;
      i.vidaMax = ini[k + 6] / 10;
      const f = ini[k + 7];
      i.elite = !!(f & 1);
      i.congelado = f & 2 ? Math.max(i.congelado, 0.3) : 0;
      i.lento = f & 4 ? Math.max(i.lento, 0.3) : 0;
      i.queimar = f & 8 ? Math.max(i.queimar, 0.3) : 0;
      i.veneno = f & 16 ? Math.max(i.veneno, 0.3) : 0;
      i.atordoado = f & 32 ? Math.max(i.atordoado, 0.3) : 0;
      i.ang = ini[k + 8] / 100;
      i.raio = ini[k + 9] / 100;
      const at = ini[k + 10];
      if (at > 0) {
        const tipo = TIPOS_ATAQUE[at - 1];
        if (!i.ataque || i.ataque.tipo !== tipo) {
          i.ataque = { tipo, t: ini[k + 11] / 100, ax: ini[k + 14] / 100, az: ini[k + 15] / 100 };
          if (tipo === 'mirar') this.aviso(i.ataque.ax, i.ataque.az, 1.7, 1.1, '#ff3b3b', () => {});
        }
      } else i.ataque = undefined;
      i.vel = ini[k + 12] / 100;
      i.dano = ini[k + 13] / 10;
    }
    for (const i of this.inimigos)
      if (!vistos.has(i.id) && i.vivo) {
        i.vivo = false;
        this.brilhos.explosao(i.x, 0.6, i.z, 8, {
          cor: i.def.cor,
          tamanho: 0.26,
          vida: 0.5,
          velocidade: 4,
        });
      }
    this.inimigos = this.inimigos.filter((i) => i.vivo);
    const ch = Number(m.ch);
    this.chefeAtual = ch ? (this.inimigos.find((i) => i.id === ch) ?? null) : null;
    // itens
    const itTipos: Item['tipo'][] = ['coracao', 'ima', 'bomba', 'bau'];
    const itens = m.it as number[][];
    const ids = new Set(itens.map((d) => d[0]));
    for (const it of this.itens)
      if (!ids.has(it.id)) {
        this.cena.remove(it.malha);
        it.x = 1e9;
      }
    this.itens = this.itens.filter((it) => it.x < 1e8);
    for (const [id, tipo, x, z] of itens)
      if (!this.itens.some((it) => it.id === id)) {
        this.soltarItem(itTipos[tipo], x / 100, z / 100);
        this.itens[this.itens.length - 1].id = id;
      }
    // aviso na tela
    const bn = m.bn as [string, string, string, number] | null;
    if (bn && (!this.banner || this.banner.texto !== bn[0] || this.banner.sub !== bn[1]))
      this.mostrarBanner(bn[0], bn[1], bn[2], bn[3]);
    if (m.est === 'fim' && this.estado !== 'fim') {
      this.estado = 'fim';
      this.audio.tocar('derrota');
      this.aoMudar();
    } else if (m.est === 'jogando' && this.estado === 'nivel') {
      this.estado = 'jogando';
      this.aoMudar();
    }
  }

  /** Cristais no chão (anfitrião → convidados, ≈1 vez por segundo). */
  exportarCristais(): Mensagem {
    const c: number[] = [];
    for (const k of this.cristais)
      if (k.t >= 0) c.push(Math.round(k.x * 10), Math.round(k.z * 10), k.t);
    return { t: 'cristais', c };
  }

  importarCristais(m: Record<string, unknown>): void {
    const c = m.c as number[];
    const novos: Cristal[] = [];
    for (let k = 0; k + 3 <= c.length; k += 3) {
      const x = c[k] / 10;
      const z = c[k + 1] / 10;
      novos.push({ x, z, t: c[k + 2], atraido: false, fase: Math.abs(x * 13.7 + z * 7.3) % 6 });
    }
    this.cristais = novos;
  }

  /** Posições de todos (anfitrião) ou só a minha (convidado). */
  exportarPosicoes(soLocal: boolean): number[][] {
    return this.jogadores
      .filter((jg) => !soLocal || jg.local)
      .map((jg) => [
        jg.indice,
        Math.round(jg.x * 100) / 100,
        Math.round(jg.z * 100) / 100,
        Math.round(jg.vx * 100) / 100,
        Math.round(jg.vz * 100) / 100,
        Math.round(jg.angulo * 100) / 100,
        jg.dash > 0 ? 1 : 0,
        jg.ausente ? 1 : 0,
      ]);
  }

  importarPosicoes(lista: number[][]): void {
    for (const [indice, x, z, vx, vz, a, d, aus] of lista) {
      const jg = this.jogadores.find((o) => o.indice === indice);
      if (!jg || jg.local) continue;
      jg.rede = { x, z, vx, vz, angulo: a, dash: !!d, t: 0 };
      if (this.autoridade) jg.ausente = !!aus;
    }
  }

  /** Builds e escolhas de nível (anfitrião → convidados). */
  exportarNivel(): Mensagem {
    const of: Record<number, Oferta[]> = {};
    const b: Record<number, EstadoBuild> = {};
    const rr: Record<number, number> = {};
    const esc: number[] = [];
    for (const jg of this.jogadores) {
      of[jg.indice] = jg.ofertas;
      b[jg.indice] = jg.build;
      rr[jg.indice] = jg.rerrolagens;
      if (jg.escolheu) esc.push(jg.indice);
    }
    return {
      t: 'nivel',
      est: this.estado,
      pend: this.niveisPendentes,
      nv: this.nivel,
      of,
      b,
      rr,
      esc,
    };
  }

  importarNivel(m: Record<string, unknown>): void {
    const of = m.of as Record<number, Oferta[]>;
    const b = m.b as Record<number, EstadoBuild>;
    const rr = m.rr as Record<number, number>;
    const esc = m.esc as number[];
    const antes = this.estado;
    for (const jg of this.jogadores) {
      if (b[jg.indice]) {
        this.j = jg;
        this.build = b[jg.indice];
        this.atualizarBuild();
      }
      jg.ofertas = of[jg.indice] ?? [];
      jg.rerrolagens = rr[jg.indice] ?? jg.rerrolagens;
      jg.escolheu = esc.includes(jg.indice);
    }
    this.j = this.local;
    this.niveisPendentes = Number(m.pend);
    this.nivel = Number(m.nv);
    if (m.est === 'nivel' || m.est === 'jogando') this.estado = m.est;
    if (this.estado === 'nivel' && antes !== 'nivel') {
      this.audio.tocar('comemoracao');
      this.falar('nivel');
    }
    this.aoMudar();
  }

  /** Remove quem saiu da sala no meio da partida. */
  removerJogador(indice: number): void {
    const jg = this.jogadores.find((x) => x.indice === indice);
    if (!jg || jg.local) return;
    this.cena.remove(jg.modelo.raiz, jg.modelo.sombraContato);
    const aura = this.aurasJogador.get(jg);
    if (aura) this.cena.remove(aura);
    this.aurasJogador.delete(jg);
    this.jogadores = this.jogadores.filter((x) => x !== jg);
    this.mostrarBanner(`${jg.def.nome} saiu da sala`, '', '#ffb0a0', 2.5);
    if (this.estado === 'nivel' && this.autoridade && this.jogadores.every((x) => x.escolheu)) {
      this.estado = 'jogando';
      this.rede?.nivelAberto();
    }
    this.aoMudar();
  }

  /** Convidado aplica a escolha de cartas de um jogador remoto (só no anfitrião). */
  escolhaRemota(indice: number, i: number): void {
    const jg = this.jogadores.find((x) => x.indice === indice);
    if (jg) this.aplicarEscolha(jg, i);
  }

  rerrolarRemoto(indice: number): void {
    const jg = this.jogadores.find((x) => x.indice === indice);
    if (jg) this.rerrolarJogador(jg);
  }

  // ------------------------------------------------------------------ depuração (testes automatizados)

  /** Dá experiência como se viesse de cristais. */
  depurarXp(v: number): void {
    this.ganharXp(v);
  }

  /** Coloca uma habilidade (ativa ou passiva) direto no nível pedido. */
  depurarHabilidade(id: string, nivel: number): void {
    const ativa = HABILIDADES.some((h) => h.id === id);
    const lista = ativa ? this.build.ativas : this.build.passivas;
    const s = lista.find((x) => x.id === id);
    if (s) s.nivel = nivel;
    else lista.push({ id, nivel });
    this.atualizarBuild();
    this.aoMudar();
  }

  /** Força o próximo ataque do chefe (testes). */
  depurarAtaqueChefe(tipo: TipoAtaque): void {
    const c = this.chefeAtual;
    if (c) c.ataque = { tipo, t: 0, ax: 0, az: 0 };
  }

  /** Cria inimigos de um tipo em volta do jogador local. */
  depurarInimigo(id: IdInimigo, n = 1, dist = 7): void {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      const i = this.criarInimigo(
        INIMIGOS[id],
        this.x + Math.cos(a) * dist,
        this.z + Math.sin(a) * dist
      );
      if (i && i.def.comportamento === 'chefe') this.chefeAtual = i;
    }
  }

  /** Avança o relógio da partida (hordas e chefes acontecem no próximo passo). */
  depurarTempo(t: number): void {
    this.tempo = t;
  }

  /** Direção sugerida para um jogador-robô: foge dos inimigos próximos e busca cristais. */
  depurarDirecao(): { x: number; z: number } {
    let fx = 0;
    let fz = 0;
    for (const i of this.inimigos) {
      const dx = this.x - i.x;
      const dz = this.z - i.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 100) continue;
      const d = Math.sqrt(d2) || 0.1;
      fx += (dx / d) * (1 / d) * 6;
      fz += (dz / d) * (1 / d) * 6;
    }
    let melhor = Infinity;
    let cx = 0;
    let cz = 0;
    for (const c of this.cristais) {
      const d2 = (c.x - this.x) ** 2 + (c.z - this.z) ** 2;
      if (d2 < melhor) {
        melhor = d2;
        cx = c.x - this.x;
        cz = c.z - this.z;
      }
    }
    const dc = Math.sqrt(melhor) || 1;
    if (Number.isFinite(melhor)) {
      fx += (cx / dc) * 0.8;
      fz += (cz / dc) * 0.8;
    }
    // não fica preso na borda
    const r = Math.hypot(this.x, this.z);
    if (r > RAIO_ARENA - 12) {
      fx -= (this.x / r) * 2;
      fz -= (this.z / r) * 2;
    }
    const n = Math.hypot(fx, fz) || 1;
    return { x: fx / n, z: fz / n };
  }

  contagem(): { inimigos: number; projeteis: number; cristais: number; zonas: number } {
    return {
      inimigos: this.inimigos.length,
      projeteis: this.projeteis.length,
      cristais: this.cristais.length,
      zonas: this.zonas.length,
    };
  }

  /** Estado das habilidades para o HUD (fração de recarga 0..1). */
  /** A habilidade do HUD (do jogador local) está travada pelo Ransomware? */
  travada(idx: number): boolean {
    return (this.local.bloqueios.get(idx) ?? 0) > this.tempo;
  }

  slotsHud(): {
    id: string;
    icone: string;
    cor: string;
    nivel: number;
    recarga: number;
    nome: string;
    travada: boolean;
  }[] {
    return this.habs.map((h) => {
      const v = valoresHabilidade(h.def, h.nivel, this.atributos);
      const cont =
        h.def.comportamento === 'aura' ||
        h.def.comportamento === 'drone' ||
        ((h.def.comportamento === 'orbita' || h.def.comportamento === 'laser') && v.evo10);
      const total =
        h.def.comportamento === 'orbita' || h.def.comportamento === 'laser'
          ? v.recarga + v.duracao
          : v.recarga;
      return {
        id: h.def.id,
        icone: h.def.icone,
        cor: h.def.cor,
        nivel: h.nivel,
        recarga: cont ? 0 : Math.max(0, Math.min(1, h.timer / total)),
        nome: h.def.nome,
        travada: this.travada(h.idx),
      };
    });
  }
}
