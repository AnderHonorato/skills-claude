/**
 * Monta o cenário 3D a partir dos dados do mundo: ilhas flutuantes com penhascos,
 * grama e flores instanciadas com vento, árvores que balançam, moitas que mexem
 * quando alguém passa, lagos animados, pontes, oficina, farol, a ponte de luz,
 * a parede da fronteira e o arquipélago ainda em esboço.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  ARBUSTOS,
  ARVORES,
  CAMINHOS,
  FRONTEIRA,
  LAGOS,
  OBJETOS,
  RAMPAS,
  REGIOES,
  ROCHAS,
  SOLIDOS_FIXOS,
} from '../dados/mundo';
import { criarAleatorio, hash2 } from '../nucleo/aleatorio';
import type { MundoFisico } from '../nucleo/fisica';
import type { IdRegiao, Solido } from '../nucleo/tipos';
import { aplicarVento, gradienteToon, profundidadeComVento, toon, toonNovo } from './materiais';

const COR_PENHASCO = ['#b98e6a', '#9c7458', '#7d5d4b'];

function corRegiao(id: IdRegiao | undefined): [THREE.Color, THREE.Color] {
  const r = REGIOES.find((x) => x.id === id) ?? REGIOES[0];
  return [new THREE.Color(r.grama[0]), new THREE.Color(r.grama[1])];
}

/** Topo de ilha: disco em anéis polares com cores de grama variando. */
function topoIlha(s: Solido): THREE.Mesh {
  const r = s.r ?? 1;
  const aneis = Math.max(3, Math.ceil(r / 1.4));
  const segs = Math.max(20, Math.ceil(r * 3.2));
  const pos: number[] = [];
  const cor: number[] = [];
  const idx: number[] = [];
  const [c1, c2] = corRegiao(s.regiao);
  const tmp = new THREE.Color();
  const esboco = s.visual === 'esboco';
  pos.push(0, 0, 0);
  tmp.copy(c1).lerp(c2, 0.5);
  cor.push(tmp.r, tmp.g, tmp.b);
  for (let a = 1; a <= aneis; a++) {
    for (let k = 0; k < segs; k++) {
      const ang = (k / segs) * Math.PI * 2;
      let rr = (a / aneis) * r;
      if (a === aneis) rr += 0.12 + (hash2(k, s.x * 7, 3) - 0.5) * 0.25;
      const x = Math.cos(ang) * rr;
      const z = Math.sin(ang) * rr;
      pos.push(x, a === aneis ? -0.04 : 0, z);
      const n =
        hash2(Math.floor((x + s.x) / 2.2), Math.floor((z + s.z) / 2.2), 1) * 0.6 +
        hash2(Math.floor((x + s.x) / 0.9), Math.floor((z + s.z) / 0.9), 2) * 0.4;
      tmp.copy(c1).lerp(c2, n);
      if (a === aneis) tmp.multiplyScalar(0.88);
      if (esboco) tmp.set('#c9d4f2');
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
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cor, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradienteToon() })
  );
  m.position.set(s.x, s.topo + 0.002 * ((s.x * 13 + s.z * 7) % 5), s.z);
  m.receiveShadow = true;
  return m;
}

/** Penhasco cônico de rocha sob a ilha, com camadas de terra. */
function penhasco(s: Solido, rnd: () => number): THREE.Group {
  const g = new THREE.Group();
  const r = s.r ?? 1;
  const altura = Math.min(22, 4 + r * 0.9);
  const geo = new THREE.CylinderGeometry(
    r + 0.1,
    r * 0.25,
    altura,
    Math.max(14, Math.ceil(r * 2.2)),
    4,
    true
  );
  const pos = geo.attributes.position;
  const cores: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y + altura / 2) / altura; // 1 no topo
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (t < 0.98) {
      const ruido = 0.75 + rnd() * 0.5;
      pos.setX(i, x * ruido);
      pos.setZ(i, z * ruido);
      pos.setY(i, y + (rnd() - 0.5) * 0.6);
    }
    const camada = t > 0.9 ? 0 : t > 0.6 ? 1 : 2;
    c.set(COR_PENHASCO[camada]).multiplyScalar(0.9 + rnd() * 0.2);
    if (s.visual === 'esboco') c.set('#a9b6e6');
    cores.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: gradienteToon(),
      side: THREE.DoubleSide,
      wireframe: s.visual === 'esboco',
    })
  );
  m.position.set(s.x, s.topo - altura / 2 - 0.05, s.z);
  g.add(m);
  // faixa de grama pendurada na borda
  const borda = new THREE.Mesh(
    new THREE.CylinderGeometry(r + 0.16, r + 0.02, 0.35, Math.max(16, Math.ceil(r * 3)), 1, true),
    toon(
      s.visual === 'esboco'
        ? '#c9d4f2'
        : corRegiao(s.regiao)[0].clone().multiplyScalar(0.8).getStyle()
    )
  );
  borda.position.set(s.x, s.topo - 0.17, s.z);
  g.add(borda);
  // pedrinhas soltas flutuando embaixo
  for (let i = 0; i < Math.ceil(r / 4); i++) {
    const p = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.4 + rnd() * 0.9, 0),
      toon(COR_PENHASCO[2])
    );
    const a = rnd() * Math.PI * 2;
    p.position.set(
      s.x + Math.cos(a) * r * 0.8,
      s.topo - altura * (0.5 + rnd() * 0.6),
      s.z + Math.sin(a) * r * 0.8
    );
    p.userData.flutua = rnd() * 6;
    g.add(p);
  }
  return g;
}

