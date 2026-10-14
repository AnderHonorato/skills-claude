/**
 * O jogo: cena 3D, câmera elevada que segue o Claude, luz do sol com sombras,
 * vento, ciclo de atualização, diálogos com escolhas, missões, regiões, fronteira,
 * salvamento e a cena do farol. Não existe final definitivo: o mundo continua aberto.
 */
import * as THREE from 'three';
import type { ApiAudio, IdMusica } from '../audio/contrato';
import { criarAudio } from '../audio/indice';
import { ARMAS, ORDEM_ARMAS } from '../dados/armas';
import { DIALOGOS, type NoDialogo, type OpcaoDialogo } from '../dados/dialogos';
import { MISSOES, type EtapaMissao, type Missao } from '../dados/missoes';
import {
  alemDaFronteira,
  ARBUSTOS,
  dadosRegiao,
  FRONTEIRA,
  INICIO,
  INIMIGOS,
  montarSolidos,
  PONTO_CHECKPOINT,
  RAMPAS,
  regiaoEm,
  VERSAO_CONTEUDO,
} from '../dados/mundo';
import { NPCS } from '../dados/npcs';
import { EntradaJogo } from '../motor/entrada';
import { EstadoProgresso, type AvisoEstado } from '../nucleo/estado';
import { MundoFisico } from '../nucleo/fisica';
import { aproximar, escolher } from '../nucleo/matematica';
import {
  apagarSalvamento,
  gravarSalvamento,
  lerSalvamento,
  posicaoSegura,
  salvamentoVazio,
  type DadosSalvos,
} from '../nucleo/salvamento';
import type { Falante, Humor, IdNpc, IdRegiao } from '../nucleo/tipos';
import { criarCenario, type Cenario } from '../render/cenario';
import { VENTO } from '../render/materiais';
import { SistemaParticulas } from '../render/particulas';
import { Pegadas } from '../render/pegadas';
import type { Alvo, Contexto } from './contexto';
import { Inimigo } from './inimigos';
import { Jogador } from './jogador';
import { Npc } from './npcs';
import { ObjetosMundo, type Interacao } from './objetos';
import { Projeteis } from './projeteis';

export type EstadoJogo = 'titulo' | 'jogando' | 'dialogo' | 'pausado' | 'derrota' | 'cena';

export interface LinhaDialogo {
  quem: Falante;
  nome: string;
  fala: string;
  humor: Humor;
  opcoes: OpcaoDialogo[];
}

/** Ponte entre o jogo e a interface (HUD, menus, diálogos). */
export interface Ui {
  atualizar(dt: number): void;
  mensagem(texto: string, duracao?: number): void;
  balao(alvo: { x: number; y: number; z: number }, texto: string, duracao: number): void;
  dialogo(linha: LinhaDialogo | null): void;
  regiao(nome: string): void;
  derrota(): void;
  titulo(temSalvamento: boolean): void;
  pausa(ativa: boolean): void;
  alternarMapa(forcar?: boolean): void;
  aviso(texto: string | null): void;
  menuAberto(): boolean;
}

const NOMES: Record<Falante, string> = {
  lumi: 'Dona Lumi',
  pipo: 'Pipo',
  bento: 'Mestre Bento',
  eco: 'Eco',
  vela: 'Vela',
  claude: 'Claude',
  narrador: '',
};

export class JogoCentelha {
  readonly renderizador: THREE.WebGLRenderer;
  readonly cena = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly entrada: EntradaJogo;
  readonly audio: ApiAudio;
  readonly estado = new EstadoProgresso();
  readonly fisica: MundoFisico;
  readonly poeira = new SistemaParticulas(900, false);
  readonly brilhos = new SistemaParticulas(1400, true);
  readonly pegadas = new Pegadas();
  readonly cenario: Cenario;
  readonly jogador: Jogador;
  readonly npcs: Npc[] = [];
  readonly inimigos: Inimigo[] = [];
  readonly objetos: ObjetosMundo;
  readonly projeteis: Projeteis;
  readonly ctx: Contexto;
  ui!: Ui;

  estadoJogo: EstadoJogo = 'titulo';
  tempo = 0;
  tempoJogo = 0;
  regiaoAtual: IdRegiao = 'jardim';
  checkpoint = 'pedra-jardim';
  removidos = new Set<string>();
  qualidade: 'alta' | 'media' | 'baixa';
  tremorAtivo = true;
  interacao: Interacao | null = null;
  falandoCom: Npc | null = null;
  chefeAtivo: Inimigo | null = null;
  ultimaMissaoEtapa = '';

