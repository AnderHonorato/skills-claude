/**
 * Painel "Jogar junto (mesmo Wi-Fi)": criar sala, convidar e entrar.
 *
 * - Com o servidor de rede local (`pnpm lan`): um toque em "Criar sala" e os outros
 *   tocam em "Entrar" — sem códigos.
 * - Sem servidor (link do jogo ou arquivo): conexão direta WebRTC. Quem cria a sala
 *   gera um código de convite (texto ou QR); quem entra cola esse código e devolve um
 *   código de resposta. Depois disso os dados vão direto pelo Wi-Fi.
 */
import { renderSVG } from 'uqr';
import { PERSONAGENS } from './dados/personagens';
import type { Partida } from './jogo/partida';
import { CORES_JOGADOR } from './jogo/jogador';
import { enderecoLan, entrarLan, hospedarLan, servidorLanDisponivel } from './rede/lan';
import { Sessao } from './rede/sessao';
import { ConviteWebRtc, responderConvite, webrtcDisponivel } from './rede/webrtc';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe?: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(texto: string, classe = 'rg-botao', acao?: () => void): HTMLButtonElement {
  const b = el('button', classe, texto);
  b.type = 'button';
  if (acao) b.addEventListener('click', acao);
  return b;
}

/** Copia texto mesmo dentro de páginas incorporadas (onde a API de área de transferência falha). */
async function copiar(texto: string, area?: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    if (!area) return false;
    area.focus();
    area.select();
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

type DetectorQr = { detect(fonte: CanvasImageSource): Promise<{ rawValue: string }[]> };

function podeLerQr(): boolean {
  return 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia;
}

export class PainelSala {
  readonly raiz = el('div', 'rg-sala');
  sessao: Sessao | null = null;
  /** Avisa a interface principal (o menu muda quando há sala). */
  aoMudar: () => void = () => {};
  private convite: ConviteWebRtc | null = null;
  private cancelarEntrada: (() => void) | null = null;
  private fecharLan: (() => void) | null = null;
  private camera: MediaStream | null = null;

  constructor(private partida: Partida) {
    this.raiz.hidden = true;
  }

  get aberto(): boolean {
    return !this.raiz.hidden;
  }

  abrir(): void {
    this.raiz.hidden = false;
    if (this.sessao) this.telaSala();
    else this.telaInicio();
  }

  fechar(): void {
    this.pararCamera();
    this.raiz.hidden = true;
    this.aoMudar();
  }

  private caixa(titulo: string, sub?: string): HTMLElement {
    this.pararCamera();
    this.raiz.replaceChildren();
    const fundo = el('div', 'rg-sala-fundo');
    const c = el('div', 'rg-caixa rg-caixa-sala');
    c.append(el('h2', undefined, titulo));
    if (sub) c.append(el('p', 'rg-sala-sub', sub));
    fundo.append(c);
    this.raiz.append(fundo);
    return c;
  }

  private erro(c: HTMLElement, msg: string): void {
    c.querySelector('.rg-sala-erro')?.remove();
    c.append(el('p', 'rg-sala-erro', msg));
  }

  // ------------------------------------------------------------------ início

  private telaInicio(): void {
    const lan = servidorLanDisponivel();
    const c = this.caixa(
      'Jogar junto',
      lan
        ? 'Todos no mesmo Wi-Fi abrindo este endereço. Uma pessoa cria a sala; as outras entram.'
        : 'Até 4 pessoas no mesmo Wi-Fi, cada uma no seu celular ou PC. Uma pessoa cria a sala e convida as outras.'
    );
    if (!lan && !webrtcDisponivel()) {
      this.erro(c, 'Este navegador não permite conexão direta entre aparelhos.');
      c.append(botao('Fechar', 'rg-botao', () => this.fechar()));
      return;
    }
    const acoes = el('div', 'rg-sala-acoes');
    acoes.append(
      botao('Criar sala', 'rg-botao principal', () => void this.criarSala()),
      botao(
        'Entrar numa sala',
        'rg-botao principal',
        () => void (lan ? this.entrarLan() : this.telaEntrar())
      )
    );
    c.append(acoes);
    if (lan) {
      const end = enderecoLan();
      const qr = el('div', 'rg-sala-qr');
      qr.innerHTML = renderSVG(end, { ecc: 'M', border: 2 });
      c.append(
        el('p', 'rg-sala-sub', 'Endereço para os outros abrirem (ou leiam o QR com a câmera):'),
        qr,
        el('code', 'rg-sala-endereco', end)
      );
    } else
      c.append(
        el(
          'p',
          'rg-sala-dica',
          'Dica: sem códigos? Rode "pnpm lan" num computador do Wi-Fi e todos abrem o endereço que ele mostrar.'
        )
      );
    c.append(botao('Voltar', 'rg-botao', () => this.fechar()));
  }

  private novaSessao(papel: 'anfitriao' | 'convidado'): Sessao {
    const s = new Sessao(this.partida, papel);
    s.aoMudar = () => {
      if (this.aberto && this.partida.estado === 'menu') this.telaSala();
      this.aoMudar();
    };
    s.aoEncerrar = (motivo) => {
      this.sessao = null;
      this.fecharLan?.();
      this.fecharLan = null;
      this.raiz.hidden = false;
      const c = this.caixa('Sala encerrada', motivo);
      c.append(botao('Ok', 'rg-botao principal', () => this.fechar()));
      this.aoMudar();
    };
    this.sessao = s;
    return s;
  }

  private async criarSala(): Promise<void> {
    const s = this.novaSessao('anfitriao');
    if (servidorLanDisponivel()) {
      try {
        this.fecharLan = await hospedarLan((canal) => s.adicionarConvidado(canal));
      } catch (e) {
        this.sessao = null;
        const c = this.caixa('Não deu certo');
        this.erro(c, (e as Error).message);
        c.append(botao('Voltar', 'rg-botao', () => this.telaInicio()));
        return;
      }
    }
    this.telaSala();
    this.aoMudar();
  }

  private async entrarLan(): Promise<void> {
    const c = this.caixa('Entrando…');
    try {
      const canal = await entrarLan();
      const s = this.novaSessao('convidado');
      s.conectar(canal);
      this.telaSala();
      this.aoMudar();
    } catch (e) {
      this.erro(c, (e as Error).message);
      c.append(botao('Voltar', 'rg-botao', () => this.telaInicio()));
    }
  }

  // ------------------------------------------------------------------ sala

  private telaSala(): void {
    const s = this.sessao;
    if (!s) return this.telaInicio();
    const anfitriao = s.papel === 'anfitriao';
    const c = this.caixa(
      anfitriao ? 'Sua sala' : 'Você está na sala',
      anfitriao
        ? 'Convide as pessoas e toque em "Começar". Cada um escolhe o personagem no próprio aparelho.'
        : 'Escolha seu personagem no menu. O anfitrião começa a partida.'
    );
    const lista = el('div', 'rg-sala-lista');
    for (let k = 0; k < 4; k++) {
      const m = s.membros.find((x) => x.indice === k);
      const linha = el('div', m ? 'rg-sala-membro' : 'rg-sala-membro vazio');
      linha.style.setProperty('--cor', CORES_JOGADOR[k]);
      const def = m ? PERSONAGENS.find((d) => d.id === m.personagem) : null;
      linha.append(
        el('span', 'rg-sala-etiqueta', `J${k + 1}`),
        el(
          'span',
          undefined,
          m
            ? `${def?.nome ?? m.personagem}${k === s.meuIndice ? ' (você)' : ''}${k === 0 ? ' · anfitrião' : ''}`
            : 'vaga livre'
        )
      );
      lista.append(linha);
    }
    c.append(lista);
    const acoes = el('div', 'rg-sala-acoes');
    if (anfitriao) {
      if (!servidorLanDisponivel() && s.membros.length < 4)
        acoes.append(botao('Convidar alguém', 'rg-botao', () => void this.telaConvidar()));
      const comecar = botao(
        s.membros.length > 1
          ? `Começar com ${s.membros.length} jogadores`
          : 'Começar (sozinho por enquanto)',
        'rg-botao principal',
        () => {
          this.fechar();
          s.iniciarPartida();
        }
      );
      acoes.append(comecar);
    }
    acoes.append(botao('Escolher personagem', 'rg-botao', () => this.fechar()));
    c.append(acoes);
    if (servidorLanDisponivel() && anfitriao)
      c.append(el('p', 'rg-sala-dica', `Os outros abrem ${enderecoLan()} e tocam em "Entrar".`));
    c.append(
      botao(anfitriao ? 'Fechar a sala' : 'Sair da sala', 'rg-botao perigo', () => {
        s.sair();
      })
    );
  }

  // ------------------------------------------------------------------ convite (WebRTC)

  private blocoCodigo(c: HTMLElement, codigo: string, titulo: string): void {
    c.append(el('p', 'rg-sala-passo', titulo));
    const qr = el('div', 'rg-sala-qr');
    qr.innerHTML = renderSVG(codigo, { ecc: 'L', border: 2 });
    const area = el('textarea', 'rg-sala-codigo');
    area.readOnly = true;
    area.value = codigo;
    area.rows = 3;
    area.addEventListener('focus', () => area.select());
    const linha = el('div', 'rg-sala-acoes');
    const copiarB = botao('Copiar código', 'rg-botao', async () => {
      copiarB.textContent = (await copiar(codigo, area)) ? 'Copiado!' : 'Selecione e copie';
    });
    linha.append(copiarB);
    if (typeof navigator.share === 'function')
      linha.append(
        botao('Compartilhar', 'rg-botao', () => {
          navigator.share({ text: codigo }).catch(() => {});
        })
      );
    c.append(qr, area, linha);
  }

  private campoColar(c: HTMLElement, rotulo: string, acao: (texto: string) => Promise<void>): void {
    c.append(el('p', 'rg-sala-passo', rotulo));
    const area = el('textarea', 'rg-sala-codigo');
    area.rows = 3;
    area.placeholder = 'Cole o código aqui';
    const linha = el('div', 'rg-sala-acoes');
    const ok = botao('Conectar', 'rg-botao principal', async () => {
      const t = area.value.trim();
      if (!t) return this.erro(c, 'Cole o código primeiro.');
      ok.disabled = true;
      ok.textContent = 'Conectando…';
      try {
        await acao(t);
      } catch (e) {
        ok.disabled = false;
        ok.textContent = 'Conectar';
        this.erro(c, (e as Error).message || 'Código inválido.');
      }
    });
    linha.append(ok);
    if (podeLerQr())
      linha.append(
        botao('Ler QR com a câmera', 'rg-botao', () => void this.lerQr(c, (t) => (area.value = t)))
      );
    c.append(area, linha);
  }

  private async telaConvidar(): Promise<void> {
    const s = this.sessao;
    if (!s) return;
    const c = this.caixa('Convidar alguém', 'Gerando o código…');
    this.convite?.cancelar();
    const convite = new ConviteWebRtc();
    this.convite = convite;
    let codigo: string;
    try {
      codigo = await convite.criarCodigo();
    } catch (e) {
      this.erro(c, (e as Error).message);
      c.append(botao('Voltar', 'rg-botao', () => this.telaSala()));
      return;
    }
    if (this.convite !== convite) return;
    c.querySelector('.rg-sala-sub')!.textContent =
      'O amigo toca em "Jogar junto → Entrar numa sala" e usa este código. Depois ele te manda um código de resposta.';
    this.blocoCodigo(c, codigo, '1. Mande este código (ou mostre o QR) para o amigo');
    this.campoColar(c, '2. Cole aqui o código de resposta dele', async (t) => {
      const canal = await convite.aceitarResposta(t);
      this.convite = null;
      s.adicionarConvidado(canal);
      this.telaSala();
    });
    c.append(
      botao('Voltar', 'rg-botao', () => {
        convite.cancelar();
        this.convite = null;
        this.telaSala();
      })
    );
  }

  private telaEntrar(): void {
    const c = this.caixa('Entrar numa sala', 'Peça o código de convite para quem criou a sala.');
    this.campoColar(c, '1. Cole o código de convite', async (t) => {
      const r = await responderConvite(t);
      this.cancelarEntrada = r.cancelar;
      const c2 = this.caixa(
        'Quase lá',
        'Agora mande o seu código de resposta para quem criou a sala.'
      );
      this.blocoCodigo(c2, r.codigoResposta, '2. Mande este código de volta (ou mostre o QR)');
      const espera = el('p', 'rg-sala-espera', 'Esperando o anfitrião colar o seu código…');
      c2.append(espera);
      c2.append(
        botao('Cancelar', 'rg-botao', () => {
          r.cancelar();
          this.telaInicio();
        })
      );
      try {
        const canal = await r.canal;
        this.cancelarEntrada = null;
        const s = this.novaSessao('convidado');
        s.conectar(canal);
        this.telaSala();
        this.aoMudar();
      } catch (e) {
        espera.textContent = (e as Error).message;
        espera.classList.add('rg-sala-erro');
      }
    });
    c.append(botao('Voltar', 'rg-botao', () => this.telaInicio()));
  }

  // ------------------------------------------------------------------ atalhos (testes automatizados)

  /** Cria a sala como anfitrião (o mesmo que o botão). */
  async hospedar(): Promise<void> {
    if (!this.sessao) await this.criarSala();
  }

  /** Servidor de rede local: entra na sala aberta. */
  async entrarRedeLocal(): Promise<void> {
    await this.entrarLan();
  }

  /** Anfitrião: gera um convite; `aceitar` recebe o código de resposta. */
  async gerarConvite(): Promise<{ codigo: string; aceitar: (resposta: string) => Promise<void> }> {
    const s = this.sessao;
    if (!s || s.papel !== 'anfitriao') throw new Error('Crie a sala primeiro.');
    const convite = new ConviteWebRtc();
    const codigo = await convite.criarCodigo();
    return {
      codigo,
      aceitar: async (resposta) => {
        s.adicionarConvidado(await convite.aceitarResposta(resposta));
      },
    };
  }

  /** Convidado: usa o convite e devolve o código de resposta (conecta em segundo plano). */
  async entrarComConvite(codigo: string): Promise<string> {
    const r = await responderConvite(codigo);
    void r.canal.then((canal) => {
      const s = this.novaSessao('convidado');
      s.conectar(canal);
      this.aoMudar();
    });
    return r.codigoResposta;
  }

  // ------------------------------------------------------------------ câmera

  private async lerQr(c: HTMLElement, aoLer: (t: string) => void): Promise<void> {
    const Detector = (window as unknown as { BarcodeDetector: new (o: object) => DetectorQr })
      .BarcodeDetector;
    let video: HTMLVideoElement | null = null;
    try {
      this.camera = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      video = el('video', 'rg-sala-camera');
      video.playsInline = true;
      video.muted = true;
      video.srcObject = this.camera;
      c.append(video);
      await video.play();
      const det = new Detector({ formats: ['qr_code'] });
      const fim = Date.now() + 60000;
      while (this.camera && Date.now() < fim) {
        const r = await det.detect(video).catch(() => []);
        if (r[0]?.rawValue) {
          aoLer(r[0].rawValue);
          break;
        }
        await new Promise((ok) => setTimeout(ok, 250));
      }
    } catch {
      this.erro(c, 'Não deu para usar a câmera aqui. Copie e cole o código.');
    }
    this.pararCamera();
    video?.remove();
  }

  private pararCamera(): void {
    this.camera?.getTracks().forEach((t) => t.stop());
    this.camera = null;
  }

  /** Para a interface principal: a sala ainda está aberta no menu? */
  descartarConexoesPendentes(): void {
    this.convite?.cancelar();
    this.convite = null;
    this.cancelarEntrada?.();
    this.cancelarEntrada = null;
  }
}
