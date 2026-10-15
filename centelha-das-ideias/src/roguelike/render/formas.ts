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
    case 'virus': {
      const partes = [em(new THREE.IcosahedronGeometry(0.4, 1), 0, 0.55, 0)];
      const ico = new THREE.IcosahedronGeometry(1, 0);
      const pos = ico.getAttribute('position');
      const vistos = new Set<string>();
      for (let k = 0; k < pos.count; k++) {
        const d = new THREE.Vector3(pos.getX(k), pos.getY(k), pos.getZ(k)).normalize();
        const chave = `${d.x.toFixed(2)},${d.y.toFixed(2)},${d.z.toFixed(2)}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        const haste = new THREE.CylinderGeometry(0.035, 0.035, 0.26, 4);
        haste.translate(0, 0.13, 0);
        haste.applyQuaternion(
          new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
        );
        haste.translate(d.x * 0.36, 0.55 + d.y * 0.36, d.z * 0.36);
        partes.push(haste);
        partes.push(
          em(new THREE.SphereGeometry(0.075, 6, 4), d.x * 0.64, 0.55 + d.y * 0.64, d.z * 0.64)
        );
      }
      return juntar(partes);
    }
    case 'verme':
      return juntar([
        em(new THREE.SphereGeometry(0.5, 12, 8), 0, 0.4, 0, 0.9, 0.8, 1.1),
        em(
          new THREE.ConeGeometry(0.09, 0.35, 4),
          0.18,
          0.32,
          0.55,
          1,
          1,
          1,
          Math.PI / 2.3,
          0,
          -0.3
        ),
        em(
          new THREE.ConeGeometry(0.09, 0.35, 4),
          -0.18,
          0.32,
          0.55,
          1,
          1,
          1,
          Math.PI / 2.3,
          0,
          0.3
        ),
        em(
          new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4),
          0.12,
          0.85,
          0.2,
          1,
          1,
          1,
          -0.4,
          0,
          -0.3
        ),
        em(
          new THREE.CylinderGeometry(0.02, 0.02, 0.35, 4),
          -0.12,
          0.85,
          0.2,
          1,
          1,
          1,
          -0.4,
          0,
          0.3
        ),
      ]);
    case 'trojan':
      // um "presente" dourado: o disfarce
      return juntar([
        em(new THREE.BoxGeometry(0.95, 0.7, 0.95), 0, 0.38, 0),
        em(new THREE.BoxGeometry(1.02, 0.16, 1.02), 0, 0.78, 0),
        em(new THREE.BoxGeometry(0.18, 0.74, 1), 0, 0.4, 0),
        em(new THREE.BoxGeometry(1, 0.74, 0.18), 0, 0.4, 0),
        em(new THREE.TorusGeometry(0.17, 0.06, 6, 12), 0.15, 0.98, 0, 1, 1, 1, 0, Math.PI / 2, 0.5),
        em(
          new THREE.TorusGeometry(0.17, 0.06, 6, 12),
          -0.15,
          0.98,
          0,
          1,
          1,
          1,
          0,
          Math.PI / 2,
          -0.5
        ),
      ]);
    case 'loopInfinito':
      return juntar([
        em(new THREE.TorusGeometry(0.42, 0.12, 8, 28), 0, 0.95, 0),
        em(new THREE.TorusGeometry(0.42, 0.06, 6, 28), 0, 0.95, 0, 1, 1, 1, 0, Math.PI / 2, 0),
        em(new THREE.SphereGeometry(0.2, 10, 8), 0, 0.95, 0),
      ]);
    case 'vazamento':
      return juntar([
        em(new THREE.SphereGeometry(0.55, 14, 10), 0, 0.5, 0, 1, 0.75, 1),
        em(new THREE.SphereGeometry(0.18, 8, 6), 0.5, 0.18, 0.15),
        em(new THREE.SphereGeometry(0.14, 8, 6), -0.45, 0.14, -0.2),
        em(new THREE.SphereGeometry(0.12, 8, 6), 0.1, 0.1, -0.55),
        em(new THREE.ConeGeometry(0.12, 0.3, 6), 0, 0.98, 0.1, 1, 1, 1, 0.3),
      ]);
    case 'ponteiroNulo':
      // seta de cursor do mouse
      return juntar([
        em(new THREE.ConeGeometry(0.42, 0.95, 3), 0, 1.05, 0, 1, 1, 0.45, Math.PI, 0, 0.35),
        em(new THREE.BoxGeometry(0.16, 0.5, 0.14), 0.12, 1.55, 0, 1, 1, 1, 0, 0, 0.35),
      ]);
    case 'pilha':
      return juntar([
        em(new THREE.BoxGeometry(0.95, 0.46, 0.95), 0, 0.24, 0),
        em(new THREE.BoxGeometry(0.85, 0.44, 0.85), 0.06, 0.7, -0.03, 1, 1, 1, 0, 0.18, 0),
        em(new THREE.BoxGeometry(0.78, 0.42, 0.78), -0.05, 1.14, 0.04, 1, 1, 1, 0, -0.22, 0),
        em(new THREE.BoxGeometry(0.7, 0.4, 0.7), 0.08, 1.56, 0, 1, 1, 1, 0, 0.35, 0.08),
      ]);
    case 'bloco':
      return juntar([em(new THREE.BoxGeometry(0.62, 0.55, 0.62), 0, 0.3, 0)]);
    case 'ransomware':
      // um cadeado gigante
      return juntar([
        em(new THREE.BoxGeometry(1.7, 1.45, 1), 0, 1.0, 0),
        em(new THREE.TorusGeometry(0.58, 0.16, 8, 20, Math.PI), 0, 1.72, 0),
        em(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), 0.58, 1.6, 0),
        em(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8), -0.58, 1.6, 0),
        em(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10), 0, 0.85, 0.52, 1, 1, 1, Math.PI / 2),
        em(new THREE.BoxGeometry(0.1, 0.32, 0.08), 0, 0.66, 0.52),
      ]);
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
  virus: { y: 0.62, z: 0.4, sep: 0.14, tam: 0.07 },
  verme: { y: 0.55, z: 0.42, sep: 0.15, tam: 0.07 },
  trojan: { y: 0.55, z: 0.49, sep: 0.2, tam: 0.0001 },
  loopInfinito: { y: 0.98, z: 0.19, sep: 0.07, tam: 0.06 },
  vazamento: { y: 0.6, z: 0.5, sep: 0.18, tam: 0.08 },
  ponteiroNulo: { y: 1.1, z: 0.14, sep: 0.11, tam: 0.07 },
  pilha: { y: 1.6, z: 0.36, sep: 0.15, tam: 0.07 },
  bloco: { y: 0.4, z: 0.32, sep: 0.12, tam: 0.06 },
  ransomware: { y: 1.25, z: 0.51, sep: 0.42, tam: 0.16 },
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