  private sol: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private tremor = 0;
  private congelado = 0;
  private alvoCamera = new THREE.Vector3();
  private camPos = new THREE.Vector3();
  private zoom = 1;
  private noAtual: NoDialogo | null = null;
  private filaClaude: { fala: string; humor: Humor; depois: () => void } | null = null;
  private corCeuA = new THREE.Color();
  private corCeuB = new THREE.Color();
  private corNevoa = new THREE.Color();
  private avisoFronteira = false;
  private cenaFarol = -1;
  private marcador: THREE.Mesh;
  private tituloOrbita = 0;
  private salvarEm = 0;
  private regiaoTimer = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    qualidade?: 'alta' | 'media' | 'baixa'
  ) {
    const grosso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const salvo = lerSalvamento();
    this.qualidade = qualidade ?? salvo?.configuracoes.qualidade ?? (grosso ? 'media' : 'alta');
    this.renderizador = new THREE.WebGLRenderer({
      canvas,
      antialias: this.qualidade !== 'baixa',
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderizador.setClearColor(0x000000, 0);
    this.renderizador.outputColorSpace = THREE.SRGBColorSpace;
    this.renderizador.shadowMap.enabled = this.qualidade !== 'baixa';
    this.renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 260);
    this.cena.fog = new THREE.Fog('#f3e3cf', 38, 110);

    this.hemi = new THREE.HemisphereLight('#dff1ff', '#8a7a62', 1.7);
    this.cena.add(this.hemi);
    this.sol = new THREE.DirectionalLight('#fff0d6', 2.4);
    this.sol.castShadow = this.qualidade !== 'baixa';
    const tam = this.qualidade === 'alta' ? 2048 : 1024;
    this.sol.shadow.mapSize.set(tam, tam);
    const s = this.sol.shadow.camera;
    s.left = -24;
    s.right = 24;
    s.top = 24;
    s.bottom = -24;
    s.near = 1;
    s.far = 80;
    this.sol.shadow.bias = -0.0008;
    this.sol.shadow.normalBias = 0.03;
    this.cena.add(this.sol, this.sol.target);

    this.entrada = new EntradaJogo(canvas);
    this.audio = criarAudio();
    this.fisica = new MundoFisico(montarSolidos(), RAMPAS, (f) => this.estado.temFlag(f));
    this.cenario = criarCenario(this.fisica, this.qualidade);
    this.cena.add(this.cenario.grupo, this.poeira.pontos, this.brilhos.pontos, this.pegadas.malha);

    // contexto compartilhado
    const jogo = this;
    this.ctx = {
      cena: this.cena,
      fisica: this.fisica,
      estado: this.estado,
      audio: this.audio,
      entrada: this.entrada,
      poeira: this.poeira,
      brilhos: this.brilhos,
      get tempo() {
        return jogo.tempo;
      },
      tremer: (f) => {
        if (this.tremorAtivo) this.tremor = Math.max(this.tremor, f);
      },
      congelar: (s2) => (this.congelado = Math.max(this.congelado, s2)),
      mensagem: (t, d) => this.ui?.mensagem(t, d),
      balao: (q, t, d = 2.5) => this.ui?.balao(q, t, d),
      moitaEm: (x, z) => {
        for (let i = 0; i < ARBUSTOS.length; i++)
          if (Math.hypot(ARBUSTOS[i].x - x, ARBUSTOS[i].z - z) < ARBUSTOS[i].r * 0.95) return i;
        return -1;
      },
      agitarMoita: (i, f) => this.cenario.agitarMoita(i, f),
      alvos: () => [...this.inimigos.filter((i) => i.vivo), ...this.npcs] as Alvo[],
      jogador: {
        get x() {
          return jogo.jogador.x;
        },
        get y() {
          return jogo.jogador.y;
        },
        get z() {
          return jogo.jogador.z;
        },
        get escondido() {
          return jogo.jogador.escondido;
        },
        get velocidade() {
          return jogo.jogador.velocidade;
        },
        get vivo() {
          return jogo.jogador.vivo && jogo.estadoJogo === 'jogando';
        },
        receberDano: (d, dx, dz, f) => this.jogador.receberDano(d, dx, dz, f),
        defendendoDe: (x, z) => this.jogador.defendendoDe(x, z),
      },
      projetil: (p) => this.projeteis.criar(p),
      aoDerrotar: (id, x, y, z, xp, missao) => this.aoDerrotar(id, x, y, z, xp, missao),
    };

    this.jogador = new Jogador(this.ctx, this.pegadas);
    this.cena.add(
      this.jogador.modelo.raiz,
      this.jogador.modelo.sombraContato,
      ...this.jogador.arma.objetos()
    );
    for (const d of NPCS) {
      const n = new Npc(d, this.ctx);
      this.npcs.push(n);
      this.cena.add(...n.objetos());
    }
    for (const s2 of INIMIGOS) {
      const i = new Inimigo(s2, this.ctx);
      this.inimigos.push(i);
      this.cena.add(...i.objetos());
    }
    this.projeteis = new Projeteis(this.ctx);
    this.objetos = new ObjetosMundo(this.ctx, {
      salvar: () => this.salvarLogo(),
      checkpoint: (id) => {
        this.checkpoint = id;
        this.objetos.definirCheckpoint(id);
      },
      renascerInimigos: () => {
        for (const i of this.inimigos) if (!i.vivo && !i.spawn.missao) i.renascer();
      },
      farolAceso: () => this.iniciarCenaFarol(),
      removido: (id) => this.removidos.has(id),
      remover: (id) => this.removidos.add(id),
      chefeVivoAcordado: () => {
        const c = this.inimigos.find((i) => i.ehChefe);
        return !!c && c.vivo && !c.dormindo();
      },
      claudeSente: (h, d) => this.jogador.sentir(h, d),
      conjurar: () => {
        this.jogador.conjurando = 0.5;
      },
    });

    // marcador de objetivo flutuante
    this.marcador = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.MeshBasicMaterial({
        color: '#ffd27a',
        transparent: true,
        opacity: 0.9,
        depthTest: false,
      })
    );
    this.marcador.renderOrder = 30;
    this.cena.add(this.marcador);

    this.estado.aoAviso = (a) => this.aoAviso(a);
    this.redimensionar();
    window.addEventListener('resize', () => this.redimensionar());
    this.jogador.posicionar(INICIO.x, 0, INICIO.z);
    this.aplicarCores(true);
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
  }

  /** Projeta um ponto do mundo para a tela (px). */
  paraTela(x: number, y: number, z: number): { x: number; y: number; visivel: boolean } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: ((v.x + 1) / 2) * window.innerWidth,
      y: ((1 - v.y) / 2) * window.innerHeight,
      visivel: v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2,
    };
  }

  private salvarLogo(): void {
    this.salvarEm = 0.05;
  }

  definirQualidade(q: 'alta' | 'media' | 'baixa'): void {
    this.qualidade = q;
    this.renderizador.shadowMap.enabled = q !== 'baixa';
    this.sol.castShadow = q !== 'baixa';
    this.redimensionar();
    this.salvar();
  }

  // ------------------------------------------------------------------ avisos do estado

  private aoAviso(a: AvisoEstado): void {
    const ui = this.ui;
    switch (a.tipo) {
      case 'arma': {
        const d = ARMAS[a.id];
        this.audio.tocar('itemObtido');
        ui?.mensagem(
          `Nova arma: ${d.nome} (${d.categoria}). ${d.descricao} Troque com 1–6 ou no botão Arma.`,
          5
        );
        this.jogador.sentir('feliz', 2.5);
        break;
      }
      case 'nivel': {
        const d = ARMAS[a.id];
        this.audio.tocar('comemoracao');
        ui?.mensagem(`${d.nome} subiu para o nível ${a.nivel}! ${d.niveis[a.nivel - 1]}.`, 4.5);
        this.jogador.sentir('determinado', 2);
        this.brilhos.explosao(this.jogador.x, this.jogador.y + 1, this.jogador.z, 40, {
          cor: d.brilho,
          tamanho: 0.3,
          vida: 1,
          velocidade: 5,
          gravidade: -2,
        });
        break;
      }
      case 'habilidade': {
        const nomes = { observar: 'OBSERVAR (Q)', conectar: 'CONECTAR (R)', criar: 'CRIAR (F)' };
        this.audio.tocar('restauracao');
        ui?.mensagem(`Nova habilidade: ${nomes[a.id]}!`, 4);
        break;
      }
      case 'missaoNova':
        this.audio.tocar('missaoNova');
        ui?.mensagem(`Nova missão: ${MISSOES[a.id]?.titulo ?? a.id}`, 3.5);
        break;
      case 'missaoConcluida':
        this.audio.tocar('missaoConcluida');
        ui?.mensagem(`Missão concluída: ${MISSOES[a.id]?.titulo ?? a.id}`, 3.5);
        this.jogador.sentir('feliz', 2.5);
        this.salvarLogo();
        break;
      case 'vidaMaxima':
        this.audio.tocar('coracaoObtido');
        break;
      case 'mensagem':
        ui?.mensagem(a.texto, 4);
        break;
      case 'humorClaude':
        this.jogador.sentir(a.humor, a.duracao);
        break;
      case 'humorNpc':
        this.npcs.find((n) => n.def.id === a.npc)?.definirHumor(a.humor, a.duracao);
        break;
      case 'afinidade':
        if (this.estadoJogo === 'jogando' && a.delta < 0) {
          // bater num amigo deixa o Claude envergonhado
          setTimeout(() => this.jogador.sentir('envergonhado', 2.5), 450);
        }
        break;
      case 'curar':
        this.brilhos.explosao(this.jogador.x, this.jogador.y + 0.8, this.jogador.z, 12, {
          cor: '#ff8fb0',
          tamanho: 0.22,
          vida: 0.7,
          velocidade: 2,
          gravidade: -2,
        });
        break;
      default:
        break;
    }
  }

  private aoDerrotar(
    id: string,
    x: number,
    y: number,
    z: number,
    xp: number,
    missao?: string
  ): void {
    this.estado.ganharXp(xp);
    if (missao) {
      this.removidos.add(id);
      this.estado.contadores[`derrotados_${missao}`] =
        this.estado.contador(`derrotados_${missao}`) + 1;
      if (missao === 'flores') {
        const n = this.estado.contador('derrotados_flores');
        this.ui?.mensagem(
          n >= 3
            ? 'As flores estão a salvo! Volte para a Dona Lumi.'
            : `Chiados espantados: ${n}/3`,
          3
        );
      }
      if (missao === 'vale') {
        this.ui?.mensagem('A Estática Grande se desfez em silêncio. Toque a Pedra das Ideias!', 4);
        this.audio.musica(dadosRegiao('vale').musica);
      }
      this.salvarLogo();
    }
    if (this.estado.vida < this.estado.vidaMaxima && Math.random() < 0.35)
      this.objetos.soltarCoracao(x, y, z);
    if (Math.random() < 0.5) this.jogador.sentir('feliz', 1.2);
  }

  // ------------------------------------------------------------------ ciclo de vida

  novoJogo(): void {
    apagarSalvamento();
    this.aplicarSalvamento(salvamentoVazio());
    this.estadoJogo = 'jogando';
    this.ui.titulo(false);
    this.audio.musica('jardim');
    this.jogador.sentir('sonolento', 3);
    this.iniciarDialogo('intro_1', null);
  }

  continuar(): void {
    const d = lerSalvamento();
    if (!d) return this.novoJogo();
    this.aplicarSalvamento(d);
    this.estadoJogo = 'jogando';
    this.audio.musica(dadosRegiao(this.regiaoAtual).musica);
    this.ui.mensagem('Bem-vindo de volta!', 2.5);
    this.jogador.sentir('feliz', 2);
  }

  renascer(): void {
    const p = PONTO_CHECKPOINT[this.checkpoint] ?? { x: INICIO.x, z: INICIO.z };
    this.estado.vida = this.estado.vidaMaxima;
    this.jogador.vivo = true;
    this.jogador.posicionar(
      p.x + 1.2,
      Math.max(0, this.fisica.alturaChao(p.x + 1.2, p.z, 10)),
      p.z + 1.2
    );
    this.jogador.invencivel = 2;
    for (const i of this.inimigos) if (!i.spawn.missao && !i.vivo) i.renascer();
    this.projeteis.limpar();
    this.estadoJogo = 'jogando';
    this.jogador.sentir('determinado', 2);
  }

  voltarAoTitulo(): void {
    this.salvar();
    this.estadoJogo = 'titulo';
    this.ui.titulo(!!lerSalvamento());
    this.audio.musica('titulo');
  }

  montarSalvamento(): DadosSalvos {
    const e = this.estado;
    const base = lerSalvamento() ?? salvamentoVazio();
    return {
      ...base,
      versao: 2,
      versaoConteudo: VERSAO_CONTEUDO,
      tempoJogo: this.tempoJogo,
      posicao: {
        x: this.jogador.pontoSeguro.x,
        y: this.jogador.pontoSeguro.y,
        z: this.jogador.pontoSeguro.z,
      },
      regiao: this.regiaoAtual,
      checkpoint: this.checkpoint,
      vida: Math.max(1, e.vida),
      vidaMaxima: e.vidaMaxima,
      inspiracao: this.jogador.inspiracao,
      armas: JSON.parse(JSON.stringify(e.armas)),
      armaAtual: e.armaAtual,
      habilidades: [...e.habilidades],
      flags: [...e.flags],
      contadores: { ...e.contadores },
      afinidade: { ...e.afinidade },
      missoesAtivas: [...e.missoesAtivas],
      missoesConcluidas: [...e.missoesConcluidas],
      removidos: [...this.removidos],
      configuracoes: {
        volumeGeral: this.audio.volume('geral'),
        volumeMusica: this.audio.volume('musica'),
        volumeEfeitos: this.audio.volume('efeitos'),
        tremor: this.tremorAtivo,
        qualidade: this.qualidade,
      },
    };
  }

  salvar(): void {
    if (this.estadoJogo === 'titulo') return;
    gravarSalvamento(this.montarSalvamento());
  }

  aplicarSalvamento(d: DadosSalvos): void {
    const e = this.estado;
    const aviso = e.aoAviso;
    e.aoAviso = () => {};
    e.flags = new Set(d.flags);
    e.contadores = { ...d.contadores };
    e.afinidade = { ...d.afinidade };
    e.armas = JSON.parse(JSON.stringify(d.armas));
    e.armaAtual = d.armaAtual;
    e.habilidades = new Set(d.habilidades);
    e.missoesAtivas = [...d.missoesAtivas];
    e.missoesConcluidas = new Set(d.missoesConcluidas);
    e.vidaMaxima = d.vidaMaxima;
    e.vida = Math.max(1, Math.min(d.vida, d.vidaMaxima));
    e.aoAviso = aviso;
    this.removidos = new Set(d.removidos);
    this.checkpoint = d.checkpoint in PONTO_CHECKPOINT ? d.checkpoint : 'pedra-jardim';
    this.objetos.definirCheckpoint(this.checkpoint);
    this.tempoJogo = d.tempoJogo;
    this.tremorAtivo = d.configuracoes.tremor;
    this.audio.definirVolume('geral', d.configuracoes.volumeGeral);
    this.audio.definirVolume('musica', d.configuracoes.volumeMusica);
    this.audio.definirVolume('efeitos', d.configuracoes.volumeEfeitos);
    // posição validada: nunca além da fronteira, no vazio ou dentro de parede
    const cp = PONTO_CHECKPOINT[this.checkpoint];
    const p = posicaoSegura(this.fisica, FRONTEIRA, alemDaFronteira, d.posicao, [cp, INICIO]);
    this.jogador.posicionar(p.x, p.y, p.z);
    this.jogador.inspiracao = d.inspiracao;
    this.jogador.vivo = true;
    // inimigos e objetos
    for (const i of this.inimigos) {
      if (this.removidos.has(i.id)) {
        i.vivo = false;
        i.estado = 'morto';
        i.modelo.raiz.visible = false;
      } else {
        i.renascer();
        if (
          e.temFlag('vale_furtivo') &&
          dadosRegiao('vale') &&
          regiaoEm(i.spawn.x, i.spawn.z) === 'vale'
        )
          i.adormecer();
      }
    }
    this.objetos.sincronizar();
    this.regiaoAtual = regiaoEm(p.x, p.z);
    this.aplicarCores(true);
  }

  // ------------------------------------------------------------------ diálogos

  iniciarConversa(npc: Npc): void {
    const conv = npc.def.conversas.find((c) => this.estado.avaliar(c.quando));
    if (!conv) return;
    this.falandoCom = npc;
    npc.conversar(true);
    this.jogador.angulo = Math.atan2(npc.x - this.jogador.x, npc.z - this.jogador.z);
    this.iniciarDialogo(conv.inicio, npc);
  }

  iniciarDialogo(id: string, npc: Npc | null): void {
    this.estadoJogo = 'dialogo';
    this.jogador.travado = true;
    this.falandoCom = npc;
    this.irPara(id);
  }

  private irPara(id: string | undefined): void {
    if (!id) return this.terminarDialogo();
    const no = DIALOGOS[id];
    if (!no) return this.terminarDialogo();
    this.noAtual = no;
    this.estado.aplicar(no.efeitos);
    const quem: Falante = no.quem ?? (this.falandoCom?.def.id as IdNpc) ?? 'narrador';
    const humor = no.humor ?? 'neutro';
    if (this.falandoCom && quem !== 'claude' && quem !== 'narrador') {
      this.falandoCom.definirHumor(humor, 6);
      this.falandoCom.falando = true;
    }
    if (no.efeitos?.some((e) => e.tipo === 'humorNpc')) {
      /* o efeito já ajustou o humor */
    }
    const opcoes = (no.opcoes ?? []).filter((o) => this.estado.avaliar(o.quando));
    this.ui.dialogo({ quem, nome: NOMES[quem], fala: no.fala, humor, opcoes });
    this.audio.tocar(quem === 'claude' ? 'falaClaude' : 'falaNpc', { voz: quem });
  }

  /** Avança (sem opções) ou escolhe a opção i. */
  escolher(i: number | null): void {
    if (this.estadoJogo !== 'dialogo') return;
    if (this.filaClaude) {
      const f = this.filaClaude;
      this.filaClaude = null;
      this.jogador.falando = false;
      f.depois();
      return;
    }
    const no = this.noAtual;
    if (!no) return this.terminarDialogo();
    const opcoes = (no.opcoes ?? []).filter((o) => this.estado.avaliar(o.quando));
    if (opcoes.length === 0) return this.irPara(no.proximo);
    if (i === null || !opcoes[i]) return;
    const op = opcoes[i];
    this.audio.tocar('uiConfirmar');
    if (this.falandoCom) this.falandoCom.falando = false;
    // o Claude fala a frase escolhida, com a emoção escolhida
    this.jogador.sentir(op.humor ?? 'neutro', 2.5);
    this.jogador.falando = true;
    this.filaClaude = {
      fala: op.texto,
      humor: op.humor ?? 'neutro',
      depois: () => {
        this.estado.aplicar(op.efeitos);
        this.irPara(op.proximo);
      },
    };
    this.ui.dialogo({
      quem: 'claude',
      nome: 'Claude',
      fala: op.texto,
      humor: op.humor ?? 'neutro',
      opcoes: [],
    });
    this.audio.tocar('falaClaude', { voz: 'claude' });
  }

  private terminarDialogo(): void {
    this.noAtual = null;
    this.ui.dialogo(null);
    if (this.falandoCom) {
      this.falandoCom.conversar(false);
      this.falandoCom.falando = false;
    }
    this.falandoCom = null;
    this.jogador.falando = false;
    this.jogador.travado = false;
    if (this.estadoJogo === 'dialogo') this.estadoJogo = 'jogando';
    // rota furtiva: os Ruídos do Vale adormecem
    if (this.estado.temFlag('vale_furtivo') && !this.estado.temFlag('vale_adormecido')) {
      this.estado.ligar('vale_adormecido');
      for (const i of this.inimigos) if (regiaoEm(i.spawn.x, i.spawn.z) === 'vale') i.adormecer();
    }
    this.salvarLogo();
  }

  // ------------------------------------------------------------------ missões

  /** Missão acompanhada e a etapa atual. */
  missaoAtual(): { missao: Missao; etapa: EtapaMissao; indice: number } | null {
    const e = this.estado;
    const ativas = e.missoesAtivas.map((id) => MISSOES[id]).filter(Boolean);
    ativas.sort((a, b) => Number(b.principal) - Number(a.principal));
    for (const m of ativas) {
      const idx = m.etapas.findIndex((s) => !e.avaliar(s.feita));
      if (idx >= 0) return { missao: m, etapa: m.etapas[idx], indice: idx };
    }
    return null;
  }

  posicaoAlvo(etapa: EtapaMissao): { x: number; z: number } | null {
    const a = etapa.alvo;
    if (!a) return null;
    if ('npc' in a) {
      const n = this.npcs.find((x) => x.def.id === a.npc);
      return n ? { x: n.x, z: n.z } : null;
    }
    if ('objeto' in a) return this.objetos.posicao(a.objeto);
    return a;
  }

  private verificarMissoes(): void {
    const e = this.estado;
    for (const id of [...e.missoesAtivas]) {
      const m = MISSOES[id];
      if (m?.autoConcluir && m.etapas.every((s) => e.avaliar(s.feita)))
        e.aplicar([{ tipo: 'concluirMissao', id }]);
    }
    const atual = this.missaoAtual();
    const chave = atual ? `${atual.missao.id}:${atual.indice}` : '';
    if (chave !== this.ultimaMissaoEtapa) {
      if (
        this.ultimaMissaoEtapa &&
        atual &&
        atual.indice > 0 &&
        this.ultimaMissaoEtapa.startsWith(atual.missao.id)
      ) {
        this.audio.tocar('enigmaResolvido', { volume: 0.6 });
        this.ui?.mensagem(`Objetivo: ${atual.etapa.texto}`, 3);
      }
      this.ultimaMissaoEtapa = chave;
    }
  }

  // ------------------------------------------------------------------ cena do farol

  private iniciarCenaFarol(): void {
    this.estadoJogo = 'cena';
    this.jogador.travado = true;
    this.cenaFarol = 0;
    this.audio.tocar('restauracao');
    this.audio.musica('vitoria');
    this.ui.mensagem('A chama nasceu!', 3);
    this.jogador.sentir('surpreso', 1.5);
  }

  private atualizarCenaFarol(dt: number): void {
    this.cenaFarol += dt;
    const t = this.cenaFarol;
    if (t > 0.6 && t < 0.7) {
      this.tremor = 0.5;
      this.brilhos.explosao(-4, 13.5, -104.2, 80, {
        cor: '#ffd27a',
        tamanho: 0.5,
        vida: 2,
        velocidade: 8,
        gravidade: -1,
      });
    }
    if (t > 1.5 && t < 1.6) this.jogador.sentir('feliz', 4);
    if (t > 5.5) {
      this.cenaFarol = -1;
      this.estadoJogo = 'jogando';
      this.jogador.travado = false;
      this.audio.musica('farol');
      this.ui.mensagem('O Farol das Ideias está aceso! Fale com Vela.', 4);
      this.salvar();
    }
  }

  // ------------------------------------------------------------------ cores do céu por região

  private aplicarCores(instantaneo = false, dt = 0): void {
    const r = dadosRegiao(this.regiaoAtual);
    let ceu = r.ceu;
    let nevoa = r.nevoa;
    if (this.estado.temFlag('farol_aceso') && r.id === 'vale') {
      ceu = ['#8fb0e8', '#f2c9b8'];
      nevoa = '#d9c4cf';
    }
    const k = instantaneo ? 1 : 1 - Math.exp(-1.5 * dt);
    this.corCeuA.lerp(new THREE.Color(ceu[0]), k);
    this.corCeuB.lerp(new THREE.Color(ceu[1]), k);
    this.corNevoa.lerp(new THREE.Color(nevoa), k);
    (this.cena.fog as THREE.Fog).color.copy(this.corNevoa);
    document.body.style.background = `linear-gradient(180deg, #${this.corCeuA.getHexString()} 0%, #${this.corCeuB.getHexString()} 62%, #${this.corNevoa.getHexString()} 100%)`;
    const vale = r.id === 'vale' && !this.estado.temFlag('farol_aceso');
    this.sol.color.lerp(
      new THREE.Color(vale ? '#e2d4ff' : r.id === 'farol' ? '#ffe2c0' : '#fff0d6'),
      k
    );
    this.sol.intensity = aproximar(this.sol.intensity, vale ? 1.8 : 2.4, 2, dt || 1);
  }

  // ------------------------------------------------------------------ passo de lógica

  passo(dt: number): void {
    this.entrada.iniciarPasso();
    this.tempo += dt;
    VENTO.tempo.value = this.tempo;
    VENTO.forca.value =
      0.5 + Math.sin(this.tempo * 0.13) * 0.25 + Math.max(0, Math.sin(this.tempo * 0.41)) * 0.35;

    const ent = this.entrada;
    const ui = this.ui;
    if (
      ent.apertou('pausa') &&
      (this.estadoJogo === 'jogando' || this.estadoJogo === 'pausado') &&
      !ui.menuAberto()
    ) {
      this.alternarPausa(this.estadoJogo === 'jogando');
    }

    switch (this.estadoJogo) {
      case 'titulo':
        this.tituloOrbita += dt * 0.08;
        break;
      case 'jogando':
        this.passoJogando(dt);
        break;
      case 'dialogo':
        if (ent.apertou('avancar') || ent.apertou('atacar')) {
          const no = this.noAtual;
          const temOpcoes =
            !this.filaClaude && no && (no.opcoes ?? []).some((o) => this.estado.avaliar(o.quando));
          if (!temOpcoes) this.escolher(null);
        }
        for (let k = 1; k <= 4; k++) if (ent.apertou(`arma${k}` as 'arma1')) this.escolher(k - 1);
        this.passoMundo(dt, true);
        break;
      case 'cena':
        this.atualizarCenaFarol(dt);
        this.passoMundo(dt, true);
        break;
      case 'pausado':
      case 'derrota':
        break;
    }
    ui.atualizar(dt);
    this.entrada.finalizarPasso();
  }

  alternarPausa(pausar: boolean): void {
    if (pausar && this.estadoJogo === 'jogando') {
      this.estadoJogo = 'pausado';
      this.ui.pausa(true);
      this.audio.tocar('uiAbrir');
      this.salvar();
    } else if (!pausar && this.estadoJogo === 'pausado') {
      this.estadoJogo = 'jogando';
      this.ui.pausa(false);
      this.audio.tocar('uiVoltar');
    }
  }

  private passoJogando(dt: number): void {
    const ent = this.entrada;
    const j = this.jogador;
    const e = this.estado;
    if (this.congelado > 0) {
      this.congelado -= dt;
      this.passoMundo(dt * 0.05, false);
      return;
    }
    this.tempoJogo += dt;

    // trocar de arma
    for (let k = 0; k < ORDEM_ARMAS.length; k++)
      if (ent.apertou(`arma${k + 1}` as 'arma1')) j.trocarArma(ORDEM_ARMAS[k]);
    if (ent.apertou('armaProxima')) this.proximaArma();
    if (ent.apertou('mapa')) this.ui.alternarMapa();

    // habilidades
    if (ent.apertou('observar')) this.usarHabilidade('observar');
    if (ent.apertou('conectar')) this.usarHabilidade('conectar');
    if (ent.apertou('criar')) this.usarHabilidade('criar');

    // interação: conversar com NPC ou usar objeto
    let melhor: Interacao | null = null;
    let menor = 2.5;
    for (const n of this.npcs) {
      const d = Math.hypot(n.x - j.x, n.z - j.z);
      if (d < menor && Math.abs(n.y - j.y) < 2) {
        menor = d;
        melhor = {
          texto: `Falar com ${n.def.nome}`,
          x: n.x,
          y: n.y + n.altura + 0.3,
          z: n.z,
          executar: () => this.iniciarConversa(n),
        };
      }
    }
    if (!melhor) melhor = this.objetos.interacaoProxima(j.x, j.y, j.z);
    this.interacao = melhor;
    if (melhor && ent.apertou('interagir')) {
      ent.consumir('interagir');
      melhor.executar();
    }

    this.passoMundo(dt, false);

    // queda de vida = derrota
    if (!j.vivo) {
      this.estadoJogo = 'derrota';
      this.audio.tocar('derrota');
      this.ui.derrota();
      return;
    }

    // região, música e cores
    this.regiaoTimer -= dt;
    if (this.regiaoTimer <= 0) {
      this.regiaoTimer = 0.4;
      const r = regiaoEm(j.x, j.z);
      if (r !== this.regiaoAtual) {
        this.regiaoAtual = r;
        const d = dadosRegiao(r);
        this.ui.regiao(d.nome);
        if (!this.chefeAtivo) this.audio.musica(d.musica as IdMusica);
        if (r === 'oficina') e.ligar('visitou_oficina');
      }
      this.verificarMissoes();
    }
    this.aplicarCores(false, dt);

    // fronteira: aviso ao se aproximar
    const df = Math.abs(j.z - FRONTEIRA.z);
    const perto = df < FRONTEIRA.raioAviso && Math.abs(j.x - FRONTEIRA.x) < FRONTEIRA.w / 2 + 3;
    if (perto !== this.avisoFronteira) {
      this.avisoFronteira = perto;
      this.ui.aviso(perto ? FRONTEIRA.mensagem : null);
      if (perto) {
        this.audio.tocar('fronteira');
        this.jogador.sentir('curioso', 2.5);
        if (!e.temFlag('viu_fronteira')) {
          e.ligar('viu_fronteira');
          this.salvarLogo();
        }
      }
    }

    // chefe: barra de vida e música
    const chefe = this.inimigos.find(
      (i) => i.ehChefe && i.vivo && i.estado !== 'dormindo' && Math.hypot(i.x - j.x, i.z - j.z) < 16
    );
    if (chefe !== (this.chefeAtivo ?? undefined)) {
      this.chefeAtivo = chefe ?? null;
      this.audio.musica(chefe ? 'chefe' : (dadosRegiao(this.regiaoAtual).musica as IdMusica));
    }
    this.audio.definirIntensidade(j.emCombate > 0 ? 0.8 : 0);

    // salvamento automático
    if (this.salvarEm > 0) {
      this.salvarEm -= dt;
      if (this.salvarEm <= 0) this.salvar();
    }
  }

  private passoMundo(dt: number, pausarIA: boolean): void {
    const j = this.jogador;
    j.atualizar(dt);
    const perigos = this.inimigos
      .filter((i) => i.vivo && i.estado !== 'dormindo')
      .map((i) => ({ x: i.x, z: i.z }));
    for (const n of this.npcs) n.atualizar(dt, perigos);
    if (!pausarIA) {
      for (const i of this.inimigos) i.atualizar(dt);
      this.projeteis.atualizar(dt);
    }
    this.objetos.atualizar(dt, j.x, j.y, j.z);
    this.audio.definirOuvinte(j.x, j.z);
    VENTO.jogador.value.set(j.x, j.y, j.z);
  }

  private proximaArma(): void {
    const tem = ORDEM_ARMAS.filter((a) => this.estado.armas[a]);
    if (tem.length < 2) return;
    const i = tem.indexOf(this.estado.armaAtual ?? tem[0]);
    this.jogador.trocarArma(tem[(i + 1) % tem.length]);
  }

  usarArma(id: (typeof ORDEM_ARMAS)[number]): void {
    this.jogador.trocarArma(id);
  }

  usarHabilidade(h: 'observar' | 'conectar' | 'criar'): void {
    const e = this.estado;
    const j = this.jogador;
    if (!e.habilidades.has(h)) {
      const dica = {
        observar: 'Dona Lumi pode te ensinar a observar.',
        conectar: 'Mestre Bento, na Oficina, ensina a conectar.',
        criar: 'A Pedra das Ideias, no Vale, ensina a criar.',
      };
      this.ui.mensagem(`Você ainda não sabe ${h.toUpperCase()}. ${dica[h]}`, 3);
      this.audio.tocar('conectarFalha', { volume: 0.5 });
      return;
    }
    const custo = { observar: 15, conectar: 10, criar: 30 }[h];
    if (j.inspiracao < custo) {
      this.ui.mensagem('Inspiração insuficiente. Ela volta com o tempo.', 2);
      this.audio.tocar('conectarFalha', { volume: 0.5 });
      return;
    }
    let ok = true;
    if (h === 'observar') this.objetos.observar(j.x, j.y, j.z);
    if (h === 'conectar') this.objetos.conectar(j.x, j.y, j.z);
    if (h === 'criar') ok = this.objetos.criar(j.x, j.y, j.z, j.angulo);
    if (ok) j.inspiracao -= custo;
  }

  // ------------------------------------------------------------------ desenho

  desenhar(dt: number): void {
    const j = this.jogador;
    const aspecto = this.camera.aspect;
    const retrato = aspecto < 1 ? 1 + (1 - aspecto) * 0.9 : 1;
    if (this.estadoJogo === 'titulo') {
      const a = this.tituloOrbita;
      this.camera.position.set(Math.sin(a) * 26, 16, 6 + Math.cos(a) * 26);
      this.camera.lookAt(4, 0, 0);
      this.marcador.visible = false;
    } else {
      const dialogo = this.estadoJogo === 'dialogo' && this.falandoCom;
      const alvoZoom = dialogo ? 0.62 : this.estadoJogo === 'cena' ? 1.5 : 1;
      this.zoom = aproximar(this.zoom, alvoZoom, 3, dt);
      let ax = j.x + j.vx * 0.28;
      let az = j.z + j.vz * 0.28;
      let ay = j.y;
      if (dialogo && this.falandoCom) {
        ax = (j.x + this.falandoCom.x) / 2;
        az = (j.z + this.falandoCom.z) / 2;
      }
      if (this.estadoJogo === 'cena') {
        ax = -4;
        az = -100;
        ay = 4;
      }
      const k = 1 - Math.exp(-5 * dt);
      this.alvoCamera.x += (ax - this.alvoCamera.x) * k;
      this.alvoCamera.z += (az - this.alvoCamera.z) * k;
      this.alvoCamera.y += (ay - this.alvoCamera.y) * (1 - Math.exp(-3 * dt));
      const dist = this.zoom * retrato;
      this.camPos.set(
        this.alvoCamera.x,
        this.alvoCamera.y + 11 * dist,
        this.alvoCamera.z + 9.6 * dist
      );
      this.camera.position.copy(this.camPos);
      if (this.tremor > 0) {
        this.camera.position.x += (Math.random() - 0.5) * this.tremor * 0.6;
        this.camera.position.y += (Math.random() - 0.5) * this.tremor * 0.6;
        this.tremor = Math.max(0, this.tremor - dt * 2.2);
      }
      this.camera.lookAt(this.alvoCamera.x, this.alvoCamera.y + 0.6, this.alvoCamera.z - 0.5);
      this.camera.updateMatrixWorld();
      VENTO.foco.value.copy(this.alvoCamera);
      {
        const tam = this.renderizador.getDrawingBufferSize(new THREE.Vector2());
        const p = new THREE.Vector3(this.alvoCamera.x, this.alvoCamera.y + 0.7, this.alvoCamera.z);
        const prof = p.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
        p.project(this.camera);
        VENTO.focoTela.value.set(((p.x + 1) / 2) * tam.x, ((p.y + 1) / 2) * tam.y, -prof);
        VENTO.alturaTela.value = tam.y;
      }

      // marcador do objetivo
      const m = this.missaoAtual();
      const pos = m ? this.posicaoAlvo(m.etapa) : null;
      if (pos && this.estadoJogo === 'jogando' && Math.hypot(pos.x - j.x, pos.z - j.z) > 3) {
        this.marcador.visible = true;
        const y = Math.max(0, this.fisica.alturaChao(pos.x, pos.z, 20));
        this.marcador.position.set(pos.x, y + 3.2 + Math.sin(this.tempo * 3) * 0.25, pos.z);
        this.marcador.rotation.y = this.tempo * 2;
      } else this.marcador.visible = false;
    }
    // sol segue a câmera para as sombras ficarem nítidas perto do Claude
    const fx = this.estadoJogo === 'titulo' ? 4 : this.alvoCamera.x;
    const fz = this.estadoJogo === 'titulo' ? 0 : this.alvoCamera.z;
    this.sol.position.set(fx + 14, 28, fz + 12);
    this.sol.target.position.set(fx, 0, fz);
    this.cenario.atualizar(dt, this.tempo, (f) => this.estado.temFlag(f));
    this.poeira.atualizar(dt, this.tempo);
    this.brilhos.atualizar(dt, this.tempo);
    this.pegadas.atualizar(dt);
    // folhas levadas pelo vento
    if (Math.random() < dt * 6 && this.estadoJogo !== 'titulo') {
      const d = VENTO.direcao.value;
      this.poeira.emitir({
        x: j.x - d.x * 14 + (Math.random() - 0.5) * 20,
        y: j.y + 2 + Math.random() * 4,
        z: j.z - d.y * 14 + (Math.random() - 0.5) * 16,
        vx: d.x * 4 * VENTO.forca.value * 2,
        vz: d.y * 4 * VENTO.forca.value * 2,
        vy: -0.4,
        vida: 4,
        tamanho: 0.14,
        cor: escolher(
          this.regiaoAtual === 'vale' ? ['#9a86c9', '#7f9f78'] : ['#7fd06a', '#ffd27a', '#ff9fb8']
        ),
        arrasto: 0.1,
        ondular: 2,
      });
    }
    this.renderizador.render(this.cena, this.camera);
  }
}
