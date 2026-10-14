/** Canvas principal: ajusta tamanho à janela e à densidade de pixels (limitada a 2). */
export class Tela {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  larguraCss = 0;
  alturaCss = 0;
  dpr = 1;
  private aoMudar: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponível neste navegador.');
    this.ctx = ctx;
    this.ajustar();
    window.addEventListener('resize', () => this.ajustar());
    window.visualViewport?.addEventListener('resize', () => this.ajustar());
  }

  aoRedimensionar(fn: () => void): void {
    this.aoMudar.push(fn);
  }

  ajustar(): void {
    const largura = Math.max(320, Math.round(window.innerWidth));
    const altura = Math.max(200, Math.round(window.innerHeight));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (largura === this.larguraCss && altura === this.alturaCss && dpr === this.dpr) return;
    this.larguraCss = largura;
    this.alturaCss = altura;
    this.dpr = dpr;
    this.canvas.width = Math.round(largura * dpr);
    this.canvas.height = Math.round(altura * dpr);
    this.canvas.style.width = `${largura}px`;
    this.canvas.style.height = `${altura}px`;
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    for (const fn of this.aoMudar) fn();
  }
}
