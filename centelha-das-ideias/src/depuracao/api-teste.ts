/**
 * API de teste para sondas automáticas (Playwright): window.__centelha.
 * Não altera o jogo sozinha; só expõe leitura de estado e atalhos de teleporte.
 */
import type { JogoCentelha } from '../jogo/jogo';

export function instalarApiTeste(jogo: JogoCentelha): void {
  (window as unknown as { __centelha: unknown }).__centelha = {
    jogo,
    estado: () => ({
      estado: jogo.estadoJogo,
      x: +jogo.jogador.x.toFixed(2),
      y: +jogo.jogador.y.toFixed(2),
      z: +jogo.jogador.z.toFixed(2),
      noChao: jogo.jogador.noChao,
      vida: jogo.estado.vida,
      arma: jogo.estado.armaAtual,
      nivel: jogo.estado.nivelArma(),
      xp: jogo.estado.armaAtual ? jogo.estado.armas[jogo.estado.armaAtual]?.xp : 0,
      humor: jogo.jogador.humor,
      escondido: jogo.jogador.escondido,
      regiao: jogo.regiaoAtual,
      missao: jogo.missaoAtual()?.etapa.texto ?? null,
      flags: [...jogo.estado.flags],
      afinidade: { ...jogo.estado.afinidade },
      inimigosVivos: jogo.inimigos.filter((i) => i.vivo).length,
    }),
    ir: (x: number, z: number) => {
      const y = Math.max(0, jogo.fisica.alturaChao(x, z, 50));
      jogo.jogador.posicionar(x, y, z);
    },
    flag: (f: string) => jogo.estado.ligar(f),
    arma: (id: string) => jogo.estado.darArma(id as never),
    habilidade: (id: string) => jogo.estado.aplicar([{ tipo: 'habilidade', id: id as never }]),
    xp: (n: number) => jogo.estado.ganharXp(n),
    escolher: (i: number | null) => jogo.escolher(i),
    falar: (npc: string) => {
      const n = jogo.npcs.find((x) => x.def.id === npc);
      if (n) jogo.iniciarConversa(n);
    },
  };
}
