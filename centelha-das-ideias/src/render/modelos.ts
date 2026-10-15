/**
 * Modelos procedurais: armas mágicas, NPCs, inimigos do Ruído e objetos do mundo.
 * Tudo construído com primitivas e material cartoon (sem arquivos externos).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { IdArma, IdNpc, TipoInimigo } from '../nucleo/tipos';
import { gradienteToon, toon } from './materiais';
import { Rosto } from './rosto';

function malha(geo: THREE.BufferGeometry, mat: THREE.Material, sombra = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = sombra;
  return m;
}

function contorno(geo: THREE.BufferGeometry, escala = 1.07): THREE.Mesh {
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color: '#33222a', side: THREE.BackSide })
  );
  m.scale.setScalar(escala);
  return m;
}

// ---------------------------------------------------------------------------
// armas (cabo na origem, ponta para +Y)
// ---------------------------------------------------------------------------

export interface ModeloArma {
  grupo: THREE.Group;
  /** Ponta da arma (para o rastro do golpe). */
  ponta: THREE.Object3D;
}

export function criarModeloArma(id: IdArma): ModeloArma {
  const g = new THREE.Group();
  const ponta = new THREE.Object3D();
  switch (id) {
    case 'galho': {
      const madeira = toon('#8a5a3b');
      const folha = toon('#7fd06a');
      const haste = malha(new THREE.CylinderGeometry(0.035, 0.055, 0.95, 6), madeira);
      haste.position.y = 0.47;
      haste.rotation.z = 0.06;
      g.add(haste);
      const ramo = malha(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 5), madeira);
      ramo.position.set(0.08, 0.6, 0);
      ramo.rotation.z = -0.8;
      g.add(ramo);
      for (const [x, y, r] of [
        [0.19, 0.72, -0.5],
        [-0.06, 0.95, 0.4],
        [0.03, 0.82, -1.4],
      ] as const) {
        const f = malha(new THREE.SphereGeometry(0.08, 6, 5), folha);
        f.scale.set(1, 0.4, 0.6);
        f.position.set(x, y, 0);
        f.rotation.z = r;
        g.add(f);
      }
      ponta.position.y = 0.98;
      break;
    }
    case 'espada': {
      const lam = toon('#e2c08a');
      const cabo = toon('#7a4b2e');
      const lamina = malha(new THREE.BoxGeometry(0.13, 0.75, 0.05), lam);
      lamina.position.y = 0.55;
      g.add(lamina);
      const bico = malha(new THREE.ConeGeometry(0.092, 0.16, 4), lam);
      bico.position.y = 1.0;
      bico.rotation.y = Math.PI / 4;
      bico.scale.z = 0.4;
      g.add(bico);
      const guarda = malha(new THREE.BoxGeometry(0.34, 0.06, 0.09), cabo);
      guarda.position.y = 0.17;
      g.add(guarda);
      const punho = malha(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 6), cabo);
      punho.position.y = 0.06;
      g.add(punho);
      ponta.position.y = 1.08;
      break;
    }
    case 'martelo': {
      const cabeca = malha(new THREE.CylinderGeometry(0.17, 0.17, 0.42, 12), toon('#e5534b'));
      cabeca.rotation.z = Math.PI / 2;
      cabeca.position.y = 0.8;
      g.add(cabeca);
      for (const lado of [-1, 1]) {
        const tampa = malha(new THREE.CylinderGeometry(0.175, 0.175, 0.05, 12), toon('#ffb4a8'));
        tampa.rotation.z = Math.PI / 2;
        tampa.position.set(lado * 0.22, 0.8, 0);
        g.add(tampa);
      }
      const cabo = malha(new THREE.CylinderGeometry(0.035, 0.04, 0.75, 6), toon('#f2e3c6'));
      cabo.position.y = 0.38;
      g.add(cabo);
      ponta.position.y = 0.95;
      break;
    }
    case 'colher': {
      const prata = toon('#d7e0ea');
      const concha = malha(
        new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        prata
      );
      concha.scale.set(1, 0.45, 1.35);
      concha.rotation.x = Math.PI / 2;
      concha.position.y = 0.88;
      g.add(concha);
      const cabo = malha(new THREE.CylinderGeometry(0.03, 0.045, 0.7, 6), prata);
      cabo.position.y = 0.38;
      g.add(cabo);
      ponta.position.y = 1.1;
      break;
    }
    case 'cajado': {
      const cabo = malha(new THREE.CylinderGeometry(0.035, 0.045, 1.05, 6), toon('#6b4a8a'));
      cabo.position.y = 0.5;
      g.add(cabo);
      const orbe = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.13, 1),
        new THREE.MeshBasicMaterial({ color: '#c9b8ff' })
      );
      orbe.position.y = 1.1;
      g.add(orbe);
      const anel = malha(new THREE.TorusGeometry(0.16, 0.025, 5, 16), toon('#ffd27a'));
      anel.position.y = 1.1;
      g.add(anel);
      ponta.position.y = 1.12;
      break;
    }
    case 'escudo': {
      const disco = malha(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18), toon('#9aa7b4'));
      disco.rotation.x = Math.PI / 2;
      disco.position.y = 0.45;
      g.add(disco);
      const borda = malha(new THREE.TorusGeometry(0.42, 0.04, 6, 24), toon('#6a7682'));
      borda.position.y = 0.45;
      g.add(borda);
      const pegador = malha(new THREE.SphereGeometry(0.09, 8, 6), toon('#e5534b'));
      pegador.position.set(0, 0.45, 0.07);
      g.add(pegador);
      ponta.position.set(0, 0.87, 0);
      break;
    }
  }
  g.add(ponta);
  return { grupo: g, ponta };
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

