/**
 * Geometrias dos inimigos e projéteis (fundidas em uma malha por tipo, para instanciar).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { IdInimigo } from '../dados/inimigos';

function juntar(partes: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const limpas = partes.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    for (const nome of Object.keys(n.attributes))
      if (nome !== 'position' && nome !== 'normal') n.deleteAttribute(nome);
    return n;
  });
  const r = mergeGeometries(limpas, false)!;
  r.computeVertexNormals();
  return r;
}

function em(
  g: THREE.BufferGeometry,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  g.scale(sx, sy, sz);
  g.rotateX(rx);
  g.rotateY(ry);
  g.rotateZ(rz);
  g.translate(x, y, z);
  return g;
}

/** Corpo de cada inimigo (unidade ~1 m; a escala vem do raio). Frente = +z. */
export function geometriaInimigo(id: IdInimigo): THREE.BufferGeometry {
  switch (id) {
    case 'chiado': {
      const partes = [em(new THREE.IcosahedronGeometry(0.5, 0), 0, 0.5, 0)];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        partes.push(
          em(
            new THREE.ConeGeometry(0.1, 0.32, 4),
            Math.cos(a) * 0.36,
            0.78,
            Math.sin(a) * 0.36,
            1,
            1,
            1,
            Math.sin(a) * 0.8,
            0,
            -Math.cos(a) * 0.8
          )
        );
      }
      return juntar(partes);
    }
    case 'spam':
      return juntar([
        em(new THREE.BoxGeometry(0.7, 0.45, 0.5), 0, 0.35, 0),
        em(new THREE.ConeGeometry(0.36, 0.3, 4), 0, 0.62, 0, 1, 1, 0.7, 0, Math.PI / 4),
      ]);
    case 'zumbido':
      return juntar([
        em(new THREE.SphereGeometry(0.38, 12, 8), 0, 1.2, 0, 1, 0.85, 1.25),
        em(new THREE.CircleGeometry(0.34, 10), -0.4, 1.45, -0.05, 1, 1, 1, -Math.PI / 2.4, 0, 0.5),
        em(new THREE.CircleGeometry(0.34, 10), 0.4, 1.45, -0.05, 1, 1, 1, -Math.PI / 2.4, 0, -0.5),
        em(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 4), 0, 1.6, 0.1),
        em(new THREE.SphereGeometry(0.07, 6, 4), 0, 1.76, 0.12),
      ]);
    case 'estatica':
      return juntar([
        em(new THREE.BoxGeometry(1, 1.4, 0.8), 0, 0.8, 0),
        em(new THREE.BoxGeometry(0.4, 0.12, 0.4), 0.2, 1.6, 0, 1, 1, 1, 0, 0.6),
        em(new THREE.BoxGeometry(0.35, 0.12, 0.35), -0.2, 1.72, 0.1, 1, 1, 1, 0, 1.2),
        em(new THREE.CapsuleGeometry(0.16, 0.5, 3, 6), -0.66, 0.75, 0, 1, 1, 1, 0, 0, 0.3),
        em(new THREE.CapsuleGeometry(0.16, 0.5, 3, 6), 0.66, 0.75, 0, 1, 1, 1, 0, 0, -0.3),
      ]);
    case 'alucinacao': {
      const pontos: THREE.Vector2[] = [];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        pontos.push(
          new THREE.Vector2(
            0.45 * Math.sin(t * Math.PI * 0.95) * (1 - t * 0.2) +
              (t > 0.9 ? 0 : 0.02 * Math.sin(t * 30)),
            t * 1.3
          )
        );
      }
      return juntar([em(new THREE.LatheGeometry(pontos, 14), 0, 0.2, 0)]);
    }
    case 'glitch':
      return juntar([
        em(new THREE.BoxGeometry(0.8, 0.8, 0.8), 0, 0.6, 0),
        em(new THREE.BoxGeometry(0.9, 0.18, 0.5), 0.15, 0.85, 0.1),
        em(new THREE.BoxGeometry(0.5, 0.15, 0.9), -0.15, 0.4, -0.05),
      ]);
    case 'trollBug': {
      const partes = [
        em(new THREE.SphereGeometry(0.75, 14, 10), 0, 0.85, -0.1, 1.1, 0.7, 1.35),
        em(new THREE.SphereGeometry(0.42, 12, 8), 0, 0.8, 0.85),
      ];
      for (let i = 0; i < 3; i++)
        for (const lado of [-1, 1])
          partes.push(
            em(
              new THREE.CylinderGeometry(0.06, 0.05, 0.9, 5),
              lado * 0.95,
              0.4,
              -0.5 + i * 0.5,
              1,
              1,
              1,
              0,
              0,
              lado * 1.0
            )
          );
      partes.push(
        em(new THREE.ConeGeometry(0.08, 0.5, 4), 0.2, 1.2, 1.1, 1, 1, 1, 0.9),
        em(new THREE.ConeGeometry(0.08, 0.5, 4), -0.2, 1.2, 1.1, 1, 1, 1, 0.9)
      );
      return juntar(partes);
    }
    case 'chefe': {
      const partes = [
        em(new THREE.DodecahedronGeometry(1, 1), 0, 1.6, 0, 1.1, 1.3, 1.1),
        em(new THREE.TorusGeometry(1.5, 0.12, 6, 24), 0, 1.7, 0, 1, 1, 1, Math.PI / 2.3),
      ];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        partes.push(
          em(
            new THREE.ConeGeometry(0.16, 0.8, 4),
            Math.cos(a) * 0.95,
            2.4,
            Math.sin(a) * 0.95,
            1,
            1,
            1,
            Math.sin(a) * 0.6,
            0,
            -Math.cos(a) * 0.6
          )
        );
      }
      return juntar(partes);
    }
  }
}

