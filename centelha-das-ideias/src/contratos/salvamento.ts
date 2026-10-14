/**
 * Formato do salvamento local (localStorage). Sempre versionado.
 * Nunca remova campos: adicione e escreva uma migração em src/sistemas/salvamento.ts.
 */
import type { IdArma, IdHabilidade, IdItem, IdMelhoria, IdRegiao } from './base';

export const VERSAO_SALVAMENTO = 1;

export interface DadosSalvos {
  versao: number;
  /** Versão de conteúdo do mundo quando o jogo foi salvo (src/dados/mundo.ts). */
  versaoConteudo: number;
  criadoEm: number;
  atualizadoEm: number;

  jogador: {
    x: number;
    y: number;
    regiao: IdRegiao;
    vida: number;
    vidaMaxima: number;
    inspiracao: number;
    inspiracaoMaxima: number;
    armas: IdArma[];
    armaAtual: IdArma | null;
    habilidades: IdHabilidade[];
    melhorias: IdMelhoria[];
    itens: Partial<Record<IdItem, number>>;
  };

  /** Última Pedra-Memória tocada (id da entidade) e posição de retorno em px do mundo. */
  checkpoint: { id: string; x: number; y: number; regiao: IdRegiao } | null;

  /** Todas as flags de progresso (missões, enigmas, baús, gatilhos, NPCs...). */
  flags: Record<string, boolean>;

  /** Etapa atual de cada missão iniciada (-1 = concluída). */
  missoes: Record<string, number>;
  missaoAcompanhada: string | null;

  regioesDescobertas: IdRegiao[];
  /** Blocos permanentemente alterados (espinhos cortados, paredes quebradas). Chave "tx,ty". */
  blocosAlterados: Record<string, string>;
  /** Entidades removidas permanentemente (coletáveis pegos, inimigos permanentes derrotados). */
  removidas: string[];

  estatisticas: {
    /** Segundos de jogo ativo (sem pausa, menus, diálogos e cenas). */
    tempoAtivo: number;
    /** Segundos em diálogos e cenas. */
    tempoCenas: number;
    derrotas: number;
    quedas: number;
    inimigosDerrotados: number;
    segredos: number;
  };

  configuracoes: {
    volumeGeral: number;
    volumeMusica: number;
    volumeEfeitos: number;
    tremorCamera: boolean;
    controlesToque: 'auto' | 'sempre' | 'nunca';
  };
}
