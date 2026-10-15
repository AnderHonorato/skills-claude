/**
 * Armas mágicas: cada uma define o estilo de luta e uma habilidade especial.
 * Elas flutuam ao lado do Claude, guiadas por magia, e crescem na hora do golpe.
 * Ganham experiência ao acertar e derrotar inimigos e sobem até o nível 5.
 */
import type { IdArma } from '../nucleo/tipos';

export type TipoGolpe = 'corte' | 'esmagar' | 'projetil' | 'escudo';

export interface DefinicaoArma {
  id: IdArma;
  nome: string;
  categoria: 'Galho' | 'Arma' | 'Magia' | 'Escudo';
  descricao: string;
  tipo: TipoGolpe;
  /** Dano base (em pontos de vida dos inimigos). */
  dano: number;
  /** Alcance do golpe (m) e abertura do arco (graus). */
  alcance: number;
  arco: number;
  /** Intervalo mínimo entre golpes (s). */
  recarga: number;
  empurrao: number;
  /** Quantos golpes formam o combo. */
  combo: number;
  /** Quanto a arma cresce no golpe. */
  crescimento: number;
  cor: string;
  brilho: string;
  especial: { nome: string; descricao: string; custo: number; nivel: number };
  /** O que cada nível traz (índice 0 = nível 1). */
  niveis: string[];
}

export const XP_NIVEIS = [0, 25, 70, 140, 250];
export const NIVEL_MAXIMO = 5;

export const ARMAS: Record<IdArma, DefinicaoArma> = {
  galho: {
    id: 'galho',
    nome: 'Galho Mágico',
    categoria: 'Galho',
    descricao: 'Leve e rápido. Combo de golpes que espalham folhas.',
    tipo: 'corte',
    dano: 1,
    alcance: 2.1,
    arco: 140,
    recarga: 0.24,
    empurrao: 3,
    combo: 3,
    crescimento: 1.9,
    cor: '#8a5a3b',
    brilho: '#b8f28a',
    especial: {
      nome: 'Redemoinho de Folhas',
      descricao: 'Giro de 360° que acerta tudo em volta.',
      custo: 25,
      nivel: 2,
    },
    niveis: [
      'Combo de 3 golpes',
      'Libera Redemoinho de Folhas',
      '+40% de dano',
      'Redemoinho maior e mais longo',
      'Folhas douradas: golpes críticos',
    ],
  },
  espada: {
    id: 'espada',
    nome: 'Espada de Madeira',
    categoria: 'Arma',
    descricao: 'Equilibrada. O terceiro golpe é uma estocada longa.',
    tipo: 'corte',
    dano: 1.6,
    alcance: 2.5,
    arco: 120,
    recarga: 0.3,
    empurrao: 4,
    combo: 3,
    crescimento: 2.2,
    cor: '#c79a5b',
    brilho: '#ffe28a',
    especial: {
      nome: 'Investida',
      descricao: 'Avança cortando tudo no caminho.',
      custo: 25,
      nivel: 2,
    },
    niveis: [
      'Combo com estocada',
      'Libera Investida',
      '+40% de dano',
      'Investida atravessa e atordoa',
      'Lâmina de luz: críticos',
    ],
  },
  martelo: {
    id: 'martelo',
    nome: 'Martelo de Borracha',
    categoria: 'Arma',
    descricao: 'Lento e pesado. Empurra longe e quica nos inimigos.',
    tipo: 'esmagar',
    dano: 2.4,
    alcance: 2.3,
    arco: 100,
    recarga: 0.55,
    empurrao: 9,
    combo: 2,
    crescimento: 2.4,
    cor: '#e5534b',
    brilho: '#ffb4a8',
    especial: {
      nome: 'Tremor',
      descricao: 'Pancada no chão com onda de choque. No ar, vira mergulho.',
      custo: 30,
      nivel: 2,
    },
    niveis: [
      'Golpe que empurra longe',
      'Libera Tremor',
      '+40% de dano',
      'Onda de choque maior',
      'Borracha estelar: atordoa',
    ],
  },
  colher: {
    id: 'colher',
    nome: 'Colher Gigante',
    categoria: 'Arma',
    descricao: 'Joga os inimigos para o alto. Divertida e caótica.',
    tipo: 'esmagar',
    dano: 1.5,
    alcance: 2.4,
    arco: 150,
    recarga: 0.36,
    empurrao: 5,
    combo: 2,
    crescimento: 2.1,
    cor: '#cfd8e3',
    brilho: '#bfe8ff',
    especial: {
      nome: 'Catapulta',
      descricao: 'Lança os inimigos próximos para o céu.',
      custo: 25,
      nivel: 2,
    },
    niveis: [
      'Golpe que levanta',
      'Libera Catapulta',
      '+40% de dano',
      'Catapulta puxa inimigos',
      'Colher de prata: críticos',
    ],
  },
  cajado: {
    id: 'cajado',
    nome: 'Cajado de Ideias',
    categoria: 'Magia',
    descricao: 'Dispara orbes de ideia à distância.',
    tipo: 'projetil',
    dano: 1.2,
    alcance: 12,
    arco: 0,
    recarga: 0.32,
    empurrao: 2.5,
    combo: 1,
    crescimento: 1.6,
    cor: '#7a5cff',
    brilho: '#c9b8ff',
    especial: {
      nome: 'Chuva de Ideias',
      descricao: 'Cinco orbes que perseguem os inimigos.',
      custo: 30,
      nivel: 2,
    },
    niveis: [
      'Orbe de ideia',
      'Libera Chuva de Ideias',
      '+40% de dano',
      'Orbes atravessam inimigos',
      'Orbes que explodem',
    ],
  },
  escudo: {
    id: 'escudo',
    nome: 'Escudo de Tampa',
    categoria: 'Escudo',
    descricao: 'Segure o ataque para defender e refletir. Toque para empurrar.',
    tipo: 'escudo',
    dano: 1,
    alcance: 1.9,
    arco: 120,
    recarga: 0.35,
    empurrao: 7,
    combo: 1,
    crescimento: 1.8,
    cor: '#9aa7b4',
    brilho: '#a8f0ff',
    especial: {
      nome: 'Domo de Luz',
      descricao: 'Bolha que deixa você invencível por alguns segundos.',
      custo: 35,
      nivel: 2,
    },
    niveis: [
      'Defesa e empurrão',
      'Libera Domo de Luz',
      'Reflexo devolve o dobro',
      'Domo dura mais',
      'Escudo brilhante: cura ao defender',
    ],
  },
};

export const ORDEM_ARMAS: IdArma[] = ['galho', 'espada', 'martelo', 'colher', 'cajado', 'escudo'];

export function nivelPorXp(xp: number): number {
  let n = 1;
  for (let i = 1; i < XP_NIVEIS.length; i++) if (xp >= XP_NIVEIS[i]) n = i + 1;
  return Math.min(NIVEL_MAXIMO, n);
}

/** Progresso (0..1) até o próximo nível; 1 no nível máximo. */
export function progressoNivel(xp: number): number {
  const n = nivelPorXp(xp);
  if (n >= NIVEL_MAXIMO) return 1;
  const a = XP_NIVEIS[n - 1];
  const b = XP_NIVEIS[n];
  return (xp - a) / (b - a);
}

/** Dano efetivo considerando o nível (+40% a partir do nível 3). */
export function danoArma(id: IdArma, nivel: number): number {
  const base = ARMAS[id].dano;
  return base * (nivel >= 3 ? 1.4 : 1) * (1 + (nivel - 1) * 0.05);
}
