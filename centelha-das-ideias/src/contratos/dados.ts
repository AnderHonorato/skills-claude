/**
 * Formatos de dados do mundo: regiões, entidades posicionadas, missões, diálogos, armas.
 *
 * Coordenadas em especificações de entidades usam BLOCOS LOCAIS da região.
 * Um ponto (x, y) inteiro representa o CENTRO do bloco; frações são permitidas.
 * Áreas (largura/altura) começam no canto superior esquerdo do bloco (x, y).
 */
import type {
  Acao,
  Condicao,
  EspecieInimigo,
  IdArma,
  IdHabilidade,
  IdNpc,
  IdRegiao,
  IdTema,
  Recompensa,
  Retangulo,
  Vetor,
} from './base';

export type SimboloRuna = 'circulo' | 'triangulo' | 'espiral' | 'quadrado' | 'estrela';

export type EspecEntidade =
  // ----- personagens -----
  | { tipo: 'npc'; id: IdNpc; x: number; y: number; rotina?: PontoRotina[]; olhando?: Vetor }
  | {
      tipo: 'inimigo';
      especie: EspecieInimigo;
      x: number;
      y: number;
      id?: string;
      /** Inimigos com o mesmo grupo formam um encontro; derrotar todos liga a flag `grupo:<grupo>`. */
      grupo?: string;
      /** Raio da área de patrulha em blocos (padrão 4). */
      raioArea?: number;
      patrulha?: Vetor[];
      /** Não reaparece depois de derrotado (padrão: reaparece ao carregar o jogo). */
      permanente?: boolean;
    }
  | { tipo: 'chefe'; id: 'rumor'; x: number; y: number; arena: Retangulo }
  // ----- energia e mecanismos (Conectar) -----
  | { tipo: 'fonte'; id: string; x: number; y: number; ligada?: boolean; enigma?: string }
  | {
      tipo: 'receptor';
      id: string;
      x: number;
      y: number;
      /** Ids de mecanismos ativados enquanto o receptor estiver energizado. */
      alvos: string[];
      enigma?: string;
    }
  | { tipo: 'prisma'; id: string; x: number; y: number; oculto?: boolean; enigma?: string }
  | {
      tipo: 'porta';
      id: string;
      x: number;
      y: number;
      /** 'h' bloqueia passagem norte-sul (porta deitada); 'v' bloqueia leste-oeste. */
      orientacao: 'h' | 'v';
      /** Tamanho em blocos ao longo da orientação (padrão 2). */
      tamanho?: number;
      /** Se a flag existir, a porta já começa aberta. */
      flagAbre?: string;
    }
  | {
      tipo: 'ponteRetratil';
      id: string;
      x: number;
      y: number;
      largura: number;
      altura: number;
      flagAbre?: string;
    }
  | {
      tipo: 'plataformaMovel';
      id: string;
      x: number;
      y: number;
      ate: Vetor;
      /** Blocos de largura/altura da plataforma (padrão 2x2). */
      largura?: number;
      altura?: number;
      /** Segundos para ir de um ponto ao outro (padrão 3). */
      duracao?: number;
    }
  | { tipo: 'placaPressao'; id: string; x: number; y: number; alvos: string[]; enigma?: string }
  | { tipo: 'caixa'; id: string; x: number; y: number; enigma?: string; comPrisma?: boolean }
  | { tipo: 'ancora'; id: string; x: number; y: number; par: string }
  | { tipo: 'runa'; id: string; x: number; y: number; simbolo: SimboloRuna; enigma: string }
  | { tipo: 'alavanca'; id: string; x: number; y: number; alvos: string[] }
  | { tipo: 'lampada'; id: string; x: number; y: number }
  | { tipo: 'engrenagem'; id: string; x: number; y: number; raio?: number }
  | {
      tipo: 'pisoOculto';
      id: string;
      x: number;
      y: number;
      largura: number;
      altura: number;
      /** Se verdadeiro, fica sólido para sempre após a primeira revelação. */
      fixarAoRevelar?: boolean;
    }
  | { tipo: 'cristal'; id: string; x: number; y: number; alvos: string[] }
  /**
   * Pista oculta revelada por Observar (pegadas, símbolos, setas). Ao ser revelada liga a flag
   * `pista:<id>`. Use várias em sequência para trilhas de investigação.
   */
  | {
      tipo: 'pista';
      id: string;
      x: number;
      y: number;
      modelo: 'pegada' | 'simbolo' | 'seta' | 'mancha';
      /** Rotação em graus (pegadas e setas). */
      angulo?: number;
      simbolo?: SimboloRuna;
    }
  // ----- progressão -----
  | {
      tipo: 'bau';
      id: string;
      x: number;
      y: number;
      conteudo: Recompensa;
      texto?: string;
      oculto?: boolean;
    }
  | { tipo: 'pedraMemoria'; id: string; x: number; y: number }
  | {
      tipo: 'coletavel';
      id: string;
      x: number;
      y: number;
      item: 'faisca' | 'coracao' | 'centelha' | 'caldo';
      oculto?: boolean;
    }
  | {
      tipo: 'gaiola';
      id: string;
      x: number;
      y: number;
      prisioneiro: IdNpc;
      /** Flag ligada quando a gaiola é aberta. */
      flag: string;
      /** Grupo de inimigos que precisa ser derrotado antes de abrir (opcional). */
      grupoGuardiao?: string;
    }
  | { tipo: 'arma'; id: string; x: number; y: number; arma: IdArma }
  | { tipo: 'santuario'; id: string; x: number; y: number; habilidade: IdHabilidade }
  // ----- roteiro -----
  | {
      tipo: 'gatilho';
      id: string;
      x: number;
      y: number;
      largura: number;
      altura: number;
      aoEntrar: Acao[];
      se?: Condicao;
      /** Padrão: true (dispara uma vez por salvamento, registrado como flag `gatilho:<id>`). */
      umaVez?: boolean;
    }
  | {
      tipo: 'zonaEnigma';
      id: string;
      x: number;
      y: number;
      largura: number;
      altura: number;
      regra: RegraEnigma;
      /** Ações executadas ao resolver. O sistema também liga a flag `enigma:<id>`. */
      aoResolver: Acao[];
      /** Dicas graduais (curtas) mostradas após tentativas ou tempo. */
      dicas: string[];
      /** Pedra de Rascunho (reinicia as peças do enigma) em blocos locais; padrão: canto da zona. */
      reinicio?: Vetor;
    }
  | { tipo: 'decoracao'; modelo: string; x: number; y: number; solido?: boolean; escala?: number }
  | { tipo: 'placa'; id: string; x: number; y: number; texto: string }
  | { tipo: 'luz'; x: number; y: number; raio: number; cor: string; intensidade?: number };

