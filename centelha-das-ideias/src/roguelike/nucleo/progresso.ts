/**
 * Progressão do roguelike (lógica pura e testável): atributos, curva de experiência,
 * valores de cada habilidade por nível e o sorteio das opções ao subir de nível.
 * Habilidades que você já tem aparecem com mais chance (como evolução).
 */
import {
  HABILIDADES,
  PASSIVAS,
  habilidade,
  passiva,
  type DefHabilidade,
  type Valores,
} from '../dados/habilidades';

export const NIVEL_MAX_HABILIDADE = 10;
export const MAX_ATIVAS = 10;
export const MAX_PASSIVAS = 5;

export interface Atributos {
  vidaMaxima: number;
  regeneracao: number;
  /** Multiplicador da velocidade base (6 m/s). */
  velocidade: number;
  dano: number;
  area: number;
  /** Multiplicador das recargas (menor = mais rápido). */
  recarga: number;
  /** Projéteis extras (parte inteira conta). */
  quantidade: number;
  velocidadeProjetil: number;
  duracao: number;
  /** Raio de coleta (m). */
  ima: number;
  /** Chance de crítico (0..1). */
  sorte: number;
  armadura: number;
  xp: number;
}

export const ATRIBUTOS_BASE: Atributos = {
  vidaMaxima: 100,
  regeneracao: 0,
  velocidade: 1,
  dano: 1,
  area: 1,
  recarga: 1,
  quantidade: 0,
  velocidadeProjetil: 1,
  duracao: 1,
  ima: 3.2,
  sorte: 0.05,
  armadura: 0,
  xp: 1,
};

/** Experiência necessária para sair do nível n. */
export function xpParaNivel(n: number): number {
  return Math.round(5 + (n - 1) * 6 + Math.pow(n - 1, 1.8) * 1.3);
}

export interface Slot {
  id: string;
  nivel: number;
}

export interface EstadoBuild {
  ativas: Slot[];
  passivas: Slot[];
}

/** Atributos finais: base × personagem × passivas. */
export function calcularAtributos(personagem: Partial<Atributos>, build: EstadoBuild): Atributos {
  const a: Atributos = { ...ATRIBUTOS_BASE };
  for (const [k, val] of Object.entries(personagem) as [keyof Atributos, number][]) {
    if (
      k === 'vidaMaxima' ||
      k === 'regeneracao' ||
      k === 'quantidade' ||
      k === 'ima' ||
      k === 'sorte' ||
      k === 'armadura'
    )
      a[k] = k === 'vidaMaxima' ? val : a[k] + val;
    else a[k] = val;
  }
  for (const s of build.passivas) {
    const p = passiva(s.id);
    if (p.modo === 'soma') a[p.atributo] += p.porNivel * s.nivel;
    else a[p.atributo] *= Math.pow(1 + p.porNivel, s.nivel);
  }
  a.recarga = Math.max(0.35, a.recarga);
  return a;
}

/** Valores efetivos de uma habilidade no nível dado, com os atributos aplicados. */
export function valoresHabilidade(
  def: DefHabilidade,
  nivel: number,
  at: Atributos = ATRIBUTOS_BASE
): Valores & { evo5: boolean; evo10: boolean } {
  const b = def.base;
  const n = Math.max(1, Math.min(NIVEL_MAX_HABILIDADE, nivel));
  const evo5 = n >= 5;
  const evo10 = n >= 10;
  const extraQtd = def.maisQuantidade.filter((l) => l <= n).length;
  const fatorDano = (1 + 0.16 * (n - 1)) * (evo5 ? 1.15 : 1) * (evo10 ? 1.3 : 1);
  return {
    dano: b.dano * fatorDano * at.dano,
    recarga: b.recarga * Math.pow(0.955, n - 1) * at.recarga,
    velocidade:
      b.velocidade *
      (1 + 0.03 * (n - 1)) *
      (def.comportamento === 'projetil' ||
      def.comportamento === 'drone' ||
      def.comportamento === 'bumerangue' ||
      def.comportamento === 'ricochete'
        ? at.velocidadeProjetil
        : 1),
    area: b.area * (1 + 0.05 * (n - 1)) * (evo10 ? 1.25 : 1) * at.area,
    quantidade: b.quantidade + extraQtd + Math.floor(at.quantidade),
    duracao: b.duracao * (1 + 0.04 * (n - 1)) * at.duracao,
    perfura: b.perfura + (b.perfura < 50 ? Math.floor((n - 1) / 3) : 0),
    alcance: b.alcance * (1 + 0.02 * (n - 1)),
    evo5,
    evo10,
  };
}