function textoCaminho(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(214,176,128,0)');
  grad.addColorStop(0.22, 'rgba(214,176,128,1)');
  grad.addColorStop(0.78, 'rgba(214,176,128,1)');
  grad.addColorStop(1, 'rgba(214,176,128,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Faixa de terra batida seguindo uma polilinha. */
function caminho(
  pontos: { x: number; z: number }[],
  fisica: MundoFisico,
  mat: THREE.Material
): THREE.Mesh {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const amostras: { x: number; z: number }[] = [];
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    const n = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.8));
    for (let k = 0; k < n; k++)
      amostras.push({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n });
  }
  amostras.push(pontos[pontos.length - 1]);
  const largura = 0.95;
  for (let i = 0; i < amostras.length; i++) {
    const p = amostras[i];
    const q = amostras[Math.min(amostras.length - 1, i + 1)];
    const o = amostras[Math.max(0, i - 1)];
    let dx = q.x - o.x;
    let dz = q.z - o.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    const nx = -dz;
    const nz = dx;
    const w = largura * (0.85 + hash2(i, 3, 9) * 0.3);
    const y = Math.max(0, fisica.alturaChao(p.x, p.z, 10, 0)) + 0.025;
    pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
    uv.push(0, i * 0.3, 1, i * 0.3);
    if (i < amostras.length - 1) {
      const b = i * 2;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}

const VERT_AGUA = /* glsl */ `
varying vec2 vUv;
varying vec3 vMundo;
void main() {
  vUv = uv;
  vec4 m = modelMatrix * vec4(position, 1.0);
  vMundo = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;
const FRAG_AGUA = /* glsl */ `
uniform float uTempo;
varying vec2 vUv;
varying vec3 vMundo;
void main() {
  vec2 c = vUv - 0.5;
  float d = length(c) * 2.0;
  vec3 fundo = mix(vec3(0.33, 0.66, 0.86), vec3(0.55, 0.85, 0.95), d);
  float ondas = sin(vMundo.x * 2.3 + uTempo * 1.7) * sin(vMundo.z * 2.1 - uTempo * 1.3);
  float brilho = smoothstep(0.72, 0.95, ondas);
  float borda = smoothstep(0.82, 0.98, d);
  vec3 cor = fundo + brilho * 0.35 + borda * 0.4;
  gl_FragColor = vec4(cor, 0.82);
  #include <colorspace_fragment>
}`;

export interface Cenario {
  grupo: THREE.Group;
  /** Agita a moita de índice i (alguém passou por ela). */
  agitarMoita(i: number, forca: number): void;
  revelarOculta(id: string): void;
  atualizar(dt: number, tempo: number, flags: (f: string) => boolean): void;
  /** Posição da ponta do facho do farol (quando aceso). */
  farolAceso: boolean;
}

export function criarCenario(fisica: MundoFisico, qualidade: 'alta' | 'media' | 'baixa'): Cenario {
  const grupo = new THREE.Group();
  const rnd = criarAleatorio(77);
  const densidade = qualidade === 'alta' ? 1 : qualidade === 'media' ? 0.6 : 0.35;
  const flutuantes: THREE.Object3D[] = [];

  // ---------------------------------------------------------------- ilhas
  for (const s of SOLIDOS_FIXOS) {
    if (s.tipo !== 'ilha') continue;
    grupo.add(topoIlha(s));
    const p = penhasco(s, rnd);
    p.traverse((o) => {
      if (o.userData.flutua !== undefined) flutuantes.push(o);
    });
    grupo.add(p);
  }

  // ---------------------------------------------------------------- pontes, rochas, prédios
  const madeira = toon('#b07a4a');
  const madeiraEscura = toon('#7d5534');
  const rocha = toon('#a59a8c');
  let pontaLuz: THREE.Group | null = null;
  let porta: THREE.Group | null = null;
  let parede: THREE.Mesh | null = null;
  let feixe: THREE.Mesh | null = null;
  let lanterna: THREE.Mesh | null = null;
  for (const s of SOLIDOS_FIXOS) {
    if (s.tipo === 'ponte') {
      const g = new THREE.Group();
      const w = s.w ?? 1;
      const d = s.d ?? 1;
      const aoLongoX = w > d;
      const comprimento = aoLongoX ? w : d;
      const largura = aoLongoX ? d : w;
      const tabuas = Math.ceil(comprimento / 0.55);
      const luz = s.visual === 'luz';
      const matT = luz
        ? new THREE.MeshBasicMaterial({ color: '#ffe9a8', transparent: true, opacity: 0.75 })
        : madeira;
      for (let i = 0; i < tabuas; i++) {
        const t = new THREE.Mesh(
          new THREE.BoxGeometry(aoLongoX ? 0.48 : largura, 0.16, aoLongoX ? largura : 0.48),
          matT
        );
        const off = -comprimento / 2 + (i + 0.5) * (comprimento / tabuas);
        t.position.set(
          aoLongoX ? off : 0,
          -0.08 + (luz ? 0 : (hash2(i, s.x, 4) - 0.5) * 0.03),
          aoLongoX ? 0 : off
        );
        t.rotation.y = luz ? 0 : (hash2(i, s.z, 5) - 0.5) * 0.06;
        t.receiveShadow = !luz;
        t.castShadow = !luz;
        g.add(t);
      }
      if (!luz) {
        for (const lado of [-1, 1]) {
          const corda = new THREE.Mesh(
            new THREE.BoxGeometry(
              aoLongoX ? comprimento : 0.06,
              0.06,
              aoLongoX ? 0.06 : comprimento
            ),
            madeiraEscura
          );
          corda.position.set(
            aoLongoX ? 0 : lado * (largura / 2 - 0.05),
            0.75,
            aoLongoX ? lado * (largura / 2 - 0.05) : 0
          );
          g.add(corda);
          for (let i = 0; i <= Math.ceil(comprimento / 3); i++) {
            const poste = new THREE.Mesh(
              new THREE.CylinderGeometry(0.07, 0.08, 1, 6),
              madeiraEscura
            );
            const off = -comprimento / 2 + (i * comprimento) / Math.ceil(comprimento / 3);
            poste.position.set(
              aoLongoX ? off : lado * (largura / 2 - 0.05),
              0.35,
              aoLongoX ? lado * (largura / 2 - 0.05) : off
            );
            poste.castShadow = true;
            g.add(poste);
          }
        }
      }
      g.position.set(s.x, s.topo, s.z);
      if (luz) {
        g.visible = false;
        g.scale.set(aoLongoX ? 0.01 : 1, 1, aoLongoX ? 1 : 0.01);
        pontaLuz = g;
      }
      grupo.add(g);
    } else if (s.tipo === 'pedra') {
      const g = new THREE.Group();
      const r = s.r ?? 1;
      const topo = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.3, 12), toon('#8fcf6a'));
      topo.position.y = -0.15;
      topo.receiveShadow = true;
      const base = new THREE.Mesh(new THREE.ConeGeometry(r * 0.95, 2.4, 7), rocha);
      base.rotation.x = Math.PI;
      base.position.y = -1.5;
      g.add(topo, base);
      g.position.set(s.x, s.topo, s.z);
      g.userData.flutua = rnd() * 6;
      g.userData.baseY = s.topo;
      grupo.add(g);
    } else if (s.tipo === 'rocha' && s.forma === 'caixa') {
      const m = new THREE.Mesh(
        new RoundedBoxGeometry(s.w ?? 1, s.topo - s.base, s.d ?? 1, 2, 0.25),
        rocha
      );
      m.position.set(s.x, (s.topo + s.base) / 2, s.z);
      m.castShadow = true;
      m.receiveShadow = true;
      grupo.add(m);
      const grama = new THREE.Mesh(
        new RoundedBoxGeometry((s.w ?? 1) * 0.96, 0.12, (s.d ?? 1) * 0.96, 2, 0.05),
        toon('#86c76a')
      );
      grama.position.set(s.x, s.topo, s.z);
      grama.receiveShadow = true;
      grupo.add(grama);
    } else if (s.tipo === 'rocha' && s.visual === 'colina') {
      const r = s.r ?? 1;
      const colina = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r + 0.6, s.topo + 0.2, 28),
        toon('#b98e6a')
      );
      colina.position.set(s.x, s.topo / 2 - 0.1, s.z);
      colina.castShadow = true;
      colina.receiveShadow = true;
      const topo = new THREE.Mesh(new THREE.CircleGeometry(r + 0.05, 28), toon('#9fd17a'));
      topo.rotation.x = -Math.PI / 2;
      topo.position.set(s.x, s.topo + 0.01, s.z);
      topo.receiveShadow = true;
      grupo.add(colina, topo);
    } else if (s.tipo === 'predio' && s.visual === 'oficina') {
      const g = new THREE.Group();
      const w = s.w ?? 4;
      const d = s.d ?? 4;
      const paredes = new THREE.Mesh(new THREE.BoxGeometry(w, 3, d), toon('#e8d3b0'));
      paredes.position.y = 1.5;
      paredes.castShadow = true;
      paredes.receiveShadow = true;
      const telhado = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, (w / 2) * 1.25, 2, 4, 1),
        toon('#c4553b')
      );
      telhado.rotation.y = Math.PI / 4;
      telhado.scale.z = d / w;
      telhado.position.y = 4;
      telhado.castShadow = true;
      const porta2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.9, 0.1), madeiraEscura);
      porta2.position.set(-1, 0.95, d / 2 + 0.03);
      const janela = new THREE.Mesh(
        new THREE.BoxGeometry(1, 0.8, 0.1),
        new THREE.MeshBasicMaterial({ color: '#ffe9a8' })
      );
      janela.position.set(1.4, 1.8, d / 2 + 0.03);
      const chamine = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6, 8), toon('#8c7f73'));
      chamine.position.set(w / 2 - 1, 4.4, -d / 4);
      chamine.name = 'chamine';
      const engrenagem = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.22, 6, 12), toon('#ffb347'));
      engrenagem.position.set(0, 2.6, d / 2 + 0.15);
      engrenagem.name = 'engrenagemFachada';
      g.add(paredes, telhado, porta2, janela, chamine, engrenagem);
      g.position.set(s.x, 0, s.z);
      grupo.add(g);
    } else if (s.tipo === 'predio' && s.visual === 'gerador') {
      const g = new THREE.Group();
      const caixa = new THREE.Mesh(
        new RoundedBoxGeometry(s.w ?? 2, 2.2, s.d ?? 2, 2, 0.2),
        toon('#6f8496')
      );
      caixa.position.y = 1.1;
      caixa.castShadow = true;
      const bobina = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.6, 12), toon('#c98a3b'));
      bobina.position.y = 2.5;
      const raio = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.3, 0),
        new THREE.MeshBasicMaterial({ color: '#9df0ff' })
      );
      raio.position.y = 3.1;
      raio.name = 'raio';
      g.add(caixa, bobina, raio);
      g.position.set(s.x, 0, s.z);
      grupo.add(g);
    } else if (s.tipo === 'plataforma' && s.visual === 'caixote') {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(s.w ?? 1, s.topo - s.base, s.d ?? 1),
        toon('#c69256')
      );
      m.position.set(s.x, (s.topo + s.base) / 2, s.z);
      m.castShadow = true;
      m.receiveShadow = true;
      const ripa = new THREE.Mesh(
        new THREE.BoxGeometry((s.w ?? 1) + 0.02, 0.12, (s.d ?? 1) + 0.02),
        madeiraEscura
      );
      ripa.position.copy(m.position);
      grupo.add(m, ripa);
    } else if (s.tipo === 'porta') {
      porta = new THREE.Group();
      const w = s.w ?? 4;
      for (const lado of [-1, 1]) {
        const folha = new THREE.Group();
        const placa = new THREE.Mesh(new THREE.BoxGeometry(w / 2, 3.6, 0.3), toon('#8c6a4a'));
        placa.position.x = (-lado * w) / 4;
        placa.position.y = 1.8;
        placa.castShadow = true;
        const faixa = new THREE.Mesh(new THREE.BoxGeometry(w / 2, 0.25, 0.34), toon('#5b6878'));
        faixa.position.set((-lado * w) / 4, 2.6, 0);
        folha.add(placa, faixa);
        folha.position.x = lado * (w / 2);
        folha.name = lado < 0 ? 'folhaE' : 'folhaD';
        porta.add(folha);
      }
      const arco = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, 0.6), toon('#5b6878'));
      arco.position.y = 4.1;
      porta.add(arco);
      for (const lado of [-1, 1]) {
        const coluna = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.4, 0.6), toon('#5b6878'));
        coluna.position.set(lado * (w / 2 + 0.3), 2.1, 0);
        coluna.castShadow = true;
        porta.add(coluna);
      }
      porta.position.set(s.x, 0, s.z);
      grupo.add(porta);
    } else if (s.tipo === 'farol') {
      const g = new THREE.Group();
      const altura = s.topo - s.base;
      const torre = new THREE.Mesh(
        new THREE.CylinderGeometry((s.r ?? 2) * 0.72, s.r ?? 2, altura - 2.4, 16),
        toon('#f6f1e7')
      );
      torre.position.y = (altura - 2.4) / 2;
      torre.castShadow = true;
      g.add(torre);
      for (let i = 0; i < 3; i++) {
        const t = (i + 0.5) / 3.5;
        const faixa = new THREE.Mesh(
          new THREE.CylinderGeometry(
            (s.r ?? 2) * (1 - 0.28 * (t + 0.08)) + 0.03,
            (s.r ?? 2) * (1 - 0.28 * t) + 0.03,
            1.1,
            16
          ),
          toon('#e5534b')
        );
        faixa.position.y = t * (altura - 2.4);
        g.add(faixa);
      }
      const varanda = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.25, 16), toon('#3f5c8a'));
      varanda.position.y = altura - 2.4;
      g.add(varanda);
      lanterna = new THREE.Mesh(
        new THREE.CylinderGeometry(1.0, 1.0, 1.5, 12),
        new THREE.MeshToonMaterial({
          color: '#d9e6f2',
          gradientMap: gradienteToon(),
          emissive: '#000000',
        })
      );
      lanterna.position.y = altura - 1.55;
      g.add(lanterna);
      const cupula = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.1, 12), toon('#e5534b'));
      cupula.position.y = altura - 0.25;
      g.add(cupula);
      const porta3 = new THREE.Mesh(new THREE.BoxGeometry(1, 1.7, 0.2), madeiraEscura);
      porta3.position.set(0, 0.85, (s.r ?? 2) - 0.02);
      g.add(porta3);
      // facho de luz (aparece quando o farol acende)
      const geoF = new THREE.ConeGeometry(4, 40, 24, 1, true);
      geoF.translate(0, -20, 0);
      geoF.rotateZ(Math.PI / 2);
      feixe = new THREE.Mesh(
        geoF,
        new THREE.MeshBasicMaterial({
          color: '#fff2c4',
          transparent: true,
          opacity: 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      feixe.position.y = altura - 1.55;
      feixe.visible = false;
      g.add(feixe);
      g.position.set(s.x, s.base, s.z);
      grupo.add(g);
    } else if (s.tipo === 'fronteira') {
      // parede da fronteira: barreira de luz com faixas e andaimes
      const w = s.w ?? 10;
      const geoP = new THREE.PlaneGeometry(w, 9, 1, 1);
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 256;
      const gc = c.getContext('2d')!;
      gc.fillStyle = 'rgba(255,210,122,0.18)';
      gc.fillRect(0, 0, 256, 256);
      gc.strokeStyle = 'rgba(255,190,90,0.9)';
      gc.lineWidth = 14;
      for (let i = -256; i < 512; i += 48) {
        gc.beginPath();
        gc.moveTo(i, 256);
        gc.lineTo(i + 256, 0);
        gc.stroke();
      }
      const tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(w / 4, 2);
      tex.colorSpace = THREE.SRGBColorSpace;
      parede = new THREE.Mesh(
        geoP,
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      parede.position.set(s.x, 4.2, s.z);
      grupo.add(parede);
      for (const lado of [-1, 1]) {
        const poste = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), toon('#ffb347'));
        poste.position.set(s.x + lado * (w / 2), 4.2, s.z);
        poste.castShadow = true;
        grupo.add(poste);
      }
      const faixa = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.2), toon('#2b2530'));
      faixa.position.set(s.x, 1.1, s.z + 0.15);
      grupo.add(faixa);
      // placa "em construção"
      const placa = document.createElement('canvas');
      placa.width = 512;
      placa.height = 160;
      const gp = placa.getContext('2d')!;
      gp.fillStyle = '#ffd27a';
      gp.fillRect(0, 0, 512, 160);
      gp.strokeStyle = '#2b2530';
      gp.lineWidth = 12;
      gp.strokeRect(6, 6, 500, 148);
      gp.fillStyle = '#2b2530';
      gp.font = '700 44px Fredoka, system-ui, sans-serif';
      gp.textAlign = 'center';
      gp.fillText('EM DESENVOLVIMENTO', 256, 70);
      gp.font = '500 30px Fredoka, system-ui, sans-serif';
      gp.fillText('Arquipélago dos Sonhos', 256, 118);
      const texPlaca = new THREE.CanvasTexture(placa);
      texPlaca.colorSpace = THREE.SRGBColorSpace;
      const mPlaca = new THREE.Mesh(
        new THREE.PlaneGeometry(4, 1.25),
        new THREE.MeshBasicMaterial({ map: texPlaca })
      );
      mPlaca.position.set(s.x, 2.4, s.z + 0.35);
      grupo.add(mPlaca);
      // andaimes de luz no arquipélago em esboço
      for (let i = 0; i < 9; i++) {
        const b = new THREE.Mesh(
          new THREE.BoxGeometry(1 + rnd() * 1.5, 1 + rnd() * 3, 1 + rnd() * 1.5),
          new THREE.MeshBasicMaterial({
            color: '#c9b8ff',
            wireframe: true,
            transparent: true,
            opacity: 0.6,
          })
        );
        b.position.set(FRONTEIRA.x + (rnd() - 0.5) * 12, 1 + rnd() * 4, -136 + (rnd() - 0.5) * 10);
        b.userData.flutua = rnd() * 6;
        b.userData.baseY = b.position.y;
        flutuantes.push(b);
        grupo.add(b);
      }
    }
  }
  for (const r of RAMPAS) {
    const comp = r.eixo === 'z' ? r.d : r.w;
    const alt = Math.abs(r.de - r.ate);
    const ang = Math.atan2(alt, comp);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(r.w, 0.3, Math.hypot(comp, alt)),
      toon('#c9a77c')
    );
    m.position.set(r.x, (r.de + r.ate) / 2 - 0.12, r.z);
    m.rotation.x = r.de > r.ate ? -ang : ang;
    m.receiveShadow = true;
    m.castShadow = true;
    grupo.add(m);
  }

  // ---------------------------------------------------------------- caminhos e lagos
  const matCaminho = new THREE.MeshToonMaterial({
    map: textoCaminho(),
    gradientMap: gradienteToon(),
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    depthWrite: false,
  });
  for (const c of CAMINHOS) grupo.add(caminho(c, fisica, matCaminho));
  const uniAgua = { uTempo: { value: 0 } };
  const matAgua = new THREE.ShaderMaterial({
    vertexShader: VERT_AGUA,
    fragmentShader: FRAG_AGUA,
    uniforms: uniAgua,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    depthWrite: false,
  });
  for (const l of LAGOS) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(l.r, 32), matAgua);
    m.rotation.x = -Math.PI / 2;
    m.position.set(l.x, 0.04, l.z);
    m.renderOrder = 1;
    grupo.add(m);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + rnd();
      const p = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + rnd() * 0.2, 0), rocha);
      p.position.set(l.x + Math.cos(a) * (l.r + 0.1), 0.05, l.z + Math.sin(a) * (l.r + 0.1));
      p.scale.y = 0.6;
      grupo.add(p);
    }
    // nenúfares
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Mesh(
        new THREE.CircleGeometry(0.35, 10, 0.3, Math.PI * 1.8),
        toon('#5fae5a')
      );
      n.rotation.x = -Math.PI / 2;
      const a = rnd() * Math.PI * 2;
      const d = rnd() * l.r * 0.7;
      n.position.set(l.x + Math.cos(a) * d, 0.06, l.z + Math.sin(a) * d);
      grupo.add(n);
    }
  }

  // ---------------------------------------------------------------- vegetação instanciada
  const ocupado = (x: number, z: number) => {
    for (const c of CAMINHOS)
      for (let i = 0; i < c.length - 1; i++) {
        const a = c[i];
        const b = c[i + 1];
        const vx = b.x - a.x;
        const vz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / (vx * vx + vz * vz)));
        if (Math.hypot(x - (a.x + vx * t), z - (a.z + vz * t)) < 1.1) return true;
      }
    for (const l of LAGOS) if (Math.hypot(x - l.x, z - l.z) < l.r + 0.4) return true;
    return !!fisica.bloqueado(x, z, Math.max(0, fisica.alturaChao(x, z, 10)) + 0.1);
  };
  const ilhas = SOLIDOS_FIXOS.filter((s) => s.tipo === 'ilha' && s.visual !== 'esboco');

  // grama: tufos de 5 folhas
  const geoTufo = (() => {
    const pos: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      const ox = Math.cos(a) * 0.09;
      const oz = Math.sin(a) * 0.09;
      const h = 0.32 + (i % 3) * 0.08;
      const w = 0.05;
      const tx = Math.cos(a) * 0.08;
      const tz = Math.sin(a) * 0.08;
      pos.push(
        ox - Math.sin(a) * w,
        0,
        oz + Math.cos(a) * w,
        ox + Math.sin(a) * w,
        0,
        oz - Math.cos(a) * w,
        ox + tx,
        h,
        oz + tz
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    return g;
  })();
  const matGrama = aplicarVento(
    new THREE.MeshToonMaterial({ gradientMap: gradienteToon(), side: THREE.DoubleSide }),
    { flex: 2.4, pisada: true }
  );
  const tufos: { x: number; y: number; z: number; cor: THREE.Color; s: number }[] = [];
  for (const ilha of ilhas) {
    const area = Math.PI * (ilha.r ?? 1) ** 2;
    const n = Math.floor(area * 0.75 * densidade);
    const [c1, c2] = corRegiao(ilha.regiao);
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * ((ilha.r ?? 1) - 0.4);
      const x = ilha.x + Math.cos(a) * d;
      const z = ilha.z + Math.sin(a) * d;
      if (ocupado(x, z)) continue;
      const y = fisica.alturaChao(x, z, 10, 0);
      if (y === -Infinity) continue;
      tufos.push({
        x,
        y,
        z,
        cor: c1
          .clone()
          .lerp(c2, rnd())
          .multiplyScalar(0.85 + rnd() * 0.25),
        s: 0.7 + rnd() * 0.8,
      });
    }
  }
  const grama = new THREE.InstancedMesh(geoTufo, matGrama, tufos.length);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  tufos.forEach((t, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    m4.compose(v.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * (0.8 + rnd() * 0.5), t.s));
    grama.setMatrixAt(i, m4);
    grama.setColorAt(i, t.cor);
  });
  grama.receiveShadow = true;
  grupo.add(grama);

  // flores
  const geoFlor = new THREE.SphereGeometry(0.09, 6, 4);
  geoFlor.scale(1, 0.55, 1);
  geoFlor.translate(0, 0.28, 0);
  const caule = new THREE.CylinderGeometry(0.012, 0.015, 0.28, 4);
  caule.translate(0, 0.14, 0);
  const matFlor = aplicarVento(new THREE.MeshToonMaterial({ gradientMap: gradienteToon() }), {
    flex: 3,
    pisada: true,
  });
  const coresFlor = ['#ff9fb8', '#ffd27a', '#ffffff', '#c9b8ff', '#ff8a6b', '#8fd3ff'];
  const flores: { x: number; y: number; z: number; c: string }[] = [];
  for (const ilha of ilhas) {
    const n = Math.floor(
      Math.PI * (ilha.r ?? 1) ** 2 * 0.09 * densidade * (ilha.regiao === 'vale' ? 0.3 : 1)
    );
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const d = Math.sqrt(rnd()) * ((ilha.r ?? 1) - 0.6);
      const x = ilha.x + Math.cos(a) * d;
      const z = ilha.z + Math.sin(a) * d;
      if (ocupado(x, z)) continue;
      const y = fisica.alturaChao(x, z, 10, 0);
      flores.push({ x, y, z, c: coresFlor[Math.floor(rnd() * coresFlor.length)] });
    }
  }
  const florM = new THREE.InstancedMesh(geoFlor, matFlor, flores.length);
  const cauleM = new THREE.InstancedMesh(
    caule,
    aplicarVento(new THREE.MeshToonMaterial({ color: '#4f9a4a', gradientMap: gradienteToon() }), {
      flex: 3,
      pisada: true,
    }),
    flores.length
  );
  flores.forEach((f, i) => {
    m4.makeTranslation(f.x, f.y, f.z);
    florM.setMatrixAt(i, m4);
    cauleM.setMatrixAt(i, m4);
    florM.setColorAt(i, new THREE.Color(f.c));
  });
  grupo.add(florM, cauleM);

  // árvores: tronco + copas instanciados, com vento e sombra que balança
  const ventoTronco = { flex: 0.012, vazar: true };
  const ventoCopa = { flex: 0.045, absoluta: true, vazar: true };
  const ventoCopaSombra = { flex: 0.045, absoluta: true };
  const geoTronco = new THREE.CylinderGeometry(0.22, 0.34, 3, 7);
  geoTronco.translate(0, 1.5, 0);
  const troncos = new THREE.InstancedMesh(
    geoTronco,
    aplicarVento(toonNovo('#8a5a3b'), ventoTronco),
    ARVORES.length
  );
  troncos.customDepthMaterial = profundidadeComVento({ flex: 0.012 });
  troncos.castShadow = true;
  const geoBola = new THREE.IcosahedronGeometry(1, 1);
  const geoCone = new THREE.ConeGeometry(1, 1.6, 8);
  const bolas: THREE.Matrix4[] = [];
  const coresBola: THREE.Color[] = [];
  const cones: THREE.Matrix4[] = [];
  const coresCone: THREE.Color[] = [];
  ARVORES.forEach((a, i) => {
    const e = a.escala;
    const y = fisica.alturaChao(a.x, a.z, 10, 0);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI * 2);
    const inclina =
      a.tipo === 'torta'
        ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.18)
        : new THREE.Quaternion();
    m4.compose(
      v.set(a.x, y, a.z),
      q.clone().multiply(inclina),
      sc.set(e, e * (a.tipo === 'pinheiro' ? 0.9 : 1), e)
    );
    troncos.setMatrixAt(i, m4);
    if (a.tipo === 'pinheiro') {
      for (let k = 0; k < 3; k++) {
        const r = (1.5 - k * 0.35) * e;
        cones.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(a.x, y + (2.4 + k * 0.95) * e, a.z),
            q,
            new THREE.Vector3(r, e * (1 - k * 0.1), r)
          )
        );
        coresCone.push(
          new THREE.Color(k % 2 ? '#3f8f5a' : '#4fa36a').multiplyScalar(0.9 + rnd() * 0.2)
        );
      }
    } else {
      const base =
        a.tipo === 'torta' ? ['#7d6aa8', '#9a86c9', '#6b5a8e'] : ['#5fae5a', '#7cc56b', '#4f9a4a'];
      const blocos =
        a.tipo === 'torta'
          ? [
              [0.4, 3.4, 0, 1.2],
              [-0.5, 3.0, 0.3, 0.9],
            ]
          : [
              [0, 3.6, 0, 1.55],
              [0.85, 3.0, 0.3, 1.1],
              [-0.75, 3.1, -0.3, 1.15],
              [0.1, 4.5, -0.2, 0.95],
            ];
      for (const [bx, by, bz, br] of blocos) {
        const off = new THREE.Vector3(bx * e, by * e, bz * e).applyQuaternion(q);
        bolas.push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(a.x + off.x, y + off.y, a.z + off.z),
            q,
            new THREE.Vector3(br * e, br * e * 0.9, br * e)
          )
        );
        coresBola.push(
          new THREE.Color(base[Math.floor(rnd() * 3)]).multiplyScalar(0.9 + rnd() * 0.2)
        );
      }
    }
  });
  troncos.instanceMatrix.needsUpdate = true;
  const copas = new THREE.InstancedMesh(
    geoBola,
    aplicarVento(toonNovo('#ffffff'), ventoCopa),
    bolas.length
  );
  copas.customDepthMaterial = profundidadeComVento(ventoCopaSombra);
  bolas.forEach((m, i) => {
    copas.setMatrixAt(i, m);
    copas.setColorAt(i, coresBola[i]);
  });
  copas.castShadow = true;
  const pinheiros = new THREE.InstancedMesh(
    geoCone,
    aplicarVento(toonNovo('#ffffff'), ventoCopa),
    Math.max(1, cones.length)
  );
  pinheiros.customDepthMaterial = profundidadeComVento(ventoCopaSombra);
  pinheiros.count = cones.length;
  cones.forEach((m, i) => {
    pinheiros.setMatrixAt(i, m);
    pinheiros.setColorAt(i, coresCone[i]);
  });
  pinheiros.castShadow = true;
  grupo.add(troncos, copas, pinheiros);

  // moitas de esconder: bolinhas instanciadas com "agito" por instância
  const ventoMoita = { flex: 0.5, agito: true };
  const pedacos: { m: THREE.Matrix4; c: THREE.Color; moita: number }[] = [];
  ARBUSTOS.forEach((b, i) => {
    const y = fisica.alturaChao(b.x, b.z, 10, 0);
    const n = 5 + Math.floor(b.r * 2);
    const tons =
      REGIOES.find((r) => Math.hypot(r.centro.x - b.x, r.centro.z - b.z) < r.raio)?.id === 'vale'
        ? ['#5c8a5a', '#4f7a55', '#6b9a62']
        : ['#4f9a4a', '#5fae5a', '#3f8a46'];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd();
      const d = k === 0 ? 0 : b.r * (0.35 + rnd() * 0.45);
      const r = b.r * (0.45 + rnd() * 0.25) * (k === 0 ? 1.25 : 1);
      pedacos.push({
        m: new THREE.Matrix4().compose(
          new THREE.Vector3(b.x + Math.cos(a) * d, y + r * 0.55, b.z + Math.sin(a) * d),
          new THREE.Quaternion(),
          new THREE.Vector3(r, r * 0.95, r)
        ),
        c: new THREE.Color(tons[k % 3]).multiplyScalar(0.9 + rnd() * 0.2),
        moita: i,
      });
    }
  });
  const geoMoita = new THREE.IcosahedronGeometry(1, 1);
  const agito = new Float32Array(pedacos.length);
  geoMoita.setAttribute('aAgito', new THREE.InstancedBufferAttribute(agito, 1));
  const moitas = new THREE.InstancedMesh(
    geoMoita,
    aplicarVento(toonNovo('#ffffff'), ventoMoita),
    pedacos.length
  );
  pedacos.forEach((p, i) => {
    moitas.setMatrixAt(i, p.m);
    moitas.setColorAt(i, p.c);
  });
  moitas.castShadow = true;
  moitas.receiveShadow = true;
  grupo.add(moitas);
  const agitoMoita = new Float32Array(ARBUSTOS.length);
  const atributoAgito = geoMoita.getAttribute('aAgito') as THREE.InstancedBufferAttribute;

  // rochas decorativas
  for (const r of ROCHAS) {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(r.r, 0), rocha);
    m.scale.y = (r.h / r.r) * 1.1;
    m.position.set(r.x, r.h * 0.45, r.z);
    m.rotation.y = rnd() * 3;
    m.castShadow = true;
    m.receiveShadow = true;
    grupo.add(m);
  }

  // plataformas ocultas (aparecem quando reveladas)
  const ocultas = new Map<string, { m: THREE.Mesh; alvo: number }>();
  for (const o of OBJETOS) {
    if (o.tipo !== 'oculta') continue;
    const m = new THREE.Mesh(
      new RoundedBoxGeometry(o.w ?? 1.5, 0.5, o.d ?? 1.5, 2, 0.12),
      new THREE.MeshToonMaterial({
        color: '#9df0ff',
        gradientMap: gradienteToon(),
        transparent: true,
        opacity: 0,
        emissive: '#2a6a7a',
      })
    );
    m.position.set(o.x, (o.topo ?? 0) - 0.25, o.z);
    m.visible = false;
    m.receiveShadow = true;
    grupo.add(m);
    ocultas.set(o.id, { m, alvo: 0 });
  }

  // nuvens abaixo e acima das ilhas
  const geoNuvem = new THREE.IcosahedronGeometry(1, 1);
  const nuvens = new THREE.InstancedMesh(
    geoNuvem,
    new THREE.MeshToonMaterial({
      color: '#ffffff',
      gradientMap: gradienteToon(),
      transparent: true,
      opacity: 0.92,
    }),
    120
  );
  const dadosNuvem: { x: number; y: number; z: number; s: number; v: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const x = -60 + rnd() * 160;
    const z = 40 - rnd() * 200;
    const y = rnd() < 0.75 ? -16 - rnd() * 14 : 18 + rnd() * 10;
    for (let k = 0; k < 3; k++)
      dadosNuvem.push({
        x: x + (k - 1) * 2.6,
        y: y + (k === 1 ? 0.8 : 0),
        z: z + rnd(),
        s: 2.2 + rnd() * 2.2 + (k === 1 ? 1 : 0),
        v: 0.3 + rnd() * 0.5,
      });
  }
  grupo.add(nuvens);

  let farolAceso = false;
  let tempoLuz = 0;
  const cenario: Cenario = {
    grupo,
    get farolAceso() {
      return farolAceso;
    },
    agitarMoita(i, forca) {
      agitoMoita[i] = Math.max(agitoMoita[i], forca);
    },
    revelarOculta(id) {
      const o = ocultas.get(id);
      if (o) {
        o.alvo = 1;
        o.m.visible = true;
      }
    },
    atualizar(dt, tempo, flags) {
      uniAgua.uTempo.value = tempo;
      // moitas
      for (let i = 0; i < agitoMoita.length; i++)
        agitoMoita[i] = Math.max(0, agitoMoita[i] - dt * 1.6);
      for (let i = 0; i < pedacos.length; i++) agito[i] = agitoMoita[pedacos[i].moita];
      atributoAgito.needsUpdate = true;
      // nuvens à deriva
      dadosNuvem.forEach((n, i) => {
        n.x += n.v * dt;
        if (n.x > 110) n.x = -70;
        m4.compose(
          v.set(n.x, n.y + Math.sin(tempo * 0.2 + i) * 0.3, n.z),
          q.identity(),
          sc.set(n.s, n.s * 0.55, n.s)
        );
        nuvens.setMatrixAt(i, m4);
      });
      nuvens.instanceMatrix.needsUpdate = true;
      for (const f of flutuantes) {
        if (f.userData.baseY === undefined) f.userData.baseY = f.position.y;
        f.position.y = f.userData.baseY + Math.sin(tempo * 0.8 + f.userData.flutua) * 0.12;
      }
      // ocultas surgindo
      for (const [id, o] of ocultas) {
        if (flags(`revelado_${id}`)) o.alvo = 1;
        const mat = o.m.material as THREE.MeshToonMaterial;
        mat.opacity += (o.alvo * 0.9 - mat.opacity) * Math.min(1, dt * 3);
        o.m.visible = mat.opacity > 0.01;
        o.m.position.y += Math.sin(tempo * 2 + o.m.position.x) * 0.0015;
      }
      // ponte de luz se formando
      if (pontaLuz) {
        if (flags('ponte_luz')) {
          pontaLuz.visible = true;
          tempoLuz = Math.min(1, tempoLuz + dt * 0.8);
          pontaLuz.scale.x = Math.max(0.01, tempoLuz);
          pontaLuz.traverse((o) => {
            if (o instanceof THREE.Mesh)
              (o.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(tempo * 3) * 0.15;
          });
        }
      }
      // portão da oficina
      if (porta && flags('porta_oficina_aberta')) {
        const e = porta.getObjectByName('folhaE')!;
        const d = porta.getObjectByName('folhaD')!;
        e.rotation.y += (-1.9 - e.rotation.y) * Math.min(1, dt * 2);
        d.rotation.y += (1.9 - d.rotation.y) * Math.min(1, dt * 2);
      }
      // farol
      farolAceso = flags('farol_aceso');
      if (feixe && lanterna) {
        feixe.visible = farolAceso;
        const mat = lanterna.material as THREE.MeshToonMaterial;
        mat.emissive.set(farolAceso ? '#ffcf6a' : '#000000');
        if (farolAceso) feixe.rotation.y = tempo * 0.6;
      }
      if (parede) {
        const mat = parede.material as THREE.MeshBasicMaterial;
        if (mat.map) mat.map.offset.x = tempo * 0.15;
        mat.opacity = 0.65 + Math.sin(tempo * 2.5) * 0.15;
      }
    },
  };
  return cenario;
}
