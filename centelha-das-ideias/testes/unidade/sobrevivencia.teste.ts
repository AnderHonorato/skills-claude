import { describe, expect, it } from 'vitest';
import {
  ELEMENTOS,
  HABILIDADES,
  PASSIVAS,
  habilidade,
} from '../../src/roguelike/dados/habilidades';
import { INIMIGOS, taxaSurgimento, VALOR_CRISTAL } from '../../src/roguelike/dados/inimigos';
import { PERSONAGENS } from '../../src/roguelike/dados/personagens';
import {
  aplicarOferta,
  ATRIBUTOS_BASE,
  calcularAtributos,
  descreverMelhoria,
  gerarOfertas,
  MAX_ATIVAS,
  MAX_PASSIVAS,
  NIVEL_MAX_HABILIDADE,
  valoresHabilidade,
  xpParaNivel,
  type EstadoBuild,
} from '../../src/roguelike/nucleo/progresso';
import { criarAleatorio } from '../../src/nucleo/aleatorio';

describe('dados do modo Sobrevivência', () => {
  it('tem pelo menos 20 habilidades ativas, 10 passivas e 6 personagens', () => {
    expect(HABILIDADES.length).toBeGreaterThanOrEqual(20);
    expect(PASSIVAS.length).toBeGreaterThanOrEqual(10);
    expect(PERSONAGENS.map((p) => p.id)).toEqual(
      expect.arrayContaining(['claude', 'gpt', 'gemini'])
    );
  });

  it('cada habilidade tem textos em português, cores, elemento válido e evoluções', () => {
    const ids = new Set<string>();
    for (const h of HABILIDADES) {
      expect(ids.has(h.id), `id repetido: ${h.id}`).toBe(false);
      ids.add(h.id);
      expect(h.nome.length).toBeGreaterThan(2);
      expect(h.descricao.length).toBeGreaterThan(10);
      expect(h.evolucao5.length).toBeGreaterThan(5);
      expect(h.evolucao10.length).toBeGreaterThan(5);
      expect(ELEMENTOS[h.elemento], h.id).toBeDefined();
      expect(h.cor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(h.base.recarga).toBeGreaterThan(0);
      expect(h.base.dano).toBeGreaterThan(0);
    }
  });

  it('há habilidades rotativas, direcionais e de vários elementos', () => {
    const comps = new Set(HABILIDADES.map((h) => h.comportamento));
    expect(comps.has('orbita')).toBe(true);
    expect(comps.has('projetil')).toBe(true);
    expect(comps.has('laser')).toBe(true);
    const elementos = new Set(HABILIDADES.map((h) => h.elemento));
    for (const e of ['fogo', 'gelo', 'raio', 'vento'])
      expect(elementos.has(e as never), e).toBe(true);
  });

  it('cada personagem começa com uma habilidade que existe e tem falas', () => {
    for (const p of PERSONAGENS) {
      expect(habilidade(p.habilidadeInicial), p.id).toBeDefined();
      for (const lista of Object.values(p.falas)) expect(lista.length).toBeGreaterThan(0);
    }
  });

  it('cristais maiores valem mais e as hordas crescem com o tempo', () => {
    for (let i = 1; i < VALOR_CRISTAL.length; i++)
      expect(VALOR_CRISTAL[i]).toBeGreaterThan(VALOR_CRISTAL[i - 1]);
    expect(taxaSurgimento(300)).toBeGreaterThan(taxaSurgimento(60));
    expect(taxaSurgimento(60)).toBeGreaterThan(taxaSurgimento(0));
    expect(INIMIGOS.chefe.vida).toBeGreaterThan(INIMIGOS.chiado.vida * 50);
  });
});

describe('progressão', () => {
  it('a curva de experiência sobe a cada nível', () => {
    for (let n = 1; n < 60; n++) expect(xpParaNivel(n + 1)).toBeGreaterThan(xpParaNivel(n));
  });

  it('habilidades ficam mais fortes e mais rápidas ao subir de nível', () => {
    for (const h of HABILIDADES) {
      const a = valoresHabilidade(h, 1);
      const b = valoresHabilidade(h, NIVEL_MAX_HABILIDADE);
      expect(b.dano, h.id).toBeGreaterThan(a.dano * 2);
      expect(b.recarga, h.id).toBeLessThan(a.recarga);
      expect(b.evo5 && b.evo10).toBe(true);
      expect(valoresHabilidade(h, 4).evo5).toBe(false);
    }
  });

  it('passivas alteram os atributos', () => {
    const at = calcularAtributos(
      {},
      {
        ativas: [],
        passivas: [
          { id: 'vigor', nivel: 3 },
          { id: 'foco', nivel: 2 },
        ],
      }
    );
    expect(at.vidaMaxima).toBeGreaterThan(ATRIBUTOS_BASE.vidaMaxima);
    expect(at.recarga).toBeLessThan(ATRIBUTOS_BASE.recarga);
  });

  it('a descrição da melhoria anuncia as evoluções nos níveis 5 e 10', () => {
    const h = HABILIDADES[0];
    expect(descreverMelhoria(h, 4)).toContain('EVOLUÇÃO');
    expect(descreverMelhoria(h, 9)).toContain('EVOLUÇÃO FINAL');
    expect(descreverMelhoria(h, 2)).toContain('Dano +');
  });

  it('o que você já tem aparece bem mais vezes nas ofertas', () => {
    const rnd = criarAleatorio(42);
    const build: EstadoBuild = { ativas: [{ id: 'bolaFogo', nivel: 2 }], passivas: [] };
    let apareceu = 0;
    let nova = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const o = gerarOfertas(build, rnd, 3);
      if (o.some((x) => x.id === 'bolaFogo')) apareceu++;
      if (o.some((x) => x.id === 'lancaGelo')) nova++;
    }
    expect(apareceu).toBeGreaterThan(nova * 3.5);
    expect(apareceu / N).toBeGreaterThan(0.3);
  });

  it('não oferece repetidas na mesma rodada', () => {
    const rnd = criarAleatorio(7);
    for (let i = 0; i < 200; i++) {
      const o = gerarOfertas({ ativas: [], passivas: [] }, rnd, 4);
      expect(new Set(o.map((x) => x.tipo + x.id)).size).toBe(o.length);
    }
  });

  it('respeita 10 ativas e 5 passivas e o nível máximo 10', () => {
    const build: EstadoBuild = {
      ativas: HABILIDADES.slice(0, MAX_ATIVAS).map((h) => ({ id: h.id, nivel: 3 })),
      passivas: PASSIVAS.slice(0, MAX_PASSIVAS).map((p) => ({ id: p.id, nivel: 3 })),
    };
    const rnd = criarAleatorio(3);
    for (let i = 0; i < 300; i++) {
      for (const o of gerarOfertas(build, rnd, 4)) {
        if (o.tipo === 'ativa') expect(build.ativas.some((s) => s.id === o.id)).toBe(true);
        if (o.tipo === 'passiva') expect(build.passivas.some((s) => s.id === o.id)).toBe(true);
      }
    }
    // tentar adicionar uma 11ª ativa não faz nada
    expect(
      aplicarOferta(build, {
        tipo: 'ativa',
        id: HABILIDADES[MAX_ATIVAS].id,
        nivelAtual: 0,
        novo: true,
        evolucao: false,
      })
    ).toBe(0);
    expect(build.ativas.length).toBe(MAX_ATIVAS);
    // nível nunca passa de 10
    const s = build.ativas[0];
    for (let i = 0; i < 20; i++)
      aplicarOferta(build, {
        tipo: 'ativa',
        id: s.id,
        nivelAtual: s.nivel,
        novo: false,
        evolucao: false,
      });
    expect(s.nivel).toBe(NIVEL_MAX_HABILIDADE);
  });

  it('com tudo no máximo, oferece cura e ouro', () => {
    const build: EstadoBuild = {
      ativas: HABILIDADES.slice(0, MAX_ATIVAS).map((h) => ({ id: h.id, nivel: 10 })),
      passivas: PASSIVAS.slice(0, MAX_PASSIVAS).map((p) => ({ id: p.id, nivel: 10 })),
    };
    const o = gerarOfertas(build, criarAleatorio(1), 3);
    expect(o.map((x) => x.tipo)).toEqual(['cura', 'ouro']);
  });
});
