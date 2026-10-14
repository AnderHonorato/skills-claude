/**
 * Habilidades (Observar, Conectar, Criar), rede de energia, mecanismos e enigmas
 * (RESPONSÁVEL: agente de Habilidades e Enigmas). Versão provisória do orquestrador.
 */
import type { ApiHabilidades, Jogo } from '../../contratos/jogo';

export function criarHabilidades(jogo: Jogo): ApiHabilidades {
  return {
    fabricas: {},
    atualizar() {},
    usar(h) {
      jogo.jogador.animar('habilidade', 0.35);
      jogo.emitir('habilidadeUsada', { habilidade: h });
    },
    recarga: () => 0,
    disponivel: (h) => jogo.jogador.habilidades.has(h),
    conexoes: () => [],
    desfazerConexao() {},
    selecao: () => null,
    observacaoRestante: () => 0,
    revelado: () => false,
    energizado: () => false,
    enigmaAtual: () => null,
    reiniciarEnigma() {},
    dicaAtual: () => null,
    alvoSugerido: () => null,
    previaCriar: () => null,
    desenharChao() {},
    desenharSobre() {},
  };
}
