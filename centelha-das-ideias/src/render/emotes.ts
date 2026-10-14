/**
 * Balõezinhos de emoção que surgem sobre a cabeça (!, ?, coração, nota musical,
 * marca de raiva, Zz, gota de suor, reticências) com animação de "pop".
 */
import * as THREE from 'three';

export type TipoEmote =
  | 'exclamacao'
  | 'pergunta'
  | 'coracao'
  | 'nota'
  | 'raiva'
  | 'zz'
  | 'suor'
  | 'reticencias'
  | 'estrela';

const texturas = new Map<TipoEmote, THREE.Texture>();

function desenhar(tipo: TipoEmote): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // balão branco
  if (tipo !== 'zz' && tipo !== 'suor' && tipo !== 'raiva') {
    g.fillStyle = '#fffaf0';
    g.strokeStyle = '#2b2530';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(64, 58, 42, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(52, 96);
    g.lineTo(64, 116);
    g.lineTo(74, 95);
    g.fill();
    g.stroke();
    g.fillStyle = '#fffaf0';
    g.fillRect(50, 88, 28, 10);
  }
  g.font = '700 64px Fredoka, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  switch (tipo) {
    case 'exclamacao':
      g.fillStyle = '#e5534b';
      g.fillText('!', 64, 62);
      break;
    case 'pergunta':
      g.fillStyle = '#5b7cfa';
      g.fillText('?', 64, 62);
      break;
    case 'reticencias':
      g.fillStyle = '#2b2530';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(44 + i * 20, 60, 7, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'coracao': {
      g.fillStyle = '#ff5f7e';
      g.beginPath();
      g.moveTo(64, 82);
      g.bezierCurveTo(20, 54, 40, 22, 64, 42);
      g.bezierCurveTo(88, 22, 108, 54, 64, 82);
      g.fill();
      break;
    }
    case 'nota':
      g.fillStyle = '#7a5cff';
      g.beginPath();
      g.ellipse(52, 74, 12, 9, -0.4, 0, Math.PI * 2);
      g.fill();
      g.fillRect(60, 32, 7, 42);
      g.beginPath();
      g.moveTo(66, 32);
      g.quadraticCurveTo(86, 40, 82, 56);
      g.quadraticCurveTo(80, 44, 66, 44);
      g.fill();
      break;
    case 'estrela': {
      g.fillStyle = '#ffc94a';
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 30 : 13;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(64 + Math.cos(a) * r, 60 + Math.sin(a) * r);
      }
      g.fill();
      break;
    }
    case 'raiva':
      g.strokeStyle = '#e5534b';
      g.lineWidth = 12;
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(64, 64);
        g.rotate((i * Math.PI) / 2 + Math.PI / 4);
        g.beginPath();
        g.arc(30, 0, 16, Math.PI * 0.6, Math.PI * 1.4);
        g.stroke();
        g.restore();
      }
      break;
    case 'zz':
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#2b2530';
      g.lineWidth = 8;
      g.font = '700 56px Fredoka, system-ui, sans-serif';
      g.strokeText('Z', 44, 80);
      g.fillText('Z', 44, 80);
      g.font = '700 38px Fredoka, system-ui, sans-serif';
      g.strokeText('z', 84, 44);
      g.fillText('z', 84, 44);
      break;
    case 'suor':
      g.fillStyle = '#8fd3ff';
      g.strokeStyle = '#2b5f8a';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(64, 20);
      g.bezierCurveTo(30, 70, 40, 104, 64, 104);
      g.bezierCurveTo(88, 104, 98, 70, 64, 20);
      g.fill();
      g.stroke();
      break;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function texturaEmote(tipo: TipoEmote): THREE.Texture {
  let t = texturas.get(tipo);
  if (!t) {
    t = desenhar(tipo);
    texturas.set(tipo, t);
  }
  return t;
}

/** Um emote sobre a cabeça de alguém. */
export class Emote {
  readonly sprite: THREE.Sprite;
  private material: THREE.SpriteMaterial;
  private vida = 0;
  private total = 1;

  constructor(private altura: number) {
    this.material = new THREE.SpriteMaterial({
      map: texturaEmote('exclamacao'),
      transparent: true,
      depthTest: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.visible = false;
    this.sprite.renderOrder = 20;
  }

  mostrar(tipo: TipoEmote, duracao = 1.4): void {
    this.material.map = texturaEmote(tipo);
    this.material.needsUpdate = true;
    this.vida = this.total = duracao;
    this.sprite.visible = true;
  }

  atualizar(dt: number): void {
    if (this.vida <= 0) {
      this.sprite.visible = false;
      return;
    }
    this.vida -= dt;
    const t = 1 - this.vida / this.total;
    const pop =
      t < 0.15
        ? Math.sin((t / 0.15) * Math.PI * 0.5) * 1.25
        : t > 0.85
          ? (1 - t) / 0.15
          : 1 - Math.sin(Math.min(1, (t - 0.15) / 0.15) * Math.PI) * 0.15;
    const s = 0.7 * Math.max(0.001, pop);
    this.sprite.scale.set(s, s, s);
    this.sprite.position.y = this.altura + Math.sin(t * Math.PI * 4) * 0.04 + t * 0.15;
  }
}