export interface ModeloPersonagem {
  raiz: THREE.Group;
  corpo: THREE.Group;
  rosto: Rosto;
  bracoE: THREE.Group;
  bracoD: THREE.Group;
  peE: THREE.Group;
  peD: THREE.Group;
  /** Objeto na mão (regador, chave, pano...). */
  ferramenta?: THREE.Object3D;
  altura: number;
  materiais: THREE.MeshToonMaterial[];
}

function membro(
  cor: string,
  raio: number,
  comprimento: number,
  mats: THREE.MeshToonMaterial[]
): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon() });
  mats.push(m);
  const b = malha(new THREE.CapsuleGeometry(raio, comprimento, 4, 8), m);
  b.position.y = -comprimento / 2 - raio * 0.5;
  g.add(b);
  return g;
}

export function criarModeloNpc(id: IdNpc): ModeloPersonagem {
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  const mats: THREE.MeshToonMaterial[] = [];
  const mat = (cor: string) => {
    const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon() });
    mats.push(m);
    return m;
  };
  let rosto: Rosto;
  let altura = 1.4;
  let bracoE: THREE.Group;
  let bracoD: THREE.Group;
  let peE: THREE.Group;
  let peD: THREE.Group;
  let ferramenta: THREE.Object3D | undefined;

  switch (id) {
    case 'lumi': {
      // jardineira em forma de gota (broto), chapéu de folha e regador
      const geo = new THREE.SphereGeometry(0.55, 18, 14);
      const tronco = malha(geo, mat('#9fd48a'));
      tronco.scale.set(1, 1.25, 0.95);
      tronco.position.y = 0.85;
      const c = contorno(geo, 1.06);
      c.scale.set(1.06, 1.33, 1.01);
      c.position.copy(tronco.position);
      corpo.add(tronco, c);
      const avental = malha(
        new THREE.SphereGeometry(0.56, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.45),
        mat('#f2d7a0')
      );
      avental.scale.set(1.01, 1.26, 0.97);
      avental.position.y = 0.85;
      corpo.add(avental);
      const chapeu = malha(new THREE.ConeGeometry(0.62, 0.32, 12), mat('#5fae5a'));
      chapeu.position.y = 1.62;
      corpo.add(chapeu);
      const broto = malha(new THREE.SphereGeometry(0.12, 8, 6), mat('#ff9fb8'));
      broto.position.y = 1.82;
      corpo.add(broto);
      rosto = new Rosto({ separacao: 0.16, tamanho: 0.08 });
      rosto.grupo.position.set(0, 1.08, 0.5);
      corpo.add(rosto.grupo);
      bracoE = membro('#7cbf6a', 0.07, 0.3, mats);
      bracoD = membro('#7cbf6a', 0.07, 0.3, mats);
      bracoE.position.set(-0.55, 0.95, 0);
      bracoD.position.set(0.55, 0.95, 0);
      const regador = new THREE.Group();
      const lata = malha(new THREE.CylinderGeometry(0.13, 0.15, 0.24, 10), toon('#5b8fd9'));
      const bico = malha(new THREE.CylinderGeometry(0.025, 0.03, 0.28, 6), toon('#5b8fd9'));
      bico.rotation.z = -1.0;
      bico.position.set(0.16, 0.06, 0);
      regador.add(lata, bico);
      regador.position.set(0, -0.48, 0.1);
      regador.rotation.y = -Math.PI / 2;
      bracoD.add(regador);
      ferramenta = regador;
      altura = 1.95;
      break;
    }
    case 'pipo': {
      // faísca-criança: bolinha laranja com boné de hélice
      const geo = new THREE.SphereGeometry(0.4, 18, 14);
      const tronco = malha(geo, mat('#ffb347'));
      tronco.position.y = 0.6;
      const c = contorno(geo);
      c.position.copy(tronco.position);
      corpo.add(tronco, c);
      const bone = malha(
        new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        mat('#5b7cfa')
      );
      bone.position.y = 0.88;
      corpo.add(bone);
      const aba = malha(
        new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12, 1, false, 0, Math.PI),
        mat('#5b7cfa')
      );
      aba.position.set(0, 0.9, 0.12);
      corpo.add(aba);
      const helice = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const pa = malha(new THREE.BoxGeometry(0.42, 0.02, 0.07), mat(i ? '#ffd27a' : '#e5534b'));
        pa.rotation.y = i * (Math.PI / 2);
        helice.add(pa);
      }
      helice.position.y = 1.2;
      helice.name = 'helice';
      corpo.add(helice);
      const haste = malha(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 4), mat('#333'));
      haste.position.y = 1.15;
      corpo.add(haste);
      rosto = new Rosto({ separacao: 0.13, tamanho: 0.07 });
      rosto.grupo.position.set(0, 0.62, 0.38);
      corpo.add(rosto.grupo);
      bracoE = membro('#f09a2a', 0.055, 0.18, mats);
      bracoD = membro('#f09a2a', 0.055, 0.18, mats);
      bracoE.position.set(-0.4, 0.62, 0);
      bracoD.position.set(0.4, 0.62, 0);
      altura = 1.45;
      break;
    }
    case 'bento': {
      // robô inventor: caixa com engrenagem na cabeça e um olho-lente
      const geo = new RoundedBoxGeometry(0.95, 1.0, 0.75, 3, 0.12);
      const tronco = malha(geo, mat('#8ea3b5'));
      tronco.position.y = 0.95;
      const c = contorno(geo, 1.05);
      c.position.copy(tronco.position);
      corpo.add(tronco, c);
      const painel = malha(new THREE.BoxGeometry(0.6, 0.38, 0.04), mat('#2b3540'));
      painel.position.set(0, 1.08, 0.38);
      corpo.add(painel);
      const engrenagem = malha(new THREE.TorusGeometry(0.2, 0.07, 6, 10), mat('#ffb347'));
      engrenagem.position.y = 1.62;
      engrenagem.name = 'engrenagem';
      corpo.add(engrenagem);
      const barriga = malha(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 10), mat('#ffd27a'));
      barriga.rotation.x = Math.PI / 2;
      barriga.position.set(0, 0.65, 0.39);
      corpo.add(barriga);
      rosto = new Rosto({ separacao: 0.15, tamanho: 0.075, corOlho: '#9df0ff' });
      rosto.grupo.position.set(0, 1.12, 0.41);
      corpo.add(rosto.grupo);
      bracoE = membro('#6f8496', 0.08, 0.36, mats);
      bracoD = membro('#6f8496', 0.08, 0.36, mats);
      bracoE.position.set(-0.56, 1.25, 0);
      bracoD.position.set(0.56, 1.25, 0);
      const chave = new THREE.Group();
      const haste = malha(new THREE.BoxGeometry(0.06, 0.4, 0.04), toon('#c7ced6'));
      const boca = malha(
        new THREE.TorusGeometry(0.07, 0.025, 5, 10, Math.PI * 1.5),
        toon('#c7ced6')
      );
      boca.position.y = 0.22;
      chave.add(haste, boca);
      chave.position.set(0, -0.6, 0.06);
      bracoD.add(chave);
      ferramenta = chave;
      altura = 1.95;
      break;
    }
    case 'eco': {
      // batedor-coruja de penas lilases, orelhas pontudas
      const geo = new THREE.SphereGeometry(0.45, 18, 14);
      const tronco = malha(geo, mat('#a38fd6'));
      tronco.scale.set(1, 1.15, 0.95);
      tronco.position.y = 0.7;
      const c = contorno(geo, 1.06);
      c.scale.set(1.06, 1.22, 1.01);
      c.position.copy(tronco.position);
      corpo.add(tronco, c);
      const peito = malha(new THREE.SphereGeometry(0.3, 12, 10), mat('#e8defc'));
      peito.scale.set(1, 1.1, 0.5);
      peito.position.set(0, 0.6, 0.3);
      corpo.add(peito);
      for (const lado of [-1, 1]) {
        const orelha = malha(new THREE.ConeGeometry(0.1, 0.3, 6), mat('#7f6bb8'));
        orelha.position.set(lado * 0.25, 1.22, 0);
        orelha.rotation.z = -lado * 0.35;
        corpo.add(orelha);
      }
      rosto = new Rosto({ separacao: 0.15, tamanho: 0.09, corOlho: '#2a1f40' });
      rosto.grupo.position.set(0, 0.88, 0.4);
      corpo.add(rosto.grupo);
      const bico = malha(new THREE.ConeGeometry(0.05, 0.12, 5), mat('#ffb347'));
      bico.rotation.x = Math.PI / 2 + 0.4;
      bico.position.set(0, 0.78, 0.47);
      corpo.add(bico);
      bracoE = membro('#8a76c4', 0.07, 0.24, mats);
      bracoD = membro('#8a76c4', 0.07, 0.24, mats);
      bracoE.position.set(-0.45, 0.8, 0);
      bracoD.position.set(0.45, 0.8, 0);
      altura = 1.6;
      break;
    }
    case 'vela': {
      // faroleira com cabeça de lanterna
      const geo = new THREE.CylinderGeometry(0.35, 0.48, 1.0, 14);
      const tronco = malha(geo, mat('#3f5c8a'));
      tronco.position.y = 0.7;
      const c = contorno(geo, 1.06);
      c.position.copy(tronco.position);
      corpo.add(tronco, c);
      const cabeca = malha(new THREE.CylinderGeometry(0.3, 0.3, 0.42, 8), mat('#fff1c9'));
      cabeca.position.y = 1.42;
      corpo.add(cabeca);
      const tampa = malha(new THREE.ConeGeometry(0.38, 0.25, 8), mat('#e5534b'));
      tampa.position.y = 1.75;
      corpo.add(tampa);
      const base = malha(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8), mat('#e5534b'));
      base.position.y = 1.2;
      corpo.add(base);
      const chama = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#ffb347' })
      );
      chama.position.y = 1.65;
      chama.name = 'chama';
      corpo.add(chama);
      rosto = new Rosto({ separacao: 0.12, tamanho: 0.07 });
      rosto.grupo.position.set(0, 1.4, 0.31);
      corpo.add(rosto.grupo);
      bracoE = membro('#2f4870', 0.07, 0.3, mats);
      bracoD = membro('#2f4870', 0.07, 0.3, mats);
      bracoE.position.set(-0.42, 1.05, 0);
      bracoD.position.set(0.42, 1.05, 0);
      const pano = malha(new THREE.BoxGeometry(0.2, 0.04, 0.15), toon('#ffffff'));
      pano.position.set(0, -0.48, 0.05);
      bracoD.add(pano);
      ferramenta = pano;
      altura = 2.05;
      break;
    }
  }
  peE = membro('#3a2f3f', 0.075, 0.08, mats);
  peD = membro('#3a2f3f', 0.075, 0.08, mats);
  peE.position.set(-0.18, 0.2, 0);
  peD.position.set(0.18, 0.2, 0);
  corpo.add(bracoE!, bracoD!);
  raiz.add(corpo, peE, peD);
  return {
    raiz,
    corpo,
    rosto: rosto!,
    bracoE: bracoE!,
    bracoD: bracoD!,
    peE,
    peD,
    ferramenta,
    altura,
    materiais: mats,
  };
}

