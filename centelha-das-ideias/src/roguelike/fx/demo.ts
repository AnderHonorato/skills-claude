/**
 * Vitrine dos efeitos (fx-demo.html): chão verde e câmera iguais aos do jogo,
 * passando por todas as receitas com o nome na tela.
 *   ?efeito=<nome>   mostra só uma cena (veja a lista em CENAS)
 *   ?q=alta|media|baixa   qualidade · ?bloom=0 desliga o bloom
 *   ?pausa=1         não anima sozinho: use window.__fxDemo.avancar(segundos)
 */
import * as THREE from 'three';
import { gradienteToon } from '../../render/materiais';
import { SistemaFx, type ElementoFx, type QualidadeFx } from './indice';

const ELEMENTOS: ElementoFx[] = [
  'fogo',
  'gelo',
  'raio',
  'luz',
  'vento',
  'terra',
  'veneno',
  'arcano',
  'gravidade',
  'som',
  'agua',
  'cristal',
  'codigo',
];

const params = new URLSearchParams(location.search);
const qualidade = (params.get('q') as QualidadeFx) || 'alta';
const comBloom = params.get('bloom') !== '0';
const pausado = params.get('pausa') === '1';

// ------------------------------------------------------------------ cena base

const canvas = document.getElementById('tela') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualidade !== 'baixa', alpha: true });
renderer.setClearColor(0, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = qualidade !== 'baixa';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const cena = new THREE.Scene();
cena.fog = new THREE.Fog('#f3e3cf', 30, 70);
const camera = new THREE.PerspectiveCamera(46, 1, 0.5, 220);
camera.position.set(0, 15, 10.5);
camera.lookAt(0, 0, 0);
const hemi = new THREE.HemisphereLight('#dff1ff', '#8a7a62', 1.7);
const sol = new THREE.DirectionalLight('#fff0d6', 2.3);
sol.position.set(-8, 20, 6);
sol.castShadow = true;
sol.shadow.mapSize.set(1024, 1024);
const sc = sol.shadow.camera;
sc.left = sc.bottom = -20;
sc.right = sc.top = 20;
cena.add(hemi, sol);

{
  const geo = new THREE.PlaneGeometry(90, 90, 60, 60);
  geo.rotateX(-Math.PI / 2);
  const c1 = new THREE.Color('#79c26a');
  const c2 = new THREE.Color('#a6d86d');
  const tmp = new THREE.Color();
  const pos = geo.getAttribute('position');
  const cores: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const n = 0.5 + 0.25 * Math.sin(x * 0.4 + z * 0.13) + 0.25 * Math.sin(z * 0.37 - x * 0.21);
    tmp.copy(c1).lerp(c2, n);
    cores.push(tmp.r, tmp.g, tmp.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cores, 3));
  const chao = new THREE.Mesh(
    geo,
    new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradienteToon() })
  );
  chao.receiveShadow = true;
  cena.add(chao);
}

const matToon = (cor: string) =>
  new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon() });
const jogador = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matToon('#d97757'));
jogador.position.set(0, 0.55, 0);
jogador.castShadow = true;
cena.add(jogador);

interface Boneco {
  m: THREE.Mesh;
  x: number;
  z: number;
  fase: number;
}
const bonecos: Boneco[] = [];
const geoInimigo = new THREE.IcosahedronGeometry(0.5, 0);
const matInimigo = matToon('#8e6fd0');
for (let i = 0; i < 26; i++) {
  const m = new THREE.Mesh(geoInimigo, matInimigo);
  m.castShadow = true;
  cena.add(m);
  bonecos.push({ m, x: 0, z: 0, fase: Math.random() * 6 });
}
function espalharBonecos(raioMin = 3, raioMax = 9, visiveis = 26): void {
  bonecos.forEach((b, i) => {
    const a = (i / bonecos.length) * Math.PI * 2 + Math.random() * 0.3;
    const r = raioMin + Math.random() * (raioMax - raioMin);
    b.x = Math.cos(a) * r;
    b.z = Math.sin(a) * r * 0.75;
    b.m.visible = i < visiveis;
  });
}

const fx = new SistemaFx(cena, qualidade);
const pos = comBloom ? fx.criarPosProcesso(renderer) : null;

// ------------------------------------------------------------------ marcas (rótulos 3D)

