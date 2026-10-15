/**
 * Receitas de todos os efeitos sonoros de `SONS`. Cada receita sintetiza o som
 * a partir do tempo `t`, multiplicando as alturas por `tom` (já com a variação
 * aleatória leve aplicada pelo motor). Personalidade: fofo e satisfatório.
 */
import type { IdSom, OpcoesSom } from './contrato';
import { bipFala, perfilDe, vocalizar, type EstadoVoz } from './falas';
import { hz, type CorRuido, type Kit, type Parcial } from './sintese';

export interface EstadoSons {
  falas: Map<string, EstadoVoz>;
}

export type Receita = (
  k: Kit,
  s: AudioNode,
  t: number,
  tom: number,
  o: OpcoesSom,
  e: EstadoSons
) => void;

export interface MetaSom {
  /** Ganho base. */
  g: number;
  /** Variação aleatória de tom (fração, ±). */
  v: number;
  /** Intervalo mínimo entre repetições do mesmo som (s). */
  i: number;
  /** Prioridade (1 baixa, 3 alta) para roubo de vozes. */
  p: 1 | 2 | 3;
  /** Máximo de instâncias simultâneas do mesmo som. */
  n: number;
  /** Envio para reverberação e eco. */
  rev: number;
  eco: number;
  /** Interface: continua tocando durante a pausa. */
  ui?: boolean;
}

export interface DefinicaoSom {
  meta: MetaSom;
  tocar: Receita;
  /** Envios que dependem das opções (ex.: eco da voz de Ressoa). */
  envios?: (o: OpcoesSom) => { rev?: number; eco?: number };
}

const meta = (m: Partial<MetaSom> = {}): MetaSom => ({
  g: 1,
  v: 0.03,
  i: 0.03,
  p: 2,
  n: 4,
  rev: 0.08,
  eco: 0,
  ...m,
});

// ---------------------------------------------------------------------------
// pequenos blocos reutilizáveis
// ---------------------------------------------------------------------------

/** Clique curto (ruído em passa-banda). */
function estalo(k: Kit, s: AudioNode, t: number, f: number, p: number, d = 0.014, q = 2.5): void {
  k.ruido(s, t, { env: { a: 0.001, d, p }, filtro: { tipo: 'bandpass', f, q } });
}

/** Baque grave com queda de altura. */
function baque(
  k: Kit,
  s: AudioNode,
  t: number,
  f0: number,
  f1: number,
  d: number,
  p: number
): void {
  k.osc(s, t, {
    f: [
      [0, f0],
      [d * 0.6, f1],
    ],
    env: { a: 0.002, d, p },
  });
}

/** Sopro (golpe no ar): ruído com passa-banda varrendo de f0 a f1. */
function sopro(
  k: Kit,
  s: AudioNode,
  t: number,
  f0: number,
  f1: number,
  d: number,
  p: number,
  q = 1.6,
  cor: CorRuido = 'branco'
): void {
  k.ruido(s, t, {
    cor,
    env: { a: d * 0.3, d: d * 0.75, p },
    filtro: {
      tipo: 'bandpass',
      f: [
        [0, f0],
        [d * 0.8, f1],
      ],
      q,
    },
  });
}

const SINO_CLARO: readonly Parcial[] = [
  [1, 1, 0.5],
  [2.0, 0.3, 0.3],
  [3.0, 0.12, 0.2],
];
const SINO_CURTO: readonly Parcial[] = [
  [1, 1, 0.35],
  [2.0, 0.25, 0.18],
];
const SINO_LONGO: readonly Parcial[] = [
  [1, 1, 1.6],
  [2.0, 0.45, 0.9],
  [3.0, 0.22, 0.6],
  [4.16, 0.1, 0.4],
];
const CRISTAL: readonly Parcial[] = [
  [1, 1, 0.55],
  [2.0, 0.35, 0.32],
  [3.01, 0.2, 0.2],
  [4.17, 0.12, 0.14],
];

/** Notinha de "videogame" (onda quadrada filtrada) com envelope curto. */
function bip(k: Kit, s: AudioNode, t: number, f: number, p: number, d = 0.1, corte = 3200): void {
  k.osc(s, t, {
    tipo: 'square',
    f,
    env: { a: 0.003, d: d * 0.6, s: 0.35, h: d * 0.2, r: d * 0.4, p },
    filtro: { tipo: 'lowpass', f: corte },
  });
}

/** Nota quente e sustentada (pad curto). */
function nota(
  k: Kit,
  s: AudioNode,
  t: number,
  f: number,
  p: number,
  dur: number,
  tipo: 'triangle' | 'suave' | 'sawtooth' = 'triangle',
  corte = 2400
): void {
  k.osc(s, t, {
    tipo,
    f,
    env: { a: Math.min(0.05, dur * 0.2), d: dur * 0.3, s: 0.6, h: dur * 0.4, r: dur * 0.5, p },
    filtro: { tipo: 'lowpass', f: corte },
    vib: { f: 5.5, c: 10, atraso: dur * 0.3 },
  });
}

/** Chuvisco de brilho agudo (ruído em passa-alta). */
function brilho(k: Kit, s: AudioNode, t: number, d: number, p: number, f = 6500): void {
  k.ruido(s, t, { env: { a: d * 0.15, d: d * 0.85, p }, filtro: { tipo: 'highpass', f } });
}

/** Rajadas de estática (criaturas de Ruído). */
function estatica(k: Kit, s: AudioNode, t: number, dur: number, n: number, p: number): void {
  for (let i = 0; i < n; i++) {
    const tt = t + k.rnd() * dur;
    k.ruido(s, tt, {
      env: { a: 0.001, d: 0.015 + k.rnd() * 0.03, p: p * (0.5 + k.rnd() * 0.5) },
      filtro: { tipo: 'bandpass', f: 1500 + k.rnd() * 4000, q: 2 },
    });
  }
}

const PENTA = [0, 2, 4, 7, 9];

// ---------------------------------------------------------------------------
// receitas
// ---------------------------------------------------------------------------