// ---------------------------------------------------------------------------
// inimigos do Ruído
// ---------------------------------------------------------------------------

export interface ModeloInimigo {
  raiz: THREE.Group;
  corpo: THREE.Group;
  olhos: THREE.Group;
  materiais: THREE.MeshToonMaterial[];
  altura: number;
  antena?: THREE.Mesh;
}

export function criarModeloInimigo(tipo: TipoInimigo): ModeloInimigo {
  const raiz = new THREE.Group();
  const corpo = new THREE.Group();
  const olhos = new THREE.Group();
  const mats: THREE.MeshToonMaterial[] = [];
  const mat = (cor: string) => {
    const m = new THREE.MeshToonMaterial({ color: cor, gradientMap: gradienteToon() });
    mats.push(m);
    return m;
  };
  const olhoMat = new THREE.MeshBasicMaterial({ color: '#fff27a' });
  let altura = 1;
  let antena: THREE.Mesh | undefined;
  if (tipo === 'chiado') {
    // bolha de estática, com espinhos de chiado
    const geo = new THREE.IcosahedronGeometry(0.5, 1);
    const b = malha(geo, mat('#6b5a8e'));
    b.position.y = 0.5;
    const c = contorno(geo, 1.08);
    c.position.copy(b.position);
    corpo.add(b, c);
    for (let i = 0; i < 7; i++) {
      const esp = malha(new THREE.ConeGeometry(0.09, 0.28, 4), mat('#9a86c9'));
      const a = (i / 7) * Math.PI * 2;
      esp.position.set(Math.cos(a) * 0.38, 0.75 + Math.sin(i * 1.7) * 0.1, Math.sin(a) * 0.38);
      esp.lookAt(new THREE.Vector3(Math.cos(a) * 2, 1.6, Math.sin(a) * 2));
      esp.rotateX(Math.PI / 2);
      corpo.add(esp);
    }
    for (const lado of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), olhoMat);
      o.scale.set(1, 1.3, 0.6);
      o.position.set(lado * 0.17, 0.58, 0.44);
      olhos.add(o);
    }
    altura = 1.2;
  } else if (tipo === 'zumbido') {
    // inseto de ruído flutuante com antena que acende
    const geo = new THREE.SphereGeometry(0.38, 14, 10);
    const b = malha(geo, mat('#4f6d7a'));
    b.scale.set(1, 0.85, 1.2);
    b.position.y = 1.2;
    const c = contorno(geo, 1.08);
    c.scale.set(1.08, 0.92, 1.3);
    c.position.copy(b.position);
    corpo.add(b, c);
    for (const lado of [-1, 1]) {
      const asa = new THREE.Mesh(
        new THREE.CircleGeometry(0.32, 10),
        new THREE.MeshBasicMaterial({
          color: '#cfefff',
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
        })
      );
      asa.position.set(lado * 0.36, 1.45, -0.05);
      asa.rotation.set(-0.3, lado * 0.6, 0);
      asa.name = lado < 0 ? 'asaE' : 'asaD';
      corpo.add(asa);
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), olhoMat);
      o.position.set(lado * 0.14, 1.25, 0.4);
      olhos.add(o);
    }
    antena = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#7af0d0' })
    );
    antena.position.set(0, 1.72, 0.1);
    corpo.add(antena);
    const haste = malha(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 4), mat('#2b3540'));
    haste.position.set(0, 1.56, 0.06);
    corpo.add(haste);
    altura = 2;
  } else {
    // Estática Grande: torre de chiado com placas
    const geo = new RoundedBoxGeometry(1.6, 1.8, 1.3, 3, 0.25);
    const b = malha(geo, mat('#4b3d6b'));
    b.position.y = 1.0;
    const c = contorno(geo, 1.05);
    c.position.copy(b.position);
    corpo.add(b, c);
    for (let i = 0; i < 5; i++) {
      const placa = malha(
        new THREE.BoxGeometry(0.5, 0.12, 0.5),
        mat(i % 2 ? '#9a86c9' : '#e5534b')
      );
      placa.position.set(Math.sin(i * 2.1) * 0.5, 1.9 + i * 0.12, Math.cos(i * 2.1) * 0.3);
      placa.rotation.y = i;
      corpo.add(placa);
    }
    for (const lado of [-1, 1]) {
      const o = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), olhoMat);
      o.scale.set(1.2, 0.8, 0.6);
      o.position.set(lado * 0.38, 1.3, 0.66);
      olhos.add(o);
      const braco = malha(new THREE.CapsuleGeometry(0.18, 0.6, 4, 8), mat('#3a2f55'));
      braco.position.set(lado * 1.0, 0.9, 0);
      braco.rotation.z = lado * 0.3;
      braco.name = lado < 0 ? 'bracoE' : 'bracoD';
      corpo.add(braco);
    }
    altura = 2.8;
  }
  corpo.add(olhos);
  raiz.add(corpo);
  return { raiz, corpo, olhos, materiais: mats, altura, antena };
}

