/**
 * Primitivas de síntese sobre a Web Audio API: osciladores, ruído, envelopes,
 * filtros, sinos (aditiva), FM e saturação. Todo som começa e termina em ganho
 * zero com rampas, para não estalar.
 */
import type { Rng } from './aleatorio';

/** Menor ganho usado em rampas exponenciais (-80 dB). */
export const MINIMO = 0.0001;

export type ModoPonto = 'lin' | 'exp' | 'set';
/** Ponto de automação: [tempo relativo (s), valor, modo]. Modo padrão: exponencial. */
export type Ponto = readonly [number, number] | readonly [number, number, ModoPonto];
export type Curva = number | readonly Ponto[];
export type TipoOnda = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'pulso' | 'suave' | 'oco';
export type CorRuido = 'branco' | 'rosa' | 'marrom';

/**
 * Envelope de amplitude.
 * - Percussivo (sem `s`): 0 → p em `a`, depois cai ~80 dB em `d`.
 * - ADSR (com `s` > 0): 0 → p em `a`, cai até p·s em `d`, segura `h`, solta em `r`.
 */
export interface Envelope {
  a: number;
  d: number;
  s?: number;
  h?: number;
  r?: number;
  p: number;
}

export interface OpcoesFiltro {
  tipo: BiquadFilterType;
  f: Curva;
  q?: Curva;
  g?: number;
}
export type Filtros = OpcoesFiltro | readonly OpcoesFiltro[];

/** Vibrato: frequência (Hz), profundidade em cents e atraso opcional (s). */
export interface Vibrato {
  f: number;
  c: number;
  atraso?: number;
}

export interface OpcoesOsc {
  tipo?: TipoOnda;
  f: Curva;
  env: Envelope;
  detune?: number;
  vib?: Vibrato;
  filtro?: Filtros;
}

export interface OpcoesRuido {
  cor?: CorRuido;
  env: Envelope;
  filtro?: Filtros;
  taxa?: number;
}

/** FM simples: portadora `f`, moduladora `f·razao`, desvio `dev` em Hz. */
export interface OpcoesFm {
  f: Curva;
  razao: number;
  dev: Curva;
  env: Envelope;
  tipo?: TipoOnda;
  filtro?: Filtros;
}

/** Parcial de sino: [razão de frequência, ganho relativo, decaimento (s)]. */
export type Parcial = readonly [number, number, number];

export interface Recursos {
  ruidos: Record<CorRuido, AudioBuffer>;
  ondas: Record<'pulso' | 'suave' | 'oco', PeriodicWave>;
  saturacao: Float32Array<ArrayBuffer>;
}

/** Duração total de um envelope (s). */
export function duracaoEnvelope(e: Envelope): number {
  const a = Math.max(e.a, 0.002);
  if (e.s && e.s > 0)
    return a + Math.max(e.d, 0.001) + (e.h ?? 0) + Math.max(e.r ?? 0.05, 0.005) + 0.004;
  return a + Math.max(e.d, 0.005) + 0.004;
}

/** Nota MIDI → Hz. */
export function hz(nota: number): number {
  return 440 * Math.pow(2, (nota - 69) / 12);
}

// ---------------------------------------------------------------------------
// recursos compartilhados por contexto
// ---------------------------------------------------------------------------

function normalizar(d: Float32Array, alvo: number): void {
  let pico = 0;
  let media = 0;
  for (let i = 0; i < d.length; i++) media += d[i];
  media /= d.length;
  for (let i = 0; i < d.length; i++) {
    d[i] -= media;
    pico = Math.max(pico, Math.abs(d[i]));
  }
  if (pico > 0) for (let i = 0; i < d.length; i++) d[i] *= alvo / pico;
}

/** Remove o degrau entre o fim e o início do laço do buffer. */
function emendar(d: Float32Array): void {
  const n = d.length;
  const delta = d[n - 1] - d[0];
  for (let i = 0; i < n; i++) d[i] -= (delta * i) / (n - 1);
}

