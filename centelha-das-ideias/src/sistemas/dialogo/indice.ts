/**
 * Diálogos, latidos e NPCs com rotina (RESPONSÁVEL: agente de Narrativa e Conteúdo).
 * Versão provisória do orquestrador.
 */
import { desenharNpc } from '../../arte/personagens';
import type { EspecEntidade } from '../../contratos/dados';
import type { Entidade } from '../../contratos/entidades';
import type { ApiDialogo, Jogo, Latido } from '../../contratos/jogo';

export function criarDialogo(jogo: Jogo): ApiDialogo {
  const latidos: Latido[] = [];
  return {
    fabricas: {
      npc: (e, p) => {
        const d = e as Extract<EspecEntidade, { tipo: 'npc' }>;
        const npc: Entidade = {
          id: d.id,
          categoria: 'npc',
          x: p.x,
          y: p.y,
          z: 0,
          raio: 9,
          vivo: true,
          regiao: null,
          solido: true,
          raioSombra: 10,
          atualizar() {},
          desenhar(ctx, j) {
            desenharNpc(ctx, {
              especie: 'tartaruga',
              id: d.id,
              x: npc.x,
              ySolo: npc.y,
              z: 0,
              direcao: 2,
              estado: 'parado',
              atividade: null,
              tempoEstado: 0,
              fasePasso: 0,
              tempo: j.tempo,
              falando: false,
            });
          },
          textoInteracao: () => 'Conversar',
          aoInteragir: () => jogo.dialogo.latir(d.id, 'Olá, Claude!', 2.5),
        };
        return npc;
      },
    },
    atualizar(dt) {
      for (const l of latidos) l.restante -= dt;
      for (let i = latidos.length - 1; i >= 0; i--)
        if (latidos[i]!.restante <= 0) latidos.splice(i, 1);
    },
    iniciar() {},
    ativo: () => false,
    fala: () => null,
    avancar() {},
    escolher() {},
    destacarEscolha() {},
    pular() {},
    latir(quem, texto, duracao = 3) {
      const i = latidos.findIndex((l) => l.quem === quem);
      if (i >= 0) latidos.splice(i, 1);
      latidos.push({ quem, texto, restante: duracao, cor: '#F6F1E7' });
    },
    latidos: () => latidos,
    definicaoNpc: () => undefined,
  };
}