export const DEFINICOES_SONS: Record<IdSom, DefinicaoSom> = {
  // ----- movimento -----
  passo: {
    meta: meta({ g: 0.8, v: 0.1, i: 0.07, p: 1, n: 3, rev: 0 }),
    tocar(k, s, t, tom) {
      // "tup" macio: baquezinho + toque abafado de patinha
      baque(k, s, t, 160 * tom, 75 * tom, 0.07, 0.5);
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.002, d: 0.05, p: 0.32 },
        filtro: { tipo: 'lowpass', f: 950 * tom, q: 0.8 },
      });
      estalo(k, s, t + 0.004, 1900 * tom, 0.07, 0.012, 2);
    },
  },
  passoAgua: {
    meta: meta({ g: 0.8, v: 0.1, i: 0.08, p: 1, n: 3, rev: 0.05 }),
    tocar(k, s, t, tom) {
      // "plic": respingo + bolhinha subindo
      k.ruido(s, t, {
        env: { a: 0.004, d: 0.12, p: 0.28 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 900 * tom],
            [0.1, 2600 * tom],
          ],
          q: 1.2,
        },
      });
      k.osc(s, t + 0.012, {
        f: [
          [0, 380 * tom],
          [0.07, 950 * tom],
        ],
        env: { a: 0.004, d: 0.08, p: 0.32 },
      });
    },
  },
  pulo: {
    meta: meta({ g: 0.9, v: 0.05, i: 0.06, p: 2, n: 2, rev: 0.04 }),
    tocar(k, s, t, tom) {
      // "buíp" subindo, fofo
      k.osc(s, t, {
        tipo: 'triangle',
        f: [
          [0, 260 * tom],
          [0.13, 720 * tom],
        ],
        env: { a: 0.006, d: 0.16, p: 0.5 },
      });
      k.osc(s, t, {
        f: [
          [0, 520 * tom],
          [0.13, 1440 * tom],
        ],
        env: { a: 0.006, d: 0.1, p: 0.1 },
      });
      sopro(k, s, t, 700, 2200, 0.13, 0.1, 0.8, 'rosa');
    },
  },
  aterrissagem: {
    meta: meta({ g: 0.9, v: 0.05, i: 0.08, p: 1, n: 2, rev: 0 }),
    tocar(k, s, t, tom) {
      baque(k, s, t, 135 * tom, 55 * tom, 0.15, 0.7);
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.003, d: 0.12, p: 0.45 },
        filtro: { tipo: 'lowpass', f: 520 * tom },
      });
      estalo(k, s, t, 1500, 0.1, 0.04, 1);
    },
  },
  esquiva: {
    meta: meta({ g: 0.9, v: 0.05, i: 0.1, p: 2, n: 2, rev: 0.03 }),
    tocar(k, s, t, tom) {
      // "fuish" rápido e arejado
      k.ruido(s, t, {
        env: { a: 0.03, d: 0.17, p: 0.42 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 600 * tom],
            [0.08, 2800 * tom],
            [0.2, 1500 * tom],
          ],
          q: 1.4,
        },
      });
      k.osc(s, t, {
        f: [
          [0, 700 * tom],
          [0.12, 1500 * tom],
        ],
        env: { a: 0.01, d: 0.12, p: 0.07 },
      });
    },
  },
  quedaVao: {
    meta: meta({ g: 0.85, v: 0.02, i: 0.5, p: 3, n: 1, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // apito de queda de desenho animado + "puf" lá embaixo
      k.osc(s, t, {
        f: [
          [0, 1100 * tom],
          [0.75, 220 * tom],
        ],
        env: { a: 0.02, d: 0.15, s: 0.8, h: 0.45, r: 0.15, p: 0.32 },
        vib: { f: 7, c: 35 },
      });
      k.ruido(s, t + 0.78, {
        cor: 'rosa',
        env: { a: 0.01, d: 0.25, p: 0.22 },
        filtro: { tipo: 'lowpass', f: 700 },
      });
      baque(k, s, t + 0.78, 160, 80, 0.2, 0.28);
    },
  },
  derrota: {
    meta: meta({ g: 0.9, v: 0, i: 1, p: 3, n: 1, rev: 0.25 }),
    tocar(k, s, t, tom) {
      // gentil: desce até a tônica (sem tom de castigo) e termina com um "plim" de esperança
      [67, 64, 60].forEach((n, i) =>
        k.osc(s, t + i * 0.32, {
          tipo: 'suave',
          f: hz(n) * tom,
          env: { a: 0.02, d: 0.25, s: 0.6, h: 0.15, r: 0.35, p: 0.28 },
          filtro: { tipo: 'lowpass', f: 1800 },
          vib: { f: 5, c: 12, atraso: 0.1 },
        })
      );
      for (const n of [48, 55, 64])
        k.osc(s, t, {
          tipo: 'triangle',
          f: hz(n) * tom,
          env: { a: 0.3, d: 0.4, s: 0.7, h: 0.6, r: 0.6, p: 0.07 },
          filtro: { tipo: 'lowpass', f: 900 },
        });
      k.sino(s, t + 1.25, hz(79) * tom, SINO_CLARO, 0.16);
    },
  },

  // ----- armas (o "whoosh" do golpe com a personalidade de cada arma) -----
  ataqueEspada: {
    meta: meta({ g: 0.85, v: 0.06, i: 0.05, p: 2, n: 3, rev: 0.03 }),
    tocar(k, s, t, tom) {
      // sopro curto + "tok" amadeirado (dois modos ressonantes)
      sopro(k, s, t, 900 * tom, 2600 * tom, 0.15, 0.4, 2);
      k.osc(s, t + 0.005, { f: 820 * tom, env: { a: 0.001, d: 0.07, p: 0.34 } });
      k.osc(s, t + 0.005, { f: 1430 * tom, env: { a: 0.001, d: 0.04, p: 0.16 } });
      estalo(k, s, t, 2300 * tom, 0.2, 0.012, 3);
    },
  },
  ataqueColher: {
    meta: meta({ g: 0.85, v: 0.05, i: 0.08, p: 2, n: 3, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // sopro largo + "plom" metálico oco (FM inarmônica com leve queda)
      sopro(k, s, t, 500 * tom, 1600 * tom, 0.22, 0.36, 1.6);
      k.fm(s, t + 0.03, {
        f: [
          [0, 560 * tom],
          [0.25, 505 * tom],
        ],
        razao: 1.48,
        dev: [
          [0, 650 * tom],
          [0.22, 40 * tom],
        ],
        env: { a: 0.002, d: 0.45, p: 0.3 },
      });
      baque(k, s, t + 0.03, 300 * tom, 235 * tom, 0.2, 0.24);
    },
  },
  ataqueMartelo: {
    meta: meta({ g: 0.85, v: 0.04, i: 0.12, p: 2, n: 2, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // sopro pesado + "boing" emborrachado que quica três vezes
      sopro(k, s, t, 300 * tom, 1000 * tom, 0.28, 0.42, 1.2, 'rosa');
      [0, 0.2, 0.34, 0.44].forEach((dt, i) => {
        const sobe = 1 + i * 0.06;
        k.osc(s, t + 0.12 + dt, {
          f: [
            [0, 190 * tom * sobe],
            [0.05, 290 * tom * sobe],
            [0.16, 175 * tom],
          ],
          env: { a: 0.004, d: 0.2 - i * 0.035, p: 0.42 * Math.pow(0.55, i) },
          vib: { f: 14, c: 90 },
        });
      });
    },
  },
  ataqueCajado: {
    meta: meta({ g: 0.8, v: 0.03, i: 0.08, p: 2, n: 3, rev: 0.18 }),
    tocar(k, s, t, tom) {
      // "tlim" cristalino + sopro mágico
      k.ruido(s, t, {
        env: { a: 0.02, d: 0.14, p: 0.16 },
        filtro: {
          tipo: 'highpass',
          f: [
            [0, 2000 * tom],
            [0.14, 6000 * tom],
          ],
        },
      });
      k.sino(s, t + 0.01, 1568 * tom, CRISTAL, 0.26);
      k.osc(s, t, {
        f: [
          [0, 1200 * tom],
          [0.08, 2400 * tom],
        ],
        env: { a: 0.005, d: 0.09, p: 0.07 },
      });
    },
  },

  // ----- acertos, bloqueio e dano -----
  acerto: {
    meta: meta({ g: 0.9, v: 0.05, i: 0.03, p: 2, n: 4, rev: 0.04 }),
    tocar(k, s, t, tom) {
      // "pof!": baque + estalo brilhante + pop tonal
      baque(k, s, t, 240 * tom, 90 * tom, 0.11, 0.68);
      k.ruido(s, t, {
        env: { a: 0.001, d: 0.035, p: 0.4 },
        filtro: { tipo: 'highpass', f: 2000 * tom },
      });
      k.osc(s, t + 0.004, {
        tipo: 'triangle',
        f: [
          [0, 700 * tom],
          [0.06, 470 * tom],
        ],
        env: { a: 0.002, d: 0.08, p: 0.26 },
      });
    },
  },
  acertoForte: {
    meta: meta({ g: 0.9, v: 0.04, i: 0.05, p: 2, n: 3, rev: 0.12 }),
    tocar(k, s, t, tom) {
      // "POW!": baque fundo, crocância e brilho em quinta
      baque(k, s, t, 180 * tom, 50 * tom, 0.24, 0.85);
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.001, d: 0.12, p: 0.5 },
        filtro: { tipo: 'bandpass', f: 1400 * tom, q: 0.9 },
      });
      k.ruido(s, t, { env: { a: 0.001, d: 0.03, p: 0.36 }, filtro: { tipo: 'highpass', f: 3000 } });
      k.osc(s, t + 0.005, {
        tipo: 'square',
        f: [
          [0, 520 * tom],
          [0.08, 330 * tom],
        ],
        env: { a: 0.002, d: 0.1, p: 0.1 },
        filtro: { tipo: 'lowpass', f: 2500 },
      });
      k.sino(
        s,
        t + 0.04,
        1318 * tom,
        [
          [1, 1, 0.3],
          [1.5, 0.6, 0.25],
          [2.0, 0.3, 0.2],
        ],
        0.1
      );
    },
  },
  bloqueado: {
    meta: meta({ g: 0.85, v: 0.04, i: 0.06, p: 2, n: 3, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // "tónc" metálico abafado + duas notinhas descendo ("não passou")
      k.fm(s, t, {
        f: 410 * tom,
        razao: 2.41,
        dev: [
          [0, 900 * tom],
          [0.1, 50 * tom],
        ],
        env: { a: 0.001, d: 0.22, p: 0.3 },
      });
      k.osc(s, t, {
        tipo: 'triangle',
        f: [
          [0, 260 * tom],
          [0.1, 200 * tom],
        ],
        env: { a: 0.002, d: 0.12, p: 0.32 },
      });
      estalo(k, s, t, 3500, 0.26, 0.02, 2);
      bip(k, s, t + 0.08, hz(74) * tom, 0.06, 0.08, 2000);
      bip(k, s, t + 0.16, hz(70) * tom, 0.06, 0.1, 2000);
    },
  },
  danoRecebido: {
    meta: meta({ g: 1, v: 0.03, i: 0.15, p: 3, n: 1, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // Claude atingido: baque mais grave + crocância + "ui!" sintetizado
      baque(k, s, t, 170 * tom, 60 * tom, 0.18, 0.75);
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.001, d: 0.07, p: 0.36 },
        filtro: { tipo: 'bandpass', f: 900, q: 1.2 },
      });
      vocalizar(k, s, t + 0.025, {
        f0: [
          [0, 430 * tom],
          [0.06, 560 * tom],
          [0.2, 400 * tom],
        ],
        dur: 0.22,
        p: 0.62,
        vogais: [
          ['u', 0],
          ['i', 0.09],
        ],
        formantes: 1.2,
        tipo: 'sawtooth',
        vib: { f: 9, c: 30 },
        respiro: 0.06,
      });
    },
  },

  // ----- habilidades -----
  curar: {
    meta: meta({ g: 0.85, v: 0.01, i: 0.3, p: 2, n: 1, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // bolhas do caldo + arpejo quentinho
      for (let i = 0; i < 4; i++) {
        const tt = t + i * 0.09 + k.rnd() * 0.02;
        k.osc(s, tt, {
          f: [
            [0, (300 + i * 60) * tom],
            [0.06, (600 + i * 90) * tom],
          ],
          env: { a: 0.004, d: 0.07, p: 0.2 },
        });
      }
      [72, 76, 79, 84].forEach((n, i) => nota(k, s, t + 0.3 + i * 0.08, hz(n) * tom, 0.14, 0.5));
      k.sino(s, t + 0.62, hz(88) * tom, SINO_CURTO, 0.08);
    },
  },
  observar: {
    meta: meta({ g: 0.85, v: 0.01, i: 0.3, p: 2, n: 2, rev: 0.3 }),
    tocar(k, s, t, tom) {
      // onda que se expande + cintilância pentatônica
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.2, d: 0.9, p: 0.16 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 400 * tom],
            [0.9, 3200 * tom],
          ],
          q: 2,
        },
      });
      k.osc(s, t, {
        f: [
          [0, 330 * tom],
          [0.5, 660 * tom],
        ],
        env: { a: 0.1, d: 0.3, s: 0.5, h: 0.2, r: 0.4, p: 0.11 },
        vib: { f: 9, c: 25 },
      });
      for (let i = 0; i < 8; i++) {
        const n = 84 + PENTA[Math.floor(k.rnd() * 5) % 5] + (i > 4 ? 12 : 0);
        k.sino(s, t + 0.05 + i * 0.07 + k.rnd() * 0.03, hz(n) * tom, SINO_CURTO, 0.07);
      }
    },
  },
  revelar: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.15, p: 2, n: 2, rev: 0.25 }),
    tocar(k, s, t, tom) {
      // "ta-dim": quinta ascendente cristalina
      k.sino(s, t, hz(79) * tom, CRISTAL, 0.2);
      k.sino(s, t + 0.12, hz(86) * tom, SINO_LONGO, 0.18);
      brilho(k, s, t + 0.1, 0.5, 0.05);
    },
  },
  conectarInicio: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.1, p: 2, n: 2, rev: 0.08 }),
    tocar(k, s, t, tom) {
      // "zuip" elétrico subindo: o fio sendo lançado
      k.osc(s, t, {
        tipo: 'sawtooth',
        f: [
          [0, 220 * tom],
          [0.18, 880 * tom],
        ],
        env: { a: 0.01, d: 0.25, p: 0.18 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 600],
            [0.2, 2400],
          ],
          q: 3,
        },
      });
      k.osc(s, t, {
        tipo: 'square',
        f: [
          [0, 440 * tom],
          [0.18, 1760 * tom],
        ],
        env: { a: 0.01, d: 0.12, p: 0.04 },
        filtro: { tipo: 'lowpass', f: 3000 },
      });
      brilho(k, s, t, 0.08, 0.07, 4000);
    },
  },
  conectarOk: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.1, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // encaixe: clique + terça/quinta cristalinas + zumbido de energia fluindo
      estalo(k, s, t, 3000, 0.28, 0.015, 2);
      k.sino(s, t + 0.02, hz(76) * tom, SINO_CLARO, 0.2);
      k.sino(s, t + 0.1, hz(83) * tom, SINO_CLARO, 0.2);
      k.osc(s, t + 0.02, {
        tipo: 'sawtooth',
        f: 110 * tom,
        env: { a: 0.05, d: 0.1, s: 0.6, h: 0.15, r: 0.25, p: 0.07 },
        filtro: {
          tipo: 'lowpass',
          f: [
            [0, 300],
            [0.3, 1200],
            [0.6, 400],
          ],
        },
      });
    },
  },
  conectarFalha: {
    meta: meta({ g: 0.85, v: 0.02, i: 0.15, p: 2, n: 1, rev: 0.05 }),
    tocar(k, s, t, tom) {
      // faísca cinza que engasga + "ih-oh" suave
      k.osc(s, t, {
        tipo: 'sawtooth',
        f: [
          [0, 160 * tom],
          [0.3, 95 * tom],
        ],
        env: { a: 0.005, d: 0.32, p: 0.13 },
        filtro: { tipo: 'lowpass', f: 1400 },
      });
      estatica(k, s, t, 0.25, 5, 0.17);
      nota(k, s, t + 0.12, hz(67) * tom, 0.13, 0.14);
      k.osc(s, t + 0.28, {
        tipo: 'triangle',
        f: [
          [0, hz(63) * tom],
          [0.2, hz(62) * tom],
        ],
        env: { a: 0.01, d: 0.1, s: 0.5, h: 0.08, r: 0.15, p: 0.13 },
      });
    },
  },
  desconectar: {
    meta: meta({ g: 0.85, v: 0.04, i: 0.06, p: 2, n: 2, rev: 0.04 }),
    tocar(k, s, t, tom) {
      // "plup" descendo: fio se soltando
      k.osc(s, t, {
        f: [
          [0, 900 * tom],
          [0.12, 260 * tom],
        ],
        env: { a: 0.002, d: 0.14, p: 0.28 },
      });
      k.ruido(s, t, {
        env: { a: 0.001, d: 0.012, p: 0.18 },
        filtro: { tipo: 'highpass', f: 3000 },
      });
    },
  },
  criarPonte: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.2, p: 2, n: 2, rev: 0.25 }),
    tocar(k, s, t, tom) {
      // arpejo de luz subindo + brilho sustentado
      [72, 76, 79, 84, 88, 91].forEach((n, i) =>
        k.osc(s, t + i * 0.06, {
          tipo: 'sawtooth',
          f: hz(n) * tom,
          env: { a: 0.003, d: 0.35, p: 0.09 },
          filtro: {
            tipo: 'lowpass',
            f: [
              [0, 5000],
              [0.3, 900],
            ],
          },
        })
      );
      for (const n of [72, 76, 79])
        k.osc(s, t + 0.1, {
          tipo: 'triangle',
          f: hz(n) * tom,
          env: { a: 0.25, d: 0.3, s: 0.6, h: 0.3, r: 0.5, p: 0.06 },
          vib: { f: 5.5, c: 10 },
        });
      k.ruido(s, t + 0.05, {
        env: { a: 0.3, d: 0.6, p: 0.05 },
        filtro: {
          tipo: 'highpass',
          f: [
            [0, 3000],
            [0.6, 8000],
          ],
        },
      });
    },
  },
  criarEscudo: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.2, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // bolha: "buóomp" com ondulação aquosa
      k.osc(s, t, {
        f: [
          [0, 180 * tom],
          [0.18, 620 * tom],
        ],
        env: { a: 0.01, d: 0.3, p: 0.38 },
        vib: { f: 18, c: 60 },
      });
      k.fm(s, t + 0.05, {
        f: 880 * tom,
        razao: 1.5,
        dev: [
          [0, 300],
          [0.4, 20],
        ],
        env: { a: 0.05, d: 0.5, p: 0.07 },
      });
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.08, d: 0.3, p: 0.1 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 400],
            [0.3, 1800],
          ],
          q: 2,
        },
      });
    },
  },
  criarAliado: {
    meta: meta({ g: 0.85, v: 0.02, i: 0.2, p: 2, n: 2, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // vagalume: três piados subindo + sininho
      [0, 0.07, 0.14].forEach((dt, i) =>
        k.osc(s, t + dt, {
          f: [
            [0, (1700 + i * 350) * tom],
            [0.05, (2300 + i * 350) * tom],
          ],
          env: { a: 0.003, d: 0.06, p: 0.15 },
        })
      );
      k.sino(s, t + 0.24, hz(91) * tom, SINO_CURTO, 0.13);
      nota(k, s, t + 0.2, hz(79) * tom, 0.07, 0.4);
    },
  },
  refletir: {
    meta: meta({ g: 0.85, v: 0.04, i: 0.06, p: 2, n: 3, rev: 0.12 }),
    tocar(k, s, t, tom) {
      // "ping-zuóim": rebate brilhante
      k.osc(s, t, {
        f: [
          [0, 1200 * tom],
          [0.05, 2600 * tom],
        ],
        env: { a: 0.001, d: 0.08, p: 0.24 },
      });
      k.fm(s, t + 0.02, {
        f: 1800 * tom,
        razao: 1.41,
        dev: [
          [0, 1200],
          [0.3, 30],
        ],
        env: { a: 0.001, d: 0.35, p: 0.12 },
      });
      k.ruido(s, t, { env: { a: 0.001, d: 0.02, p: 0.22 }, filtro: { tipo: 'highpass', f: 4000 } });
    },
  },
  energizar: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.15, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // zumbido subindo (energia chegando) + carrilhão
      k.osc(s, t, {
        tipo: 'sawtooth',
        f: [
          [0, 80 * tom],
          [0.5, 160 * tom],
        ],
        env: { a: 0.1, d: 0.2, s: 0.7, h: 0.25, r: 0.2, p: 0.13 },
        filtro: {
          tipo: 'lowpass',
          f: [
            [0, 250],
            [0.5, 2500],
          ],
          q: 4,
        },
      });
      k.osc(s, t, {
        f: [
          [0, 160 * tom],
          [0.5, 320 * tom],
        ],
        env: { a: 0.1, d: 0.2, s: 0.7, h: 0.25, r: 0.2, p: 0.09 },
      });
      k.sino(s, t + 0.5, hz(84) * tom, SINO_CLARO, 0.15);
      k.sino(s, t + 0.55, hz(88) * tom, SINO_CURTO, 0.11);
    },
  },

  // ----- enigmas e mecanismos -----
  portaAbrir: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.3, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // ronco de pedra deslizando + engrenagens + "tum" final + sininho
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.08, d: 0.2, s: 0.7, h: 0.4, r: 0.2, p: 0.45 },
        filtro: { tipo: 'lowpass', f: 260 * tom, q: 1.5 },
      });
      for (let i = 0; i < 4; i++) estalo(k, s, t + 0.1 + i * 0.16, 1500, 0.11, 0.02, 3);
      baque(k, s, t + 0.85, 120 * tom, 60 * tom, 0.2, 0.5);
      k.sino(s, t + 0.9, hz(79) * tom, SINO_CURTO, 0.09);
    },
  },
  portaFechar: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.3, p: 2, n: 2, rev: 0.12 }),
    tocar(k, s, t, tom) {
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.05, d: 0.15, s: 0.6, h: 0.2, r: 0.1, p: 0.4 },
        filtro: {
          tipo: 'lowpass',
          f: [
            [0, 320 * tom],
            [0.45, 180 * tom],
          ],
        },
      });
      baque(k, s, t + 0.45, 140 * tom, 50 * tom, 0.25, 0.62);
      k.ruido(s, t + 0.45, {
        cor: 'rosa',
        env: { a: 0.002, d: 0.1, p: 0.28 },
        filtro: { tipo: 'lowpass', f: 900 },
      });
    },
  },
  placaPressionada: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.1, p: 2, n: 2, rev: 0.04 }),
    tocar(k, s, t, tom) {
      // "clique-clunk" + pip de confirmação
      estalo(k, s, t, 2500, 0.28, 0.015, 2);
      baque(k, s, t + 0.01, 190 * tom, 110 * tom, 0.12, 0.48);
      bip(k, s, t + 0.06, hz(81) * tom, 0.05, 0.07, 2500);
    },
  },
  caixaEmpurrar: {
    meta: meta({ g: 0.8, v: 0.06, i: 0.18, p: 1, n: 1, rev: 0 }),
    tocar(k, s, t, tom) {
      // arrasto granuloso
      for (let i = 0; i < 6; i++)
        k.ruido(s, t + i * 0.05, {
          cor: 'rosa',
          env: { a: 0.01, d: 0.06, p: 0.22 + k.rnd() * 0.14 },
          filtro: { tipo: 'bandpass', f: (320 + k.rnd() * 200) * tom, q: 2.5 },
        });
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.05, d: 0.1, s: 0.6, h: 0.15, r: 0.1, p: 0.24 },
        filtro: { tipo: 'lowpass', f: 300 },
      });
    },
  },
  runaAtivar: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.08, p: 2, n: 3, rev: 0.3 }),
    tocar(k, s, t, tom) {
      // pedra mística acendendo: zumbido grave + sino
      k.osc(s, t, {
        f: 220 * tom,
        env: { a: 0.08, d: 0.3, s: 0.3, h: 0.1, r: 0.4, p: 0.18 },
        vib: { f: 4, c: 10 },
      });
      k.osc(s, t, {
        tipo: 'triangle',
        f: 330 * tom,
        env: { a: 0.12, d: 0.3, s: 0.3, h: 0.1, r: 0.4, p: 0.07 },
      });
      k.sino(s, t + 0.06, 880 * tom, CRISTAL, 0.18);
    },
  },
  runaErro: {
    meta: meta({ g: 0.85, v: 0.01, i: 0.2, p: 2, n: 1, rev: 0.1 }),
    tocar(k, s, t, tom) {
      // "bonc-uh": duas notas foscas descendo, sem castigo
      k.osc(s, t, {
        tipo: 'triangle',
        f: [
          [0, 220 * tom],
          [0.1, 210 * tom],
        ],
        env: { a: 0.005, d: 0.18, p: 0.24 },
      });
      k.osc(s, t + 0.14, {
        tipo: 'triangle',
        f: [
          [0, 196 * tom],
          [0.25, 185 * tom],
        ],
        env: { a: 0.005, d: 0.3, p: 0.24 },
      });
      k.osc(s, t, {
        tipo: 'square',
        f: 55 * tom,
        env: { a: 0.01, d: 0.3, p: 0.05 },
        filtro: { tipo: 'lowpass', f: 400 },
      });
    },
  },
  enigmaResolvido: {
    meta: meta({ g: 0.9, v: 0.003, i: 0.5, p: 3, n: 1, rev: 0.25 }),
    tocar(k, s, t, tom) {
      // pequena fanfarra: motivo subindo, acorde suspenso que resolve em maior
      [67, 72, 74, 77].forEach((n, i) => {
        bip(k, s, t + i * 0.11, hz(n) * tom, 0.07, 0.14, 3000);
        k.sino(s, t + i * 0.11, hz(n + 12) * tom, SINO_CURTO, 0.04);
      });
      for (const n of [72, 77, 79]) nota(k, s, t + 0.44, hz(n) * tom, 0.07, 0.32, 'suave', 2200);
      for (const n of [72, 76, 79, 84]) nota(k, s, t + 0.74, hz(n) * tom, 0.08, 1.0, 'suave', 2600);
      k.sino(s, t + 0.74, hz(84) * tom, SINO_LONGO, 0.11);
      k.sino(s, t + 0.8, hz(88) * tom, SINO_CLARO, 0.08);
      brilho(k, s, t + 0.74, 0.8, 0.05);
    },
  },
  itemObtido: {
    meta: meta({ g: 0.9, v: 0.003, i: 0.3, p: 3, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // arpejo rápido + nota final brilhante
      [67, 72, 76, 79].forEach((n, i) => bip(k, s, t + i * 0.07, hz(n) * tom, 0.07, 0.12, 3500));
      k.osc(s, t + 0.3, {
        tipo: 'triangle',
        f: hz(84) * tom,
        env: { a: 0.01, d: 0.2, s: 0.5, h: 0.3, r: 0.4, p: 0.17 },
        vib: { f: 6, c: 15, atraso: 0.15 },
      });
      k.osc(s, t + 0.3, {
        tipo: 'triangle',
        f: hz(79) * tom,
        env: { a: 0.01, d: 0.2, s: 0.5, h: 0.3, r: 0.4, p: 0.09 },
      });
      k.sino(s, t + 0.3, hz(96) * tom, SINO_CURTO, 0.06);
    },
  },
  coracaoObtido: {
    meta: meta({ g: 0.9, v: 0.003, i: 0.2, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // "tum-tum" de coração + intervalo quente subindo
      baque(k, s, t, 110 * tom, 70 * tom, 0.12, 0.42);
      baque(k, s, t + 0.13, 100 * tom, 65 * tom, 0.14, 0.38);
      nota(k, s, t + 0.28, hz(76) * tom, 0.15, 0.25);
      nota(k, s, t + 0.4, hz(81) * tom, 0.17, 0.6);
      k.sino(s, t + 0.4, hz(88) * tom, SINO_CURTO, 0.06);
    },
  },
  centelhaObtida: {
    meta: meta({ g: 0.8, v: 0.005, i: 0.03, p: 1, n: 5, rev: 0.12 }),
    tocar(k, s, t, tom) {
      // "plim" pequenino em nota pentatônica sorteada
      const n = 84 + PENTA[Math.floor(k.rnd() * 5) % 5];
      k.sino(s, t, hz(n) * tom, SINO_CLARO, 0.19);
      brilho(k, s, t, 0.08, 0.04, 7000);
    },
  },
  faiscaObtida: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.3, p: 3, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // risadinha elétrica + brilhos
      for (let i = 0; i < 5; i++)
        k.osc(s, t + i * 0.06, {
          tipo: 'square',
          f: [
            [0, (900 + i * 180) * tom],
            [0.04, (1400 + i * 200) * tom],
          ],
          env: { a: 0.002, d: 0.05, p: 0.06 },
          filtro: { tipo: 'lowpass', f: 4000 },
        });
      [79, 84, 88, 91].forEach((n, i) =>
        k.sino(s, t + 0.32 + i * 0.06, hz(n) * tom, SINO_CURTO, 0.1)
      );
      k.ruido(s, t, {
        env: { a: 0.02, d: 0.4, p: 0.05 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 3000],
            [0.4, 8000],
          ],
          q: 1,
        },
      });
    },
  },
  checkpoint: {
    meta: meta({ g: 0.85, v: 0.003, i: 1, p: 2, n: 1, rev: 0.35 }),
    tocar(k, s, t, tom) {
      // Pedra-Memória: carrilhão calmo e ressonante
      k.sino(s, t, hz(72) * tom, SINO_LONGO, 0.17);
      k.sino(s, t + 0.18, hz(79) * tom, SINO_LONGO, 0.14);
      for (const n of [60, 67, 76]) nota(k, s, t + 0.05, hz(n) * tom, 0.05, 1.2, 'suave', 1500);
    },
  },
  missaoNova: {
    meta: meta({ g: 0.9, v: 0.003, i: 0.5, p: 3, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // motivo curioso que termina em aberto ("hum?")
      nota(k, s, t, hz(72) * tom, 0.15, 0.16);
      nota(k, s, t + 0.12, hz(77) * tom, 0.15, 0.16);
      k.osc(s, t + 0.24, {
        tipo: 'triangle',
        f: hz(79) * tom,
        env: { a: 0.006, d: 0.12, s: 0.6, h: 0.35, r: 0.3, p: 0.17 },
        vib: { f: 5.5, c: 14, atraso: 0.15 },
      });
      k.sino(s, t + 0.24, hz(86) * tom, SINO_CLARO, 0.09);
    },
  },
  missaoConcluida: {
    meta: meta({ g: 0.9, v: 0.003, i: 1, p: 3, n: 1, rev: 0.25 }),
    tocar(k, s, t, tom) {
      // fanfarra maior que resolve
      const motivo: ReadonlyArray<readonly [number, number]> = [
        [72, 0],
        [76, 0.1],
        [79, 0.2],
        [81, 0.32],
        [79, 0.44],
      ];
      for (const [n, dt] of motivo)
        k.osc(s, t + dt, {
          tipo: 'sawtooth',
          f: hz(n) * tom,
          env: { a: 0.01, d: 0.1, s: 0.5, h: 0.04, r: 0.08, p: 0.07 },
          filtro: {
            tipo: 'lowpass',
            f: [
              [0, 900],
              [0.05, 3000],
              [0.2, 1500],
            ],
          },
        });
      for (const n of [60, 72, 76, 79, 84])
        nota(k, s, t + 0.56, hz(n) * tom, 0.06, 1.1, 'sawtooth', 2200);
      baque(k, s, t + 0.56, 110, 70, 0.4, 0.4);
      k.sino(s, t + 0.56, hz(84) * tom, SINO_LONGO, 0.1);
      brilho(k, s, t + 0.56, 1.0, 0.05);
    },
  },
  comemoracao: {
    meta: meta({ g: 0.9, v: 0.01, i: 0.6, p: 2, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // "iêi!" de Claude + rufar + confete brilhante
      vocalizar(k, s, t, {
        f0: [
          [0, 520 * tom],
          [0.12, 700 * tom],
          [0.3, 640 * tom],
        ],
        dur: 0.32,
        p: 0.5,
        vogais: [
          ['i', 0],
          ['e', 0.12],
          ['i', 0.22],
        ],
        formantes: 1.25,
        tipo: 'pulso',
        vib: { f: 8, c: 25 },
      });
      for (let i = 0; i < 6; i++) estalo(k, s, t + 0.3 + i * 0.035, 1800, 0.12 + i * 0.02, 0.03, 1);
      for (let i = 0; i < 10; i++) {
        const n = 84 + PENTA[Math.floor(k.rnd() * 5) % 5] + (k.rnd() < 0.4 ? 12 : 0);
        k.sino(s, t + 0.45 + k.rnd() * 0.6, hz(n) * tom, SINO_CURTO, 0.06);
      }
      [72, 76, 79, 84].forEach((n, i) => bip(k, s, t + 0.5 + i * 0.07, hz(n) * tom, 0.05, 0.12));
    },
  },
  restauracao: {
    meta: meta({ g: 0.9, v: 0, i: 3, p: 3, n: 1, rev: 0.4 }),
    tocar(k, s, t, tom) {
      // mágico e longo: vento de cor subindo, acordes que se abrem e cascata de sinos
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 2.2, d: 0.5, s: 0.6, h: 1.5, r: 1.8, p: 0.12 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 300],
            [3, 3500],
            [6, 1500],
          ],
          q: 1.2,
        },
      });
      const acordes: ReadonlyArray<readonly [number, readonly number[]]> = [
        [0, [48, 60, 64, 67, 74]],
        [2, [53, 60, 65, 69, 76]],
        [4, [48, 60, 64, 67, 72, 79]],
      ];
      for (const [dt, notas] of acordes)
        for (const n of notas)
          k.osc(s, t + dt, {
            tipo: 'suave',
            f: hz(n) * tom,
            env: { a: 0.6, d: 0.5, s: 0.7, h: dt === 4 ? 1.2 : 0.9, r: 1.2, p: 0.045 },
            filtro: {
              tipo: 'lowpass',
              f: [
                [0, 600],
                [1.2, 2600],
              ],
            },
            vib: { f: 4.5, c: 8, atraso: 0.5 },
          });
      const cascata = [72, 76, 79, 84, 88, 91, 96, 91, 88, 84, 79, 84, 88, 91, 96, 100];
      cascata.forEach((n, i) =>
        k.sino(
          s,
          t + 0.4 + i * 0.22,
          hz(n) * tom,
          SINO_CLARO,
          0.06 + 0.03 * Math.sin((i / cascata.length) * Math.PI)
        )
      );
      k.sino(s, t + 4, hz(84) * tom, SINO_LONGO, 0.12);
      brilho(k, s, t + 3.8, 2.2, 0.05);
    },
  },

  // ----- falas -----
  falaNpc: {
    meta: meta({ g: 0.8, v: 0, i: 0.045, p: 1, n: 3, rev: 0.04 }),
    envios: (o) => ({ eco: perfilDe(o.voz, 'npc').eco ?? 0 }),
    tocar(k, s, t, tom, o, e) {
      const chave = (o.voz ?? 'npc').toLowerCase();
      let est = e.falas.get(chave);
      if (!est) e.falas.set(chave, (est = { ultimo: -1, semitom: 0 }));
      bipFala(k, s, t, tom, perfilDe(o.voz, 'npc'), est);
    },
  },
  falaClaude: {
    meta: meta({ g: 0.8, v: 0, i: 0.045, p: 1, n: 3, rev: 0.04 }),
    tocar(k, s, t, tom, o, e) {
      const chave = (o.voz ?? 'claude').toLowerCase();
      let est = e.falas.get(chave);
      if (!est) e.falas.set(chave, (est = { ultimo: -1, semitom: 0 }));
      bipFala(k, s, t, tom, perfilDe(o.voz, 'claude'), est);
    },
  },

  // ----- interface -----
  uiConfirmar: {
    meta: meta({ g: 0.8, v: 0.005, i: 0.05, p: 2, n: 2, rev: 0.02, ui: true }),
    tocar(k, s, t, tom) {
      k.osc(s, t, { tipo: 'triangle', f: hz(76) * tom, env: { a: 0.002, d: 0.08, p: 0.2 } });
      k.osc(s, t + 0.06, {
        tipo: 'triangle',
        f: hz(83) * tom,
        env: { a: 0.002, d: 0.14, p: 0.22 },
      });
      k.osc(s, t + 0.06, { f: hz(95) * tom, env: { a: 0.002, d: 0.1, p: 0.035 } });
    },
  },
  uiVoltar: {
    meta: meta({ g: 0.8, v: 0.005, i: 0.05, p: 2, n: 2, rev: 0.02, ui: true }),
    tocar(k, s, t, tom) {
      k.osc(s, t, { tipo: 'triangle', f: hz(79) * tom, env: { a: 0.002, d: 0.07, p: 0.18 } });
      k.osc(s, t + 0.06, {
        tipo: 'triangle',
        f: hz(72) * tom,
        env: { a: 0.002, d: 0.12, p: 0.18 },
      });
    },
  },
  uiNavegar: {
    meta: meta({ g: 0.8, v: 0.01, i: 0.03, p: 1, n: 2, rev: 0, ui: true }),
    tocar(k, s, t, tom) {
      k.osc(s, t, { tipo: 'triangle', f: hz(81) * tom, env: { a: 0.001, d: 0.045, p: 0.15 } });
      k.ruido(s, t, {
        env: { a: 0.001, d: 0.008, p: 0.05 },
        filtro: { tipo: 'highpass', f: 5000 },
      });
    },
  },
  uiAbrir: {
    meta: meta({ g: 0.8, v: 0.005, i: 0.08, p: 2, n: 2, rev: 0.06, ui: true }),
    tocar(k, s, t, tom) {
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.03, d: 0.12, p: 0.11 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 500],
            [0.12, 2200],
          ],
          q: 1.5,
        },
      });
      k.osc(s, t, {
        f: [
          [0, 400 * tom],
          [0.1, 800 * tom],
        ],
        env: { a: 0.005, d: 0.1, p: 0.11 },
      });
      k.sino(s, t + 0.09, hz(86) * tom, SINO_CURTO, 0.11);
    },
  },

  // ----- inimigos -----
  inimigoAlerta: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.12, p: 2, n: 2, rev: 0.03 }),
    tocar(k, s, t, tom) {
      // "!" curto: piado agudo subindo + acento
      k.osc(s, t, {
        tipo: 'square',
        f: [
          [0, 700 * tom],
          [0.06, 1500 * tom],
        ],
        env: { a: 0.002, d: 0.09, p: 0.11 },
        filtro: { tipo: 'lowpass', f: 4000 },
      });
      k.osc(s, t + 0.07, {
        tipo: 'square',
        f: 1500 * tom,
        env: { a: 0.002, d: 0.1, p: 0.09 },
        filtro: { tipo: 'lowpass', f: 4500 },
      });
      estalo(k, s, t, 3000, 0.07, 0.05, 3);
    },
  },
  inimigoTelegrafo: {
    meta: meta({ g: 0.95, v: 0.02, i: 0.15, p: 3, n: 3, rev: 0.04 }),
    tocar(k, s, t, tom) {
      // aviso que cresce: altura subindo, trêmulo acelerando e estática aumentando;
      // termina seco, logo antes do golpe
      const dur = 0.62;
      const ac = k.ac;
      const vca = k.ganho(s, 0);
      vca.gain.setValueAtTime(0, t);
      vca.gain.linearRampToValueAtTime(0.05, t + 0.05);
      vca.gain.exponentialRampToValueAtTime(0.34, t + dur - 0.02);
      vca.gain.linearRampToValueAtTime(0, t + dur + 0.03);
      const am = k.ganho(vca, 0.55);
      const lfo = ac.createOscillator();
      k.curva(lfo.frequency, t, [
        [0, 8],
        [dur, 28],
      ]);
      const prof = k.ganho(null, 0.45);
      prof.connect(am.gain);
      lfo.connect(prof);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      const fonte = k.fonteOsc(t, 'sawtooth', [
        [0, 300 * tom],
        [dur, 900 * tom],
      ]);
      const bp = k.biquad(t, {
        tipo: 'bandpass',
        f: [
          [0, 800 * tom],
          [dur, 2400 * tom],
        ],
        q: 2.5,
      });
      fonte.connect(bp);
      bp.connect(am);
      fonte.stop(t + dur + 0.05);
      k.ruido(am, t, {
        env: { a: dur * 0.9, d: 0.06, p: 0.25 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 1500],
            [dur, 4000],
          ],
          q: 1.5,
        },
      });
      if (k.fim < t + dur + 0.05) k.fim = t + dur + 0.05;
    },
  },
  inimigoAtaque: {
    meta: meta({ g: 0.85, v: 0.05, i: 0.08, p: 2, n: 3, rev: 0.03 }),
    tocar(k, s, t, tom) {
      // "fsht!": bote escuro com borda de estática
      k.ruido(s, t, {
        env: { a: 0.01, d: 0.14, p: 0.38 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 1800 * tom],
            [0.12, 500 * tom],
          ],
          q: 1.5,
        },
      });
      k.osc(s, t, {
        tipo: 'square',
        f: [
          [0, 300 * tom],
          [0.1, 120 * tom],
        ],
        env: { a: 0.002, d: 0.12, p: 0.09 },
        filtro: { tipo: 'lowpass', f: 1500 },
      });
    },
  },
  inimigoFerido: {
    meta: meta({ g: 0.85, v: 0.06, i: 0.04, p: 2, n: 3, rev: 0.03 }),
    tocar(k, s, t, tom) {
      // guincho com falha de estática
      k.osc(s, t, {
        tipo: 'square',
        f: [
          [0, 820 * tom],
          [0.1, 380 * tom],
        ],
        env: { a: 0.002, d: 0.12, p: 0.11 },
        filtro: { tipo: 'lowpass', f: 3000 },
        vib: { f: 40, c: 150 },
      });
      estalo(k, s, t, 2500, 0.18, 0.06, 2);
    },
  },
  inimigoDerrotado: {
    meta: meta({ g: 0.85, v: 0.02, i: 0.08, p: 2, n: 3, rev: 0.18 }),
    tocar(k, s, t, tom) {
      // a estática se desfaz e a criatura fica livre (sininhos)
      k.ruido(s, t, {
        env: { a: 0.005, d: 0.5, p: 0.28 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 3000],
            [0.5, 400],
          ],
          q: 1.5,
        },
      });
      k.osc(s, t, {
        tipo: 'square',
        f: [
          [0, 600 * tom],
          [0.3, 150 * tom],
        ],
        env: { a: 0.002, d: 0.3, p: 0.07 },
        filtro: { tipo: 'lowpass', f: 2000 },
      });
      [79, 84, 88].forEach((n, i) => k.sino(s, t + 0.3 + i * 0.08, hz(n) * tom, SINO_CURTO, 0.11));
    },
  },
  projetilEco: {
    meta: meta({ g: 0.85, v: 0.04, i: 0.06, p: 2, n: 4, rev: 0.1, eco: 0.35 }),
    tocar(k, s, t, tom) {
      // onda sonora lenta: "uô-uô-uô"
      k.osc(s, t, {
        f: [
          [0, 330 * tom],
          [0.45, 290 * tom],
        ],
        env: { a: 0.02, d: 0.15, s: 0.5, h: 0.2, r: 0.15, p: 0.3 },
        vib: { f: 11, c: 120 },
      });
      k.osc(s, t, {
        tipo: 'triangle',
        f: [
          [0, 660 * tom],
          [0.45, 580 * tom],
        ],
        env: { a: 0.02, d: 0.15, s: 0.5, h: 0.2, r: 0.15, p: 0.07 },
        vib: { f: 11, c: 120 },
      });
    },
  },
  escudoQuebrado: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.1, p: 3, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // vidro estilhaçando + baque
      baque(k, s, t, 160 * tom, 60 * tom, 0.15, 0.48);
      k.ruido(s, t, { env: { a: 0.001, d: 0.25, p: 0.32 }, filtro: { tipo: 'highpass', f: 2500 } });
      for (let i = 0; i < 8; i++)
        k.sino(
          s,
          t + k.rnd() * 0.18,
          (2000 + k.rnd() * 3000) * tom,
          [
            [1, 1, 0.12 + k.rnd() * 0.15],
            [2.7, 0.4, 0.08],
          ],
          0.065
        );
    },
  },
  atordoado: {
    meta: meta({ g: 0.8, v: 0.03, i: 0.3, p: 2, n: 2, rev: 0.08 }),
    tocar(k, s, t, tom) {
      // passarinhos de tontura + chiado elétrico inicial
      for (let i = 0; i < 8; i++) {
        const alto = i % 2 === 0;
        k.osc(s, t + i * 0.13, {
          f: [
            [0, (alto ? 2000 : 1600) * tom],
            [0.08, (alto ? 2300 : 1800) * tom],
          ],
          env: { a: 0.005, d: 0.1, p: 0.08 * (1 - i / 10) },
        });
      }
      estalo(k, s, t, 3500, 0.12, 0.15, 2);
    },
  },
  cortarFio: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.1, p: 2, n: 2, rev: 0.05 }),
    tocar(k, s, t, tom) {
      // "tic-tic" de tesoura + fio caindo ("piu")
      estalo(k, s, t, 4500, 0.28, 0.015, 4);
      estalo(k, s, t + 0.05, 5200, 0.28, 0.015, 4);
      k.osc(s, t + 0.05, {
        f: [
          [0, 1400 * tom],
          [0.2, 300 * tom],
        ],
        env: { a: 0.002, d: 0.22, p: 0.13 },
      });
    },
  },

  // ----- chefe -----
  chefeRugido: {
    meta: meta({ g: 0.9, v: 0.02, i: 1, p: 3, n: 1, rev: 0.3, eco: 0.15 }),
    tocar(k, s, t, tom) {
      // rugido de estática: serras graves saturadas + ruído varrido
      const sat = k.saturador(s, 2.5);
      const filtro = {
        tipo: 'lowpass' as const,
        f: [
          [0, 400],
          [0.4, 1800],
          [1.7, 300],
        ] as const,
        q: 2,
      };
      k.osc(sat, t, {
        tipo: 'sawtooth',
        f: [
          [0, 70 * tom],
          [0.4, 95 * tom],
          [1.6, 55 * tom],
        ],
        env: { a: 0.08, d: 0.3, s: 0.7, h: 0.9, r: 0.5, p: 0.28 },
        vib: { f: 9, c: 60 },
        filtro,
      });
      k.osc(sat, t, {
        tipo: 'sawtooth',
        f: [
          [0, 105 * tom],
          [0.4, 141 * tom],
          [1.6, 82 * tom],
        ],
        env: { a: 0.08, d: 0.3, s: 0.7, h: 0.9, r: 0.5, p: 0.14 },
        vib: { f: 7, c: 50 },
        filtro,
      });
      k.ruido(s, t, {
        cor: 'rosa',
        env: { a: 0.1, d: 0.3, s: 0.6, h: 0.9, r: 0.6, p: 0.32 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 250],
            [0.5, 900],
            [1.8, 300],
          ],
          q: 1.2,
        },
      });
      estatica(k, s, t + 0.1, 1.5, 12, 0.16);
    },
  },
  chefeOnda: {
    meta: meta({ g: 0.9, v: 0.02, i: 0.3, p: 3, n: 2, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // estrondo + anel que se expande (pule!)
      baque(k, s, t, 95 * tom, 38 * tom, 0.6, 0.78);
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.005, d: 0.5, p: 0.45 },
        filtro: { tipo: 'lowpass', f: 400 },
      });
      k.ruido(s, t + 0.05, {
        cor: 'rosa',
        env: { a: 0.08, d: 0.8, p: 0.24 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 300],
            [0.8, 1800],
          ],
          q: 2.5,
        },
      });
    },
  },
  chefeFase: {
    meta: meta({ g: 0.9, v: 0, i: 1, p: 3, n: 1, rev: 0.3 }),
    tocar(k, s, t, tom) {
      // impacto, aglomerado dissonante que sobe e resolve numa quinta firme
      baque(k, s, t, 80 * tom, 35 * tom, 0.8, 0.8);
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.005, d: 0.6, p: 0.4 },
        filtro: { tipo: 'lowpass', f: 500 },
      });
      for (const n of [52, 53, 58, 59])
        k.osc(s, t + 0.1, {
          tipo: 'sawtooth',
          f: [
            [0, hz(n) * tom],
            [1, hz(n + 1) * tom],
          ],
          env: { a: 0.3, d: 0.3, s: 0.7, h: 0.35, r: 0.15, p: 0.05 },
          filtro: {
            tipo: 'lowpass',
            f: [
              [0, 500],
              [1, 2500],
            ],
          },
        });
      for (const n of [52, 59, 64])
        k.osc(s, t + 1.15, {
          tipo: 'sawtooth',
          f: hz(n) * tom,
          env: { a: 0.02, d: 0.3, s: 0.6, h: 0.3, r: 0.4, p: 0.08 },
          filtro: {
            tipo: 'lowpass',
            f: [
              [0, 3000],
              [0.8, 900],
            ],
          },
        });
      baque(k, s, t + 1.15, 110, 55, 0.4, 0.5);
      k.ruido(s, t, {
        env: { a: 0.6, d: 0.6, p: 0.12 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 500],
            [1.1, 5000],
          ],
          q: 2,
        },
      });
    },
  },
  chefeDerrotado: {
    meta: meta({ g: 0.9, v: 0, i: 2, p: 3, n: 1, rev: 0.35 }),
    tocar(k, s, t, tom) {
      // a estática se dissipa em estouros de brilho e termina num acorde triunfante
      k.ruido(s, t, {
        env: { a: 0.01, d: 2.5, p: 0.28 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 2000],
            [2.5, 200],
          ],
          q: 1.2,
        },
      });
      for (let i = 0; i < 8; i++) {
        const tt = t + 0.15 + i * 0.26 + k.rnd() * 0.08;
        baque(k, s, tt, 140, 60, 0.15, 0.3);
        k.sino(s, tt, (1500 + k.rnd() * 2500) * tom, SINO_CURTO, 0.06);
      }
      for (const n of [48, 55, 60, 64, 67, 72])
        k.osc(s, t + 2.2, {
          tipo: 'sawtooth',
          f: hz(n) * tom,
          env: { a: 0.03, d: 0.4, s: 0.6, h: 0.5, r: 0.7, p: 0.055 },
          filtro: {
            tipo: 'lowpass',
            f: [
              [0, 800],
              [0.1, 3200],
              [1.2, 1200],
            ],
          },
        });
      k.sino(s, t + 2.2, hz(84) * tom, SINO_LONGO, 0.12);
      brilho(k, s, t + 2.2, 1.2, 0.05);
    },
  },

  // ----- queda, derrota e mundo -----
  fronteira: {
    meta: meta({ g: 0.85, v: 0, i: 2, p: 2, n: 1, rev: 0.3, eco: 0.12 }),
    tocar(k, s, t, tom) {
      // "em construção": marteladinhas, rabisco de lápis e acorde curioso
      [0, 0.16, 0.32].forEach((dt) => {
        k.osc(s, t + dt, {
          f: [
            [0, 900 * tom],
            [0.03, 760 * tom],
          ],
          env: { a: 0.001, d: 0.06, p: 0.18 },
        });
        estalo(k, s, t + dt, 2000, 0.14, 0.01, 3);
      });
      k.ruido(s, t + 0.5, {
        env: { a: 0.02, d: 0.05, s: 0.6, h: 0.2, r: 0.05, p: 0.06 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 3000],
            [0.15, 4200],
            [0.3, 3200],
          ],
          q: 3,
        },
      });
      [74, 76, 81].forEach((n, i) => k.sino(s, t + 0.55 + i * 0.07, hz(n) * tom, SINO_LONGO, 0.06));
      k.osc(s, t + 0.9, {
        tipo: 'triangle',
        f: [
          [0, hz(79) * tom],
          [0.25, hz(81) * tom],
        ],
        env: { a: 0.02, d: 0.1, s: 0.6, h: 0.15, r: 0.3, p: 0.1 },
      });
    },
  },
  gaiolaAberta: {
    meta: meta({ g: 0.85, v: 0.01, i: 0.5, p: 2, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // a estática some, "clinc" da tranca e um piado feliz de liberdade
      k.ruido(s, t, {
        env: { a: 0.005, d: 0.4, p: 0.19 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 3000],
            [0.4, 600],
          ],
          q: 2,
        },
      });
      k.fm(s, t + 0.05, {
        f: 1250 * tom,
        razao: 2.1,
        dev: [
          [0, 800],
          [0.15, 20],
        ],
        env: { a: 0.001, d: 0.2, p: 0.11 },
      });
      k.osc(s, t + 0.3, {
        f: [
          [0, 900 * tom],
          [0.1, 1800 * tom],
        ],
        env: { a: 0.004, d: 0.1, p: 0.12 },
      });
      k.osc(s, t + 0.42, {
        f: [
          [0, 1200 * tom],
          [0.1, 2200 * tom],
        ],
        env: { a: 0.004, d: 0.12, p: 0.12 },
      });
      k.sino(s, t + 0.5, hz(84) * tom, SINO_CLARO, 0.1);
    },
  },
  paredeQuebrada: {
    meta: meta({ g: 0.9, v: 0.03, i: 0.3, p: 2, n: 2, rev: 0.15 }),
    tocar(k, s, t, tom) {
      // desmoronar: baque + cascalho
      baque(k, s, t, 110 * tom, 40 * tom, 0.35, 0.72);
      k.ruido(s, t, {
        cor: 'marrom',
        env: { a: 0.003, d: 0.4, p: 0.48 },
        filtro: { tipo: 'lowpass', f: 700 },
      });
      for (let i = 0; i < 9; i++)
        k.ruido(s, t + 0.05 + k.rnd() * 0.6, {
          cor: 'rosa',
          env: { a: 0.001, d: 0.03 + k.rnd() * 0.05, p: 0.12 + k.rnd() * 0.14 },
          filtro: { tipo: 'bandpass', f: 600 + k.rnd() * 2000, q: 2 },
        });
    },
  },
  espinhoCortado: {
    meta: meta({ g: 0.85, v: 0.05, i: 0.05, p: 2, n: 3, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // "shk" + estalo de estática + brilhinho
      k.ruido(s, t, {
        env: { a: 0.002, d: 0.08, p: 0.33 },
        filtro: {
          tipo: 'bandpass',
          f: [
            [0, 4000 * tom],
            [0.08, 2000 * tom],
          ],
          q: 1.5,
        },
      });
      k.osc(s, t + 0.02, {
        tipo: 'square',
        f: [
          [0, 500 * tom],
          [0.06, 200 * tom],
        ],
        env: { a: 0.002, d: 0.06, p: 0.05 },
        filtro: { tipo: 'lowpass', f: 2000 },
      });
      k.sino(s, t + 0.06, hz(88) * tom, SINO_CURTO, 0.08);
    },
  },
  alavanca: {
    meta: meta({ g: 0.85, v: 0.03, i: 0.2, p: 2, n: 2, rev: 0.06 }),
    tocar(k, s, t, tom) {
      // catraca + "clunk"
      for (let i = 0; i < 3; i++)
        estalo(k, s, t + i * 0.05, (2200 - i * 200) * tom, 0.24, 0.018, 4);
      baque(k, s, t + 0.16, 220 * tom, 120 * tom, 0.15, 0.42);
      k.fm(s, t + 0.16, {
        f: 330 * tom,
        razao: 2.7,
        dev: [
          [0, 400],
          [0.1, 10],
        ],
        env: { a: 0.001, d: 0.15, p: 0.1 },
      });
    },
  },
  bauAbrir: {
    meta: meta({ g: 0.85, v: 0.005, i: 0.5, p: 3, n: 1, rev: 0.2 }),
    tocar(k, s, t, tom) {
      // rangido da tampa + "tcharam" brilhante
      k.osc(s, t, {
        tipo: 'sawtooth',
        f: [
          [0, 140 * tom],
          [0.25, 210 * tom],
          [0.4, 170 * tom],
        ],
        env: { a: 0.03, d: 0.1, s: 0.6, h: 0.2, r: 0.1, p: 0.08 },
        filtro: { tipo: 'bandpass', f: 900, q: 6 },
        vib: { f: 23, c: 80 },
      });
      [67, 72, 76, 79, 84].forEach((n, i) =>
        k.sino(s, t + 0.42 + i * 0.07, hz(n) * tom, SINO_CURTO, 0.12)
      );
      brilho(k, s, t + 0.45, 0.6, 0.05);
    },
  },
};