/** Texto curto do que melhora ao ir de n para n+1. */
export function descreverMelhoria(def: DefHabilidade, nivelAtual: number): string {
  if (nivelAtual === 0) return def.descricao;
  const proximo = nivelAtual + 1;
  if (proximo === 5) return `EVOLUÇÃO — ${def.evolucao5}`;
  if (proximo === 10) return `EVOLUÇÃO FINAL — ${def.evolucao10}`;
  const a = valoresHabilidade(def, nivelAtual);
  const b = valoresHabilidade(def, proximo);
  const partes: string[] = [];
  partes.push(`Dano +${Math.round((b.dano / a.dano - 1) * 100)}%`);
  if (b.quantidade > a.quantidade)
    partes.push(
      `+${b.quantidade - a.quantidade} ${def.comportamento === 'cadeia' ? 'salto' : 'unidade'}`
    );
  partes.push(`Recarga −${Math.round((1 - b.recarga / a.recarga) * 100)}%`);
  if (b.perfura > a.perfura && a.perfura < 50) partes.push('+1 perfuração');
  partes.push(`Área +${Math.round((b.area / a.area - 1) * 100)}%`);
  return partes.join(' · ');
}

export interface Oferta {
  tipo: 'ativa' | 'passiva' | 'cura' | 'ouro';
  id: string;
  nivelAtual: number;
  novo: boolean;
  evolucao: boolean;
}

/**
 * Sorteia as opções do nível. Pesos: habilidade que você já tem = 5 (6,5 quando a próxima
 * escolha é uma evolução), passiva que você já tem = 3,5, nova = 1. Respeita 10 ativas e 5 passivas.
 */
export function gerarOfertas(
  build: EstadoBuild,
  aleatorio: () => number,
  quantidade = 3
): Oferta[] {
  const candidatos: { o: Oferta; peso: number }[] = [];
  for (const def of HABILIDADES) {
    const slot = build.ativas.find((s) => s.id === def.id);
    if (slot) {
      if (slot.nivel < NIVEL_MAX_HABILIDADE) {
        const evolucao = slot.nivel + 1 === 5 || slot.nivel + 1 === 10;
        candidatos.push({
          o: { tipo: 'ativa', id: def.id, nivelAtual: slot.nivel, novo: false, evolucao },
          peso: evolucao ? 6.5 : 5,
        });
      }
    } else if (build.ativas.length < MAX_ATIVAS) {
      candidatos.push({
        o: { tipo: 'ativa', id: def.id, nivelAtual: 0, novo: true, evolucao: false },
        peso: 1,
      });
    }
  }
  for (const p of PASSIVAS) {
    const slot = build.passivas.find((s) => s.id === p.id);
    if (slot) {
      if (slot.nivel < NIVEL_MAX_HABILIDADE)
        candidatos.push({
          o: { tipo: 'passiva', id: p.id, nivelAtual: slot.nivel, novo: false, evolucao: false },
          peso: 3.5,
        });
    } else if (build.passivas.length < MAX_PASSIVAS) {
      candidatos.push({
        o: { tipo: 'passiva', id: p.id, nivelAtual: 0, novo: true, evolucao: false },
        peso: 0.9,
      });
    }
  }
  const escolhidas: Oferta[] = [];
  while (escolhidas.length < quantidade && candidatos.length) {
    const total = candidatos.reduce((s, c) => s + c.peso, 0);
    let r = aleatorio() * total;
    let i = 0;
    for (; i < candidatos.length - 1; i++) {
      r -= candidatos[i].peso;
      if (r <= 0) break;
    }
    escolhidas.push(candidatos[i].o);
    candidatos.splice(i, 1);
  }
  if (escolhidas.length === 0) {
    escolhidas.push({ tipo: 'cura', id: 'cura', nivelAtual: 0, novo: false, evolucao: false });
    escolhidas.push({ tipo: 'ouro', id: 'ouro', nivelAtual: 0, novo: false, evolucao: false });
  }
  return escolhidas;
}

/** Aplica a escolha na build (retorna o novo nível). */
export function aplicarOferta(build: EstadoBuild, o: Oferta): number {
  if (o.tipo === 'ativa' || o.tipo === 'passiva') {
    const lista = o.tipo === 'ativa' ? build.ativas : build.passivas;
    const slot = lista.find((s) => s.id === o.id);
    if (slot) {
      slot.nivel = Math.min(NIVEL_MAX_HABILIDADE, slot.nivel + 1);
      return slot.nivel;
    }
    if (o.tipo === 'ativa' && lista.length >= MAX_ATIVAS) return 0;
    if (o.tipo === 'passiva' && lista.length >= MAX_PASSIVAS) return 0;
    lista.push({ id: o.id, nivel: 1 });
    return 1;
  }
  return 0;
}

export { habilidade, passiva };
