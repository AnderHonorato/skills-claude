/**
 * Receitas do tema programação ("vírus", "kernel panic", "ransomware"...):
 * glitch RGB, morte digital em voxels, chuva de código estilo matriz, firewall,
 * coletor de lixo, breakpoint, recursão, criptografia e vazamento de memória.
 * Usam os mesmos 4 lotes do SistemaFx (nenhum draw call extra).
 */
import * as THREE from 'three';
import { glitchFatia, GLIFOS, type Ctx } from './elementos';
import { ESTILO_PLANO } from './ondas';
import { MODO } from './particulas';
import { Q } from './texturas';
import { sinal, sortear, type CorFx } from './util';
import { ESTILO_VOLUME } from './volumes';

export interface CtxCodigo extends Ctx {
  /** Quantas emissões cabem neste quadro para uma taxa (por segundo). */
  taxa(chave: string, porSegundo: number): number;
}

const VERDE = '#39ff88';
const VERDE_CLARO = '#8affb8';
const VERDE_ESCURO = '#18a850';

const suave = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Explosão de glitch: barras RGB deslocadas, varredura e pixels voando de lado. */
export function glitch(c: CtxCodigo, x: number, y: number, z: number, s: number): void {
  const p = c.p;
  glitchFatia(c, x, y, z, s * 1.6, 7);
  p.emitir({
    x,
    y,
    z,
    vida: 0.16,
    tam: 1.3 * s,
    cor: '#ff2a6a',
    brilho: 1.3,
    aditivo: 0.6,
    quadro: Q.GLITCH,
    entrada: 0,
    curva: 0.3,
  });
  p.emitir({
    x: x + 0.12 * s,
    y: y + 0.04,
    z,
    vida: 0.16,
    tam: 1.3 * s,
    cor: '#2af0ff',
    brilho: 1.3,
    aditivo: 0.6,
    quadro: Q.GLITCH,
    entrada: 0,
    curva: 0.3,
  });
  p.emitir({
    x,
    y,
    z,
    vida: 0.1,
    tam: 0.05 * s,
    aspecto: 40,
    cor: '#ffffff',
    brilho: 2,
    aditivo: 0.4,
    quadro: Q.PIXEL,
    entrada: 0,
    curva: 0.3,
  });
  const n = c.q(12);
  for (let k = 0; k < n; k++) {
    const lado = Math.random() < 0.5 ? -1 : 1;
    p.emitir({
      x,
      y: y + sinal() * 0.5 * s,
      z: z + sinal() * 0.3 * s,
      vx: lado * sortear(3, 8),
      vy: sinal() * 0.6,
      vz: sinal() * 1.2,
      vida: sortear(0.18, 0.35),
      tam: sortear(0.07, 0.16) * s,
      cor: ['#ff2a6a', '#2af0ff', VERDE, '#ffffff'][k % 4],
      brilho: 1.3,
      aditivo: 0.35,
      quadro: Q.PIXEL,
      arrasto: 5,
      curva: 0.4,
    });
  }
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL_DIGITAL,
    x,
    z,
    raio: 0.3 * s,
    raioFim: 1.4 * s,
    vida: 0.25,
    cor: '#bff8ff',
    cor2: '#ff2a6a',
    brilho: 1.2,
    param: 0.5,
    aditivo: 0.6,
  });
}

