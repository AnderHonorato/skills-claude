/**
 * Combate, armas, inimigos e chefe (RESPONSÁVEL: agente de Combate e Inimigos).
 * Versão provisória do orquestrador: golpe simples sem inimigos.
 */
import type { IdArma } from '../../contratos/base';
import type { DefinicaoArma } from '../../contratos/dados';
import type { Dano, Entidade } from '../../contratos/entidades';
import type { ApiCombate, Jogo } from '../../contratos/jogo';

const ARMAS: Record<IdArma, DefinicaoArma> = {
  espada: {
    id: 'espada',
    nome: 'Espada de Madeira',
    descricao: '',
    duracao: 0.32,
    janelaAtiva: [0.2, 0.6],
    dano: 1,
    alcance: 30,
    arco: 110,
    empurrao: 120,
    quebraEscudo: false,
    combo: 3,
  },
  colher: {
    id: 'colher',
    nome: 'Colher Gigante',
    descricao: '',
    duracao: 0.48,
    janelaAtiva: [0.25, 0.6],
    dano: 1.5,
    alcance: 26,
    arco: 140,
    empurrao: 220,
    quebraEscudo: false,
    combo: 1,
  },
  martelo: {
    id: 'martelo',
    nome: 'Martelo de Borracha',
    descricao: '',
    duracao: 0.8,
    janelaAtiva: [0.45, 0.65],
    dano: 3,
    alcance: 34,
    arco: 360,
    empurrao: 260,
    quebraEscudo: true,
    combo: 1,
  },
  cajado: {
    id: 'cajado',
    nome: 'Cajado de Ideias',
    descricao: '',
    duracao: 0.55,
    janelaAtiva: [0.3, 0.4],
    dano: 1,
    alcance: 192,
    arco: 20,
    empurrao: 60,
    quebraEscudo: false,
    combo: 1,
    projetil: { velocidade: 260, alcance: 192 },
  },
};

export function criarCombate(jogo: Jogo): ApiCombate {
  return {
    fabricas: {},
    atualizar(dt) {
      const j = jogo.jogador;
      if (j.ataque) {
        j.ataque.t += dt;
        if (j.ataque.t >= j.ataque.duracao) j.ataque = null;
      }
    },
    atacar() {
      const j = jogo.jogador;
      if (j.ataque || !j.armaAtual) return;
      const def = ARMAS[j.armaAtual];
      const mira = jogo.entrada.mira();
      const angulo = mira ? Math.atan2(mira.y - j.y, mira.x - j.x) : j.angulo;
      j.ataque = { arma: def.id, t: 0, duracao: def.duracao, combo: 0, angulo, acertou: new Set() };
      jogo.audio.tocar('ataqueEspada');
    },
    causarDano(alvo: Entidade, dano: Dano) {
      return alvo.receberDano?.(dano, jogo) ?? false;
    },
    atordoar() {},
    amarrar() {},
    definicaoArma: (id) => ARMAS[id],
    intensidade: () => 0,
    desenharChao() {},
    desenharSobre() {},
  };
}