// ---------------------------------------------------------------------------
// objetos do mundo
// ---------------------------------------------------------------------------

export function criarFaisca(): THREE.Group {
  const g = new THREE.Group();
  const nucleo = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.2, 0),
    new THREE.MeshBasicMaterial({ color: '#ffd27a' })
  );
  g.add(nucleo);
  const anel = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.02, 4, 16),
    new THREE.MeshBasicMaterial({ color: '#fff2c4' })
  );
  anel.rotation.x = Math.PI / 2;
  g.add(anel);
  return g;
}

export function criarPedraMemoria(): THREE.Group {
  const g = new THREE.Group();
  const geo = new THREE.DodecahedronGeometry(0.6, 0);
  const pedra = malha(geo, toon('#7d8fb3'));
  pedra.scale.set(0.9, 1.5, 0.9);
  pedra.position.y = 0.85;
  const c = contorno(geo, 1.06);
  c.scale.set(0.95, 1.58, 0.95);
  c.position.copy(pedra.position);
  g.add(pedra, c);
  const runa = new THREE.Mesh(
    new THREE.TorusGeometry(0.2, 0.04, 5, 14),
    new THREE.MeshBasicMaterial({ color: '#9df0ff' })
  );
  runa.position.set(0, 1.0, 0.52);
  runa.name = 'runa';
  g.add(runa);
  return g;
}