/** Inimigo "deletado": varredura branca, voxels que espalham e 0/1 subindo. */
export function morteDigital(
  c: CtxCodigo,
  x: number,
  y: number,
  z: number,
  cor: CorFx,
  s: number
): void {
  const p = c.p;
  const base = cor instanceof THREE.Color ? cor.clone() : new THREE.Color(cor);
  const clara = base.clone().lerp(new THREE.Color(1, 1, 1), 0.5);
  const escura = base.clone().multiplyScalar(0.55);
  p.emitir({
    x,
    y,
    z,
    vida: 0.12,
    tam: 0.14 * s,
    aspecto: 14,
    cor: '#ffffff',
    brilho: 2.2,
    aditivo: 0.5,
    quadro: Q.PIXEL,
    entrada: 0,
    curva: 0.4,
  });
  p.emitir({
    x,
    y,
    z,
    vida: 0.09,
    tam: 1 * s,
    tamFim: 1.6 * s,
    cor: '#ffffff',
    brilho: 1.8,
    quadro: Q.BRILHO,
    entrada: 0,
    curva: 1.5,
  });
  const n = c.q(11);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const v = sortear(1.8, 4.5);
    p.emitir({
      x: x + Math.cos(a) * 0.15 * s,
      y: y + sinal() * 0.2 * s,
      z: z + Math.sin(a) * 0.15 * s,
      vx: Math.cos(a) * v,
      vy: sortear(2, 5),
      vz: Math.sin(a) * v,
      vida: sortear(0.75, 1.05),
      tam: sortear(0.2, 0.36) * s,
      cor: k % 3 === 0 ? clara : k % 3 === 1 ? base : escura,
      aditivo: 0,
      quadro: Q.PIXEL,
      rot: sinal() * 0.3,
      giro: sinal() * 3,
      gravidade: 14,
      quique: 0.35,
      curva: 0.35,
    });
  }
  const m = c.q(5);
  for (let k = 0; k < m; k++)
    p.emitir({
      x: x + sinal() * 0.35 * s,
      y: y + sortear(0, 0.3),
      z: z + sinal() * 0.35 * s,
      vx: sinal() * 0.3,
      vy: sortear(1.1, 2.2),
      vz: sinal() * 0.3,
      vida: sortear(0.8, 1.2),
      tam: sortear(0.3, 0.42) * s,
      cor: VERDE_CLARO,
      corFim: VERDE_ESCURO,
      brilho: 1.3,
      aditivo: 0.55,
      quadro: Math.random() < 0.5 ? Q.ZERO : Q.UM,
      arrasto: 1.2,
      entrada: 0.1,
    });
  glitchFatia(c, x, y, z, s * 0.8, 1);
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL_DIGITAL,
    x,
    z,
    raio: 0.25 * s,
    raioFim: 1.3 * s,
    vida: 0.3,
    cor: clara,
    cor2: base,
    brilho: 1.1,
    param: 0.45,
    aditivo: 0.35,
  });
}

/** Chuva de código: colunas de glifos verdes caindo numa área por `duracao` s. */
export function chuvaCodigo(
  c: CtxCodigo,
  x: number,
  z: number,
  raio: number,
  duracao: number
): void {
  const n = Math.max(4, c.q(Math.round(raio * 6)));
  const colunas: {
    x: number;
    z: number;
    y: number;
    v: number;
    espera: number;
    acc: number;
    topo: number;
  }[] = [];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * raio;
    const topo = sortear(2.5, 4.2);
    colunas.push({
      x: x + Math.cos(a) * r,
      z: z + Math.sin(a) * r,
      y: topo,
      v: sortear(4.5, 7.5),
      espera: Math.random() * 0.5,
      acc: 0,
      topo,
    });
  }
  c.planos.criar({
    estilo: ESTILO_PLANO.GRADE_HEX,
    x,
    z,
    raio: raio * 1.15,
    vida: duracao + 0.4,
    cor: VERDE,
    cor2: '#0a4a20',
    alfa: 0.7,
    param: 1,
    camada: 0,
    entrada: 0.15,
    curva: 0.6,
  });
  // poça escura de "terminal" por baixo: o verde-matriz precisa de fundo escuro
  c.planos.criar({
    estilo: ESTILO_PLANO.LUZ_CHAO,
    x,
    z,
    raio: raio * 1.7,
    vida: duracao + 0.4,
    cor: '#010603',
    alfa: 1,
    aditivo: 0,
    camada: 0,
    entrada: 0.12,
    curva: 0.6,
  });
  c.agendar(duracao, (t, dt) => {
    const fim = t > 0.85;
    for (const col of colunas) {
      if (col.espera > 0) {
        col.espera -= dt;
        continue;
      }
      col.y -= col.v * dt;
      col.acc += dt;
      // cabeça brilhante
      c.p.desenharAgora({
        x: col.x,
        y: col.y,
        z: col.z,
        tam: 0.42,
        cor: '#f0fff4',
        brilho: 1.8,
        aditivo: 0.6,
        quadro: GLIFOS[Math.floor(Math.random() * GLIFOS.length)],
      });
      if (col.acc > 0.075) {
        col.acc = 0;
        c.p.emitir({
          x: col.x,
          y: col.y,
          z: col.z,
          vida: 0.6,
          tam: 0.38,
          cor: VERDE_CLARO,
          corFim: '#0a6a30',
          brilho: 1.2,
          aditivo: 0.3,
          quadro: GLIFOS[Math.floor(Math.random() * GLIFOS.length)],
          entrada: 0,
          curva: 1.3,
        });
      }
      if (col.y < 0.1) {
        if (Math.random() < 0.5)
          c.p.emitir({
            x: col.x,
            y: 0.06,
            z: col.z,
            vida: 0.25,
            tam: 0.2,
            tamFim: 0.6,
            cor: VERDE,
            brilho: 1.3,
            quadro: Q.ANEL,
            modo: MODO.CHAO,
            entrada: 0,
          });
        col.y = fim ? -99 : col.topo;
        col.espera = fim ? 99 : Math.random() * 0.25;
      }
    }
  });
}

