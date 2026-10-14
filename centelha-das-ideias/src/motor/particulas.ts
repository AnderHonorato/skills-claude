import type { Particula, SistemaParticulas } from '../contratos/jogo';

const MAXIMO = 900;

/** Partículas simples em coordenadas do mundo (com altura z). Presets em src/arte/efeitos.ts. */
export class Particulas implements SistemaParticulas {
  private lista: Particula[] = [];

  emitir(p: Partial<Particula> & { x: number; y: number }): void {
    if (this.lista.length >= MAXIMO) this.lista.shift();
    const vida = p.vida ?? p.vidaMaxima ?? 0.6;
    this.lista.push({
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      vidaMaxima: vida,
      tamanho: 2,
      tamanhoFinal: p.tamanhoFinal ?? p.tamanho ?? 2,
      cor: '#ffffff',
      forma: 'circulo',
      gravidade: 0,
      atrito: 0,
      aditiva: false,
      rotacao: 0,
      giro: 0,
      ...p,
      vida,
    });
  }

  quantidade(): number {
    return this.lista.length;
  }

  limpar(): void {
    this.lista.length = 0;
  }

  atualizar(dt: number): void {
    const l = this.lista;
    let j = 0;
    for (let i = 0; i < l.length; i++) {
      const p = l[i]!;
      p.vida -= dt;
      if (p.vida <= 0) continue;
      const f = p.atrito > 0 ? Math.exp(-p.atrito * dt) : 1;
      p.vx *= f;
      p.vy *= f;
      p.vz = p.vz * f - p.gravidade * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.z < 0 && p.gravidade > 0) {
        p.z = 0;
        p.vz *= -0.35;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }
      p.rotacao += p.giro * dt;
      l[j++] = p;
    }
    l.length = j;
  }

  desenhar(
    ctx: CanvasRenderingContext2D,
    aditivas: boolean,
    area: { x: number; y: number; largura: number; altura: number }
  ): void {
    const margem = 40;
    for (const p of this.lista) {
      if (p.aditiva !== aditivas) continue;
      if (p.x < area.x - margem || p.x > area.x + area.largura + margem) continue;
      if (p.y < area.y - margem || p.y > area.y + area.altura + margem + p.z) continue;
      const t = 1 - p.vida / p.vidaMaxima;
      const tamanho = p.tamanho + (p.tamanhoFinal - p.tamanho) * t;
      const alpha = Math.min(1, (p.vida / p.vidaMaxima) * 1.6);
      ctx.globalAlpha = alpha;
      const px = p.x;
      const py = p.y - p.z;
      switch (p.forma) {
        case 'quadrado':
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rotacao);
          ctx.fillStyle = p.cor;
          ctx.fillRect(-tamanho / 2, -tamanho / 2, tamanho, tamanho);
          ctx.restore();
          break;
        case 'losango':
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.rotacao + Math.PI / 4);
          ctx.fillStyle = p.cor;
          ctx.fillRect(-tamanho / 2, -tamanho / 2, tamanho, tamanho);
          ctx.restore();
          break;
        case 'anel':
          ctx.strokeStyle = p.cor;
          ctx.lineWidth = Math.max(0.5, tamanho * 0.18);
          ctx.beginPath();
          ctx.ellipse(px, py, tamanho, tamanho * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'risco': {
          const vel = Math.hypot(p.vx, p.vy - p.vz) || 1;
          ctx.strokeStyle = p.cor;
          ctx.lineWidth = Math.max(0.6, tamanho * 0.4);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - (p.vx / vel) * tamanho * 2, py - ((p.vy - p.vz) / vel) * tamanho * 2);
          ctx.stroke();
          break;
        }
        case 'brilho': {
          ctx.fillStyle = p.cor;
          const r = tamanho;
          ctx.beginPath();
          ctx.moveTo(px, py - r);
          ctx.quadraticCurveTo(px, py, px + r, py);
          ctx.quadraticCurveTo(px, py, px, py + r);
          ctx.quadraticCurveTo(px, py, px - r, py);
          ctx.quadraticCurveTo(px, py, px, py - r);
          ctx.fill();
          break;
        }
        default:
          ctx.fillStyle = p.cor;
          ctx.beginPath();
          ctx.arc(px, py, tamanho / 2, 0, Math.PI * 2);
          ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
