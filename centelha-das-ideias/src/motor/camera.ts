import { BLOCO, CAMERA } from '../configuracao';
import type { Vetor } from '../contratos/base';
import type { Camera } from '../contratos/jogo';
import { aproximar, limitar } from './matematica';

/** Câmera elevada que segue Claude com antecipação, tremor e foco para cenas. */
export class CameraJogo implements Camera {
  x = 0;
  y = 0;
  largura = 640;
  altura = 360;
  zoom = 2;
  larguraTela = 1280;
  alturaTela = 720;

  private alvoX = 0;
  private alvoY = 0;
  private tremorIntensidade = 0;
  private tremorRestante = 0;
  private tremorDuracao = 0;
  private deslocTremor: Vetor = { x: 0, y: 0 };
  private foco: Vetor | null = null;
  private velocidadeFoco = 3;
  limites = { x: 0, y: 0, largura: 1e9, altura: 1e9 };
  tremorAtivado = true;

  ajustarTela(largura: number, altura: number): void {
    this.larguraTela = largura;
    this.alturaTela = altura;
    const zv = altura / (CAMERA.blocosVerticais * BLOCO);
    const zh = largura / (CAMERA.blocosHorizontais * BLOCO);
    this.zoom = limitar(Math.min(zv, zh), 0.9, CAMERA.zoomMaximo);
    this.largura = largura / this.zoom;
    this.altura = altura / this.zoom;
  }

  seguir(x: number, y: number): void {
    this.alvoX = x;
    this.alvoY = y;
  }

  /** Posiciona imediatamente (sem suavização). */
  centralizar(x: number, y: number): void {
    this.alvoX = x;
    this.alvoY = y;
    this.x = x - this.largura / 2;
    this.y = y - this.altura / 2;
    this.restringir();
  }

  tremer(intensidade: number, duracao: number): void {
    if (!this.tremorAtivado) return;
    if (intensidade >= this.tremorIntensidade * (this.tremorRestante / (this.tremorDuracao || 1))) {
      this.tremorIntensidade = intensidade;
      this.tremorRestante = duracao;
      this.tremorDuracao = duracao;
    }
  }

  focar(ponto: Vetor | null, duracao = 0.8): void {
    this.foco = ponto ? { ...ponto } : null;
    this.velocidadeFoco = 3 / Math.max(0.2, duracao);
  }

  atualizar(dt: number): void {
    const alvo = this.foco ?? { x: this.alvoX, y: this.alvoY };
    const taxa = this.foco ? this.velocidadeFoco * 2 : CAMERA.suavizacao;
    const cx = aproximar(this.x + this.largura / 2, alvo.x, taxa, dt);
    const cy = aproximar(this.y + this.altura / 2, alvo.y, taxa, dt);
    this.x = cx - this.largura / 2;
    this.y = cy - this.altura / 2;
    this.restringir();
    if (this.tremorRestante > 0) {
      this.tremorRestante -= dt;
      const f = Math.max(0, this.tremorRestante / this.tremorDuracao);
      const a = this.tremorIntensidade * f * f;
      this.deslocTremor = { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
    } else {
      this.deslocTremor = { x: 0, y: 0 };
    }
  }

  private restringir(): void {
    const { limites } = this;
    if (this.largura >= limites.largura) {
      this.x = limites.x + (limites.largura - this.largura) / 2;
    } else {
      this.x = limitar(this.x, limites.x, limites.x + limites.largura - this.largura);
    }
    if (this.altura >= limites.altura) {
      this.y = limites.y + (limites.altura - this.altura) / 2;
    } else {
      this.y = limitar(this.y, limites.y, limites.y + limites.altura - this.altura);
    }
  }

  /** Posição final usada no desenho (com tremor). */
  get xVisual(): number {
    return this.x + this.deslocTremor.x;
  }

  get yVisual(): number {
    return this.y + this.deslocTremor.y;
  }

  mundoParaTela(x: number, y: number): Vetor {
    return { x: (x - this.xVisual) * this.zoom, y: (y - this.yVisual) * this.zoom };
  }

  telaParaMundo(x: number, y: number): Vetor {
    return { x: x / this.zoom + this.xVisual, y: y / this.zoom + this.yVisual };
  }
}
