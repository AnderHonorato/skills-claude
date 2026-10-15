/**
 * Ponto de entrada: por padrão abre o modo Sobrevivência (roguelike); com
 * ?modo=aventura abre a aventura 3D clássica. Os dois usam laço com passo fixo de 60 Hz.
 */
import './estilos/base.css';
import './roguelike/estilos.css';
import { instalarApiTeste } from './depuracao/api-teste';
import { JogoCentelha } from './jogo/jogo';
import { CHAVE_SALVAMENTO, lerSalvamento } from './nucleo/salvamento';
import { instalarApiSobrevivencia } from './roguelike/api-teste';
import { Partida } from './roguelike/jogo/partida';
import { InterfaceSobrevivencia } from './roguelike/ui';
import { Interface } from './ui/interface';

const PASSO = 1 / 60;

/** Gancho de atualização ao vivo da página publicada (ausente fora dela). */
interface DadosAtualizacao {
  salvamento?: string;
  recordes?: Record<string, string>;
}

interface GanchoAtualizacao {
  data?: DadosAtualizacao;
  ready?: (iniciar: (dados: DadosAtualizacao) => void) => void;
  snapshot?: (obter: () => unknown) => void;
}

const PREFIXO_RECORDE = 'centelha-sobrevivencia:';

function ganchoAtualizacao(): GanchoAtualizacao | undefined {
  try {
    return (window as unknown as { claude?: { hot?: GanchoAtualizacao } }).claude?.hot;
  } catch {
    return undefined;
  }
}

function restaurarDeAtualizacao(dados: DadosAtualizacao | undefined): void {
  try {
    if (dados?.salvamento) window.localStorage.setItem(CHAVE_SALVAMENTO, dados.salvamento);
    for (const [k, v] of Object.entries(dados?.recordes ?? {}))
      if (k.startsWith(PREFIXO_RECORDE)) window.localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento */
  }
}

function lerRecordes(): Record<string, string> {
  const r: Record<string, string> = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(PREFIXO_RECORDE)) r[k] = window.localStorage.getItem(k) ?? '';
    }
  } catch {
    /* sem armazenamento */
  }
  return r;
}

function modoAventura(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('modo') === 'aventura';
  } catch {
    return false;
  }
}

/** Laço com passo fixo; desenha uma vez por quadro. */
function laco(passo: (dt: number) => void, desenhar: (dt: number) => void): void {
  let anterior = performance.now();
  let acumulado = 0;
  const quadro = (agora: number) => {
    const dt = Math.min(0.1, (agora - anterior) / 1000);
    anterior = agora;
    acumulado += dt;
    let passos = 0;
    while (acumulado >= PASSO && passos < 5) {
      passo(PASSO);
      acumulado -= PASSO;
      passos++;
    }
    if (passos >= 5) acumulado = 0;
    desenhar(dt);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);
}

function semWebgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return true;
  }
}

function iniciarSobrevivencia(canvas: HTMLCanvasElement, raizUi: HTMLElement): void {
  const partida = new Partida(canvas);
  const ui = new InterfaceSobrevivencia(partida, raizUi);
  instalarApiSobrevivencia(partida);
  partida.audio.musica('titulo');
  const desbloquear = () => partida.audio.desbloquear();
  window.addEventListener('pointerdown', desbloquear);
  window.addEventListener('keydown', desbloquear);
  laco(
    (dt) => partida.passo(dt),
    (dt) => {
      partida.desenhar(dt);
      ui.atualizar();
    }
  );
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      partida.pausar(true);
      partida.vozes.silenciar();
      partida.audio.suspender(true);
    } else partida.audio.suspender(false);
  });
  ganchoAtualizacao()?.snapshot?.(() => ({ recordes: lerRecordes() }));
}

async function iniciar(): Promise<void> {
  const canvas = document.getElementById('tela-jogo') as HTMLCanvasElement;
  const raizUi = document.getElementById('interface') as HTMLElement;
  if (semWebgl()) {
    raizUi.innerHTML =
      '<div class="tela-titulo"><div class="caixa-menu"><h2>Sem 3D aqui</h2><p>Este navegador não liberou o WebGL. Tente o Chrome, Edge, Firefox ou Safari atualizados.</p></div></div>';
    return;
  }
  try {
    await document.fonts?.load('600 16px Fredoka');
  } catch {
    /* segue com a fonte do sistema */
  }
  if (!modoAventura()) {
    iniciarSobrevivencia(canvas, raizUi);
    return;
  }
  const jogo = new JogoCentelha(canvas);
  const ui = new Interface(jogo, raizUi);
  jogo.ui = ui;
  instalarApiTeste(jogo);
  ui.titulo(!!lerSalvamento());
  jogo.audio.musica('titulo');
  const desbloquear = () => jogo.audio.desbloquear();
  window.addEventListener('pointerdown', desbloquear);
  window.addEventListener('keydown', desbloquear);

  laco(
    (dt) => jogo.passo(dt),
    (dt) => jogo.desenhar(dt)
  );

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (jogo.estadoJogo === 'jogando') jogo.alternarPausa(true);
      jogo.audio.suspender(true);
      jogo.salvar();
    } else jogo.audio.suspender(false);
  });
  window.addEventListener('pagehide', () => jogo.salvar());
  ganchoAtualizacao()?.snapshot?.(() => {
    jogo.salvar();
    try {
      return {
        salvamento: window.localStorage.getItem(CHAVE_SALVAMENTO) ?? undefined,
        recordes: lerRecordes(),
      };
    } catch {
      return {};
    }
  });
}

const gancho = ganchoAtualizacao();
if (gancho?.ready) {
  gancho.ready((dados) => {
    restaurarDeAtualizacao(dados);
    void iniciar();
  });
} else {
  restaurarDeAtualizacao(gancho?.data);
  void iniciar();
}
