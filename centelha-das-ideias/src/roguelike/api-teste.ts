/**
 * API de teste do modo Sobrevivência (window.__sobrevivencia), usada pelas sondas
 * automatizadas com navegador. Não altera o jogo se ninguém chamar.
 */
import type { IdPersonagem } from './dados/personagens';
import type { Partida } from './jogo/partida';
import type { InterfaceSobrevivencia } from './ui';

export function instalarApiSobrevivencia(p: Partida, ui?: InterfaceSobrevivencia): void {
  let convite: { codigo: string; aceitar: (r: string) => Promise<void> } | null = null;
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
    inimigo: (id: string, n = 1, dist = 7) => p.depurarInimigo(id as never, n, dist),
    ataqueChefe: (tipo: string) => p.depurarAtaqueChefe(tipo as never),
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
    // multijogador
    mpCriarSala: async () => {
      await ui?.sala.hospedar();
    },
    mpConvite: async () => {
      convite = (await ui?.sala.gerarConvite()) ?? null;
      return convite?.codigo ?? '';
    },
    mpAceitar: async (resposta: string) => {
      await convite?.aceitar(resposta);
    },
    mpEntrar: async (codigo: string) => (await ui?.sala.entrarComConvite(codigo)) ?? '',
    mpEntrarLan: async () => {
      await ui?.sala.entrarRedeLocal();
    },
    mpIniciar: () => ui?.sala.sessao?.iniciarPartida(),
    mpSala: () => {
      const s = ui?.sala.sessao;
      return s ? { papel: s.papel, membros: s.membros, meuIndice: s.meuIndice } : null;
    },
    mpJogadores: () =>
      p.jogadores.map((jg) => ({
        indice: jg.indice,
        local: jg.local,
        personagem: jg.personagemId,
        x: Math.round(jg.x * 10) / 10,
        z: Math.round(jg.z * 10) / 10,
        vida: Math.round(jg.vida),
        caido: jg.caido,
        escolheu: jg.escolheu,
        ativas: jg.build.ativas.map((a) => `${a.id}:${a.nivel}`),
        passivas: jg.build.passivas.map((a) => `${a.id}:${a.nivel}`),
      })),
    mpEscolher: (i: number) => p.escolherOferta(i),
  };
  (window as unknown as { __sobrevivencia: typeof api }).__sobrevivencia = api;
}