export function criarBau(): THREE.Group {
  const g = new THREE.Group();
  const madeira = toon('#a8693f');
  const metal = toon('#ffd27a');
  const base = malha(new THREE.BoxGeometry(0.9, 0.5, 0.6), madeira);
  base.position.y = 0.25;
  g.add(base);
  const tampa = new THREE.Group();
  const t = malha(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10, 1, false, 0, Math.PI), madeira);
  t.rotation.z = Math.PI / 2;
  t.position.z = 0.3;
  tampa.add(t);
  const fecho = malha(new THREE.BoxGeometry(0.14, 0.18, 0.06), metal);
  fecho.position.set(0, 0.05, 0.62);
  tampa.add(fecho);
  tampa.position.set(0, 0.5, -0.3);
  tampa.name = 'tampa';
  g.add(tampa);
  return g;
}

export function criarNo(cor = '#9df0ff'): THREE.Group {
  const g = new THREE.Group();
  const poste = malha(new THREE.CylinderGeometry(0.16, 0.24, 1.3, 8), toon('#5b6878'));
  poste.position.y = 0.65;
  g.add(poste);
  const bobina = malha(new THREE.TorusGeometry(0.22, 0.06, 6, 14), toon('#c98a3b'));
  bobina.rotation.x = Math.PI / 2;
  bobina.position.y = 1.1;
  g.add(bobina);
  const luz = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 10, 8),
    new THREE.MeshBasicMaterial({ color: cor })
  );
  luz.position.y = 1.45;
  luz.name = 'luz';
  g.add(luz);
  return g;
}

