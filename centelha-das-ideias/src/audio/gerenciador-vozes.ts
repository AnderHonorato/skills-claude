/**
 * Contabilidade de vozes (lógica pura, sem Web Audio): limite global de vozes
 * simultâneas, limite por som, intervalo mínimo entre repetições e escolha de
 * qual voz roubar quando falta espaço.
 */

export interface RegistroVoz {
  id: number;
  som: string;
  inicio: number;
  fim: number;
  prioridade: number;
}

export interface ResultadoAlocacao {
  /** Voz criada (null = pedido recusado). */
  voz: RegistroVoz | null;
  /** Vozes que devem ser silenciadas para abrir espaço. */
  roubadas: RegistroVoz[];
}

export class GerenciadorVozes {
  private vozes: RegistroVoz[] = [];
  private ultimoInicio = new Map<string, number>();
  private proximoId = 1;

  constructor(readonly maxVozes = 24) {}

  /** Remove e retorna as vozes já terminadas. */
  coletar(agora: number): RegistroVoz[] {
    const terminadas: RegistroVoz[] = [];
    const vivas: RegistroVoz[] = [];
    for (const v of this.vozes) (v.fim <= agora ? terminadas : vivas).push(v);
    this.vozes = vivas;
    return terminadas;
  }

  ativas(): number {
    return this.vozes.length;
  }

  contar(som: string): number {
    let n = 0;
    for (const v of this.vozes) if (v.som === som) n++;
    return n;
  }

  /** O mesmo som pode tocar de novo agora? (intervalo mínimo entre repetições) */
  podeRepetir(som: string, agora: number, intervalo: number): boolean {
    const u = this.ultimoInicio.get(som);
    return u === undefined || agora < u || agora - u >= intervalo - 1e-9;
  }

  /**
   * Reserva uma voz. Se o som já tem `maxIguais` instâncias, rouba a mais antiga
   * dele; se o total chegou ao limite, rouba a de menor prioridade (a mais antiga
   * entre as de mesma prioridade) — ou recusa, se todas forem mais importantes.
   */
  alocar(som: string, agora: number, prioridade: number, maxIguais: number): ResultadoAlocacao {
    const roubadas: RegistroVoz[] = [];
    const iguais = this.vozes.filter((v) => v.som === som);
    if (iguais.length >= Math.max(1, maxIguais)) {
      let antiga = iguais[0];
      for (const v of iguais) if (v.inicio < antiga.inicio) antiga = v;
      roubadas.push(antiga);
    } else if (this.vozes.length >= this.maxVozes) {
      let vitima: RegistroVoz | null = null;
      for (const v of this.vozes) {
        if (
          !vitima ||
          v.prioridade < vitima.prioridade ||
          (v.prioridade === vitima.prioridade && v.inicio < vitima.inicio)
        )
          vitima = v;
      }
      if (!vitima || vitima.prioridade > prioridade) return { voz: null, roubadas: [] };
      roubadas.push(vitima);
    }
    if (roubadas.length) this.vozes = this.vozes.filter((v) => !roubadas.includes(v));
    const voz: RegistroVoz = {
      id: this.proximoId++,
      som,
      inicio: agora,
      fim: agora + 0.1,
      prioridade,
    };
    this.vozes.push(voz);
    this.ultimoInicio.set(som, agora);
    return { voz, roubadas };
  }

  remover(id: number): void {
    this.vozes = this.vozes.filter((v) => v.id !== id);
  }

  limpar(): void {
    this.vozes = [];
    this.ultimoInicio.clear();
  }
}
