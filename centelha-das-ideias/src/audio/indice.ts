/**
 * Motor de áudio: efeitos sintetizados (receitas em sons.ts), sons posicionais,
 * reverberação, eco e trilha procedural por região. Tudo gerado em tempo real
 * com Web Audio, sem arquivos de som.
 */
import { criarRng, type Rng } from './aleatorio';
import type { ApiAudio, IdMusica, IdSom, OpcoesSom } from './contrato';
import { espacializar } from './espacial';
import { GerenciadorVozes } from './gerenciador-vozes';
import {
  Kit,
  PRE_LIMITADOR,
  criarCurvaLimitador,
  criarRecursos,
  criarRespostaImpulso,
  hz,
} from './sintese';
import { DEFINICOES_SONS, type EstadoSons } from './sons';

/** Metros do mundo 3D → unidades do espacializador (pensado em pixels). */
const ESCALA_MUNDO = 22;

/** Nomes de personagens → perfis de voz já afinados. */
const VOZES: Record<string, string> = {
  lumi: 'salvia',
  bento: 'caldo',
  eco: 'ressoa',
  vela: 'lume',
};

type Canal = 'geral' | 'musica' | 'efeitos';

interface Trilha {
  bpm: number;
  /** Graus da escala (notas MIDI) para os acordes, 4 compassos. */
  acordes: number[][];
  escala: number[];
  timbre: 'triangle' | 'sine' | 'suave' | 'pulso';
  brilho: number;
}

const TRILHAS: Record<IdMusica, Trilha> = {
  titulo: {
    bpm: 76,
    acordes: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
      [52, 55, 59],
    ],
    escala: [69, 71, 72, 76, 79, 81],
    timbre: 'sine',
    brilho: 0.6,
  },
  jardim: {
    bpm: 92,
    acordes: [
      [60, 64, 67],
      [57, 60, 64],
      [53, 57, 60],
      [55, 59, 62],
    ],
    escala: [72, 74, 76, 79, 81, 84],
    timbre: 'triangle',
    brilho: 1,
  },
  oficina: {
    bpm: 104,
    acordes: [
      [62, 65, 69],
      [58, 62, 65],
      [60, 64, 67],
      [57, 61, 64],
    ],
    escala: [74, 76, 77, 81, 84, 86],
    timbre: 'pulso',
    brilho: 0.8,
  },
  vale: {
    bpm: 84,
    acordes: [
      [57, 60, 64],
      [56, 59, 64],
      [53, 57, 60],
      [52, 56, 59],
    ],
    escala: [69, 71, 72, 75, 76, 81],
    timbre: 'suave',
    brilho: 0.55,
  },
  farol: {
    bpm: 88,
    acordes: [
      [55, 59, 62],
      [52, 55, 59],
      [48, 52, 55],
      [50, 54, 57],
    ],
    escala: [74, 76, 79, 81, 83, 86],
    timbre: 'sine',
    brilho: 0.9,
  },
  chefe: {
    bpm: 128,
    acordes: [
      [57, 60, 64],
      [53, 57, 60],
      [55, 58, 62],
      [52, 56, 59],
    ],
    escala: [69, 72, 74, 75, 76, 79],
    timbre: 'pulso',
    brilho: 1,
  },
  vitoria: {
    bpm: 112,
    acordes: [
      [60, 64, 67],
      [65, 69, 72],
      [67, 71, 74],
      [60, 64, 67],
    ],
    escala: [72, 76, 79, 84, 88, 91],
    timbre: 'triangle',
    brilho: 1,
  },
  construcao: {
    bpm: 80,
    acordes: [
      [60, 65, 67],
      [58, 62, 65],
      [60, 65, 67],
      [55, 60, 62],
    ],
    escala: [72, 74, 77, 79, 84],
    timbre: 'sine',
    brilho: 0.7,
  },
};