export function criarPlaca(): THREE.Group {
  const g = new THREE.Group();
  const madeira = toon('#b07a4a');
  const poste = malha(new THREE.CylinderGeometry(0.06, 0.07, 1.2, 6), madeira);
  poste.position.y = 0.6;
  const tabua = malha(new THREE.BoxGeometry(0.9, 0.45, 0.08), toon('#d9a86b'));
  tabua.position.y = 1.15;
  g.add(poste, tabua);
  return g;
}

export function criarFlorPergunta(): THREE.Group {
  const g = new THREE.Group();
  const caule = malha(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 5), toon('#4f9a4a'));
  caule.position.y = 0.45;
  g.add(caule);
  const botao = new THREE.Group();
  botao.position.y = 0.95;
  botao.name = 'botao';
  for (let i = 0; i < 6; i++) {
    const p = malha(new THREE.SphereGeometry(0.16, 8, 6), toon(i % 2 ? '#ff9fb8' : '#ffd27a'));
    p.scale.set(1, 0.35, 0.6);
    const a = (i / 6) * Math.PI * 2;
    p.position.set(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
    p.rotation.y = -a;
    p.name = 'petala';
    botao.add(p);
  }
  const miolo = malha(new THREE.SphereGeometry(0.1, 8, 6), toon('#ffb347'));
  botao.add(miolo);
  g.add(botao);
  for (const lado of [-1, 1]) {
    const folha = malha(new THREE.SphereGeometry(0.12, 6, 5), toon('#6fbf5f'));
    folha.scale.set(1.4, 0.3, 0.6);
    folha.position.set(lado * 0.12, 0.35, 0);
    g.add(folha);
  }
  return g;
}

