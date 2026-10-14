/**
 * Interface: HUD, balões, menus, mapa, controles de toque (RESPONSÁVEL: agente de Interface).
 * Versão provisória do orquestrador: título, HUD textual e balões simples.
 */
import type { ApiUi, Jogo } from '../contratos/jogo';
import { instalarToqueProvisorio } from './toque-provisorio';

export function criarUi(jogo: Jogo, raiz: HTMLElement): ApiUi {
  const hud = document.createElement('div');
  hud.className = 'hud-provisorio';
  raiz.appendChild(hud);
  let titulo: HTMLElement | null = null;
  const toque = instalarToqueProvisorio(jogo, raiz);
  let mensagem = '';
  let mensagemRestante = 0;

  function esconderTitulo(): void {
    titulo?.remove();
    titulo = null;
  }

  return {
    atualizar(dt) {
      mensagemRestante -= dt;
      const j = jogo.jogador;
      hud.textContent = `Vida ${j.vida}/${j.vidaMaxima} · Inspiração ${Math.floor(j.inspiracao)}/${j.inspiracaoMaxima} · ${j.armaAtual ?? 'sem arma'}${mensagemRestante > 0 ? ' · ' + mensagem : ''}`;
      if (jogo.entrada.apertou('pausa') && jogo.estado === 'jogando') jogo.estado = 'pausado';
      else if (jogo.entrada.apertou('pausa') && jogo.estado === 'pausado') jogo.estado = 'jogando';
      if (jogo.estado === 'pausado') hud.textContent = 'Pausado — Esc ou o botão II para continuar';
      toque.atualizar();
    },
    desenharTela(ctx) {
      ctx.font = '600 14px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (const l of jogo.dialogo.latidos()) {
        const e = l.quem === 'claude' ? jogo.jogador : jogo.entidades.porId(l.quem);
        if (!e) continue;
        const p = jogo.camera.mundoParaTela(e.x, e.y - 40);
        const w = ctx.measureText(l.texto).width + 16;
        ctx.fillStyle = '#F6F1E7';
        ctx.fillRect(p.x - w / 2, p.y - 22, w, 24);
        ctx.fillStyle = '#2B2530';
        ctx.fillText(l.texto, p.x, p.y - 5);
      }
      const alvo = jogo.jogador.alvoInteracao;
      if (alvo && alvo.textoInteracao) {
        const t = alvo.textoInteracao(jogo);
        if (t) {
          const p = jogo.camera.mundoParaTela(alvo.x, alvo.y - 30);
          ctx.fillStyle = '#FFE9B0';
          ctx.fillText(`[E] ${t}`, p.x, p.y);
        }
      }
    },
    mensagem(texto) {
      mensagem = texto;
      mensagemRestante = 3;
    },
    mostrarTitulo(temSalvamento) {
      esconderTitulo();
      titulo = document.createElement('div');
      titulo.className = 'titulo-provisorio';
      const h = document.createElement('h1');
      h.textContent = 'Claude — A Centelha das Ideias';
      titulo.appendChild(h);
      const novo = document.createElement('button');
      novo.textContent = 'Novo jogo';
      novo.onclick = () => {
        jogo.audio.desbloquear();
        esconderTitulo();
        jogo.novoJogo();
      };
      titulo.appendChild(novo);
      if (temSalvamento) {
        const cont = document.createElement('button');
        cont.textContent = 'Continuar';
        cont.onclick = () => {
          jogo.audio.desbloquear();
          esconderTitulo();
          jogo.continuar();
        };
        titulo.appendChild(cont);
      }
      raiz.appendChild(titulo);
    },
    mostrarDerrota() {
      const d = document.createElement('div');
      d.className = 'titulo-provisorio';
      const b = document.createElement('button');
      b.textContent = 'Tentar de novo';
      b.onclick = () => {
        d.remove();
        jogo.renascer();
      };
      d.appendChild(b);
      raiz.appendChild(d);
    },
    alternarPausa() {},
    alternarMapa() {},
    menuAberto: () => titulo !== null,
  };
}