/** Firewall: muralha circular de segmentos hexagonais em chamas. t = progresso 0..1. */
export function firewall(
  c: CtxCodigo,
  id: string | number,
  x: number,
  z: number,
  raio: number,
  t: number
): void {
  const sobe = suave(0, 0.12, t);
  const some = t > 0.85 ? Math.max(0, (1 - t) / 0.15) : 1;
  const chave = `fw:${id}`;
  c.volumes.manter(
    chave,
    {
      estilo: ESTILO_VOLUME.FIREWALL,
      x,
      z,
      altura: 1.7 * (0.15 + 0.85 * sobe),
      raioBase: raio,
      raioTopo: raio,
      cor: '#ff8a1a',
      cor2: '#a01208',
      brilho: 1.2,
      alfa: some,
      aditivo: 0.5,
    },
    c.tempo
  );
  c.planos.manter(
    chave,
    {
      estilo: ESTILO_PLANO.GRADE_HEX,
      x,
      z,
      raio: raio * 1.18,
      param: 0.24,
      cor: '#ff8a1a',
      cor2: '#c81e0a',
      brilho: 1.1,
      alfa: some * 0.9,
      aditivo: 0.6,
      camada: 0,
    },
    c.tempo
  );
  const n = c.taxa(chave, 10 + raio * 9);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const px = x + Math.cos(a) * raio;
    const pz = z + Math.sin(a) * raio;
    if (Math.random() < 0.65)
      c.p.emitir({
        x: px,
        y: sortear(0.2, 1.4),
        z: pz,
        vx: sinal() * 0.3,
        vy: sortear(1.5, 3),
        vz: sinal() * 0.3,
        vida: sortear(0.5, 0.9),
        tam: 0.07,
        cor: '#ffe7a0',
        corFim: '#ff4a12',
        brilho: 2.2,
        quadro: Q.BRASA,
        arrasto: 1,
      });
    else
      c.p.emitir({
        x: px,
        y: 1.5 * sobe,
        z: pz,
        vy: sortear(0.8, 1.6),
        vida: 0.45,
        tam: 0.55,
        tamFim: 0.2,
        cor: '#ffd36b',
        corFim: '#e8380c',
        brilho: 1.6,
        aditivo: 0.8,
        quadro: Q.CHAMA_C,
        arrasto: 1,
        alfa: some,
      });
  }
}

