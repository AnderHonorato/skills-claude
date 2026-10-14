import { describe, expect, it } from 'vitest';
import { BLOCO } from '../../src/configuracao';
import type { DefinicaoMundo, DefinicaoRegiao } from '../../src/contratos/dados';
import type { Entidade } from '../../src/contratos/entidades';
import type { GerenciadorEntidades } from '../../src/contratos/jogo';
import { FisicaJogo } from '../../src/mundo/fisica';
import { MundoJogo } from '../../src/mundo/mundo';
import { posicaoSegura } from '../../src/mundo/seguranca';
import { completar, migrar } from '../../src/sistemas/salvamento';
import { FlagsJogo } from '../../src/sistemas/flags';

/** Região de teste: corredor que leva ao leste. */
function regiao(id: string, origemX: number, largura: number): DefinicaoRegiao {
  const linha = (c: string) => c.repeat(largura);
  return {
    id,
    nome: id,
    tema: 'jardim',
    origem: { x: origemX, y: 0 },
    mapa: [linha('#'), linha('.'), linha('.'), linha('.'), linha('#')],
    entidades: [],
    musica: 'jardim',
    entrada: { x: 1, y: 2 },
    descricao: '',
  };
}

const MENSAGEM =
  'Esta região está em desenvolvimento. A aventura continua nas próximas atualizações.';

function mundoV1(): DefinicaoMundo {
  return {
    versaoConteudo: 1,
    regiaoInicial: 'a',
    regioes: [regiao('a', 0, 20)],
    fronteira: {
      id: 'f1',
      regiaoFutura: 'b',
      nomeRegiaoFutura: 'B',
      area: { x: 20, y: 1, largura: 2, altura: 3 },
      mensagem: MENSAGEM,
      raioAviso: 4,
    },
    fronteirasAnteriores: [],
  };
}

/** Expansão: região "b" cadastrada e a parede movida para o novo limite. */
function mundoV2(): DefinicaoMundo {
  const v1 = mundoV1();
  return {
    ...v1,
    versaoConteudo: 2,
    regioes: [...v1.regioes, regiao('b', 20, 20)],
    fronteira: {
      ...v1.fronteira,
      id: 'f2',
      regiaoFutura: 'c',
      area: { x: 40, y: 1, largura: 2, altura: 3 },
    },
    fronteirasAnteriores: [v1.fronteira],
  };
}

function entidadeTeste(x: number, y: number): Entidade {
  return {
    id: 'teste',
    categoria: 'jogador',
    x,
    y,
    z: 0,
    raio: 7,
    vivo: true,
    regiao: null,
    atualizar() {},
    desenhar() {},
  };
}

const semEntidades = { todas: () => [] } as unknown as GerenciadorEntidades;

describe('fronteira em desenvolvimento', () => {
  it('é aplicada a partir dos dados e bloqueia andar, pular e visão', () => {
    const mundo = new MundoJogo(mundoV1());
    expect(mundo.codigoEm(20, 2)).toBe('F');
    expect(mundo.passavel(20, 2, 0)).toBe(false);
    expect(mundo.passavel(20, 2, 999)).toBe(false); // nem pulando muito alto
    const a = { x: 18 * BLOCO, y: 2.5 * BLOCO };
    const b = { x: 23 * BLOCO, y: 2.5 * BLOCO };
    expect(mundo.linhaDeVisao(a, b)).toBe(false);
  });

  it('não pode ser sobreposta por pontes de luz nem alterada por blocos', () => {
    const mundo = new MundoJogo(mundoV1());
    mundo.sobrepor(20, 2, 'L', 'ponte');
    mundo.definirBloco(21, 2, '.', true);
    expect(mundo.codigoEm(20, 2)).toBe('F');
    expect(mundo.codigoEm(21, 2)).toBe('F');
  });

  it('a física impede atravessar mesmo em alta velocidade e no ar', () => {
    const mundo = new MundoJogo(mundoV1());
    const fisica = new FisicaJogo(mundo, () => semEntidades);
    const e = entidadeTeste(19 * BLOCO, 2.5 * BLOCO);
    e.z = 60;
    fisica.mover(e, 400, 0);
    expect(e.x).toBeLessThan(20 * BLOCO - e.raio + 0.5);
  });

  it('na expansão a parede antiga vira passagem e a nova bloqueia', () => {
    const mundo = new MundoJogo(mundoV2());
    expect(mundo.codigoEm(20, 2)).toBe('.');
    expect(mundo.passavel(20, 2, 0)).toBe(true);
    expect(mundo.codigoEm(40, 2)).toBe('F');
    expect(mundo.passavel(40, 2, 0)).toBe(false);
    const fisica = new FisicaJogo(mundo, () => semEntidades);
    const e = entidadeTeste(18 * BLOCO, 2.5 * BLOCO);
    fisica.mover(e, 5 * BLOCO, 0);
    expect(e.x).toBeGreaterThan(22 * BLOCO);
  });
});

