/**
 * API de testes automatizados (Playwright). Exposta em window.__centelha.
 * Não é usada pelo jogo; serve para os agentes críticos verificarem estados reais.
 */
import { BLOCO } from '../configuracao';
import type { IdHabilidade } from '../contratos/base';
import type { JogoCentelha } from '../jogo/jogo';

export interface ApiTeste {
  jogo: JogoCentelha;
  estado(): Record<string, unknown>;
  teleportar(x: number, y: number): void;
  teleportarBloco(regiao: string, tx: number, ty: number): void;
  irPara(idEntidade: string): boolean;
  flag(nome: string, valor?: boolean): boolean;
  darHabilidades(...h: IdHabilidade[]): void;
  entidades(filtro?: string): { id: string; categoria: string; x: number; y: number }[];
  salvamento(): unknown;
  fps(): number;
}

export function instalarApiTeste(jogo: JogoCentelha): void {
  let quadros = 0;
  let fps = 0;
  let marca = performance.now();
  const medir = () => {
    quadros++;
    const agora = performance.now();
    if (agora - marca >= 1000) {
      fps = (quadros * 1000) / (agora - marca);
      quadros = 0;
      marca = agora;
    }
    requestAnimationFrame(medir);
  };
  requestAnimationFrame(medir);

  const api: ApiTeste = {
    jogo,
    estado: () => {
      const j = jogo.jogador;
      return {
        estadoJogo: jogo.estado,
        x: Math.round(j.x),
        y: Math.round(j.y),
        z: Math.round(j.z),
        bloco: jogo.mundo.bloco(j.x, j.y),
        regiao: j.regiao,
        vida: j.vida,
        vidaMaxima: j.vidaMaxima,
        inspiracao: j.inspiracao,
        animacao: j.estado,
        humor: j.humor,
        armas: [...j.armas],
        armaAtual: j.armaAtual,
        habilidades: [...j.habilidades],
        noChao: j.noChao,
        alvoInteracao: j.alvoInteracao?.id ?? null,
        tempoAtivo: jogo.estatisticas().tempoAtivo,
        tempoCenas: jogo.estatisticas().tempoCenas,
        msQuadro: jogo.renderizador.msQuadro,
        particulas: jogo.particulas.quantidade(),
        entidades: jogo.entidades.todas().length,
      };
    },
    teleportar: (x, y) => {
      jogo.jogador.posicionar(x, y);
      jogo.camera.centralizar(x, y);
    },
    teleportarBloco: (regiao, tx, ty) => {
      const p = jogo.mundo.localParaMundo(regiao, tx, ty);
      jogo.jogador.posicionar(p.x, p.y);
      jogo.camera.centralizar(p.x, p.y);
    },
    irPara: (id) => {
      const e = jogo.entidades.porId(id);
      if (!e) return false;
      const p = jogo.mundo.pontoSeguroProximo(e.x, e.y + BLOCO);
      jogo.jogador.posicionar(p.x, p.y);
      jogo.camera.centralizar(p.x, p.y);
      return true;
    },
    flag: (nome, valor) => {
      if (valor !== undefined) jogo.flags.definir(nome, valor);
      return jogo.flags.obter(nome);
    },
    darHabilidades: (...h) => {
      for (const x of h) jogo.jogador.habilidades.add(x);
    },
    entidades: (filtro) =>
      jogo.entidades
        .todas()
        .filter((e) => !filtro || e.categoria === filtro || e.id.includes(filtro))
        .map((e) => ({ id: e.id, categoria: e.categoria, x: Math.round(e.x), y: Math.round(e.y) })),
    salvamento: () => jogo.montarSalvamento(),
    fps: () => Math.round(fps),
  };
  (window as unknown as { __centelha: ApiTeste }).__centelha = api;
}
