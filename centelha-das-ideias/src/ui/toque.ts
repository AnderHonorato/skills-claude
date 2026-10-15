/**
 * Controles de toque (multitoque): joystick flutuante na metade esquerda e botões à
 * direita. Dá para andar, pular e atacar ao mesmo tempo. Os botões de habilidade só
 * aparecem depois de aprendidas; "Usar" aparece quando há algo para usar.
 */
import type { Comando } from '../motor/entrada';
import type { JogoCentelha } from '../jogo/jogo';

interface DefBotao {
  comando: Comando;
  rotulo: string;
  classe: string;
  visivel?: (j: JogoCentelha) => boolean;
}

const BOTOES: DefBotao[] = [
  { comando: 'atacar', rotulo: 'Atacar', classe: 't-atacar', visivel: (j) => !!j.estado.armaAtual },
  { comando: 'pular', rotulo: 'Pular', classe: 't-pular' },
  { comando: 'esquivar', rotulo: 'Esquiva', classe: 't-esquivar' },
  {
    comando: 'especial',
    rotulo: 'Especial',
    classe: 't-especial',
    visivel: (j) => !!j.estado.armaAtual,
  },
  { comando: 'interagir', rotulo: 'Usar', classe: 't-usar', visivel: (j) => !!j.interacao },
  {
    comando: 'observar',
    rotulo: 'Observar',
    classe: 't-hab',
    visivel: (j) => j.estado.habilidades.has('observar'),
  },
  {
    comando: 'conectar',
    rotulo: 'Conectar',
    classe: 't-hab',
    visivel: (j) => j.estado.habilidades.has('conectar'),
  },
  {
    comando: 'criar',
    rotulo: 'Criar',
    classe: 't-hab',
    visivel: (j) => j.estado.habilidades.has('criar'),
  },
  {
    comando: 'armaProxima',
    rotulo: 'Arma',
    classe: 't-arma',
    visivel: (j) => j.estado.armasObtidas().length > 1,
  },
];

export function instalarToque(jogo: JogoCentelha, raiz: HTMLElement): { atualizar(): void } {
  const camada = document.createElement('div');
  camada.className = 'toque';
  camada.hidden = true;
  raiz.appendChild(camada);

  const zona = document.createElement('div');
  zona.className = 'toque-zona';
  const base = document.createElement('div');
  base.className = 'toque-base';
  const pino = document.createElement('div');
  pino.className = 'toque-pino';
  base.hidden = pino.hidden = true;
  const dica = document.createElement('div');
  dica.className = 'toque-dica';
  dica.textContent = 'Arraste aqui para andar';
  zona.append(base, pino, dica);
  camada.appendChild(zona);

  let dedo: number | null = null;
  let origem = { x: 0, y: 0 };
  const RAIO = 58;
  const mover = (x: number, y: number) => {
    let dx = x - origem.x;
    let dy = y - origem.y;
    const d = Math.hypot(dx, dy);
    if (d > RAIO) {
      // a base acompanha o dedo (joystick flutuante de verdade)
      origem.x += (dx / d) * (d - RAIO);
      origem.y += (dy / d) * (d - RAIO);
      base.style.left = `${origem.x}px`;
      base.style.top = `${origem.y}px`;
      dx = x - origem.x;
      dy = y - origem.y;
    }
    pino.style.left = `${origem.x + dx}px`;
    pino.style.top = `${origem.y + dy}px`;
    const m = Math.min(1, Math.hypot(dx, dy) / RAIO);
    const f = m < 0.12 ? 0 : m;
    const n = Math.hypot(dx, dy) || 1;
    jogo.entrada.definirJoystick((dx / n) * f, (dy / n) * f);
  };
  zona.addEventListener('pointerdown', (e) => {
    if (dedo !== null) return;
    dedo = e.pointerId;
    zona.setPointerCapture(e.pointerId);
    origem = { x: e.clientX, y: e.clientY };
    base.style.left = `${origem.x}px`;
    base.style.top = `${origem.y}px`;
    base.hidden = pino.hidden = false;
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
    base.hidden = pino.hidden = true;
    jogo.entrada.definirJoystick(0, 0);
  };
  zona.addEventListener('pointerup', soltar);
  zona.addEventListener('pointercancel', soltar);

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
      jogo.audio.desbloquear();
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

  const topo = document.createElement('div');
  topo.className = 'toque-topo';
  const mk = (rotulo: string, aria: string, fn: () => void) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'toque-mini';
    b.textContent = rotulo;
    b.setAttribute('aria-label', aria);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      fn();
    });
    topo.append(b);
  };
  mk('Mapa', 'Mapa', () => jogo.ui.alternarMapa());
  mk('II', 'Pausa', () => jogo.alternarPausa(jogo.estadoJogo === 'jogando'));
  camada.appendChild(topo);

  let usandoToque = false;
  window.addEventListener('touchstart', () => (usandoToque = true), { passive: true });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') usandoToque = true;
  });
  window.addEventListener('keydown', () => (usandoToque = false));
  const grosso = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (grosso) usandoToque = true;

  return {
    atualizar() {
      const ativo = usandoToque && (jogo.estadoJogo === 'jogando' || jogo.estadoJogo === 'dialogo');
      camada.hidden = !ativo;
      document.body.classList.toggle('modo-toque', usandoToque);
      if (!ativo) return;
      const jogando = jogo.estadoJogo === 'jogando';
      zona.hidden = !jogando;
      grade.hidden = !jogando;
      for (const { def, b } of botoes) {
        const v = !def.visivel || def.visivel(jogo);
        if (b.hidden === v) b.hidden = !v;
      }
    },
  };
}