export function criarAudio(): ApiAudio {
  const volumes: Record<Canal, number> = { geral: 0.8, musica: 0.55, efeitos: 0.85 };
  let ac: AudioContext | null = null;
  let mestre: GainNode;
  let busEfeitos: GainNode;
  let busMusica: GainNode;
  let envioRev: GainNode;
  let envioEco: GainNode;
  let kit: Kit;
  let rng: Rng;
  const vozes = new GerenciadorVozes(28);
  const nos = new Map<number, GainNode>();
  const estado: EstadoSons = { falas: new Map() };
  let ouvinte = { x: 0, y: 0 };
  let suspenso = false;
  let musicaAtual: IdMusica | null = null;
  let intensidade = 0;
  let proximaBatida = 0;
  let batida = 0;
  let relogio: number | undefined;

  function montar(): void {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    rng = criarRng(1234);
    kit = new Kit(ac, criarRecursos(ac, rng), rng);
    const pre = ac.createGain();
    pre.gain.value = PRE_LIMITADOR;
    const limitador = ac.createWaveShaper();
    limitador.curve = criarCurvaLimitador();
    mestre = ac.createGain();
    mestre.connect(pre).connect(limitador).connect(ac.destination);
    busEfeitos = ac.createGain();
    busMusica = ac.createGain();
    busEfeitos.connect(mestre);
    busMusica.connect(mestre);
    const reverb = ac.createConvolver();
    reverb.buffer = criarRespostaImpulso(ac, rng);
    envioRev = ac.createGain();
    envioRev.gain.value = 0.9;
    envioRev.connect(reverb).connect(mestre);
    const atraso = ac.createDelay(1);
    atraso.delayTime.value = 0.27;
    const retorno = ac.createGain();
    retorno.gain.value = 0.38;
    const filtroEco = ac.createBiquadFilter();
    filtroEco.type = 'lowpass';
    filtroEco.frequency.value = 2600;
    envioEco = ac.createGain();
    envioEco.connect(atraso).connect(filtroEco).connect(retorno).connect(atraso);
    filtroEco.connect(mestre);
    aplicarVolumes();
    relogio = window.setInterval(agendarMusica, 90);
  }

  function aplicarVolumes(): void {
    if (!ac) return;
    const t = ac.currentTime;
    mestre.gain.setTargetAtTime(volumes.geral, t, 0.05);
    busEfeitos.gain.setTargetAtTime(volumes.efeitos, t, 0.05);
    busMusica.gain.setTargetAtTime(volumes.musica * 0.55, t, 0.05);
  }

  function coletar(agora: number): void {
    for (const v of vozes.coletar(agora)) {
      const no = nos.get(v.id);
      if (no) {
        try {
          no.disconnect();
        } catch {
          /* já desconectado */
        }
        nos.delete(v.id);
      }
    }
  }

  function tocar(id: IdSom, o: OpcoesSom = {}): void {
    if (!ac || ac.state !== 'running') return;
    const def = DEFINICOES_SONS[id];
    if (!def) return;
    if (suspenso && !def.meta.ui) return;
    const agora = ac.currentTime;
    coletar(agora);
    if (!vozes.podeRepetir(id, agora, def.meta.i)) return;
    let ganhoEspacial = 1;
    let pan = 0;
    if (o.x !== undefined && o.y !== undefined) {
      const e = espacializar(
        o.x * ESCALA_MUNDO,
        o.y * ESCALA_MUNDO,
        ouvinte.x * ESCALA_MUNDO,
        ouvinte.y * ESCALA_MUNDO
      );
      ganhoEspacial = e.ganho;
      pan = e.pan;
      if (ganhoEspacial < 0.02) return;
    }
    const { voz, roubadas } = vozes.alocar(id, agora, def.meta.p, def.meta.n);
    for (const r of roubadas) {
      const no = nos.get(r.id);
      if (no) {
        no.gain.cancelScheduledValues(agora);
        no.gain.setTargetAtTime(0, agora, 0.01);
        window.setTimeout(() => no.disconnect(), 80);
        nos.delete(r.id);
      }
    }
    if (!voz) return;
    const saida = ac.createGain();
    saida.gain.value = def.meta.g * (o.volume ?? 1) * ganhoEspacial;
    const panner = ac.createStereoPanner();
    panner.pan.value = pan;
    saida.connect(panner).connect(busEfeitos);
    const envios = { rev: def.meta.rev, eco: def.meta.eco, ...(def.envios?.(o) ?? {}) };
    if (envios.rev) {
      const g = ac.createGain();
      g.gain.value = envios.rev;
      panner.connect(g).connect(envioRev);
    }
    if (envios.eco) {
      const g = ac.createGain();
      g.gain.value = envios.eco;
      panner.connect(g).connect(envioEco);
    }
    const tom = (o.tom ?? 1) * (1 + (rng() * 2 - 1) * def.meta.v);
    const t = agora + 0.005;
    kit.iniciar(t);
    const opcoes = o.voz ? { ...o, voz: VOZES[o.voz] ?? o.voz } : o;
    try {
      def.tocar(kit, saida, t, tom, opcoes, estado);
    } catch (erro) {
      console.warn('[audio] falha ao tocar', id, erro);
    }
    voz.fim = Math.max(kit.fim, t + 0.05) + 0.05;
    nos.set(voz.id, saida);
  }

  /** Agenda a trilha com antecedência (escalonador com olhar à frente). */
  function agendarMusica(): void {
    if (!ac || !musicaAtual || suspenso || ac.state !== 'running') return;
    const trilha = TRILHAS[musicaAtual];
    const tempoBatida = 60 / trilha.bpm / 2; // colcheias
    if (proximaBatida < ac.currentTime) proximaBatida = ac.currentTime + 0.05;
    while (proximaBatida < ac.currentTime + 0.35) {
      tocarBatida(trilha, batida, proximaBatida, tempoBatida);
      proximaBatida += tempoBatida;
      batida++;
    }
  }

  function tocarBatida(tr: Trilha, n: number, t: number, dur: number): void {
    const compasso = Math.floor(n / 8) % tr.acordes.length;
    const acorde = tr.acordes[compasso];
    const pos = n % 8;
    const k = kit;
    const s = busMusica;
    if (pos === 0) {
      // pad do acorde, longo e macio
      for (const nota of acorde) {
        k.osc(s, t, {
          tipo: 'suave',
          f: hz(nota),
          env: { a: 0.35, d: dur * 6, s: 0.6, h: dur * 2, r: 0.6, p: 0.05 },
          filtro: { tipo: 'lowpass', f: 900 + 700 * tr.brilho },
          vib: { f: 4, c: 6 },
        });
      }
      k.osc(s, t, { tipo: 'sine', f: hz(acorde[0] - 12), env: { a: 0.02, d: dur * 7, p: 0.13 } });
    }
    if (pos === 4)
      k.osc(s, t, { tipo: 'sine', f: hz(acorde[2] - 12), env: { a: 0.02, d: dur * 3, p: 0.08 } });
    // melodia pentatônica com respiros
    const semente = (n * 7919 + compasso * 31) % 13;
    if (semente < 6 && pos % 2 === 0) {
      const nota = tr.escala[(semente + compasso) % tr.escala.length];
      k.osc(s, t, {
        tipo: tr.timbre,
        f: hz(nota),
        env: { a: 0.01, d: dur * 2.4, p: 0.055 * tr.brilho + 0.02 },
        filtro: { tipo: 'lowpass', f: 3200 },
      });
    }
    // camada de combate
    if (intensidade > 0.3) {
      if (pos === 0 || pos === 4)
        k.osc(s, t, {
          tipo: 'sine',
          f: [
            [0, 140],
            [0.12, 45, 'exp'],
          ],
          env: { a: 0.002, d: 0.22, p: 0.32 * intensidade },
        });
      if (pos % 2 === 1)
        k.ruido(s, t, {
          cor: 'branco',
          env: { a: 0.001, d: 0.04, p: 0.05 * intensidade },
          filtro: { tipo: 'highpass', f: 7000 },
        });
      if (pos === 6)
        k.ruido(s, t, {
          cor: 'rosa',
          env: { a: 0.001, d: 0.12, p: 0.12 * intensidade },
          filtro: { tipo: 'bandpass', f: 1800, q: 1.2 },
        });
    }
  }

  return {
    desbloquear() {
      if (!ac) montar();
      if (ac && ac.state === 'suspended' && !suspenso) void ac.resume();
    },
    tocar,
    musica(id) {
      if (id === musicaAtual) return;
      musicaAtual = id;
      batida = 0;
      if (ac) proximaBatida = ac.currentTime + 0.4;
    },
    definirIntensidade(v) {
      intensidade = Math.max(0, Math.min(1, v));
    },
    definirVolume(canal, valor) {
      volumes[canal] = Math.max(0, Math.min(1, valor));
      aplicarVolumes();
    },
    volume: (canal) => volumes[canal],
    suspender(s) {
      suspenso = s;
      if (!ac) return;
      if (s) void ac.suspend();
      else void ac.resume();
    },
    definirOuvinte(x, y) {
      ouvinte = { x, y };
    },
    destruir() {
      if (relogio) window.clearInterval(relogio);
      void ac?.close();
    },
  } as ApiAudio & { destruir(): void };
}