/** Altura dos olhos de cada inimigo (unidade). */
export const OLHOS: Record<IdInimigo, { y: number; z: number; sep: number; tam: number }> = {
  chiado: { y: 0.6, z: 0.42, sep: 0.17, tam: 0.08 },
  spam: { y: 0.42, z: 0.26, sep: 0.15, tam: 0.06 },
  zumbido: { y: 1.25, z: 0.42, sep: 0.13, tam: 0.07 },
  estatica: { y: 1.15, z: 0.41, sep: 0.25, tam: 0.11 },
  alucinacao: { y: 1.05, z: 0.36, sep: 0.13, tam: 0.08 },
  glitch: { y: 0.7, z: 0.41, sep: 0.18, tam: 0.08 },
  trollBug: { y: 0.9, z: 1.2, sep: 0.18, tam: 0.1 },
  chefe: { y: 1.9, z: 1.0, sep: 0.4, tam: 0.18 },
};

/** Formas dos projéteis. */
export type FormaProjetil =
  'orbe' | 'lanca' | 'lamina' | 'disco' | 'serra' | 'cristal' | 'estrela' | 'gota';

export function geometriaProjetil(f: FormaProjetil): THREE.BufferGeometry {
  switch (f) {
    case 'orbe':
      return new THREE.IcosahedronGeometry(0.5, 1);
    case 'lanca': {
      const g = new THREE.ConeGeometry(0.18, 1.6, 6);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case 'lamina': {
      const g = new THREE.TorusGeometry(0.5, 0.08, 4, 16, Math.PI * 1.3);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case 'disco': {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 0.12, 20);
      return g;
    }
    case 'serra': {
      const partes: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.5, 0.5, 0.08, 18)];
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        partes.push(
          em(
            new THREE.ConeGeometry(0.1, 0.25, 3),
            Math.cos(a) * 0.58,
            0,
            Math.sin(a) * 0.58,
            1,
            1,
            1,
            0,
            -a,
            -Math.PI / 2
          )
        );
      }
      return juntar(partes);
    }
    case 'cristal':
      return new THREE.OctahedronGeometry(0.5, 0);
    case 'estrela': {
      const g = new THREE.OctahedronGeometry(0.5, 0);
      g.scale(1, 0.4, 1);
      return g;
    }
    case 'gota':
      return new THREE.SphereGeometry(0.5, 10, 8);
  }
}
