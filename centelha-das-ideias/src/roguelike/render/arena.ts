/**
 * A arena: uma grande clareira de ideias com grama ao vento, árvores, rochas,
 * formações de cristal que brilham à noite e uma borda de pilares de luz.
 */
import * as THREE from 'three';
import { criarAleatorio, hash2 } from '../../nucleo/aleatorio';
import {
  aplicarVento,
  gradienteToon,
  profundidadeComVento,
  toon,
  toonNovo,
} from '../../render/materiais';

export const RAIO_ARENA = 105;

export interface Obstaculo {
  x: number;
  z: number;
  r: number;
}

export interface Arena {
  grupo: THREE.Group;
  obstaculos: Obstaculo[];
  /** Grade de obstáculos para consulta rápida. */
  obstaculosPerto(x: number, z: number): Obstaculo[];
  atualizar(dt: number, tempo: number, jx: number, jz: number, noite: number): void;
}

export function criarArena(qualidade: 'alta' | 'media' | 'baixa'): Arena {
  const grupo = new THREE.Group();
  const rnd = criarAleatorio(2026);

  // chão: disco com manchas de grama e trilhas de terra
  const aneis = 70;
  const segs = 160;
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const c1 = new THREE.Color('#79c26a');
  const c2 = new THREE.Color('#a6d86d');
  const terra = new THREE.Color('#d1b07f');
  const tmp = new THREE.Color();
  pos.push(0, 0, 0);
  cor.push(c1.r, c1.g, c1.b);
  for (let a = 1; a <= aneis; a++) {
    for (let k = 0; k < segs; k++) {
      const ang = (k / segs) * Math.PI * 2;
      const r = (a / aneis) * (RAIO_ARENA + 14);
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      pos.push(x, 0, z);
      const n =
        hash2(Math.floor(x / 4), Math.floor(z / 4), 1) * 0.6 +
        hash2(Math.floor(x / 1.5), Math.floor(z / 1.5), 2) * 0.4;
      tmp.copy(c1).lerp(c2, n);
      // trilhas de terra em espiral
      const trilha = Math.abs(Math.sin(ang * 3 + r * 0.06)) < 0.06 && r > 8;
      if (trilha) tmp.lerp(terra, 0.75);
      if (r > RAIO_ARENA) tmp.lerp(new THREE.Color('#8f86b8'), Math.min(1, (r - RAIO_ARENA) / 10));
      cor.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let k = 0; k < segs; k++) idx.push(0, 1 + ((k + 1) % segs), 1 + k);
  for (let a = 1; a < aneis; a++) {
    const b0 = 1 + (a - 1) * segs;
    const b1 = 1 + a * segs;
    for (let k = 0; k < segs; k++) {
      const k2 = (k + 1) % segs;
      idx.push(b0 + k, b0 + k2, b1 + k, b0 + k2, b1 + k2, b1 + k);
    }
  }
  const geoChao = new THREE.BufferGeometry();
  geoChao.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geoChao.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geoChao.setIndex(idx);
  geoChao.computeVertexNormals();
  const chao = new THREE.Mesh(
    geoChao,
    new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradienteToon() })
  );
  chao.receiveShadow = true;
  grupo.add(chao);

  // obstáculos: árvores e rochas
  const obstaculos: Obstaculo[] = [];
  const arvores: { x: number; z: number; e: number; tipo: number }[] = [];
  const rochas: { x: number; z: number; r: number }[] = [];
  const livre = (x: number, z: number, r: number) =>
    Math.hypot(x, z) > 9 && obstaculos.every((o) => Math.hypot(o.x - x, o.z - z) > o.r + r + 2.2);
  for (let i = 0; i < 1400 && arvores.length < 170; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * (RAIO_ARENA - 4);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const e = 0.8 + rnd() * 0.7;
    if (!livre(x, z, 0.5 * e)) continue;
    arvores.push({ x, z, e, tipo: rnd() < 0.3 ? 1 : 0 });
    obstaculos.push({ x, z, r: 0.45 * e });
  }
  for (let i = 0; i < 800 && rochas.length < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * (RAIO_ARENA - 4);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const r = 0.6 + rnd() * 1.3;
    if (!livre(x, z, r)) continue;
    rochas.push({ x, z, r });
    obstaculos.push({ x, z, r: r * 0.9 });
  }

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const vv = new THREE.Vector3();
  const ss = new THREE.Vector3();
  const eixoY = new THREE.Vector3(0, 1, 0);

  const ventoTronco = { flex: 0.012, vazar: true };
  const ventoCopa = { flex: 0.045, absoluta: true, vazar: true };
  const geoTronco = new THREE.CylinderGeometry(0.22, 0.34, 3, 7);
  geoTronco.translate(0, 1.5, 0);
  const troncos = new THREE.InstancedMesh(
    geoTronco,
    aplicarVento(toonNovo('#8a5a3b'), ventoTronco),
    arvores.length
  );
  troncos.customDepthMaterial = profundidadeComVento({ flex: 0.012 });
  troncos.castShadow = true;
  const copasDados: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  arvores.forEach((a, i) => {
    q.setFromAxisAngle(eixoY, rnd() * Math.PI * 2);
    m4.compose(vv.set(a.x, 0, a.z), q, ss.set(a.e, a.e, a.e));
    troncos.setMatrixAt(i, m4);
    const tons =
      a.tipo === 1 ? ['#c58bff', '#a46fe0', '#d9b0ff'] : ['#5fae5a', '#7cc56b', '#4f9a4a'];
    for (const [bx, by, bz, br] of [
      [0, 3.6, 0, 1.55],
      [0.85, 3.0, 0.3, 1.1],
      [-0.75, 3.1, -0.3, 1.15],
      [0.1, 4.5, -0.2, 0.95],
    ]) {
      const off = new THREE.Vector3(bx * a.e, by * a.e, bz * a.e).applyQuaternion(q);
      copasDados.push({
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(a.x + off.x, off.y, a.z + off.z),
          q,
          new THREE.Vector3(br * a.e, br * a.e * 0.9, br * a.e)
        ),
        c: new THREE.Color(tons[Math.floor(rnd() * 3)]).multiplyScalar(0.9 + rnd() * 0.2),
      });
    }
  });
  const copas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    aplicarVento(toonNovo('#ffffff'), ventoCopa),
    copasDados.length
  );
  copas.customDepthMaterial = profundidadeComVento({ flex: 0.045, absoluta: true });
  copasDados.forEach((d, i) => {
    copas.setMatrixAt(i, d.m);
    copas.setColorAt(i, d.c);
  });
  copas.castShadow = true;
  grupo.add(troncos, copas);

  const geoRocha = new THREE.DodecahedronGeometry(1, 0);
  const rochasM = new THREE.InstancedMesh(geoRocha, toon('#a59a8c'), rochas.length);
  rochas.forEach((r, i) => {
    q.setFromEuler(new THREE.Euler(rnd(), rnd() * 6, rnd()));
    m4.compose(vv.set(r.x, r.r * 0.3, r.z), q, ss.set(r.r, r.r * 0.75, r.r));
    rochasM.setMatrixAt(i, m4);
  });
  rochasM.castShadow = true;
  rochasM.receiveShadow = true;
  grupo.add(rochasM);

  // formações de cristal decorativas (brilham mais à noite)
  const cristais: THREE.Mesh[] = [];
  const matCristal = new THREE.MeshToonMaterial({
    color: '#9df0ff',
    gradientMap: gradienteToon(),
    emissive: '#2a6a7a',
    transparent: true,
    opacity: 0.92,
  });
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const d = 15 + rnd() * (RAIO_ARENA - 20);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    if (!livre(x, z, 1.5)) continue;
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const h = 1 + rnd() * 2.2;
      const m = new THREE.Mesh(new THREE.ConeGeometry(0.35 + rnd() * 0.3, h, 5), matCristal);
      m.position.set((rnd() - 0.5) * 1.6, h / 2, (rnd() - 0.5) * 1.6);
      m.rotation.set((rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.6);
      m.castShadow = true;
      g.add(m);
    }
    g.position.set(x, 0, z);
    grupo.add(g);
    cristais.push(g as unknown as THREE.Mesh);
    obstaculos.push({ x, z, r: 1.2 });
  }

  // borda: pilares de luz e névoa
  const matPilar = new THREE.MeshBasicMaterial({
    color: '#ffe9a8',
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 14, 8, 1, true), matPilar);
    p.position.set(Math.cos(a) * (RAIO_ARENA + 1.5), 7, Math.sin(a) * (RAIO_ARENA + 1.5));
    grupo.add(p);
  }
  const muro = new THREE.Mesh(
    new THREE.CylinderGeometry(RAIO_ARENA + 1.5, RAIO_ARENA + 1.5, 3, 96, 1, true),
    new THREE.MeshBasicMaterial({
      color: '#ffe9a8',
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  muro.position.y = 1.5;
  grupo.add(muro);

  // grama ao redor do jogador (janela que acompanha)
  const CEL = 0.9;
  const RAIO_GRAMA = qualidade === 'alta' ? 24 : qualidade === 'media' ? 18 : 12;
  const geoTufo = (() => {
    const p: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const ox = Math.cos(a) * 0.09;
      const oz = Math.sin(a) * 0.09;
      const h = 0.3 + (i % 3) * 0.09;
      const w = 0.05;
      p.push(
        ox - Math.sin(a) * w,
        0,
        oz + Math.cos(a) * w,
        ox + Math.sin(a) * w,
        0,
        oz - Math.cos(a) * w,
        ox + Math.cos(a) * 0.08,
        h,
        oz + Math.sin(a) * 0.08
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  })();
  const capGrama = Math.ceil(Math.PI * (RAIO_GRAMA / CEL) ** 2) + 50;
  const grama = new THREE.InstancedMesh(
    geoTufo,
    aplicarVento(
      new THREE.MeshToonMaterial({ gradientMap: gradienteToon(), side: THREE.DoubleSide }),
      { flex: 2.4, pisada: true }
    ),
    capGrama
  );
  grama.frustumCulled = false;
  grama.receiveShadow = true;
  grupo.add(grama);
  let ultimaCelX = Infinity;
  let ultimaCelZ = Infinity;
  const corT = new THREE.Color();
  const reposicionarGrama = (jx: number, jz: number) => {
    const cx = Math.round(jx / CEL);
    const cz = Math.round(jz / CEL);
    if (cx === ultimaCelX && cz === ultimaCelZ) return;
    ultimaCelX = cx;
    ultimaCelZ = cz;
    const r = Math.ceil(RAIO_GRAMA / CEL);
    let n = 0;
    for (let i = -r; i <= r; i++) {
      for (let k = -r; k <= r; k++) {
        if (i * i + k * k > r * r || n >= capGrama) continue;
        const gx = cx + i;
        const gz = cz + k;
        const h = hash2(gx, gz, 7);
        if (h < 0.35) continue;
        const x = gx * CEL + (hash2(gx, gz, 8) - 0.5) * CEL;
        const z = gz * CEL + (hash2(gx, gz, 9) - 0.5) * CEL;
        if (Math.hypot(x, z) > RAIO_ARENA) continue;
        const s = 0.7 + hash2(gx, gz, 10) * 0.9;
        q.setFromAxisAngle(eixoY, h * 20);
        m4.compose(vv.set(x, 0, z), q, ss.set(s, s * (0.8 + h * 0.5), s));
        grama.setMatrixAt(n, m4);
        corT
          .copy(c1)
          .lerp(c2, hash2(gx, gz, 11))
          .multiplyScalar(0.85 + h * 0.25);
        grama.setColorAt(n, corT);
        n++;
      }
    }
    grama.count = n;
    grama.instanceMatrix.needsUpdate = true;
    if (grama.instanceColor) grama.instanceColor.needsUpdate = true;
  };

  // grade de obstáculos
  const TAM = 6;
  const grade = new Map<string, Obstaculo[]>();
  for (const o of obstaculos) {
    const gx0 = Math.floor((o.x - o.r) / TAM);
    const gx1 = Math.floor((o.x + o.r) / TAM);
    const gz0 = Math.floor((o.z - o.r) / TAM);
    const gz1 = Math.floor((o.z + o.r) / TAM);
    for (let gx = gx0; gx <= gx1; gx++)
      for (let gz = gz0; gz <= gz1; gz++) {
        const k = `${gx},${gz}`;
        let l = grade.get(k);
        if (!l) grade.set(k, (l = []));
        l.push(o);
      }
  }
  const vazio: Obstaculo[] = [];

  return {
    grupo,
    obstaculos,
    obstaculosPerto(x, z) {
      return grade.get(`${Math.floor(x / TAM)},${Math.floor(z / TAM)}`) ?? vazio;
    },
    atualizar(_dt, tempo, jx, jz, noite) {
      reposicionarGrama(jx, jz);
      matCristal.emissive.setRGB(0.15 + noite * 0.35, 0.4 + noite * 0.5, 0.48 + noite * 0.5);
      matPilar.opacity = 0.35 + Math.sin(tempo * 1.5) * 0.08 + noite * 0.25;
    },
  };
}