/** Coletor de lixo: varredura para dentro, lixo (voxels/bytes) sugado e compactado. */
export function coletorLixo(c: CtxCodigo, x: number, z: number, raio: number): void {
  const dur = 0.6;
  c.planos.criar({
    estilo: ESTILO_PLANO.VARREDURA,
    x,
    z,
    raio,
    vida: dur,
    cor: '#e8fff0',
    cor2: VERDE,
    brilho: 1.3,
    alfa: 1,
    aditivo: 0.7,
    entrada: 0.02,
    curva: 0.4,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.GRADE_HEX,
    x,
    z,
    raio,
    vida: dur + 0.2,
    cor: VERDE,
    cor2: '#0a4a20',
    alfa: 0.55,
    param: 1,
    camada: 0,
    entrada: 0.1,
  });
  const n = c.q(30);
  const cores = ['#9aa3ad', '#7a8590', VERDE, '#b48cff', '#c8ced6'];
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = sortear(0.35, 1) * raio;
    const vida = dur * (0.45 + 0.55 * (r / raio)) + 0.05;
    const y0 = sortear(0.1, 0.8);
    const q = Math.random();
    c.p.emitir({
      x: x + Math.cos(a) * r,
      y: y0,
      z: z + Math.sin(a) * r,
      orbX: x,
      orbZ: z,
      orbW: 2.5,
      orbVr: -(r - 0.15) / vida,
      vy: (0.5 - y0) / vida,
      vida,
      tam: q < 0.6 ? sortear(0.2, 0.36) : 0.36,
      tamFim: 0.1,
      cor: q < 0.6 ? cores[k % cores.length] : VERDE_CLARO,
      brilho: q < 0.6 ? 1 : 1.3,
      aditivo: q < 0.6 ? 0 : 0.5,
      quadro: q < 0.6 ? Q.PIXEL : q < 0.8 ? Q.HEXA : Math.random() < 0.5 ? Q.ZERO : Q.UM,
      giro: sinal() * 6,
      entrada: 0.15,
      curva: 0.3,
    });
  }
  c.agendar(dur + 0.02, (t) => {
    if (t < 1) return;
    c.p.emitir({
      x,
      y: 0.6,
      z,
      vida: 0.14,
      tam: 1.4,
      tamFim: 2.4,
      cor: VERDE_CLARO,
      brilho: 2,
      quadro: Q.BRILHO,
      entrada: 0,
      curva: 1.5,
    });
    c.p.emitir({
      x,
      y: 0.6,
      z,
      vida: 0.45,
      tam: 1.1,
      tamFim: 0.35,
      cor: '#ffffff',
      corFim: VERDE,
      brilho: 1.3,
      aditivo: 0.2,
      quadro: Q.PIXEL,
      rot: 0.2,
      giro: 4,
      entrada: 0,
      curva: 0.5,
    });
    c.planos.criar({
      estilo: ESTILO_PLANO.ANEL_DIGITAL,
      x,
      z,
      raio: 0.3,
      raioFim: 1.8,
      vida: 0.35,
      cor: VERDE,
      cor2: '#0a8a3a',
      brilho: 1.2,
      param: 0.45,
      aditivo: 0.6,
    });
    const m = c.q(8);
    for (let k = 0; k < m; k++)
      c.p.emitir({
        x,
        y: 0.6,
        z,
        vx: sinal() * 2,
        vy: sortear(1.5, 3),
        vz: sinal() * 2,
        vida: 0.7,
        tam: 0.24,
        cor: VERDE_CLARO,
        corFim: VERDE_ESCURO,
        brilho: 1.3,
        aditivo: 0.55,
        quadro: Math.random() < 0.5 ? Q.ZERO : Q.UM,
        arrasto: 2,
      });
    c.tremer(0.1);
  });
}

