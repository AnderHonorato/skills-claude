import type { Vetor } from '../contratos/base';
import type { Comando, Entrada } from '../contratos/jogo';

const TECLAS: Record<string, Comando[]> = {
  KeyW: ['cima'],
  ArrowUp: ['cima'],
  KeyS: ['baixo'],
  ArrowDown: ['baixo'],
  KeyA: ['esquerda'],
  ArrowLeft: ['esquerda'],
  KeyD: ['direita'],
  ArrowRight: ['direita'],
  ShiftLeft: ['correr'],
  ShiftRight: ['correr'],
  Space: ['pular', 'avancar'],
  KeyC: ['esquivar'],
  KeyJ: ['atacar'],
  KeyK: ['esquivar'],
  KeyE: ['interagir', 'avancar'],
  Enter: ['avancar'],
  NumpadEnter: ['avancar'],
  KeyQ: ['observar'],
  KeyR: ['conectar'],
  KeyF: ['criar'],
  Digit1: ['arma1'],
  Digit2: ['arma2'],
  Digit3: ['arma3'],
  Digit4: ['arma4'],
  KeyH: ['curar'],
  KeyM: ['mapa'],
  Tab: ['mapa'],
  Escape: ['pausa', 'voltar'],
  KeyP: ['pausa'],
};

/** Teclas cujo comportamento padrão do navegador deve ser bloqueado. */
const BLOQUEAR_PADRAO = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
]);

/**
 * Entrada unificada: teclado, mouse, controle (gamepad) e comandos virtuais do toque.
 * "apertou"/"soltou" valem por um passo de atualização (ver iniciarPasso/finalizarPasso).
 */
export class EntradaJogo implements Entrada {
  private teclas = new Map<string, boolean>();
  private virtuais = new Set<Comando>();
  private controle = new Set<Comando>();
  private novosApertos = new Set<Comando>();
  private novosSoltos = new Set<Comando>();
  private apertosPasso = new Set<Comando>();
  private soltosPasso = new Set<Comando>();
  private joystick: Vetor = { x: 0, y: 0 };
  private eixoControle: Vetor = { x: 0, y: 0 };
  private miraTela: Vetor | null = null;
  private direcaoToque: Vetor | null = null;
  private toqueAtivo = false;
  private ultimoToque = 0;
  private mouseAtivo = false;
  private estadoAnterior = new Set<Comando>();