const divMarcas = document.getElementById('marcas')!;
const marcas: { el: HTMLDivElement; p: THREE.Vector3 }[] = [];
function marcar(texto: string, x: number, y: number, z: number): void {
  const el = document.createElement('div');
  el.className = 'marca';
  el.textContent = texto;
  divMarcas.appendChild(el);
  marcas.push({ el, p: new THREE.Vector3(x, y, z) });
}
function limparMarcas(): void {
  divMarcas.replaceChildren();
  marcas.length = 0;
}
const tmpV = new THREE.Vector3();
function posicionarMarcas(): void {
  for (const m of marcas) {
    tmpV.copy(m.p).project(camera);
    m.el.style.left = `${((tmpV.x + 1) / 2) * innerWidth}px`;
    m.el.style.top = `${((1 - tmpV.y) / 2) * innerHeight}px`;
  }
}

// ------------------------------------------------------------------ cenas

interface Cena {
  nome: string;
  titulo: string;
  descricao: string;
  duracao: number;
  iniciar?: () => void;
  quadro: (t: number, dt: number) => void;
}

/** Dispara `fn` a cada `periodo` segundos (com fase). */
function cada(t: number, dt: number, periodo: number, fase = 0): boolean {
  if (t < fase) return false;
  if (t - dt <= fase) return true;
  return Math.floor((t - fase) / periodo) > Math.floor((t - dt - fase) / periodo);
}

const grade = (i: number): [number, number] => {
  const col = i % 5;
  const lin = Math.floor(i / 5);
  return [-8.4 + col * 4.2, -4.2 + lin * 4.6];
};

const elUnico = (params.get('el') as ElementoFx) || 'fogo';

