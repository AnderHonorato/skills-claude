/**
 * Modelos de visualização entregues às funções de desenho procedural.
 * As funções de arte NUNCA alteram estado de jogo: recebem um "visual" e desenham.
 *
 * Convenção: o contexto já está em coordenadas do mundo (px). `x`/`ySolo` é o ponto do
 * chão sob os pés JÁ descontada a altura da plataforma (ou seja, y visual do chão). O
 * corpo deve ser desenhado deslocado por `-z`. A sombra de contato é desenhada pelo motor.
 */
import type {
  Direcao8,
  EspecieInimigo,
  EstadoAnimClaude,
  Humor,
  IdArma,
  IdRegiao,
  IdTema,
} from './base';
import type { SimboloRuna } from './dados';

export interface VisualClaude {
  x: number;
  ySolo: number;
  z: number;
  direcao: Direcao8;
  estado: EstadoAnimClaude;
  /** Segundos desde que o estado atual começou. */
  tempoEstado: number;
  /** Fase contínua do ciclo de passos (0..1, cresce com a distância percorrida). */
  fasePasso: number;
  /** Velocidade horizontal normalizada (0 parado .. 1 correndo). */
  velocidade: number;
  /** Velocidade vertical (px/s, positiva subindo) — útil para pose de pulo/queda. */
  vz: number;
  humor: Humor;
  humorAnterior: Humor;
  /** 0 = humorAnterior, 1 = humor atual (transição suave). */
  misturaHumor: number;
  /** 0 = olhos abertos, 1 = fechados (piscar). */
  palpebra: number;
  arma: IdArma | null;
  ataque: { progresso: number; combo: number; angulo: number } | null;
  /** Habilidade em uso (pose de lançar). */
  habilidade: 'observar' | 'conectar' | 'criar' | null;
  /** Pisca durante invulnerabilidade. */
  invulneravel: boolean;
  /** Escala geral (queda no vão encolhe). */
  escala: number;
  alpha: number;
  /** Tempo global em segundos (respiração, brilho). */
  tempo: number;
  /** Direção do olhar (-1..1) para olhos seguirem algo interessante. */
  olhar: { x: number; y: number };
  /** Determinação ativa (efeito sutil). */
  determinado: boolean;
}

export type EstadoNpc =
  'parado' | 'andando' | 'falando' | 'trabalhando' | 'comemorando' | 'preso' | 'triste';

export interface VisualNpc {
  especie: string;
  /** Id do NPC (variações de cor/acessórios por indivíduo). */
  id: string;
  x: number;
  ySolo: number;
  z: number;
  direcao: Direcao8;
  estado: EstadoNpc;
  /** Atividade da rotina ('regar', 'martelar', 'mexer'...). */
  atividade: string | null;
  tempoEstado: number;
  fasePasso: number;
  tempo: number;
  falando: boolean;
}

export type EstadoInimigo =
  | 'patrulha'
  | 'alerta'
  | 'perseguindo'
  | 'telegrafando'
  | 'atacando'
  | 'recuperando'
  | 'fugindo'
  | 'atordoado'
  | 'amarrado'
  | 'ferido'
  | 'derrotado'
  | 'retornando';

export interface VisualInimigo {
  especie: EspecieInimigo;
  x: number;
  ySolo: number;
  z: number;
  /** Ângulo para onde olha (radianos, 0 = leste, PI/2 = sul). */
  angulo: number;
  estado: EstadoInimigo;
  /** Progresso 0..1 dentro do estado atual (telegrafia usa para crescer o aviso). */
  progresso: number;
  tempoEstado: number;
  tempo: number;
  /** Ponto fraco visível (Observar). */
  revelado: boolean;
  escudo: boolean;
  vida: number;
  vidaMaxima: number;
  /** 0..1 piscar branco após levar dano. */
  flashDano: number;
  /** Mundo restaurado: inimigos ficam menos saturados/mais calmos (opcional). */
  restaurado: boolean;
}

export interface VisualChefe {
  fase: 1 | 2 | 3;
  x: number;
  ySolo: number;
  z: number;
  estado:
    | 'surgindo'
    | 'ocioso'
    | 'rajada'
    | 'onda'
    | 'invocando'
    | 'recuando'
    | 'exposto'
    | 'atordoado'
    | 'derrotado';
  progresso: number;
  tempo: number;
  escudo: boolean;
  nucleoExposto: boolean;
  revelado: boolean;
  vida: number;
  vidaMaxima: number;
  flashDano: number;
}

export type TipoMecanismo =
  | 'fonte'
  | 'receptor'
  | 'prisma'
  | 'porta'
  | 'ponteRetratil'
  | 'plataformaMovel'
  | 'placaPressao'
  | 'caixa'
  | 'ancora'
  | 'runa'
  | 'alavanca'
  | 'lampada'
  | 'engrenagem'
  | 'pisoOculto'
  | 'cristal'
  | 'bau'
  | 'pedraMemoria'
  | 'gaiola'
  | 'santuario'
  | 'placa'
  | 'coletavel';

