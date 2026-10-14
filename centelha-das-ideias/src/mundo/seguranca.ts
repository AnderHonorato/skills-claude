import type { Vetor } from '../contratos/base';
import type { DadosSalvos } from '../contratos/salvamento';
import type { MundoJogo } from './mundo';

/**
 * Posição segura para retomar a partida após atualizações de conteúdo:
 * região existente, chão andável e longe das fronteiras (atual e anteriores).
 * Ordem: posição salva → Pedra-Memória → entrada da região salva → entrada inicial.
 */
export function posicaoSegura(mundo: MundoJogo, d: DadosSalvos): Vetor {
  const def = mundo.definicao;
  const ok = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const r = mundo.regiaoEm(x, y);
    if (!r || !mundo.regiaoPorId(r)) return false;
    const { tx, ty } = mundo.bloco(x, y);
    if (!mundo.blocoSeguro(tx, ty)) return false;
    if (mundo.distanciaFronteiras(x, y) < def.fronteira.raioAviso + 1) return false;
    return true;
  };
  if (ok(d.jogador.x, d.jogador.y)) return { x: d.jogador.x, y: d.jogador.y };
  if (d.checkpoint && ok(d.checkpoint.x, d.checkpoint.y)) {
    return { x: d.checkpoint.x, y: d.checkpoint.y };
  }
  const regiao = mundo.regiaoPorId(d.jogador.regiao) ?? mundo.regiaoPorId(def.regiaoInicial)!;
  const p = mundo.localParaMundo(regiao.id, regiao.entrada.x, regiao.entrada.y);
  return mundo.pontoSeguroProximo(p.x, p.y);
}
