/**
 * Contrato de entidades do mundo.
 *
 * Posição: (x, y) é o ponto no CHÃO sob os pés, em px do mundo. `z` é a altura acima da
 * superfície onde a entidade está (0 = apoiada). A superfície pode ser elevada
 * (plataformas): consulte `jogo.mundo.alturaChaoEm(x, y)`.
 * O desenho acontece com o contexto já transformado para coordenadas do mundo.
 */
import type { IdRegiao, Vetor } from './base';
import type { Jogo } from './jogo';

export type CategoriaEntidade =
  | 'jogador'
  | 'npc'
  | 'inimigo'
  | 'chefe'
  | 'mecanismo'
  | 'coletavel'
  | 'projetil'
  | 'efeito'
  | 'decoracao'
  | 'gatilho';

/** Tipos de nó para a habilidade Conectar. */
export type TipoNoConexao = 'fonte' | 'receptor' | 'prisma' | 'inimigo' | 'cristal' | 'nucleo';

export interface InfoConexao {
  tipo: TipoNoConexao;
  /** Altura (px) do ponto onde o fio se prende, acima do chão. */
  alturaFio: number;
  /** Para fontes/prismas/receptores: estado de energia atual. */
  energizado?: boolean;
  /** Indisponível (oculto, destruído etc.). */
  desabilitado?: boolean;
}

export interface Dano {
  quantidade: number;
  /** Ponto de origem (para empurrão e para escudos frontais). */
  origem: Vetor;
  tipo: 'golpe' | 'projetil' | 'choque' | 'onda' | 'queda' | 'contato';
  fonte?: Entidade;
  empurrao?: number;
  quebraEscudo?: boolean;
  arma?: string;
  /** Atordoamento em segundos causado pelo golpe. */
  atordoa?: number;
}

export interface Entidade {
  id: string;
  categoria: CategoriaEntidade;
  x: number;
  y: number;
  z: number;
  /** Raio de colisão no chão (px). */
  raio: number;
  /** false = será removida no fim do quadro. */
  vivo: boolean;
  /** Região onde a entidade nasceu (para salvamento e mapa). */
  regiao: IdRegiao | null;

  /** Bloqueia movimento de outras entidades como um retângulo/círculo sólido. */
  solido?: boolean;
  /** Retângulo de colisão sólida (px do mundo), quando não for círculo. */
  caixaSolida?(): { x: number; y: number; largura: number; altura: number } | null;
  /** Altura do obstáculo sólido (px). Infinity = não pode ser pulado. Padrão Infinity. */
  alturaSolida?: number;
  /** Bloqueia linha de visão (fios de conexão, projéteis, percepção). */
  bloqueiaVisao?: boolean;

  /** Sempre atualizada, mesmo longe da câmera. */
  sempreAtiva?: boolean;

  atualizar(dt: number, jogo: Jogo): void;
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void;
  /** Chave de ordenação por profundidade (padrão: y). */
  profundidade?(): number;
  /** Raio da sombra de contato (0 = sem sombra). Desenhada pelo motor. */
  raioSombra?: number;

  // ----- interação -----
  textoInteracao?(jogo: Jogo): string | null;
  aoInteragir?(jogo: Jogo): void;
  /** Distância máxima de interação (padrão 34 px). */
  alcanceInteracao?: number;

  // ----- combate -----
  /** Retorna true se o dano foi aplicado (false = bloqueado/imune). */
  receberDano?(dano: Dano, jogo: Jogo): boolean;
  /** Pode ser alvo de golpes de Claude. */
  atingivel?: boolean;
  vida?: number;
  vidaMaxima?: number;

  // ----- habilidades -----
  conexao?: InfoConexao;
  /** Revelável por Observar (runas ocultas, prismas ocultos, pegadas...). */
  revelavel?: boolean;
  /** Chamado por Observar quando a onda alcança a entidade. */
  aoSerRevelada?(jogo: Jogo): void;
  /** Mecanismos: alterado por receptores, alavancas, placas, enigmas. */
  definirAtivo?(ativo: boolean, jogo: Jogo): void;
  ativo?: boolean;
  /** Empurrável (caixas). */
  empurravel?: boolean;
  /** Ocupa placas de pressão. */
  pesaEmPlaca?: boolean;
  /** Escudo Refletor: projéteis inimigos que tocarem o raio voltam contra os inimigos. */
  refletor?: boolean;
  /** Aliado de Luz: inimigos podem escolher esta entidade como alvo em vez de Claude. */
  distrai?: boolean;
  /** Amigável a Claude (aliados): golpes de Claude não a atingem. */
  aliado?: boolean;
}