const CENAS: Cena[] = [
  {
    nome: 'elemento',
    titulo: `Elemento: ${elUnico}`,
    descricao: 'impacto (centro) · projétil com rastro (cima) · nova (baixo) — use ?el=<elemento>',
    duracao: 3,
    iniciar: () => espalharBonecos(0, 0, 0),
    quadro: (t, dt) => {
      if (cada(t, dt, 1.5)) fx.impacto(elUnico, -3.5, 0.8, 0.5, 1.8);
      const u = (t % 1.5) / 1.5;
      if (u < 0.9) fx.projetilRastro('pe', elUnico, -8 + u * 16, 1.2, -4.5, 1.4);
      else fx.fimRastro('pe');
      if (cada(t, dt, 1.5, 0.1)) fx.nova(4.5, 3, 3.2, elUnico, 0.6);
      if (cada(t, dt, 3, 0.2)) fx.explosao(elUnico, 4, -0.8, 1.6);
    },
  },
  {
    nome: 'impactos',
    titulo: 'Impactos por elemento',
    descricao:
      'fx.impacto(elemento, x, y, z, escala) — cada elemento com forma e movimento próprios',
    duracao: 5,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        marcar(e, x, 0, z + 1.4);
      });
    },
    quadro: (t, dt) => {
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        if (cada(t, dt, 1.25, i * 0.04)) fx.impacto(e, x, 0.8, z, 1.25);
      });
    },
  },
  {
    nome: 'projeteis',
    titulo: 'Projéteis com rastro',
    descricao:
      'fx.projetilRastro(id, elemento, x, y, z) todo quadro · fx.fimRastro(id) · impacto ao chegar',
    duracao: 5,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      ELEMENTOS.forEach((e, i) => {
        const z = -6 + i * 1.1;
        marcar(e, -10.5, 0, z + 0.3);
      });
    },
    quadro: (t) => {
      ELEMENTOS.forEach((e, i) => {
        const per = 1.7;
        const fase = (t + i * 0.13) % per;
        const z0 = -6 + i * 1.1;
        const id = `p${i}`;
        if (fase < 1.25) {
          const u = fase / 1.25;
          const x = -8.5 + u * 16;
          let z = z0;
          let y = 1;
          if (e === 'arcano') z += Math.sin(u * 12) * 0.5;
          if (e === 'veneno') y = 0.6 + Math.sin(u * Math.PI) * 2.2;
          if (e === 'vento') z += Math.sin(u * Math.PI * 2) * 0.8;
          fx.projetilRastro(id, e, x, y, z, 1);
        } else if (fase - 1.25 < 0.02) {
          fx.fimRastro(id);
          fx.impacto(e, 7.5, 0.9, z0, 0.9);
        }
      });
    },
  },
  {
    nome: 'relampago',
    titulo: 'Relâmpagos',
    descricao: 'fx.relampago(x, z) do céu · fx.raio(a, b) em cadeia entre inimigos',
    duracao: 5,
    iniciar: () => espalharBonecos(3, 8),
    quadro: (t, dt) => {
      if (cada(t, dt, 0.7)) {
        const b = bonecos[Math.floor(Math.random() * 20)];
        fx.relampago(b.x, b.z);
      }
      if (cada(t, dt, 1.1, 0.3)) {
        let ax = 0;
        let az = 0;
        let ay = 1;
        const ordem = [...bonecos.slice(0, 20)].sort(() => Math.random() - 0.5).slice(0, 5);
        for (const b of ordem) {
          fx.raio(ax, ay, az, b.x, 0.6, b.z, '#ffe45c', 0.5);
          ax = b.x;
          az = b.z;
          ay = 0.6;
        }
      }
    },
  },
  {
    nome: 'laser',
    titulo: 'Feixe giratório (laser)',
    descricao:
      'fx.laser(id, origem, destino, largura, cor) todo quadro — energia rolando, faíscas no fim',
    duracao: 5,
    iniciar: () => espalharBonecos(4, 9),
    quadro: (t) => {
      const n = 2;
      for (let k = 0; k < n; k++) {
        const a = t * 1.6 + (k * Math.PI * 2) / n;
        const o = { x: Math.cos(a) * 0.6, y: 1, z: Math.sin(a) * 0.6 };
        const d = { x: Math.cos(a) * 7.5, y: 0.6, z: Math.sin(a) * 7.5 };
        fx.laser(`laser${k}`, o, d, 0.32, k ? '#5cf0ff' : '#ff5cf0');
      }
    },
  },
  {
    nome: 'nova',
    titulo: 'Novas e ondas',
    descricao:
      'fx.nova(x, z, raioMax, elemento, duracao, direcao?, abertura?) — gelo, som (cone), água (leque), fogo',
    duracao: 6,
    iniciar: () => espalharBonecos(3, 9),
    quadro: (t, dt) => {
      if (cada(t, dt, 6, 0.05)) fx.nova(0, 0, 6, 'gelo', 0.55);
      if (cada(t, dt, 6, 1.5)) fx.nova(0, 0, 7, 'som', 0.45, -Math.PI / 2, 0.75);
      if (cada(t, dt, 6, 2.9)) fx.nova(0, 0, 7.5, 'agua', 0.6, Math.PI / 2, 1.1);
      if (cada(t, dt, 6, 4.3)) fx.nova(0, 0, 6, 'fogo', 0.5);
    },
  },
  {
    nome: 'novas-todas',
    titulo: 'Nova de cada elemento',
    descricao: 'fx.nova(...) com o estilo de anel de cada elemento',
    duracao: 5,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        marcar(e, x, 0, z + 1.9);
      });
    },
    quadro: (t, dt) => {
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        if (cada(t, dt, 1.6, i * 0.03)) fx.nova(x, z, 2.1, e, 0.6);
      });
    },
  },
  {
    nome: 'meteoro',
    titulo: 'Chuva de meteoros',
    descricao: 'fx.meteoro(x, z, duracao, raio) — aviso, queda, cratera, fumaça e destroços',
    duracao: 6,
    iniciar: () => espalharBonecos(3, 8),
    quadro: (t, dt) => {
      if (cada(t, dt, 1.3, 0.05)) {
        const b = bonecos[Math.floor(Math.random() * 20)];
        fx.meteoro(b.x, b.z, 0.7, 2.4);
      }
    },
  },
  {
    nome: 'explosoes',
    titulo: 'Explosões de área',
    descricao: 'fx.explosao(elemento, x, z, raio)',
    duracao: 6,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        marcar(e, x, 0, z + 2);
      });
    },
    quadro: (t, dt) => {
      ELEMENTOS.forEach((e, i) => {
        const [x, z] = grade(i);
        if (cada(t, dt, 2.4, i * 0.05)) fx.explosao(e, x, z, 1.6);
      });
    },
  },
  {
    nome: 'tornado',
    titulo: 'Tornados',
    descricao:
      'fx.tornado(id, x, z, raio) todo quadro — funil girando, poeira, folhas e redemoinho no chão',
    duracao: 5,
    iniciar: () => espalharBonecos(4, 9),
    quadro: (t) => {
      fx.tornado('a', -3.5 + Math.sin(t * 0.7) * 2, Math.cos(t * 0.5) * 1.5, 1.8);
      fx.tornado('b', 4 + Math.cos(t * 0.6) * 1.5, 1 + Math.sin(t * 0.8) * 2, 1.5);
    },
  },
  {
    nome: 'buracoNegro',
    titulo: 'Buraco negro',
    descricao: 'fx.buracoNegro(id, x, z, raio) todo quadro — disco de acreção, núcleo e espiral',
    duracao: 5,
    iniciar: () => espalharBonecos(4, 9),
    quadro: (t, dt) => {
      fx.buracoNegro('bn', 0.5, -1, 3);
      for (const b of bonecos) {
        const dx = 0.5 - b.x;
        const dz = -1 - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 1.2) {
          b.x += (dx / d) * dt * 1.6;
          b.z += (dz / d) * dt * 1.6;
        }
      }
      if (t > 4.6 && t - dt <= 4.6) fx.explosao('gravidade', 0.5, -1, 4);
    },
  },
  {
    nome: 'poca',
    titulo: 'Poças',
    descricao: 'fx.poca(id, x, z, raio, elemento) — veneno borbulhando, lava, água, arcano',
    duracao: 5,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      marcar('veneno', -5, 0, -1.2);
      marcar('fogo', 3.5, 0, -1.2);
      marcar('agua', -5, 0, 5.2);
      marcar('arcano', 3.5, 0, 5.2);
    },
    quadro: () => {
      fx.poca('v', -5, -3.3, 2, 'veneno');
      fx.poca('f', 3.5, -3.3, 2, 'fogo');
      fx.poca('a', -5, 3.2, 1.9, 'agua');
      fx.poca('r', 3.5, 3.2, 1.9, 'arcano');
    },
  },
  {
    nome: 'chicote',
    titulo: 'Chicote e cortes',
    descricao: 'fx.corte(x, z, angulo, comprimento, cor, cor2) · fx.chicote(pontos, cor)',
    duracao: 5,
    iniciar: () => espalharBonecos(2.5, 6),
    quadro: (t, dt) => {
      if (cada(t, dt, 0.9)) {
        fx.corte(0, 0, 0, 3.4, '#fff3c4', '#ffd27a');
        fx.corte(0, 0, Math.PI, 3.4, '#fff3c4', '#ffd27a');
      }
      if (cada(t, dt, 0.9, 0.45)) {
        fx.corte(0, 0, Math.PI / 2, 3.4, '#ffd6f5', '#ffb8f0');
        fx.corte(0, 0, -Math.PI / 2, 3.4, '#ffd6f5', '#ffb8f0');
      }
      if (cada(t, dt, 1.2, 0.2)) {
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const u = k / 16;
          pts.push({
            x: -8 + u * 6,
            y: 0.8 + Math.sin(u * Math.PI) * 1.5,
            z: 4 + Math.sin(u * 7) * 0.8,
          });
        }
        fx.chicote(pts, '#9df0ff', 0.45);
      }
    },
  },
  {
    nome: 'orbitas',
    titulo: 'Órbitas, aura e drones',
    descricao: 'fx.projetilRastro em órbita · fx.aura(x, z, raio, cor) · fx.orbe · fx.disparo',
    duracao: 5,
    iniciar: () => espalharBonecos(5, 9),
    quadro: (t, dt) => {
      fx.aura(0, 0, 2.6, '#fff3c4', '#ffb8f0');
      for (let k = 0; k < 3; k++) {
        const a = t * 3.2 + (k * Math.PI * 2) / 3;
        fx.projetilRastro(`luz${k}`, 'luz', Math.cos(a) * 2.2, 1, Math.sin(a) * 2.2, 0.8);
      }
      for (let k = 0; k < 4; k++) {
        const a = -t * 2.2 + (k * Math.PI * 2) / 4;
        fx.projetilRastro(`serra${k}`, 'cristal', Math.cos(a) * 4.2, 0.9, Math.sin(a) * 4.2, 1);
      }
      const dx = Math.cos(t * 1.3) * 1.4 - 1;
      const dz = -1.6;
      fx.orbe('arcano', dx, 1.8, dz, 0.8);
      if (cada(t, dt, 0.5)) {
        const b = bonecos[Math.floor(Math.random() * 20)];
        fx.disparo('arcano', dx, 1.8, dz, b.x - dx, b.z - dz, 1);
      }
    },
  },
  {
    nome: 'mortes',
    titulo: 'Mortes de inimigos',
    descricao: 'fx.morteInimigo(x, y, z, cor, tamanho) · fx.coletaCristal(x, y, z, cor)',
    duracao: 5,
    iniciar: () => espalharBonecos(2, 8),
    quadro: (t, dt) => {
      if (cada(t, dt, 0.22)) {
        const b = bonecos[Math.floor(Math.random() * 20)];
        const cor = ['#8e6fd0', '#e0586a', '#4fb0e0', '#f0b030'][Math.floor(Math.random() * 4)];
        fx.morteInimigo(b.x, 0.6, b.z, cor, 0.6 + Math.random() * 0.9);
      }
      if (cada(t, dt, 0.35, 0.1))
        fx.coletaCristal((Math.random() - 0.5) * 3, 0.5, (Math.random() - 0.5) * 3, '#9df0ff');
    },
  },
  {
    nome: 'digital',
    titulo: 'Tema código: impacto, glitch e morte digital',
    descricao:
      "fx.impacto('codigo', ...) · fx.glitch(x, y, z) · fx.morteDigital(x, y, z, cor, tamanho)",
    duracao: 5,
    iniciar: () => {
      espalharBonecos(3, 8);
      marcar("impacto('codigo')", -5, 0, 1.6);
      marcar('glitch', 0, 0, -2.4);
      marcar('morteDigital', 5, 0, 1.6);
    },
    quadro: (t, dt) => {
      if (cada(t, dt, 1)) fx.impacto('codigo', -5, 0.8, 0, 1.4);
      if (cada(t, dt, 0.8, 0.2)) fx.glitch(0, 1, -4, 1.3);
      if (cada(t, dt, 0.5, 0.1)) {
        const b = bonecos[Math.floor(Math.random() * 20)];
        fx.morteDigital(
          b.x,
          0.6,
          b.z,
          ['#8e6fd0', '#e0586a', '#4fb0e0'][Math.floor(Math.random() * 3)],
          0.9
        );
      }
    },
  },
  {
    nome: 'chuvaCodigo',
    titulo: 'Chuva de código (surgimento / Kernel Panic)',
    descricao: 'fx.chuvaCodigo(x, z, raio, duracao)',
    duracao: 5,
    iniciar: () => espalharBonecos(0, 0, 0),
    quadro: (t, dt) => {
      if (cada(t, dt, 2.5)) fx.chuvaCodigo(-3.5, 0, 1.8, 1.8);
      if (cada(t, dt, 2.5, 0.8)) fx.chuvaCodigo(3.5, -1, 2.6, 1.6);
    },
  },
  {
    nome: 'firewall',
    titulo: 'Firewall',
    descricao: 'fx.firewall(id, x, z, raio, t) todo quadro — muralha hexagonal em chamas',
    duracao: 5,
    iniciar: () => espalharBonecos(5, 9),
    quadro: (t) => fx.firewall('fw', 0, 0, 3.4, Math.min(1, t / 4.6)),
  },
  {
    nome: 'coletorLixo',
    titulo: 'Coletor de lixo',
    descricao: 'fx.coletorLixo(x, z, raio) — varredura para dentro, lixo sugado e compactado',
    duracao: 4,
    iniciar: () => espalharBonecos(5, 9),
    quadro: (t, dt) => {
      if (cada(t, dt, 1.6)) fx.coletorLixo(0, 0, 4.5);
    },
  },
  {
    nome: 'breakpoint',
    titulo: 'Breakpoint',
    descricao: 'fx.breakpoint(x, z, raio, t) todo quadro · fx.breakpointAtivar(x, z, raio)',
    duracao: 4,
    iniciar: () => espalharBonecos(2, 7),
    quadro: (t, dt) => {
      fx.breakpoint(0.5, 0, 3.5, Math.min(1, t / 3.8), 'bp');
      if (t >= 3.8 * 0.3 && t - dt < 3.8 * 0.3) fx.breakpointAtivar(0.5, 0, 3.5);
    },
  },
  {
    nome: 'recursao',
    titulo: 'Recursão',
    descricao:
      "projetilRastro(id, 'codigo', ...) com glifos { } · fx.recursao(x, y, z, profundidade, cor)",
    duracao: 4,
    iniciar: () => espalharBonecos(4, 9),
    quadro: (t, dt) => {
      const u = (t % 1.4) / 1.4;
      if (u < 0.7) fx.projetilRastro('rec', 'codigo', -7 + u * 10, 1, 1, 1.2);
      else if (u - dt / 1.4 < 0.7) {
        fx.fimRastro('rec');
        fx.recursao(0, 1, 1, 3, '#39ff88');
      }
    },
  },
  {
    nome: 'ransomware',
    titulo: 'Ransomware e vazamento de memória',
    descricao: 'fx.criptografar(x, y, z) · fx.vazamento(id, x, z, raio) todo quadro',
    duracao: 4,
    iniciar: () => {
      espalharBonecos(0, 0, 0);
      marcar('criptografar', -4, 0, 2);
      marcar('vazamento', 4, 0, 2.6);
    },
    quadro: (t, dt) => {
      if (cada(t, dt, 1.3)) fx.criptografar(-4, 0.8, 0);
      fx.vazamento('vz', 4, 0, 2.2);
    },
  },
  {
    nome: 'nivel',
    titulo: 'Subir de nível e evolução',
    descricao: 'fx.subirNivel(x, z) · fx.evolucao(x, z, cor)',
    duracao: 6,
    iniciar: () => espalharBonecos(5, 9),
    quadro: (t, dt) => {
      if (cada(t, dt, 6, 0.05)) fx.subirNivel(0, 0);
      if (cada(t, dt, 6, 3)) fx.evolucao(0, 0, '#c58bff');
    },
  },
];

