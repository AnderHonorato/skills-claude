import type { MapaEventos, NomeEvento } from '../contratos/eventos';

type Ouvinte<N extends NomeEvento> = (dados: MapaEventos[N]) => void;

/** Barramento de eventos tipado. Erros em ouvintes não derrubam o jogo. */
export class BarramentoEventos {
  private ouvintes = new Map<NomeEvento, Set<Ouvinte<NomeEvento>>>();

  ouvir<N extends NomeEvento>(nome: N, fn: Ouvinte<N>): () => void {
    let lista = this.ouvintes.get(nome);
    if (!lista) {
      lista = new Set();
      this.ouvintes.set(nome, lista);
    }
    lista.add(fn as Ouvinte<NomeEvento>);
    return () => lista!.delete(fn as Ouvinte<NomeEvento>);
  }

  emitir<N extends NomeEvento>(nome: N, dados: MapaEventos[N]): void {
    const lista = this.ouvintes.get(nome);
    if (!lista) return;
    for (const fn of [...lista]) {
      try {
        (fn as Ouvinte<N>)(dados);
      } catch (erro) {
        console.error(`[eventos] erro no ouvinte de "${nome}"`, erro);
      }
    }
  }

  limpar(): void {
    this.ouvintes.clear();
  }
}