function criarOnda(
  ac: BaseAudioContext,
  harmonico: (k: number) => readonly [number, number],
  n = 32
): PeriodicWave {
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) {
    const [re, im] = harmonico(k);
    real[k] = re;
    imag[k] = im;
  }
  return ac.createPeriodicWave(real, imag);
}

/** Curva de saturação suave (tanh). */
export function criarCurvaSaturacao(n = 1024, forca = 3): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const norm = Math.tanh(forca);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(forca * x) / norm;
  }
  return c;
}

/** Pré-ganho do limitador final: a curva cobre sinais de -2 a +2. */
export const PRE_LIMITADOR = 0.5;
/** Teto absoluto da saída. */
export const TETO_LIMITADOR = 0.98;

/**
 * Curva do limitador suave do mestre. Com pré-ganho de 0,5, é linear (ganho 1)
 * até 0,7 e encosta suavemente em 0,98: o pico de saída nunca chega a 1,0.
 */
export function criarCurvaLimitador(n = 2048): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const joelho = 0.7;
  const folga = TETO_LIMITADOR - joelho;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = x / PRE_LIMITADOR;
    const m = Math.abs(a);
    c[i] = m <= joelho ? a : Math.sign(a) * (joelho + folga * Math.tanh((m - joelho) / folga));
  }
  return c;
}

