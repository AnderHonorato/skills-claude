/**
 * Canal de mensagens entre dois aparelhos (WebRTC direto pelo Wi-Fi ou o
 * servidor de rede local). As mensagens são objetos JSON.
 */
export type Mensagem = { t: string } & Record<string, unknown>;

export interface Canal {
  /** `rapido`: pode chegar fora de ordem ou se perder (posições). */
  enviar(m: Mensagem, rapido?: boolean): void;
  aoMensagem: (m: Mensagem) => void;
  aoFechar: () => void;
  aberto(): boolean;
  fechar(): void;
}

/** Canal em memória (testes): dois lados ligados diretamente. */
export function parDeCanais(): [Canal, Canal] {
  const criar = (): Canal & { outro?: Canal; vivo: boolean } => ({
    vivo: true,
    enviar(m) {
      const o = this.outro;
      if (!this.vivo || !o) return;
      const copia = JSON.parse(JSON.stringify(m)) as Mensagem;
      queueMicrotask(() => o.aoMensagem(copia));
    },
    aoMensagem: () => {},
    aoFechar: () => {},
    aberto() {
      return this.vivo;
    },
    fechar() {
      if (!this.vivo) return;
      this.vivo = false;
      this.aoFechar();
      this.outro?.fechar();
    },
  });
  const a = criar();
  const b = criar();
  a.outro = b;
  b.outro = a;
  return [a, b];
}
