/**
 * Controles de toque provisórios (o agente de Interface entrega a versão final).
 * Joystick flutuante na metade esquerda (aparece onde o dedo toca) e botões à direita.
 * Multitoque com Pointer Events: mover, pular e atacar ao mesmo tempo.
 */
import type { Comando, Jogo } from '../contratos/jogo';

interface DefBotao {
  comando: Comando;
  rotulo: string;
  classe: string;
  visivel?: (jogo: Jogo) => boolean;
}

const BOTOES: DefBotao[] = [
  { comando: 'atacar', rotulo: 'Atacar', classe: 'toque-atacar', visivel: (j) => !!j.jogador.armaAtual },
  { comando: 'pular', rotulo: 'Pular', classe: 'toque-pular' },
  { comando: 'esquivar', rotulo: 'Esquivar', classe: 'toque-esquivar' },
  { comando: 'interagir', rotulo: 'Usar', classe: 'toque-interagir', visivel: (j) => !!j.jogador.alvoInteracao },
  { comando: 'observar', rotulo: 'Observar', classe: 'toque-observar', visivel: (j) => j.jogador.habilidades.has('observar') },
  { comando: 'conectar', rotulo: 'Conectar', classe: 'toque-conectar', visivel: (j) => j.jogador.habilidades.has('conectar') },
  { comando: 'criar', rotulo: 'Criar', classe: 'toque-criar', visivel: (j) => j.jogador.habilidades.has('criar') },
];

const CSS = `
.toque[hidden], .toque [hidden] { display: none !important; }
.toque { position: fixed; inset: 0; pointer-events: none; z-index: 5; font-family: var(--fonte); }
.toque-zona { position: absolute; left: 0; top: 0; bottom: 0; width: 48%; pointer-events: auto; touch-action: none; }
.toque-base { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%;
  background: rgba(246,241,231,0.14); border: 2px solid rgba(246,241,231,0.45); pointer-events: none; }
.toque-pino { position: absolute; width: 54px; height: 54px; margin: -27px 0 0 -27px; border-radius: 50%;
  background: rgba(217,119,87,0.85); border: 2px solid #F6F1E7; pointer-events: none; }
.toque-dica { position: absolute; left: max(18px, env(safe-area-inset-left, 0px)); bottom: max(18px, env(safe-area-inset-bottom, 0px));
  color: rgba(246,241,231,0.7); font-size: 13px; pointer-events: none; }
.toque-botoes { position: absolute; right: max(14px, env(safe-area-inset-right, 0px)); bottom: max(14px, env(safe-area-inset-bottom, 0px));
  display: grid; grid-template-columns: repeat(3, 64px); gap: 10px; pointer-events: none; direction: rtl; }
.toque-botao { pointer-events: auto; touch-action: none; width: 64px; height: 64px; border-radius: 50%;
  border: 2px solid rgba(246,241,231,0.8); background: rgba(43,37,48,0.72); color: #F6F1E7;
  font: 600 12px var(--fonte); display: flex; align-items: center; justify-content: center; direction: ltr; user-select: none; }
.toque-botao.ativo { background: rgba(217,119,87,0.9); transform: scale(0.94); }
.toque-atacar { width: 76px; height: 76px; background: rgba(217,119,87,0.75); }
.toque-pausa { position: absolute; top: max(12px, env(safe-area-inset-top, 0px)); right: max(12px, env(safe-area-inset-right, 0px));
  pointer-events: auto; width: 44px; height: 44px; border-radius: 12px; border: 2px solid rgba(246,241,231,0.7);
  background: rgba(43,37,48,0.72); color: #F6F1E7; font: 600 16px var(--fonte); }
`;

