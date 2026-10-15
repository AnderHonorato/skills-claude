/**
 * API de teste do modo Sobrevivência (window.__sobrevivencia), usada pelas sondas
 * automatizadas com navegador. Não altera o jogo se ninguém chamar.
 */
import type { IdPersonagem } from './dados/personagens';
import type { Partida } from './jogo/partida';

export function instalarApiSobrevivencia(p: Partida): void {
  const api = {
    estado: () => ({
      estado: p.estado,
      personagem: p.personagemId,
      vida: p.vida,
      vidaMax: p.atributos.vidaMaxima,
      nivel: p.nivel,
      xp: p.xp,
      xpProximo: p.xpProximo,
      tempo: p.tempo,
      abates: p.abates,
      x: p.x,
      z: p.z,
      build: JSON.parse(JSON.stringify(p.build)),
      ofertas: p.ofertas.map((o) => ({ ...o })),
      chefe: p.chefeAtual ? { vida: p.chefeAtual.vida, vidaMax: p.chefeAtual.vidaMax } : null,
      ...p.contagem(),
    }),
    personagem: (id: IdPersonagem) => p.escolherPersonagem(id),
    iniciar: (id?: IdPersonagem) => {
      if (id) p.escolherPersonagem(id);
      p.iniciar();
    },
    escolher: (i: number) => p.escolherOferta(i),
    rerrolar: () => p.rerrolar(),
    xp: (v: number) => p.depurarXp(v),
    habilidade: (id: string, nivel = 1) => p.depurarHabilidade(id, nivel),
    tempo: (t: number) => p.depurarTempo(t),
    invencivel: (s = 9999) => {
      p.invencivel = s;
    },
    curar: () => {
      p.vida = p.atributos.vidaMaxima;
    },
    joystick: (x: number, y: number) => p.entrada.definirJoystick(x, y),
    pausar: (v: boolean) => p.pausar(v),
    menu: () => p.voltarMenu(),
    relatorio: () => p.relatorio(),
    direcaoRobo: () => p.depurarDirecao(),
  };
  (window as unknown as { __sobrevivencia: typeof api }).__sobrevivencia = api;
}