/** Breakpoint contínuo (t = 0..1): marcador vermelho cresce e vira campo congelado com "||". */
export function breakpoint(
  c: CtxCodigo,
  x: number,
  z: number,
  raio: number,
  t: number,
  id: string | number = 0
): void {
  const pl = c.planos;
  const some = t > 0.9 ? Math.max(0, (1 - t) / 0.1) : 1;
  const marca = suave(0, 0.25, t);
  pl.desenharAgora({
    estilo: ESTILO_PLANO.MARCADOR,
    x,
    z,
    raio: raio * (0.12 + 0.13 * marca),
    cor: '#ff2a3a',
    cor2: '#ffffff',
    brilho: 1.1,
    alfa: some,
    aditivo: 0.6,
    camada: 1,
  });
  if (t < 0.3) {
    const u = t / 0.3;
    pl.desenharAgora({
      estilo: ESTILO_PLANO.ANEL,
      x,
      z,
      raio: raio * (0.25 + 0.75 * u),
      cor: '#ff5a6a',
      cor2: '#ff2a3a',
      brilho: 1.2,
      alfa: 1 - u * 0.4,
      param: 0.12,
      aditivo: 0.6,
    });
    return;
  }
  const campo = suave(0.3, 0.42, t) * some;
  pl.desenharAgora({
    estilo: ESTILO_PLANO.CONGELAR,
    x,
    z,
    raio,
    cor: '#e8f6ff',
    cor2: '#5cb8ff',
    brilho: 1.1,
    alfa: campo * 0.95,
    aditivo: 0.8,
    camada: 0,
  });
  const pulso = 1 + 0.06 * Math.sin(c.tempo * 6);
  c.p.desenharAgora({
    x,
    y: 1.6,
    z,
    tam: raio * 0.42 * pulso * (0.6 + 0.4 * campo),
    cor: '#e8f6ff',
    brilho: 1.3,
    alfa: campo,
    aditivo: 0.5,
    quadro: Q.PAUSA,
  });
  const n = c.taxa(`bp:${id}`, 8 * raio * campo);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * raio;
    c.p.emitir({
      x: x + Math.cos(a) * r,
      y: sortear(0.1, 1.2),
      z: z + Math.sin(a) * r,
      vy: 0.25,
      vida: 1,
      tam: 0.08,
      cor: '#e8f6ff',
      brilho: 1.4,
      aditivo: 0.4,
      quadro: Q.PIXEL,
      entrada: 0.3,
    });
  }
}

/** Ativação do breakpoint (uma vez): clarão azul, anel e "||" saltando. */
export function breakpointAtivar(c: CtxCodigo, x: number, z: number, raio: number): void {
  const p = c.p;
  p.emitir({
    x,
    y: 1,
    z,
    vida: 0.14,
    tam: 2,
    tamFim: 3.4,
    cor: '#e8f6ff',
    brilho: 2,
    quadro: Q.BRILHO,
    entrada: 0,
    curva: 1.5,
  });
  p.emitir({
    x,
    y: 1.6,
    z,
    vida: 0.55,
    tam: raio * 0.2,
    tamFim: raio * 0.55,
    cor: '#ffffff',
    corFim: '#9fd8ff',
    brilho: 1.5,
    aditivo: 0.5,
    quadro: Q.PAUSA,
    entrada: 0,
    curva: 0.6,
  });
  for (let k = 0; k < 4; k++)
    p.emitir({
      x,
      y: 0.4 + k * 0.4,
      z: z + sinal() * 0.2,
      vida: 0.2 + k * 0.03,
      tam: 0.06,
      aspecto: raio * 14,
      cor: '#bfe4ff',
      brilho: 1.6,
      aditivo: 0.5,
      quadro: Q.PIXEL,
      entrada: 0,
      curva: 0.4,
    });
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL,
    x,
    z,
    raio: raio * 0.25,
    raioFim: raio * 1.05,
    vida: 0.4,
    cor: '#ffffff',
    cor2: '#5cb8ff',
    brilho: 1.3,
    param: 0.2,
    aditivo: 0.7,
  });
  c.pulso('#bfe4ff', 0.3);
}

/** Recursão: faísca fractal em Y (mini-relâmpagos que se dividem). */
export function recursao(
  c: CtxCodigo,
  x: number,
  y: number,
  z: number,
  profundidade: number,
  cor: CorFx
): void {
  const prof = Math.max(1, Math.min(4, Math.round(profundidade)));
  const ramo = (px: number, pz: number, ang: number, L: number, nivel: number) => {
    const ex = px + Math.cos(ang) * L;
    const ez = pz + Math.sin(ang) * L;
    c.raios.relampago(px, y, pz, ex, y, ez, cor, {
      largura: 0.24 + 0.1 * nivel,
      vida: 0.22 + 0.04 * nivel,
      ramos: 0,
      brilho: 1.3,
    });
    c.p.emitir({
      x: ex,
      y,
      z: ez,
      vida: 0.16,
      tam: 0.45,
      cor,
      brilho: 1.8,
      quadro: Q.BRILHO,
      entrada: 0,
    });
    if (nivel > 1) {
      ramo(ex, ez, ang - 0.55, L * 0.62, nivel - 1);
      ramo(ex, ez, ang + 0.55, L * 0.62, nivel - 1);
    }
  };
  ramo(x, z, Math.random() * Math.PI * 2, 1.9, prof);
  c.p.emitir({
    x,
    y,
    z,
    vida: 0.4,
    tam: 0.3,
    tamFim: 0.85,
    cor: '#ffffff',
    corFim: cor,
    brilho: 1.5,
    aditivo: 0.55,
    quadro: Q.CHAVES,
    entrada: 0,
    curva: 1.2,
  });
  c.p.emitir({
    x,
    y,
    z,
    vida: 0.12,
    tam: 0.8,
    cor: '#ffffff',
    brilho: 1.8,
    quadro: Q.BRILHO,
    entrada: 0,
  });
}