export function criarRecursos(ac: BaseAudioContext, rng: Rng): Recursos {
  const taxa = ac.sampleRate;
  const n = Math.max(2048, Math.floor(taxa * 2));
  const branco = ac.createBuffer(1, n, taxa);
  const rosa = ac.createBuffer(1, n, taxa);
  const marrom = ac.createBuffer(1, n, taxa);
  const db = branco.getChannelData(0);
  const dr = rosa.getChannelData(0);
  const dm = marrom.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  let ultimo = 0;
  for (let i = 0; i < n; i++) {
    const w = rng() * 2 - 1;
    db[i] = w;
    // ruído rosa (filtro de Paul Kellet)
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    dr[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
    b6 = w * 0.115926;
    // ruído marrom (integração com vazamento)
    ultimo = (ultimo + 0.02 * w) / 1.02;
    dm[i] = ultimo;
  }
  emendar(dr);
  emendar(dm);
  normalizar(db, 0.9);
  normalizar(dr, 0.9);
  normalizar(dm, 0.9);
  return {
    ruidos: { branco, rosa, marrom },
    ondas: {
      // pulso estreito (25%): timbre "chiptune" fofo
      pulso: criarOnda(ac, (k) => [(2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25), 0]),
      // dente de serra arredondado (harmônicos 1/k²)
      suave: criarOnda(ac, (k) => [0, 1 / (k * k)], 16),
      // harmônicos ímpares: oco, de palheta
      oco: criarOnda(ac, (k) => [0, k % 2 === 1 ? 1 / Math.pow(k, 1.3) : 0], 24),
    },
    saturacao: criarCurvaSaturacao(),
  };
}

/** Resposta ao impulso curta e escurecendo (reverberação barata por convolução). */
export function criarRespostaImpulso(ac: BaseAudioContext, rng: Rng, duracao = 1.7): AudioBuffer {
  const taxa = ac.sampleRate;
  const n = Math.max(256, Math.floor(taxa * duracao));
  const buf = ac.createBuffer(2, n, taxa);
  const pre = Math.floor(taxa * 0.012);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = pre; i < n; i++) {
      const tt = (i - pre) / taxa;
      const prog = tt / duracao;
      const env = Math.exp(-tt * 4.2) * (1 - prog);
      const a = 0.15 + 0.7 * prog;
      y = y * a + (rng() * 2 - 1) * (1 - a);
      d[i] = y * env;
    }
    for (let r = 0; r < 6; r++) {
      const idx = pre + Math.floor(taxa * (0.006 + rng() * 0.05));
      if (idx < n) d[idx] += (rng() < 0.5 ? -1 : 1) * (0.45 - r * 0.05);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// kit de síntese
// ---------------------------------------------------------------------------

/**
 * Ferramentas de síntese ligadas a um contexto. `fim` acumula o maior tempo de
 * término agendado desde o último `iniciar()` (usado para medir a voz).
 */
export class Kit {
  fim = 0;

  constructor(
    readonly ac: BaseAudioContext,
    readonly rec: Recursos,
    public rnd: Rng
  ) {}

  iniciar(t: number): void {
    this.fim = t;
  }

  private marcar(fim: number): number {
    if (fim > this.fim) this.fim = fim;
    return fim;
  }

  /** Aplica uma curva de automação a partir do tempo `t`. */
  curva(param: AudioParam, t: number, c: Curva, escala = 1): void {
    if (typeof c === 'number') {
      param.setValueAtTime(c * escala, t);
      return;
    }
    let primeiro = true;
    for (const pt of c) {
      const tt = t + pt[0];
      const v = pt[1] * escala;
      const modo = pt[2] ?? 'exp';
      if (primeiro || modo === 'set') {
        param.setValueAtTime(v, tt);
        primeiro = false;
      } else if (modo === 'lin' || v <= 0) {
        param.linearRampToValueAtTime(v, tt);
      } else {
        param.exponentialRampToValueAtTime(Math.max(v, MINIMO), tt);
      }
    }
  }

  /** Aplica um envelope a um parâmetro de ganho. Retorna o tempo final. */
  envelope(param: AudioParam, t: number, e: Envelope): number {
    const p = Math.max(e.p, MINIMO * 2);
    const a = Math.max(e.a, 0.002);
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(p, t + a);
    if (e.s && e.s > 0) {
      const sv = Math.max(p * e.s, MINIMO);
      const t1 = t + a + Math.max(e.d, 0.001);
      param.exponentialRampToValueAtTime(sv, t1);
      const t2 = t1 + (e.h ?? 0);
      if (t2 > t1) param.setValueAtTime(sv, t2);
      const t3 = t2 + Math.max(e.r ?? 0.05, 0.005);
      param.exponentialRampToValueAtTime(MINIMO, t3);
      param.linearRampToValueAtTime(0, t3 + 0.004);
      return t3 + 0.004;
    }
    const t1 = t + a + Math.max(e.d, 0.005);
    param.exponentialRampToValueAtTime(MINIMO, t1);
    param.linearRampToValueAtTime(0, t1 + 0.004);
    return t1 + 0.004;
  }

  ganho(destino: AudioNode | null, valor = 1): GainNode {
    const g = this.ac.createGain();
    g.gain.value = valor;
    if (destino) g.connect(destino);
    return g;
  }

  biquad(t: number, o: OpcoesFiltro): BiquadFilterNode {
    const b = this.ac.createBiquadFilter();
    b.type = o.tipo;
    this.curva(b.frequency, t, o.f);
    if (o.q !== undefined) this.curva(b.Q, t, o.q);
    if (o.g !== undefined) b.gain.setValueAtTime(o.g, t);
    return b;
  }

  /** Encadeia filtros a partir de `entrada`; retorna o último nó da cadeia. */
  cadeia(entrada: AudioNode, t: number, filtros?: Filtros): AudioNode {
    if (!filtros) return entrada;
    const lista: readonly OpcoesFiltro[] = 'tipo' in filtros ? [filtros] : filtros;
    let atual = entrada;
    for (const fo of lista) {
      const b = this.biquad(t, fo);
      atual.connect(b);
      atual = b;
    }
    return atual;
  }

  fonteOsc(t: number, tipo: TipoOnda, f: Curva, detune = 0): OscillatorNode {
    const o = this.ac.createOscillator();
    if (tipo === 'pulso' || tipo === 'suave' || tipo === 'oco')
      o.setPeriodicWave(this.rec.ondas[tipo]);
    else o.type = tipo;
    this.curva(o.frequency, t, f);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.start(t);
    return o;
  }

  fonteRuido(t: number, cor: CorRuido = 'branco', taxa = 1): AudioBufferSourceNode {
    const s = this.ac.createBufferSource();
    const buf = this.rec.ruidos[cor];
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.setValueAtTime(taxa, t);
    s.start(t, this.rnd() * Math.max(0, buf.duration - 0.1));
    return s;
  }

  /** Vibrato aplicado ao parâmetro `detune` (em cents). */
  vibrato(param: AudioParam, t: number, fim: number, v: Vibrato): void {
    const lfo = this.ac.createOscillator();
    lfo.frequency.setValueAtTime(v.f, t);
    const g = this.ac.createGain();
    const ini = t + (v.atraso ?? 0);
    g.gain.setValueAtTime(0, t);
    if (ini > t) g.gain.setValueAtTime(0, ini);
    g.gain.linearRampToValueAtTime(v.c, ini + 0.06);
    lfo.connect(g);
    g.connect(param);
    lfo.start(t);
    lfo.stop(fim + 0.02);
  }

  osc(destino: AudioNode, t: number, o: OpcoesOsc): number {
    const fonte = this.fonteOsc(t, o.tipo ?? 'sine', o.f, o.detune ?? 0);
    const vca = this.ganho(destino, 0);
    const fim = this.envelope(vca.gain, t, o.env);
    this.cadeia(fonte, t, o.filtro).connect(vca);
    if (o.vib) this.vibrato(fonte.detune, t, fim, o.vib);
    fonte.stop(fim + 0.02);
    return this.marcar(fim);
  }

  ruido(destino: AudioNode, t: number, o: OpcoesRuido): number {
    const fonte = this.fonteRuido(t, o.cor ?? 'branco', o.taxa ?? 1);
    const vca = this.ganho(destino, 0);
    const fim = this.envelope(vca.gain, t, o.env);
    this.cadeia(fonte, t, o.filtro).connect(vca);
    fonte.stop(fim + 0.02);
    return this.marcar(fim);
  }

  fm(destino: AudioNode, t: number, o: OpcoesFm): number {
    const portadora = this.fonteOsc(t, o.tipo ?? 'sine', o.f);
    const mod = this.ac.createOscillator();
    this.curva(mod.frequency, t, o.f, o.razao);
    const prof = this.ac.createGain();
    prof.gain.value = 0;
    this.curva(prof.gain, t, o.dev);
    mod.connect(prof);
    prof.connect(portadora.frequency);
    mod.start(t);
    const vca = this.ganho(destino, 0);
    const fim = this.envelope(vca.gain, t, o.env);
    this.cadeia(portadora, t, o.filtro).connect(vca);
    portadora.stop(fim + 0.02);
    mod.stop(fim + 0.02);
    return this.marcar(fim);
  }

  /** Sino por síntese aditiva: cada parcial com seu decaimento. */
  sino(
    destino: AudioNode,
    t: number,
    f: number,
    parciais: readonly Parcial[],
    pico: number,
    ataque = 0.002
  ): number {
    let fim = t;
    for (const [razao, g, d] of parciais) {
      fim = Math.max(
        fim,
        this.osc(destino, t, { f: f * razao, env: { a: ataque, d, p: pico * g } })
      );
    }
    return fim;
  }

  /** Saturação suave; retorna o nó de entrada (ligado a `destino`). */
  saturador(destino: AudioNode, ganhoEntrada = 2): AudioNode {
    const pre = this.ganho(null, ganhoEntrada);
    const ws = this.ac.createWaveShaper();
    ws.curve = this.rec.saturacao;
    const pos = this.ganho(destino, 1 / Math.max(1, ganhoEntrada * 0.6));
    pre.connect(ws);
    ws.connect(pos);
    return pre;
  }

  /** Panorâmica fixa (sem StereoPanner disponível, liga direto). */
  panorama(destino: AudioNode, pan: number): AudioNode {
    if (typeof this.ac.createStereoPanner !== 'function' || pan === 0) return destino;
    const p = this.ac.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(destino);
    return p;
  }
}
