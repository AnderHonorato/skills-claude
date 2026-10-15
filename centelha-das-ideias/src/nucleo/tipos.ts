/**
 * Tipos compartilhados do jogo (lógica pura, sem dependência de renderização).
 * Coordenadas do mundo em metros: x = leste, z = sul, y = altura.
 */

export type IdRegiao = 'jardim' | 'oficina' | 'vale' | 'farol' | 'sonhos';
export type IdArma = 'galho' | 'espada' | 'martelo' | 'colher' | 'cajado' | 'escudo';
export type IdHabilidade = 'observar' | 'conectar' | 'criar';
export type IdNpc = 'lumi' | 'pipo' | 'bento' | 'eco' | 'vela';
export type Falante = IdNpc | 'claude' | 'narrador';

/** Emoções do Claude (e dos NPCs), com gatilhos reais no jogo. */
export type Humor =
  | 'neutro'
  | 'feliz'
  | 'triste'
  | 'raiva'
  | 'surpreso'
  | 'medo'
  | 'curioso'
  | 'determinado'
  | 'envergonhado'
  | 'sonolento'
  | 'carinho'
  | 'dor';

export interface Ponto {
  x: number;
  z: number;
}

/** Condição avaliada sobre o estado do jogo. Todos os campos presentes precisam valer. */
export interface Condicao {
  flag?: string;
  semFlag?: string;
  /** [npc, mínimo] */
  afinidadeMin?: [IdNpc, number];
  afinidadeMax?: [IdNpc, number];
  temArma?: IdArma;
  semArma?: IdArma;
  temHabilidade?: IdHabilidade;
  missaoAtiva?: string;
  missaoConcluida?: string;
  contador?: [string, number];
  algum?: Condicao[];
}

export type Efeito =
  | { tipo: 'flag'; flag: string; valor?: boolean }
  | { tipo: 'contador'; nome: string; delta: number }
  | { tipo: 'afinidade'; npc: IdNpc; delta: number }
  | { tipo: 'iniciarMissao'; id: string }
  | { tipo: 'concluirMissao'; id: string }
  | { tipo: 'arma'; id: IdArma }
  | { tipo: 'habilidade'; id: IdHabilidade }
  | { tipo: 'vidaMaxima'; delta: number }
  | { tipo: 'curar'; quantidade: number }
  | { tipo: 'xp'; quantidade: number }
  | { tipo: 'humorClaude'; humor: Humor; duracao?: number }
  | { tipo: 'humorNpc'; npc: IdNpc; humor: Humor; duracao?: number }
  | { tipo: 'seguir'; npc: IdNpc; ativo: boolean }
  | { tipo: 'mensagem'; texto: string };

/** Formas sólidas do mundo (eixos alinhados). */
export interface Solido {
  id?: string;
  forma: 'caixa' | 'cilindro';
  x: number;
  z: number;
  /** Largura (x) e profundidade (z) da caixa. */
  w?: number;
  d?: number;
  /** Raio do cilindro. */
  r?: number;
  base: number;
  topo: number;
  tipo:
    | 'ilha'
    | 'ponte'
    | 'plataforma'
    | 'muro'
    | 'rocha'
    | 'arvore'
    | 'predio'
    | 'porta'
    | 'fronteira'
    | 'pedra'
    | 'farol'
    | 'cerca';
  regiao?: IdRegiao;
  /** Só existe se a flag estiver ligada (ex.: ponte de luz criada). */
  seFlag?: string;
  /** Deixa de existir quando a flag liga (ex.: porta aberta). */
  semFlag?: string;
  /** Visual específico (cores/variação). */
  visual?: string;
}

/** Rampa: altura varia linearmente ao longo de um eixo, de `de` (lado menor) até `ate`. */
export interface Rampa {
  x: number;
  z: number;
  w: number;
  d: number;
  eixo: 'x' | 'z';
  de: number;
  ate: number;
}

export interface Regiao {
  id: IdRegiao;
  nome: string;
  centro: Ponto;
  raio: number;
  musica: 'jardim' | 'oficina' | 'vale' | 'farol' | 'construcao';
  /** Tons do céu e da névoa. */
  ceu: [string, string];
  nevoa: string;
  grama: [string, string];
}

/** A fronteira de conteúdo: definida em um só lugar e movida a cada expansão. */
export interface Fronteira {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  mensagem: string;
  raioAviso: number;
  /** Para onde levar quem tinha salvo além desta fronteira. */
  retorno: Ponto;
}

export type TipoInimigo = 'chiado' | 'zumbido' | 'estatica';

export interface SpawnInimigo {
  id: string;
  tipo: TipoInimigo;
  x: number;
  z: number;
  /** Faz parte de uma missão: não renasce depois de derrotado. */
  missao?: string;
  /** Inimigo que só aparece com a flag. */
  seFlag?: string;
  dormindo?: boolean;
}

export type TipoObjeto =
  | 'faisca'
  | 'bau'
  | 'pedraMemoria'
  | 'no'
  | 'soquete'
  | 'oculta'
  | 'armaChao'
  | 'pipa'
  | 'placa'
  | 'santuario'
  | 'flor'
  | 'coracao'
  | 'mecanismoFarol';

export interface ObjetoMundo {
  id: string;
  tipo: TipoObjeto;
  x: number;
  z: number;
  y?: number;
  regiao: IdRegiao;
  /** Dados extras por tipo (arma do chão, texto da placa, conteúdo do baú...). */
  arma?: IdArma;
  texto?: string;
  conteudo?: Efeito[];
  /** Plataforma oculta: tamanho e altura do topo. */
  w?: number;
  d?: number;
  topo?: number;
  /** Só aparece com essa flag (ou só sem ela). */
  seFlag?: string;
  semFlag?: string;
}

export interface Arbusto {
  x: number;
  z: number;
  r: number;
}

export interface PassoRotina {
  x: number;
  z: number;
  espera: number;
  acao?: 'regar' | 'martelar' | 'olhar' | 'polir' | 'pular' | 'esconder' | 'sentar';
}

export interface DefinicaoNpc {
  id: IdNpc;
  nome: string;
  descricao: string;
  x: number;
  z: number;
  regiao: IdRegiao;
  /** Objetivo do dia-a-dia: pontos que percorre em ordem. */
  rotina: PassoRotina[];
  objetivo: string;
  /** Escolha do diálogo de entrada: primeiro que valer. */
  conversas: { quando?: Condicao; inicio: string }[];
  /** Falas curtas ditas ao passar perto. */
  latidos: string[];
  /** Falas ao ser atacado. */
  aoApanhar: string[];
}
