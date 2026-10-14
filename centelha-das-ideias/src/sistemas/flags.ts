import type { Condicao } from '../contratos/base';
import type { Flags } from '../contratos/jogo';

/** Flags de progresso (todas booleanas) com avaliação de condições. */
export class FlagsJogo implements Flags {
  private valores: Record<string, boolean> = {};
  aoMudar: ((flag: string, valor: boolean) => void) | null = null;

  obter(flag: string): boolean {
    return this.valores[flag] === true;
  }

  definir(flag: string, valor = true): void {
    if (this.obter(flag) === valor) return;
    if (valor) this.valores[flag] = true;
    else delete this.valores[flag];
    this.aoMudar?.(flag, valor);
  }

  avaliar(c: Condicao | undefined): boolean {
    if (!c) return true;
    if ('flag' in c) return this.obter(c.flag) === (c.valor ?? true);
    if ('todas' in c) return c.todas.every((x) => this.avaliar(x));
    if ('alguma' in c) return c.alguma.some((x) => this.avaliar(x));
    if ('nao' in c) return !this.avaliar(c.nao);
    return true;
  }

  todas(): Record<string, boolean> {
    return { ...this.valores };
  }

  carregar(valores: Record<string, boolean>): void {
    this.valores = {};
    for (const [k, v] of Object.entries(valores)) if (v) this.valores[k] = true;
  }
}