export type RegraEnigma =
  /** Receptores listados precisam estar energizados ao mesmo tempo. */
  | { tipo: 'energia'; receptores: string[] }
  /** Runas atingidas/ativadas na ordem dada; erro reinicia a sequência. */
  | { tipo: 'sequencia'; ordem: string[] }
  /** Todas as placas pressionadas ao mesmo tempo. */
  | { tipo: 'placas'; placas: string[] }
  /** Liga quando a flag indicada ficar verdadeira (enigmas compostos). */
  | { tipo: 'flag'; flag: string };

export interface PontoRotina {
  x: number;
  y: number;
  /** Segundos parado neste ponto. */
  espera?: number;
  /** Animação durante a espera (ex.: 'regar', 'martelar', 'mexer'). */
  atividade?: string;
  /** Fala curta (balão sem bloquear) ao chegar. */
  latido?: string;
}

export interface DefinicaoRegiao {
  id: IdRegiao;
  nome: string;
  tema: IdTema;
  /** Posição do canto superior esquerdo da região no mundo, em blocos. */
  origem: Vetor;
  /**
   * Mapa ASCII (todas as linhas com o mesmo comprimento). Legenda em src/mundo/tiles.ts.
   * Blocos fora de qualquer região são vazio.
   */
  mapa: string[];
  entidades: EspecEntidade[];
  musica: string;
  /** Ponto de chegada padrão (blocos locais). */
  entrada: Vetor;
  /** Texto curto para o mapa completo. */
  descricao: string;
  /** Se a região começa tomada pelo Ruído (restaurada pela flag `restaurada:<id>`). */
  comRuido?: boolean;
}

export interface DefinicaoFronteira {
  id: string;
  /** Região que existirá depois desta parede (planejada). */
  regiaoFutura: IdRegiao;
  nomeRegiaoFutura: string;
  /** Área da parede em BLOCOS DO MUNDO (não locais). */
  area: Retangulo;
  mensagem: string;
  /** Distância em blocos para mostrar o aviso. */
  raioAviso: number;
}

