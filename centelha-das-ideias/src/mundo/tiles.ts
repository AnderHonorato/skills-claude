import { ALTURA_PLATAFORMA, ALTURA_PLATAFORMA_ALTA } from '../configuracao';

/**
 * Legenda dos mapas ASCII. Uma única tabela para todas as regiões; o TEMA da região muda
 * a aparência (ex.: '#' é penhasco no Jardim, parede de madeira na Oficina).
 */
export interface InfoBloco {
  nome: string;
  /** Superfície onde se pode ficar (não é vão). */
  chao: boolean;
  /** Altura da superfície (0, 24, 48). */
  alturaChao: number;
  /** Altura do obstáculo acima da superfície; Infinity = parede; 0 = livre. */
  obstaculo: number;
  /** Água rasa: reduz velocidade. */
  agua?: boolean;
  bloqueiaVisao?: boolean;
  /** Precisa ser desenhado na passada ordenada (tem volume). */
  alto?: boolean;
  /** Pode ser cortado/quebrado e vira o código indicado. */
  quebravel?: { por: 'qualquer' | 'martelo'; vira: string };
}

const INF = Number.POSITIVE_INFINITY;

export const BLOCOS: Record<string, InfoBloco> = {
  ' ': { nome: 'vazio', chao: false, alturaChao: 0, obstaculo: 0 },
  '.': { nome: 'grama', chao: true, alturaChao: 0, obstaculo: 0 },
  ',': { nome: 'flores', chao: true, alturaChao: 0, obstaculo: 0 },
  ':': { nome: 'trilha', chao: true, alturaChao: 0, obstaculo: 0 },
  '=': { nome: 'madeira', chao: true, alturaChao: 0, obstaculo: 0 },
  _: { nome: 'pedra', chao: true, alturaChao: 0, obstaculo: 0 },
  '+': { nome: 'metal', chao: true, alturaChao: 0, obstaculo: 0 },
  '~': { nome: 'aguaRasa', chao: true, alturaChao: 0, obstaculo: 0, agua: true },
  w: { nome: 'aguaFunda', chao: false, alturaChao: 0, obstaculo: 0 },
  s: { nome: 'pedraTravessia', chao: true, alturaChao: 0, obstaculo: 0 },
  b: { nome: 'ponte', chao: true, alturaChao: 0, obstaculo: 0 },
  L: { nome: 'ponteDeLuz', chao: true, alturaChao: 0, obstaculo: 0 },
  i: { nome: 'pisoRevelado', chao: true, alturaChao: 0, obstaculo: 0 },
  '#': {
    nome: 'parede',
    chao: true,
    alturaChao: 0,
    obstaculo: INF,
    bloqueiaVisao: true,
    alto: true,
  },
  T: { nome: 'arvore', chao: true, alturaChao: 0, obstaculo: INF, bloqueiaVisao: true, alto: true },
  o: { nome: 'rochaBaixa', chao: true, alturaChao: 0, obstaculo: 14, alto: true },
  h: { nome: 'cerca', chao: true, alturaChao: 0, obstaculo: 12, alto: true },
  P: { nome: 'plataforma', chao: true, alturaChao: ALTURA_PLATAFORMA, obstaculo: 0, alto: true },
  Q: {
    nome: 'plataformaAlta',
    chao: true,
    alturaChao: ALTURA_PLATAFORMA_ALTA,
    obstaculo: 0,
    alto: true,
  },
  X: {
    nome: 'paredeRachada',
    chao: true,
    alturaChao: 0,
    obstaculo: INF,
    bloqueiaVisao: true,
    alto: true,
    quebravel: { por: 'martelo', vira: '_' },
  },
  r: {
    nome: 'espinhoRuido',
    chao: true,
    alturaChao: 0,
    obstaculo: INF,
    alto: true,
    quebravel: { por: 'qualquer', vira: '.' },
  },
  F: {
    nome: 'fronteira',
    chao: true,
    alturaChao: 0,
    obstaculo: INF,
    bloqueiaVisao: true,
    alto: true,
  },
};

export function infoBloco(codigo: string): InfoBloco {
  return BLOCOS[codigo] ?? BLOCOS[' ']!;
}

export const CODIGO_FRONTEIRA = 'F';
