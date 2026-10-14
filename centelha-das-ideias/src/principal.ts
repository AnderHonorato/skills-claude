/**
 * Ponto de entrada: cria a tela, o jogo e o laço com passo fixo.
 */
import './estilos/base.css';
import { CHAVE_SALVAMENTO, PASSO_FIXO } from './configuracao';
import { instalarApiTeste } from './depuracao/api-teste';
import { JogoCentelha } from './jogo/jogo';
import { Tela } from './motor/tela';

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

/** Restaura o salvamento entregue por uma atualização da página publicada. */
function restaurarDeAtualizacao(dados: { salvamento?: string } | undefined): void {
  if (!dados?.salvamento) return;
  try {
    window.localStorage.setItem(CHAVE_SALVAMENTO, dados.salvamento);
  } catch {
    /* sem armazenamento: segue sem restaurar */
  }
}

async function iniciar(): Promise<void> {
  const canvas = document.getElementById('tela-jogo') as HTMLCanvasElement;
  const raizUi = document.getElementById('interface') as HTMLElement;
  try {
    await document.fonts?.load('600 16px Fredoka');
  } catch {
    /* segue com a fonte do sistema */
  }
  const tela = new Tela(canvas);
  const jogo = new JogoCentelha(tela, raizUi);
  instalarApiTeste(jogo);
  jogo.mostrarTitulo();

  let anterior = performance.now();
  let acumulado = 0;
  const quadro = (agora: number) => {
    const dt = Math.min(0.1, (agora - anterior) / 1000);
    anterior = agora;
    acumulado += dt;
    let passos = 0;
    while (acumulado >= PASSO_FIXO && passos < 6) {
      jogo.passo(PASSO_FIXO);
      acumulado -= PASSO_FIXO;
      passos++;
    }
    if (passos >= 6) acumulado = 0;
    jogo.desenhar();
    requestAnimationFrame(quadro);
  };
  requestAnimationFrame(quadro);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (jogo.estado === 'jogando') jogo.ui.alternarPausa(true);
      jogo.audio.suspender(true);
      jogo.salvar();
    } else {
      jogo.audio.suspender(jogo.estado === 'pausado');
    }
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