export interface VisualMecanismo {
  tipo: TipoMecanismo;
  x: number;
  ySolo: number;
  /** Ativo (porta aberta, placa pressionada, baú aberto, alavanca puxada...). */
  ativo: boolean;
  /** Recebendo energia. */
  energizado: boolean;
  /** Visível por Observar (para ocultos) — 0..1 para fade. */
  revelacao: number;
  oculto: boolean;
  /** Progresso de animação 0..1 (abertura, deslocamento). */
  progresso: number;
  tempo: number;
  tema: IdTema;
  /** Em blocos (portas, pontes, pisos). */
  largura?: number;
  altura?: number;
  orientacao?: 'h' | 'v';
  simbolo?: SimboloRuna;
  /** Destaque de seleção (alvo de Conectar/Interagir). */
  destacado: boolean;
  /** Variante livre (ex.: habilidade do santuário, conteúdo do baú). */
  variante?: string;
}

/** Leitura do mapa para o pintor de cenário (somente consulta). */
export interface ConsultaMapa {
  /** Tamanho do mundo em blocos. */
  largura: number;
  altura: number;
  tamanhoBloco: number;
  /** Código ASCII do bloco (ver src/mundo/tiles.ts). Fora do mundo: ' '. */
  bloco(tx: number, ty: number): string;
  tema(tx: number, ty: number): IdTema;
  regiao(tx: number, ty: number): IdRegiao | null;
  alturaChao(tx: number, ty: number): number;
  /** Região restaurada (sem Ruído). */
  restaurada(regiao: IdRegiao | null): boolean;
  /** Hash estável 0..1 por bloco, para variações determinísticas. */
  semente(tx: number, ty: number, canal?: number): number;
}

export interface Luz {
  x: number;
  y: number;
  raio: number;
  cor: string;
  intensidade: number;
}

export interface CameraVisao {
  x: number;
  y: number;
  /** Largura/altura visíveis em px do mundo. */
  largura: number;
  altura: number;
  /** px de tela (CSS) por px do mundo. */
  zoom: number;
}

/**
 * Catálogo fixo de decorações (`tipo: 'decoracao'`, campo `modelo`).
 * Arte de Cenário desenha todos; Conteúdo só usa estes. Novos modelos passam pelo orquestrador.
 * Entre parênteses: tamanho aproximado da base em blocos.
 */
export const MODELOS_DECORACAO = [
  // gerais
  'arbusto', // (1) moita redonda
  'flores', // (1) tufo de flores
  'florPergunta', // (1) flor em forma de ponto de interrogação (Jardim)
  'cogumelos', // (1)
  'toco', // (1) tronco cortado
  'pedrinhas', // (1)
  'pedraGrande', // (1) pedra média sólida
  'tronco', // (2x1) tronco caído
  'lampiao', // (1) poste com luz quente
  'placaMadeira', // (1) placa sem texto (decorativa)
  'banco', // (2x1)
  'bandeirinhas', // (3x1) varal de bandeirinhas
  'regador', // (1)
  'canteiro', // (2x1) canteiro com mudas
  // Oficina
  'engrenagemGrande', // (2) engrenagem decorativa girando
  'caixote', // (1)
  'barril', // (1)
  'bancada', // (2x1) bancada de trabalho com ferramentas
  'cano', // (1) cano de cobre vertical
  'bobina', // (1) bobina de cobre com faíscas
  'prateleira', // (2x1)
  'carretel', // (1)
  'fogao', // (2x1) fogão de Seu Caldo (apagado/aceso via ativo:<id> não se aplica; decorativo)
  'panelas', // (1)
  // Vale
  'cristalRuido', // (1) cristal violeta com glitch (some quando restaurado)
  'ruina', // (2x1) muro baixo em ruínas
  'pilarQuebrado', // (1)
  'pastoSeco', // (1)
  'estatuaAntiga', // (1)
  'tendaLume', // (2) tenda do esquadrão de vagalumes
  'antenaRuido', // (1) antena emitindo estática
  // Farol
  'farolTorre', // (3x3) torre do Farol (sólida, alta)
  'boia', // (1)
  'rede', // (2x1) rede de pesca
  'ancoraNavio', // (1)
  'conchas', // (1)
  'corda', // (1) rolo de corda
  // Construção (perto da fronteira)
  'andaime', // (2x1)
  'blocoRascunho', // (1) bloco em linhas de esboço
  'placaObra', // (1) placa "em construção" desenhada (sem texto)
] as const;

export type ModeloDecoracao = (typeof MODELOS_DECORACAO)[number];
