/**
 * Vozes de fala estilo "animalese": um bipe curto por sílaba/letra, com vogal
 * sintetizada por formantes e entonação que passeia dentro da faixa de cada
 * falante. Cada falante tem timbre e altura próprios e estáveis.
 */
import { hashTexto } from './aleatorio';
import type { Curva, Kit, TipoOnda } from './sintese';

/** Formantes (F1, F2, F3) de vogais, em Hz, para um falante "médio". */
export const VOGAIS = {
  a: [800, 1250, 2600],
  e: [480, 1900, 2650],
  i: [300, 2300, 3000],
  o: [500, 880, 2500],
  u: [330, 760, 2400],
} as const;
export type Vogal = keyof typeof VOGAIS;
const LISTA_VOGAIS: readonly Vogal[] = ['a', 'e', 'i', 'o', 'u'];

export interface PerfilVoz {
  /** Fundamental média (Hz). */
  base: number;
  /** Extensão da entonação (semitons, ±). */
  ext: number;
  tipo: TipoOnda;
  /** Duração da sílaba (s). */
  dur: number;
  /** Escala dos formantes (criaturas pequenas → maior). */
  formantes: number;
  /** Vibrato (cents) e sua frequência. */
  vib: number;
  vibF: number;
  /** Deriva de entonação por sílaba (semitons; > 0 sobe, como perguntas). */
  tendencia: number;
  ganho: number;
  /** Soprosidade (ruído). */
  respiro: number;
  /** Altura borbulhante (Seu Caldo). */
  borbulha?: boolean;
  /** Envio de eco (Ressoa). */
  eco?: number;
}

export const PERFIS_VOZ: Readonly<Record<string, PerfilVoz>> = {
  // Claude: médio-agudo, simpático, levemente "digital"
  claude: {
    base: 470,
    ext: 5,
    tipo: 'pulso',
    dur: 0.062,
    formantes: 1.25,
    vib: 10,
    vibF: 7,
    tendencia: 0,
    ganho: 0.5,
    respiro: 0.03,
  },
  // Sálvia, tartaruga jardineira: grave, lenta, arredondada, fala por perguntas (sobe)
  salvia: {
    base: 200,
    ext: 4,
    tipo: 'suave',
    dur: 0.115,
    formantes: 0.9,
    vib: 18,
    vibF: 4.5,
    tendencia: 0.55,
    ganho: 0.62,
    respiro: 0.07,
  },
  // Pipo, faísca agitada: agudíssimo, rápido, vibrato nervoso
  pipo: {
    base: 1050,
    ext: 7,
    tipo: 'square',
    dur: 0.04,
    formantes: 1.7,
    vib: 45,
    vibF: 13,
    tendencia: 0.25,
    ganho: 0.32,
    respiro: 0.02,
  },
  // Bia Bobina, lontra inventora: médio-agudo, fala rápido, brilhante
  bia: {
    base: 600,
    ext: 6,
    tipo: 'sawtooth',
    dur: 0.05,
    formantes: 1.35,
    vib: 8,
    vibF: 8,
    tendencia: -0.1,
    ganho: 0.42,
    respiro: 0.03,
  },
  // Seu Caldo, panela falante: grave, oco e borbulhante
  caldo: {
    base: 155,
    ext: 4,
    tipo: 'oco',
    dur: 0.09,
    formantes: 0.8,
    vib: 25,
    vibF: 6,
    tendencia: -0.2,
    ganho: 0.6,
    respiro: 0.05,
    borbulha: true,
  },
  // Capitã Lume, vagalume batedora: firme e dramática (vibrato largo)
  lume: {
    base: 690,
    ext: 6,
    tipo: 'pulso',
    dur: 0.07,
    formantes: 1.4,
    vib: 32,
    vibF: 6.5,
    tendencia: 0.1,
    ganho: 0.42,
    respiro: 0.03,
  },
  // Ressoa, Eco que não se corrompeu: etérea, lenta, com eco
  ressoa: {
    base: 390,
    ext: 3,
    tipo: 'sine',
    dur: 0.12,
    formantes: 1,
    vib: 12,
    vibF: 3,
    tendencia: 0,
    ganho: 0.6,
    respiro: 0.1,
    eco: 0.55,
  },
  // NPC genérico
  npc: {
    base: 330,
    ext: 5,
    tipo: 'triangle',
    dur: 0.075,
    formantes: 1.1,
    vib: 12,
    vibF: 5.5,
    tendencia: 0,
    ganho: 0.5,
    respiro: 0.04,
  },
};

const TIPOS_DERIVADOS: readonly TipoOnda[] = ['triangle', 'pulso', 'suave', 'oco', 'square'];

