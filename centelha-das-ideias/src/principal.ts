/**
 * Ponto de entrada: cria o jogo 3D, a interface e o laço com passo fixo de 60 Hz.
 */
import './estilos/base.css';
import { instalarApiTeste } from './depuracao/api-teste';
import { JogoCentelha } from './jogo/jogo';
import { CHAVE_SALVAMENTO, lerSalvamento } from './nucleo/salvamento';
import { Interface } from './ui/interface';

const PASSO = 1 / 60;

/** Gancho de atualização ao vivo da página publicada (ausente fora dela). */
interface GanchoAtualizacao {
  data?: { salvamento?: string };
  ready?: (iniciar: (dados: { salvamento?: string }) => void) => void;
  snapshot?: (obter: () => unknown) => void;
}

function ganchoAtualizacao(): GanchoAtualizacao | undefined {
  try {
    return (window as unknown as { claude?: { hot?: GanchoAtualizacao } }).claude?.hot;
  } catch {
    return undefined;
  }
}

function restaurarDeAtualizacao(dados: { salvamento?: string } | undefined): void {
  if (!dados?.salvamento) return;
  try {
    window.localStorage.setItem(CHAVE_SALVAMENTO, dados.salvamento);
  } catch {
    /* sem armazenamento */
  }
}

function semWebgl(): boolean {
  try {
    const c = document.createElement('canvas');
    return !(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return true;
  }
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
  const jogo = new JogoCentelha(canvas);
  const ui = new Interface(jogo, raizUi);
  jogo.ui = ui;
  instalarApiTeste(jogo);
  ui.titulo(!!lerSalvamento());
  jogo.audio.musica('titulo');
  const desbloquear = () => jogo.audio.desbloquear();
  window.addEventListener('pointerdown', desbloquear);
  window.addEventListener('keydown', desbloquear);

  let anterior = performance.now();
  let acumulado = 0;
  const quadro = (agora: number) => {
    const dt = Math.min(0.1, (agora - anterior) / 1000);
    anterior = agora;
    acumulado += dt;
    let passos = 0;
    while (acumulado >= PASSO && passos < 5) {
      jogo.passo(PASSO);
      acumulado -= PASSO;
      passos++;
    }
    if (passos >= 5) acumulado = 0;
    jogo.desenhar(dt);
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

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
      return { salvamento: window.localStorage.getItem(CHAVE_SALVAMENTO) ?? undefined };
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