// ------------------------------------------------------------------ laço

const rotulo = document.getElementById('rotulo')!;
const info = document.getElementById('info')!;
const unica = params.get('efeito');
let indice = Math.max(
  0,
  CENAS.findIndex((c) => c.nome === unica)
);
let tCena = 0;

function ir(nome: string | number): void {
  indice =
    typeof nome === 'number'
      ? nome
      : Math.max(
          0,
          CENAS.findIndex((c) => c.nome === nome)
        );
  tCena = 0;
  fx.limpar();
  limparMarcas();
  espalharBonecos();
  const c = CENAS[indice];
  c.iniciar?.();
  const b = document.createElement('b');
  b.textContent = c.titulo;
  const sp = document.createElement('span');
  sp.textContent = c.descricao;
  rotulo.replaceChildren(b, sp);
}

function passo(dt: number): void {
  const c = CENAS[indice];
  tCena += dt;
  if (tCena > c.duracao) {
    if (unica) {
      tCena = 0;
    } else {
      ir((indice + 1) % CENAS.length);
      return;
    }
  }
  c.quadro(tCena, dt);
  for (const b of bonecos) {
    b.m.position.set(b.x, 0.5 + Math.abs(Math.sin(fx.tempo * 5 + b.fase)) * 0.15, b.z);
    b.m.rotation.y = b.fase + fx.tempo;
  }
  fx.atualizar(dt, camera);
}