/** Ransomware "criptografou" algo: cadeado surge, anel verde e bytes orbitando. */
export function criptografar(c: CtxCodigo, x: number, y: number, z: number): void {
  const p = c.p;
  p.emitir({
    x,
    y: y + 0.8,
    z,
    vida: 1.1,
    tam: 0.7,
    tamFim: 1.7,
    cor: VERDE,
    corFim: '#18c860',
    brilho: 1.15,
    aditivo: 0.3,
    quadro: Q.CADEADO,
    entrada: 0,
    curva: 0.35,
  });
  p.emitir({
    x,
    y: y + 0.3,
    z,
    vida: 0.3,
    tam: 0.4,
    tamFim: 2.2,
    cor: VERDE,
    brilho: 1.5,
    aditivo: 0.8,
    quadro: Q.ANEL,
    entrada: 0,
  });
  c.planos.criar({
    estilo: ESTILO_PLANO.ANEL_DIGITAL,
    x,
    z,
    raio: 0.3,
    raioFim: 2,
    vida: 0.45,
    cor: VERDE_CLARO,
    cor2: VERDE,
    brilho: 1.2,
    param: 0.35,
    aditivo: 0.6,
  });
  const n = c.q(10);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    p.emitir({
      x: x + Math.cos(a) * 0.5,
      y: y + sortear(0, 0.6),
      z: z + Math.sin(a) * 0.5,
      orbX: x,
      orbZ: z,
      orbW: 4,
      orbVr: 0.9,
      vy: 0.5,
      vida: 0.8,
      tam: 0.24,
      cor: VERDE_CLARO,
      corFim: VERDE_ESCURO,
      brilho: 1.3,
      aditivo: 0.55,
      quadro: k % 3 ? (k % 2 ? Q.ZERO : Q.UM) : Q.HEXA,
      entrada: 0.1,
    });
  }
}

/** Vazamento de memória: poça roxo-azulada borbulhando com dígitos hexadecimais. */
export function vazamento(
  c: CtxCodigo,
  id: string | number,
  x: number,
  z: number,
  raio: number
): void {
  const chave = `vz:${id}`;
  c.planos.manter(
    chave,
    {
      estilo: ESTILO_PLANO.POCA,
      x,
      z,
      raio,
      cor: '#3020c0',
      cor2: '#8a7cff',
      alfa: 0.92,
      aditivo: 0.8,
      camada: 0,
    },
    c.tempo
  );
  const n = c.taxa(chave, 3 + raio * raio * 3);
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * raio * 0.75;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (Math.random() < 0.45)
      c.p.emitir({
        x: px,
        y: 0.08,
        z: pz,
        vy: sortear(0.1, 0.35),
        vida: sortear(0.5, 0.9),
        tam: sortear(0.08, 0.15),
        tamFim: 0.24,
        cor: '#c8d8ff',
        aditivo: 0.5,
        quadro: Q.BOLHA,
      });
    else
      c.p.emitir({
        x: px,
        y: 0.1,
        z: pz,
        vx: sinal() * 0.15,
        vy: sortear(0.4, 0.8),
        vz: sinal() * 0.15,
        vida: 1.2,
        tam: 0.32,
        cor: '#c8bcff',
        corFim: '#6a5cff',
        brilho: 1.2,
        aditivo: 0.35,
        quadro: [Q.HEXA, Q.ZERO, Q.UM, Q.ASTERISCO][Math.floor(Math.random() * 4)],
        entrada: 0.15,
      });
  }
}