  /** Converte tela -> mundo (fornecido pela câmera). */
  conversorMira: ((x: number, y: number) => Vetor) | null = null;
  /** Elemento que recebe eventos de mouse do jogo (canvas). */
  constructor(private alvo: HTMLElement) {
    window.addEventListener('keydown', (e) => this.aoTecla(e, true));
    window.addEventListener('keyup', (e) => this.aoTecla(e, false));
    window.addEventListener('blur', () => this.soltarTudo());
    alvo.addEventListener('contextmenu', (e) => e.preventDefault());
    alvo.addEventListener('pointerdown', (e) => this.aoPonteiro(e, true));
    window.addEventListener('pointerup', (e) => this.aoPonteiro(e, false));
    alvo.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse') {
        this.miraTela = { x: e.clientX, y: e.clientY };
        this.mouseAtivo = true;
        this.toqueAtivo = false;
      }
    });
    alvo.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (Math.abs(e.deltaY) > 4) this.registrar('armaProxima', true);
        this.registrar('armaProxima', false);
      },
      { passive: false }
    );
    window.addEventListener('touchstart', () => this.marcarToque(), { passive: true });
  }

  private marcarToque(): void {
    this.toqueAtivo = true;
    this.mouseAtivo = false;
    this.ultimoToque = performance.now();
  }

  private aoTecla(e: KeyboardEvent, baixo: boolean): void {
    const comandos = TECLAS[e.code];
    if (BLOQUEAR_PADRAO.has(e.code)) e.preventDefault();
    if (!comandos) return;
    if (baixo && e.repeat) return;
    this.toqueAtivo = false;
    this.teclas.set(e.code, baixo);
    for (const c of comandos) this.registrar(c, baixo);
  }

  private aoPonteiro(e: PointerEvent, baixo: boolean): void {
    if (e.pointerType !== 'mouse') {
      if (baixo) this.marcarToque();
      return;
    }
    if (baixo && e.target !== this.alvo) return;
    this.miraTela = { x: e.clientX, y: e.clientY };
    this.mouseAtivo = true;
    if (e.button === 0) {
      this.registrar('atacar', baixo);
      this.registrar('avancar', baixo);
    } else if (e.button === 2) {
      this.registrar('esquivar', baixo);
    }
  }

  private registrar(c: Comando, baixo: boolean): void {
    if (baixo) this.novosApertos.add(c);
    else this.novosSoltos.add(c);
  }

  private soltarTudo(): void {
    this.teclas.clear();
    this.virtuais.clear();
    this.joystick = { x: 0, y: 0 };
  }

  /** Chamado no início de cada passo fixo de lógica. */
  iniciarPasso(): void {
    this.lerControle();
    for (const c of this.novosApertos) this.apertosPasso.add(c);
    for (const c of this.novosSoltos) this.soltosPasso.add(c);
    this.novosApertos.clear();
    this.novosSoltos.clear();
  }

  /** Chamado no fim do passo: "apertou" vale só uma vez. */
  finalizarPasso(): void {
    this.apertosPasso.clear();
    this.soltosPasso.clear();
  }

  private lerControle(): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p && p.connected);
    if (!pad) {
      if (this.controle.size) this.controle.clear();
      this.eixoControle = { x: 0, y: 0 };
      return;
    }
    const agora = new Set<Comando>();
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    if (b(0)) agora.add('pular').add('avancar');
    if (b(1)) agora.add('esquivar').add('voltar');
    if (b(2)) agora.add('atacar');
    if (b(3)) agora.add('interagir');
    if (b(4)) agora.add('observar');
    if (b(5)) agora.add('conectar');
    if (b(7)) agora.add('criar');
    if (b(6)) agora.add('correr');
    if (b(8)) agora.add('mapa');
    if (b(9)) agora.add('pausa');
    if (b(12)) agora.add('cima');
    if (b(13)) agora.add('baixo');
    if (b(14)) agora.add('esquerda');
    if (b(15)) agora.add('direita');
    if (b(10)) agora.add('correr');
    for (const c of agora) if (!this.estadoAnterior.has(c)) this.apertosPasso.add(c);
    for (const c of this.estadoAnterior) if (!agora.has(c)) this.soltosPasso.add(c);
    this.estadoAnterior = agora;
    this.controle = agora;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    const m = Math.hypot(ax, ay);
    this.eixoControle = m > 0.2 ? { x: ax, y: ay } : { x: 0, y: 0 };
    if (m > 0.2) this.toqueAtivo = false;
  }

  segurando(c: Comando): boolean {
    if (this.virtuais.has(c) || this.controle.has(c)) return true;
    for (const [codigo, baixo] of this.teclas) {
      if (baixo && TECLAS[codigo]?.includes(c)) return true;
    }
    return false;
  }

  apertou(c: Comando): boolean {
    return this.apertosPasso.has(c);
  }

  soltou(c: Comando): boolean {
    return this.soltosPasso.has(c);
  }

  consumir(c: Comando): void {
    this.apertosPasso.delete(c);
  }

  movimento(): Vetor {
    let x = 0;
    let y = 0;
    if (this.segurando('esquerda')) x -= 1;
    if (this.segurando('direita')) x += 1;
    if (this.segurando('cima')) y -= 1;
    if (this.segurando('baixo')) y += 1;
    x += this.joystick.x + this.eixoControle.x;
    y += this.joystick.y + this.eixoControle.y;
    const m = Math.hypot(x, y);
    if (m > 1) return { x: x / m, y: y / m };
    return { x, y };
  }

  correndo(): boolean {
    if (this.segurando('correr')) return true;
    const mj = Math.hypot(this.joystick.x, this.joystick.y);
    if (mj > 0.92) return true;
    const mc = Math.hypot(this.eixoControle.x, this.eixoControle.y);
    return mc > 0.95;
  }

  mira(): Vetor | null {
    if (!this.mouseAtivo || !this.miraTela || !this.conversorMira) return null;
    return this.conversorMira(this.miraTela.x, this.miraTela.y);
  }

  miraToque(): Vetor | null {
    return this.direcaoToque;
  }

  usandoToque(): boolean {
    return this.toqueAtivo || performance.now() - this.ultimoToque < 400;
  }

  definirComandoVirtual(c: Comando, ativo: boolean): void {
    const tinha = this.virtuais.has(c);
    if (ativo && !tinha) {
      this.virtuais.add(c);
      this.registrar(c, true);
    } else if (!ativo && tinha) {
      this.virtuais.delete(c);
      this.registrar(c, false);
    }
  }

  definirJoystick(x: number, y: number): void {
    this.joystick = { x, y };
  }

  definirMiraToque(direcao: Vetor | null): void {
    this.direcaoToque = direcao;
  }
}
