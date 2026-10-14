/**
 * Tipos fundamentais compartilhados por todos os módulos.
 * Alterações aqui passam pelo orquestrador (ver docs/contratos.md).
 */

export interface Vetor {
  x: number;
  y: number;
}

/** Retângulo em pixels do mundo (ou blocos, quando indicado). */
export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Oito direções, em sentido horário a partir do leste.
 * 0 = leste, 1 = sudeste, 2 = sul (de frente para a câmera), 3 = sudoeste,
 * 4 = oeste, 5 = noroeste, 6 = norte (de costas), 7 = nordeste.
 */
export type Direcao8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Humor =
  'neutro' | 'curioso' | 'concentrado' | 'alegre' | 'assustado' | 'frustrado' | 'determinado';

export type IdArma = 'espada' | 'colher' | 'martelo' | 'cajado';
export type IdHabilidade = 'observar' | 'conectar' | 'criar';
export type IdMelhoria = 'botasMola' | 'carretelDuplo' | 'lenteAmpla' | 'moldeEstavel';
export type IdItem = 'caldo' | 'faisca';

/** Regiões são extensíveis: novas atualizações cadastram novos ids em src/dados/mundo.ts. */
export type IdRegiao = string;
/** Temas visuais de cenário. */
export type IdTema = 'jardim' | 'oficina' | 'vale' | 'farol' | 'construcao';

export type EspecieInimigo = 'chiado' | 'eco' | 'casco' | 'cortador';

/** Ids dos NPCs da primeira entrega (lista extensível). */
export type IdNpc =
  | 'salvia'
  | 'pipo'
  | 'bia'
  | 'caldo'
  | 'lume'
  | 'ressoa'
  | 'vagalume1'
  | 'vagalume2'
  | 'vagalume3'
  | 'faisca1'
  | 'faisca2'
  | 'faisca3'
  | string;

export type EstadoAnimClaude =
  | 'repouso'
  | 'caminhada'
  | 'corrida'
  | 'pulo'
  | 'queda'
  | 'aterrissagem'
  | 'esquiva'
  | 'interacao'
  | 'habilidade'
  | 'ataque'
  | 'dano'
  | 'recuperacao'
  | 'comemoracao'
  | 'caindoNoVao'
  | 'derrotado';

export interface Recompensa {
  arma?: IdArma;
  item?: { id: IdItem; quantidade: number };
  vidaMaxima?: number;
  inspiracaoMaxima?: number;
  melhoria?: IdMelhoria;
  habilidade?: IdHabilidade;
  /** Cargas de inspiração imediatas. */
  inspiracao?: number;
  /** Corações recuperados. */
  cura?: number;
}

/** Condição lógica sobre flags do jogo. */
export type Condicao =
  | { flag: string; valor?: boolean }
  | { todas: Condicao[] }
  | { alguma: Condicao[] }
  | { nao: Condicao };

/** Ações roteirizadas executadas por diálogos, gatilhos, enigmas e cenas. */
export type Acao =
  | { tipo: 'flag'; flag: string; valor?: boolean }
  | { tipo: 'dar'; recompensa: Recompensa; texto?: string }
  | { tipo: 'dialogo'; dialogo: string; falante?: string }
  | { tipo: 'humor'; humor: Humor; duracao?: number }
  | { tipo: 'som'; som: string }
  | { tipo: 'ativar'; alvo: string }
  | { tipo: 'desativar'; alvo: string }
  | { tipo: 'cena'; cena: string }
  | { tipo: 'desbloquear'; habilidade: IdHabilidade }
  | { tipo: 'checkpoint'; id: string }
  | { tipo: 'restaurarRegiao'; regiao: IdRegiao }
  | { tipo: 'mensagem'; texto: string; estilo?: 'dica' | 'conquista' | 'aviso' }
  /** Move a câmera até uma entidade (por id) e volta ao jogador. */
  | { tipo: 'camera'; alvo: string; duracao: number }
  | { tipo: 'comemorar' }
  | { tipo: 'removerEntidade'; id: string }
  | { tipo: 'iniciarMissao'; missao: string };