function desenhar(): void {
  const tr = fx.tremor();
  camera.position.set((Math.random() - 0.5) * tr, 15 + (Math.random() - 0.5) * tr, 10.5);
  camera.lookAt(0, 0, 0);
  if (pos) pos.render(renderer, cena, camera);
  else renderer.render(cena, camera);
  posicionarMarcas();
}

function redimensionar(): void {
  const w = innerWidth;
  const h = innerHeight;
  const dpr = Math.min(devicePixelRatio || 1, qualidade === 'alta' ? 2 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  pos?.redimensionar(w, h, dpr);
}
addEventListener('resize', redimensionar);
redimensionar();
ir(indice);

let ultimo = performance.now();
let quadros = 0;
let acumFps = 0;
function laco(agora: number): void {
  const dt = Math.min(0.05, (agora - ultimo) / 1000);
  ultimo = agora;
  passo(dt);
  desenhar();
  quadros++;
  acumFps += dt;
  if (acumFps > 0.5) {
    const e = fx.estatisticas();
    info.textContent = `${Math.round(quadros / acumFps)} fps · ${e.particulas} partículas · ${e.rastros} rastros · qualidade ${qualidade}${pos ? ' + bloom' : ''} · ${renderer.info.render.calls} draws`;
    quadros = 0;
    acumFps = 0;
  }
  requestAnimationFrame(laco);
}

const api = {
  cenas: CENAS.map((c) => c.nome),
  ir,
  /** Simula `segundos` em passos de 1/60 s e desenha um quadro. */
  avancar(segundos: number): string {
    const n = Math.round(segundos * 60);
    for (let i = 0; i < n; i++) passo(1 / 60);
    desenhar();
    const e = fx.estatisticas();
    return `${CENAS[indice].nome} t=${tCena.toFixed(2)} partículas=${e.particulas} draws=${renderer.info.render.calls}`;
  },
  pronto: true,
  fx,
};
(window as unknown as { __fxDemo: typeof api }).__fxDemo = api;
if (!pausado) requestAnimationFrame(laco);
else desenhar();
