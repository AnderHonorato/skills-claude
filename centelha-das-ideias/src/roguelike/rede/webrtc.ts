/**
 * Conexão direta entre aparelhos com WebRTC, sem servidor de jogo: quem cria a
 * sala gera um código de convite; quem entra cola (ou lê o QR) e devolve um
 * código de resposta. Depois disso os dados vão direto pelo Wi-Fi.
 */
import type { Canal, Mensagem } from './canal';
import { codificar, decodificar } from './codigo';

const CONFIG: RTCConfiguration = {
  // na mesma rede os endereços locais bastam; o STUN ajuda quando o roteador isola aparelhos
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export function webrtcDisponivel(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

/** Espera os candidatos de rede (no máximo `ms`), para o código já levar tudo. */
function esperarCandidatos(pc: RTCPeerConnection, ms = 2500): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((ok) => {
    const fim = () => {
      pc.removeEventListener('icegatheringstatechange', mudou);
      clearTimeout(t);
      ok();
    };
    const mudou = () => {
      if (pc.iceGatheringState === 'complete') fim();
    };
    pc.addEventListener('icegatheringstatechange', mudou);
    const t = setTimeout(fim, ms);
  });
}

class CanalWebRtc implements Canal {
  aoFechar: () => void = () => {};
  private fechado = false;
  /** Mensagens que chegaram antes de alguém começar a ouvir. */
  private fila: Mensagem[] = [];
  private ouvinte: ((m: Mensagem) => void) | null = null;

  constructor(
    private pc: RTCPeerConnection,
    private confiavel: RTCDataChannel,
    private rapido: RTCDataChannel | null
  ) {
    confiavel.onmessage = (e) => this.receber(e);
    if (rapido) this.adicionarRapido(rapido);
    confiavel.onclose = () => this.fechar();
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.fechar();
    });
  }

  get aoMensagem(): (m: Mensagem) => void {
    return (m) => this.ouvinte?.(m);
  }

  set aoMensagem(fn: (m: Mensagem) => void) {
    this.ouvinte = fn;
    const pendentes = this.fila;
    this.fila = [];
    for (const m of pendentes) fn(m);
  }

  adicionarRapido(dc: RTCDataChannel): void {
    this.rapido = dc;
    dc.onmessage = (e) => this.receber(e);
  }

  private receber(e: MessageEvent): void {
    let m: Mensagem;
    try {
      m = JSON.parse(String(e.data)) as Mensagem;
    } catch {
      return;
    }
    if (this.ouvinte) this.ouvinte(m);
    else if (this.fila.length < 200) this.fila.push(m);
  }

  enviar(m: Mensagem, rapido = false): void {
    if (this.fechado) return;
    const texto = JSON.stringify(m);
    const dc = rapido && this.rapido?.readyState === 'open' ? this.rapido : this.confiavel;
    if (dc.readyState !== 'open') return;
    // não deixa a fila crescer sem fim se a rede engasgar (posições velhas não importam)
    if (rapido && dc.bufferedAmount > 256 * 1024) return;
    try {
      dc.send(texto);
    } catch {
      /* canal fechando */
    }
  }

  aberto(): boolean {
    return !this.fechado && this.confiavel.readyState === 'open';
  }

  fechar(): void {
    if (this.fechado) return;
    this.fechado = true;
    try {
      this.confiavel.close();
      this.rapido?.close();
      this.pc.close();
    } catch {
      /* já fechado */
    }
    this.aoFechar();
  }
}

function quandoAberto(dc: RTCDataChannel): Promise<void> {
  if (dc.readyState === 'open') return Promise.resolve();
  return new Promise((ok, erro) => {
    dc.addEventListener('open', () => ok(), { once: true });
    dc.addEventListener('error', () => erro(new Error('O canal falhou.')), { once: true });
  });
}

function comPrazo<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((ok, erro) => {
    const t = setTimeout(() => erro(new Error(msg)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        ok(v);
      },
      (e) => {
        clearTimeout(t);
        erro(e);
      }
    );
  });
}

/** Lado de quem cria a sala: um convite por pessoa. */
export class ConviteWebRtc {
  readonly pc = new RTCPeerConnection(CONFIG);
  private confiavel = this.pc.createDataChannel('r', { ordered: true });
  private rapido = this.pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 });

  /** Gera o código de convite para mostrar/compartilhar. */
  async criarCodigo(): Promise<string> {
    await this.pc.setLocalDescription(await this.pc.createOffer());
    await esperarCandidatos(this.pc);
    return codificar(JSON.stringify({ t: 'o', sdp: this.pc.localDescription!.sdp }));
  }

  /** Recebe o código de resposta de quem entrou e abre o canal. */
  async aceitarResposta(codigo: string): Promise<Canal> {
    const dados = JSON.parse(await decodificar(codigo)) as { t: string; sdp: string };
    if (dados.t !== 'a') throw new Error('Esse é um código de convite, não de resposta.');
    await this.pc.setRemoteDescription({ type: 'answer', sdp: dados.sdp });
    await comPrazo(
      quandoAberto(this.confiavel),
      15000,
      'Não conectou. Vocês estão no mesmo Wi-Fi?'
    );
    return new CanalWebRtc(this.pc, this.confiavel, this.rapido);
  }

  cancelar(): void {
    this.pc.close();
  }
}

/** Lado de quem entra: lê o convite, gera a resposta e espera o canal abrir. */
export async function responderConvite(
  codigoConvite: string
): Promise<{ codigoResposta: string; canal: Promise<Canal>; cancelar: () => void }> {
  const dados = JSON.parse(await decodificar(codigoConvite)) as { t: string; sdp: string };
  if (dados.t !== 'o') throw new Error('Esse é um código de resposta. Cole o código de convite.');
  const pc = new RTCPeerConnection(CONFIG);
  let canalPronto: CanalWebRtc | null = null;
  let rapidoAntes: RTCDataChannel | null = null;
  const chegou = new Promise<RTCDataChannel>((ok) => {
    pc.ondatachannel = (e) => {
      if (e.channel.label === 'u') {
        if (canalPronto) canalPronto.adicionarRapido(e.channel);
        else rapidoAntes = e.channel;
      } else if (e.channel.label === 'r') {
        // cria o canal já, para nenhuma mensagem se perder antes de alguém ouvir
        canalPronto = new CanalWebRtc(pc, e.channel, rapidoAntes);
        ok(e.channel);
      }
    };
  });
  await pc.setRemoteDescription({ type: 'offer', sdp: dados.sdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await esperarCandidatos(pc);
  const codigoResposta = await codificar(JSON.stringify({ t: 'a', sdp: pc.localDescription!.sdp }));
  const canal = comPrazo(
    (async () => {
      const r = await chegou;
      await quandoAberto(r);
      return canalPronto as unknown as Canal;
    })(),
    120000,
    'O anfitrião não usou o seu código a tempo.'
  );
  return { codigoResposta, canal, cancelar: () => pc.close() };
}
