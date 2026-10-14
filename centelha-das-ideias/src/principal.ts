/**
 * Ponto de entrada: cria a tela, o jogo e o laço com passo fixo.
 */
import './estilos/base.css';
import { PASSO_FIXO } from './configuracao';
import { instalarApiTeste } from './depuracao/api-teste';
import { JogoCentelha } from './jogo/jogo';
import { Tela } from './motor/tela';

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
}

void iniciar();
