/**
 * Modo servidor de rede local: um computador roda `pnpm lan` e todos abrem o
 * endereço que ele mostra (http://192.168.x.x:8080). O servidor só repassa as
 * mensagens; quem cria a sala continua sendo o anfitrião da partida.
 */
import type { Canal, Mensagem } from './canal';

export function servidorLanDisponivel(): boolean {
  return (
    typeof document !== 'undefined' && document.querySelector('meta[name="centelha-lan"]') !== null
  );
}

/** Endereço que os outros aparelhos devem abrir (informado pelo servidor). */
export function enderecoLan(): string {
  return (
    document.querySelector('meta[name="centelha-lan"]')?.getAttribute('content') || location.origin
  );
}

function abrirSocket(papel: 'anfitriao' | 'convidado'): Promise<WebSocket> {
  return new Promise((ok, erro) => {
    const ws = new WebSocket(
      `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/rede`
    );
    const t = setTimeout(() => erro(new Error('O servidor da rede local não respondeu.')), 6000);
    ws.onopen = () => {
      clearTimeout(t);
      ws.send(JSON.stringify({ lan: papel }));
      ok(ws);
    };
    ws.onerror = () => {
      clearTimeout(t);
      erro(new Error('Não deu para falar com o servidor da rede local.'));
    };
  });
}

class CanalVirtual implements Canal {
  aoMensagem: (m: Mensagem) => void = () => {};
  aoFechar: () => void = () => {};
  vivo = true;
  constructor(private mandar: (m: Mensagem) => void) {}
  enviar(m: Mensagem): void {
    if (this.vivo) this.mandar(m);
  }
  aberto(): boolean {
    return this.vivo;
  }
  fechar(): void {
    if (!this.vivo) return;
    this.vivo = false;
    this.aoFechar();
  }
}

/** Anfitrião: recebe um canal para cada pessoa que entrar. */
export async function hospedarLan(aoEntrar: (canal: Canal) => void): Promise<() => void> {
  const ws = await abrirSocket('anfitriao');
  const canais = new Map<number, CanalVirtual>();
  ws.onmessage = (e) => {
    let d: { lan: string; id?: number; m?: Mensagem };
    try {
      d = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (d.lan === 'entrou' && d.id !== undefined) {
      const id = d.id;
      const c = new CanalVirtual(
        (m) => ws.readyState === 1 && ws.send(JSON.stringify({ lan: 'msg', para: id, m }))
      );
      canais.set(id, c);
      aoEntrar(c);
    } else if (d.lan === 'saiu' && d.id !== undefined) {
      canais.get(d.id)?.fechar();
      canais.delete(d.id);
    } else if (d.lan === 'msg' && d.id !== undefined && d.m) canais.get(d.id)?.aoMensagem(d.m);
  };
  ws.onclose = () => {
    for (const c of canais.values()) c.fechar();
    canais.clear();
  };
  return () => ws.close();
}

/** Convidado: um canal até o anfitrião. */
export async function entrarLan(): Promise<Canal> {
  const ws = await abrirSocket('convidado');
  return new Promise((ok, erro) => {
    let canal: CanalVirtual | null = null;
    ws.onmessage = (e) => {
      let d: { lan: string; m?: Mensagem };
      try {
        d = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (d.lan === 'aceito') {
        canal = new CanalVirtual(
          (m) => ws.readyState === 1 && ws.send(JSON.stringify({ lan: 'msg', m }))
        );
        ok(canal);
      } else if (d.lan === 'sem-anfitriao') {
        erro(new Error('Ninguém criou uma sala ainda. Peça para alguém tocar em "Criar sala".'));
        ws.close();
      } else if (d.lan === 'msg' && d.m) canal?.aoMensagem(d.m);
    };
    ws.onclose = () => canal?.fechar();
  });
}