/** Perfil do falante; nomes desconhecidos ganham um perfil estável derivado do nome. */
export function perfilDe(voz: string | undefined, padrao: 'claude' | 'npc'): PerfilVoz {
  const chave = (voz ?? padrao).toLowerCase();
  const conhecido = PERFIS_VOZ[chave];
  if (conhecido) return conhecido;
  const h = hashTexto(chave);
  const frac = (bits: number) => ((h >>> bits) & 0xff) / 255;
  return {
    base: 220 * Math.pow(2, frac(0) * 2),
    ext: 3 + frac(8) * 4,
    tipo: TIPOS_DERIVADOS[h % TIPOS_DERIVADOS.length],
    dur: 0.05 + frac(16) * 0.06,
    formantes: 0.85 + frac(24) * 0.6,
    vib: 8 + frac(4) * 25,
    vibF: 4 + frac(12) * 6,
    tendencia: (frac(20) - 0.5) * 0.6,
    ganho: 0.48,
    respiro: 0.04,
  };
}

/** Estado de entonação por falante (contorno que passeia entre sílabas). */
export interface EstadoVoz {
  ultimo: number;
  semitom: number;
}

export interface OpcoesVocal {
  f0: Curva;
  dur: number;
  p: number;
  /** Sequência de vogais: [vogal, tempo relativo (s)]. */
  vogais: ReadonlyArray<readonly [Vogal, number]>;
  formantes?: number;
  tipo?: TipoOnda;
  vib?: { f: number; c: number };
  respiro?: number;
  ataque?: number;
  soltura?: number;
}

const Q_FORMANTE = [5, 7, 9];
const GANHO_FORMANTE = [1.6, 1.1, 0.5];

/** Sintetiza um som vocal curto (fonte + três formantes em paralelo). */
export function vocalizar(k: Kit, saida: AudioNode, t: number, o: OpcoesVocal): number {
  const ac = k.ac;
  const ataque = o.ataque ?? 0.008;
  const soltura = o.soltura ?? 0.03;
  const corpo = Math.max(0.005, o.dur - ataque - soltura);
  const vca = k.ganho(saida, 0);
  const fim = k.envelope(vca.gain, t, {
    a: ataque,
    d: 0.01,
    s: 0.85,
    h: corpo,
    r: soltura,
    p: o.p,
  });
  const fonte = k.fonteOsc(t, o.tipo ?? 'sawtooth', o.f0);
  if (o.vib) k.vibrato(fonte.detune, t, fim, { f: o.vib.f, c: o.vib.c, atraso: o.dur * 0.3 });
  const escala = o.formantes ?? 1;
  const somaFormantes = k.ganho(vca, 1);
  for (let j = 0; j < 3; j++) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = Q_FORMANTE[j];
    let primeiro = true;
    for (const [vogal, dt] of o.vogais) {
      const f = VOGAIS[vogal][j] * escala;
      if (primeiro) bp.frequency.setValueAtTime(f, t + dt);
      else bp.frequency.linearRampToValueAtTime(f, t + dt);
      primeiro = false;
    }
    const g = k.ganho(somaFormantes, GANHO_FORMANTE[j]);
    fonte.connect(bp);
    bp.connect(g);
  }
  // um pouco da fonte direta, filtrada, dá corpo à vogal
  const corpoDireto = k.ganho(vca, 0.12);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400 * escala;
  fonte.connect(lp);
  lp.connect(corpoDireto);
  fonte.stop(fim + 0.02);
  if (o.respiro && o.respiro > 0) {
    k.ruido(saida, t, {
      cor: 'rosa',
      env: { a: ataque, d: o.dur * 0.8, p: o.p * o.respiro },
      filtro: { tipo: 'bandpass', f: VOGAIS[o.vogais[0][0]][1] * escala, q: 2 },
    });
  }
  if (fim > k.fim) k.fim = fim;
  return fim;
}

/** Um bipe de fala (uma sílaba) do falante `perfil`. */
export function bipFala(
  k: Kit,
  saida: AudioNode,
  t: number,
  tom: number,
  perfil: PerfilVoz,
  estado: EstadoVoz
): number {
  if (t - estado.ultimo > 0.45 || t < estado.ultimo) {
    // nova frase: começa perto do centro
    estado.semitom = (k.rnd() - 0.5) * perfil.ext * 0.5;
  } else {
    estado.semitom += perfil.tendencia + (k.rnd() - 0.5) * perfil.ext * 0.7;
    estado.semitom = Math.max(-perfil.ext, Math.min(perfil.ext, estado.semitom));
  }
  estado.ultimo = t;
  const f = perfil.base * tom * Math.pow(2, estado.semitom / 12);
  const dur = perfil.dur * (0.85 + k.rnd() * 0.3);
  const vogal = LISTA_VOGAIS[Math.floor(k.rnd() * LISTA_VOGAIS.length) % LISTA_VOGAIS.length];
  const f0: Curva = perfil.borbulha
    ? [
        [0, f * 0.86],
        [dur * 0.45, f * 1.12],
        [dur, f * 0.97],
      ]
    : [
        [0, f * 1.03],
        [dur, f * (0.96 + k.rnd() * 0.05)],
      ];
  return vocalizar(k, saida, t, {
    f0,
    dur,
    p: perfil.ganho,
    vogais: [[vogal, 0]],
    formantes: perfil.formantes,
    tipo: perfil.tipo,
    vib: { f: perfil.vibF, c: perfil.vib },
    respiro: perfil.respiro,
    ataque: Math.min(0.01, dur * 0.2),
    soltura: Math.min(0.03, dur * 0.35),
  });
}
