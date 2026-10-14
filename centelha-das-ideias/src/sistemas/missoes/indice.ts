/**
 * Missões dirigidas por flags (RESPONSÁVEL: agente de Narrativa e Conteúdo).
 * Versão provisória do orquestrador.
 */
import type { ApiMissoes, Jogo } from '../../contratos/jogo';

export function criarMissoes(_jogo: Jogo): ApiMissoes {
  let etapas: Record<string, number> = {};
  let acompanhada: string | null = null;
  return {
    atualizar() {},
    ativas: () => [],
    concluidas: () => [],
    acompanhada: () => acompanhada,
    acompanhar(id) {
      acompanhada = id;
    },
    marcador: () => null,
    carregar(e) {
      etapas = { ...e };
    },
    exportar: () => ({ ...etapas }),
  };
}