export interface DefinicaoMundo {
  /** Incrementa a cada atualização de conteúdo. */
  versaoConteudo: number;
  regiaoInicial: IdRegiao;
  regioes: DefinicaoRegiao[];
  /** Limite atual do conteúdo disponível (única fonte de verdade da parede). */
  fronteira: DefinicaoFronteira;
  /** Posições antigas da fronteira, para migração segura de salvamentos. */
  fronteirasAnteriores: DefinicaoFronteira[];
}

// ----------------------------------------------------------------------------
// Missões
// ----------------------------------------------------------------------------

export type TipoMissao = 'exploracao' | 'resgate' | 'combate' | 'investigacao' | 'enigma';

export interface EtapaMissao {
  id: string;
  /** Texto curto do objetivo (aparece no rastreador). */
  texto: string;
  /** A etapa conclui quando esta condição for verdadeira. */
  concluiQuando: Condicao;
  /** Id de entidade usada como marcador no mapa/minimapa (opcional). */
  marcador?: string;
}

export interface DefinicaoMissao {
  id: string;
  titulo: string;
  regiao: IdRegiao;
  tipo: TipoMissao;
  principal: boolean;
  descricao: string;
  /** A missão aparece quando esta condição for verdadeira. */
  iniciaQuando: Condicao;
  etapas: EtapaMissao[];
  recompensa?: Recompensa;
  /** Ações ao concluir (além da recompensa). */
  aoConcluir?: Acao[];
}

// ----------------------------------------------------------------------------
// Diálogos
// ----------------------------------------------------------------------------

export interface Fala {
  /** 'claude' ou id de NPC. */
  quem: string;
  texto: string;
  /** A fala só aparece se a condição for verdadeira. */
  se?: Condicao;
  escolhas?: EscolhaDialogo[];
  /** Ações executadas quando a fala aparece. */
  acoes?: Acao[];
}

export interface EscolhaDialogo {
  texto: string;
  /** Falas mostradas em seguida a esta escolha. */
  falas?: Fala[];
  acoes?: Acao[];
}

export interface DefinicaoDialogo {
  id: string;
  falas: Fala[];
  /** Ações ao terminar (também executadas se o jogador pular). */
  aoTerminar?: Acao[];
}

export interface DefinicaoNpc {
  id: IdNpc;
  nome: string;
  /** Aparência (desenhada em src/arte/personagens.ts). */
  especie: 'tartaruga' | 'faisca' | 'lontra' | 'panela' | 'vagalume' | 'ecoAmigo' | string;
  personalidade: string;
  /** Primeiro diálogo cuja condição for verdadeira é usado ao conversar. */
  dialogos: { se?: Condicao; dialogo: string }[];
  /** Latidos ambientes (balões curtos) escolhidos aleatoriamente. */
  latidos?: { se?: Condicao; textos: string[] }[];
  /** Cor de destaque do balão e do nome. */
  cor: string;
}

// ----------------------------------------------------------------------------
// Armas e inimigos (definições numéricas)
// ----------------------------------------------------------------------------

export interface DefinicaoArma {
  id: IdArma;
  nome: string;
  descricao: string;
  /** Segundos de um golpe completo. */
  duracao: number;
  /** Fração [inicio, fim] do golpe em que o acerto está ativo. */
  janelaAtiva: [number, number];
  dano: number;
  /** Alcance em px a partir do centro de Claude. */
  alcance: number;
  /** Abertura do arco em graus (360 = círculo). */
  arco: number;
  empurrao: number;
  quebraEscudo: boolean;
  /** Golpes encadeados possíveis. */
  combo: number;
  projetil?: { velocidade: number; alcance: number };
}

// ----------------------------------------------------------------------------
// Cenas (puláveis)
// ----------------------------------------------------------------------------

export type PassoCena =
  /** Leva a câmera até a entidade (id) em `duracao` segundos. */
  | { tipo: 'camera'; alvo: string; duracao: number }
  /** Volta a câmera ao jogador. */
  | { tipo: 'cameraJogador'; duracao: number }
  | { tipo: 'esperar'; duracao: number }
  /** Balão sobre a entidade (ou 'claude'); some após `duracao` ou ao avançar. */
  | { tipo: 'fala'; quem: string; texto: string; duracao?: number }
  | { tipo: 'acoes'; acoes: Acao[] }
  | { tipo: 'tremor'; intensidade: number; duracao: number };

export interface DefinicaoCena {
  id: string;
  passos: PassoCena[];
  /** Executadas ao terminar ou ao pular (garantem o estado final). */
  aoTerminar?: Acao[];
}