export function instalarToqueProvisorio(jogo: Jogo, raiz: HTMLElement): { atualizar(): void } {
  const estilo = document.createElement('style');
  estilo.textContent = CSS;
  document.head.appendChild(estilo);

  const camada = document.createElement('div');
  camada.className = 'toque';
  camada.hidden = true;
  raiz.appendChild(camada);

  // ----- joystick flutuante -----
  const zona = document.createElement('div');
  zona.className = 'toque-zona';
  const base = document.createElement('div');
  base.className = 'toque-base';
  const pino = document.createElement('div');
  pino.className = 'toque-pino';
  base.hidden = true;
  pino.hidden = true;
  const dica = document.createElement('div');
  dica.className = 'toque-dica';
  dica.textContent = 'Toque e arraste aqui para andar';
  zona.append(base, pino, dica);
  camada.appendChild(zona);

  let dedo: number | null = null;
  let origem = { x: 0, y: 0 };
  const RAIO = 56;
  const mover = (x: number, y: number) => {
    let dx = x - origem.x;
    let dy = y - origem.y;
    const d = Math.hypot(dx, dy);
    if (d > RAIO) {
      dx = (dx / d) * RAIO;
      dy = (dy / d) * RAIO;
    }
    pino.style.left = `${origem.x + dx}px`;
    pino.style.top = `${origem.y + dy}px`;
    const m = Math.min(1, d / RAIO);
    const fator = m < 0.15 ? 0 : m;
    const norm = d > 0 ? { x: dx / Math.max(1, Math.hypot(dx, dy)), y: dy / Math.max(1, Math.hypot(dx, dy)) } : { x: 0, y: 0 };
    jogo.entrada.definirJoystick(norm.x * fator, norm.y * fator);
  };
  zona.addEventListener('pointerdown', (e) => {
    if (dedo !== null) return;
    dedo = e.pointerId;
    zona.setPointerCapture(e.pointerId);
    origem = { x: e.clientX, y: e.clientY };
    base.style.left = `${origem.x}px`;
    base.style.top = `${origem.y}px`;
    base.hidden = false;
    pino.hidden = false;
    dica.hidden = true;
    mover(e.clientX, e.clientY);
    jogo.audio.desbloquear();
  });
  zona.addEventListener('pointermove', (e) => {
    if (e.pointerId === dedo) mover(e.clientX, e.clientY);
  });
  const soltar = (e: PointerEvent) => {
    if (e.pointerId !== dedo) return;
    dedo = null;
    base.hidden = true;
    pino.hidden = true;
    jogo.entrada.definirJoystick(0, 0);
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);

  // ----- botões -----
  const grade = document.createElement('div');
  grade.className = 'toque-botoes';
  camada.appendChild(grade);
  const botoes = BOTOES.map((def) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `toque-botao ${def.classe}`;
    b.textContent = def.rotulo;
    const apertar = (e: PointerEvent) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.classList.add('ativo');
      jogo.entrada.definirComandoVirtual(def.comando, true);
      if (def.comando === 'interagir') jogo.entrada.definirComandoVirtual('avancar', true);
    };
    const largar = () => {
      b.classList.remove('ativo');
      jogo.entrada.definirComandoVirtual(def.comando, false);
      if (def.comando === 'interagir') jogo.entrada.definirComandoVirtual('avancar', false);
    };
    b.addEventListener('pointerdown', apertar);
    b.addEventListener('pointerup', largar);
    b.addEventListener('pointercancel', largar);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    grade.appendChild(b);
    return { def, b };
  });

  const pausa = document.createElement('button');
  pausa.type = 'button';
  pausa.className = 'toque-pausa';
  pausa.textContent = 'II';
  pausa.setAttribute('aria-label', 'Pausa');
  pausa.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    jogo.entrada.definirComandoVirtual('pausa', true);
    setTimeout(() => jogo.entrada.definirComandoVirtual('pausa', false), 60);
  });
  camada.appendChild(pausa);

  // Toque fora dos botões avança falas/balões.
  let usandoToque = false;
  window.addEventListener('touchstart', () => (usandoToque = true), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') usandoToque = true;
  });
  const grosso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

  return {
    atualizar() {
      const mostrar = (usandoToque || grosso) && jogo.estado !== 'titulo' && jogo.estado !== 'derrota';
      camada.hidden = !mostrar;
      if (!mostrar) return;
      for (const { def, b } of botoes) {
        const v = !def.visivel || def.visivel(jogo);
        if (b.hidden === v) b.hidden = !v;
      }
    },
  };
}