describe('salvamento', () => {
  it('completa dados parciais sem perder o que existe', () => {
    const d = completar(
      { flags: { 'enigma:x': true }, jogador: { armas: ['espada'] } as never },
      mundoV1()
    );
    expect(d.flags['enigma:x']).toBe(true);
    expect(d.jogador.armas).toEqual(['espada']);
    expect(d.jogador.vidaMaxima).toBe(3);
    expect(d.configuracoes.volumeMusica).toBeGreaterThan(0);
  });

  it('recusa salvamento de versão futura', () => {
    expect(() => migrar({ versao: 999 }, mundoV1())).toThrow();
  });

  it('após expansão, jogador salvo perto da fronteira antiga volta a um lugar seguro', () => {
    const v1 = mundoV1();
    const mundoAntigo = new MundoJogo(v1);
    const salvo = completar({}, v1);
    // salvo encostado na parede antiga (posição válida antes da atualização? não: dentro do raio)
    salvo.jogador.x = 19.5 * BLOCO;
    salvo.jogador.y = 2.5 * BLOCO;
    salvo.jogador.regiao = 'a';
    salvo.checkpoint = { id: 'pedra', x: 5.5 * BLOCO, y: 2.5 * BLOCO, regiao: 'a' };
    const antes = posicaoSegura(mundoAntigo, salvo);
    expect(antes.x).toBe(5.5 * BLOCO); // longe da fronteira atual

    const mundoNovo = new MundoJogo(mundoV2());
    const depois = posicaoSegura(mundoNovo, salvo);
    expect(mundoNovo.distanciaFronteiras(depois.x, depois.y)).toBeGreaterThanOrEqual(5);
    const { tx, ty } = mundoNovo.bloco(depois.x, depois.y);
    expect(mundoNovo.blocoSeguro(tx, ty)).toBe(true);
  });

  it('posição em região removida cai na entrada inicial', () => {
    const mundo = new MundoJogo(mundoV1());
    const salvo = completar({}, mundoV1());
    salvo.jogador.x = 999 * BLOCO;
    salvo.jogador.y = 999 * BLOCO;
    salvo.jogador.regiao = 'inexistente';
    const p = posicaoSegura(mundo, salvo);
    expect(mundo.regiaoEm(p.x, p.y)).toBe('a');
  });
});

describe('flags e condições', () => {
  it('avalia combinações', () => {
    const f = new FlagsJogo();
    f.definir('a');
    expect(f.avaliar({ flag: 'a' })).toBe(true);
    expect(f.avaliar({ todas: [{ flag: 'a' }, { flag: 'b' }] })).toBe(false);
    expect(f.avaliar({ alguma: [{ flag: 'a' }, { flag: 'b' }] })).toBe(true);
    expect(f.avaliar({ nao: { flag: 'b' } })).toBe(true);
    expect(f.avaliar({ flag: 'b', valor: false })).toBe(true);
  });
});

describe('alturas e vãos', () => {
  it('plataforma exige pulo e queda acontece no vão', () => {
    const def = mundoV1();
    def.regioes[0]!.mapa = ['#########', '...PP  ..', '...PP  ..', '#########'];
    const mundo = new MundoJogo(def);
    expect(mundo.passavel(3, 1, 0)).toBe(false);
    expect(mundo.passavel(3, 1, 30)).toBe(true);
    expect(mundo.temChao(5.5 * BLOCO, 1.5 * BLOCO)).toBe(false);
    expect(mundo.alturaChaoEm(3.5 * BLOCO, 1.5 * BLOCO)).toBe(24);
  });
});