export function criarPipa(): THREE.Group {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(0, 0.5);
  forma.lineTo(0.35, 0);
  forma.lineTo(0, -0.6);
  forma.lineTo(-0.35, 0);
  forma.lineTo(0, 0.5);
  const vela = new THREE.Mesh(
    new THREE.ShapeGeometry(forma),
    new THREE.MeshToonMaterial({
      color: '#e5534b',
      gradientMap: gradienteToon(),
      side: THREE.DoubleSide,
    })
  );
  g.add(vela);
  for (let i = 0; i < 4; i++) {
    const laco = malha(new THREE.BoxGeometry(0.14, 0.06, 0.02), toon('#ffd27a'));
    laco.position.set(Math.sin(i) * 0.08, -0.7 - i * 0.18, 0);
    laco.rotation.z = i * 0.4;
    g.add(laco);
  }
  return g;
}

export function criarSantuario(): THREE.Group {
  const g = new THREE.Group();
  const base = malha(new THREE.CylinderGeometry(1.4, 1.6, 0.4, 10), toon('#8c7fa8'));
  base.position.y = 0.2;
  g.add(base);
  const pedra = malha(
    new THREE.OctahedronGeometry(0.6, 0),
    new THREE.MeshToonMaterial({
      color: '#ffd27a',
      gradientMap: gradienteToon(),
      emissive: '#7a5a10',
    })
  );
  pedra.scale.set(0.8, 1.4, 0.8);
  pedra.position.y = 1.4;
  pedra.name = 'pedra';
  g.add(pedra);
  for (let i = 0; i < 4; i++) {
    const coluna = malha(new THREE.CylinderGeometry(0.14, 0.16, 1.6, 6), toon('#b3a8cc'));
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    coluna.position.set(Math.cos(a) * 1.15, 1.0, Math.sin(a) * 1.15);
    g.add(coluna);
  }
  return g;
}

export function criarSoquete(): THREE.Group {
  const g = new THREE.Group();
  const base = malha(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 12), toon('#8c7fa8'));
  base.position.y = 0.12;
  g.add(base);
  const cristal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.3, 0),
    new THREE.MeshBasicMaterial({ color: '#ffe9a8' })
  );
  cristal.position.y = 0.75;
  cristal.name = 'cristal';
  g.add(cristal);
  return g;
}
