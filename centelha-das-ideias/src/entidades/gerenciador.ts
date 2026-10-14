import type { IdRegiao } from '../contratos/base';
import type { EspecEntidade } from '../contratos/dados';
import type { Entidade } from '../contratos/entidades';
import type { GerenciadorEntidades, Jogo, MapaFabricas } from '../contratos/jogo';

/** Lista de entidades com busca por id e criação a partir de dados via fábricas registradas. */
export class Gerenciador implements GerenciadorEntidades {
  private lista: Entidade[] = [];
  private porIdMapa = new Map<string, Entidade>();
  private fabricas: MapaFabricas = {};
  private contador = 0;

  constructor(private jogo: () => Jogo) {}

  registrarFabricas(f: MapaFabricas): void {
    this.fabricas = { ...this.fabricas, ...f };
  }

  idUnico(prefixo: string): string {
    this.contador++;
    return `${prefixo}#${this.contador}`;
  }

  adicionar<T extends Entidade>(e: T): T {
    if (!e.id) e.id = this.idUnico(e.categoria);
    if (this.porIdMapa.has(e.id)) {
      const antiga = this.porIdMapa.get(e.id)!;
      if (antiga !== e) {
        console.warn(`[entidades] id duplicado "${e.id}" — substituindo`);
        this.remover(antiga);
      }
    }
    this.lista.push(e);
    this.porIdMapa.set(e.id, e);
    return e;
  }

  remover(e: Entidade | string): void {
    const ent = typeof e === 'string' ? this.porIdMapa.get(e) : e;
    if (!ent) return;
    ent.vivo = false;
    this.porIdMapa.delete(ent.id);
  }

  /** Remove definitivamente as entidades mortas (fim do quadro). */
  limparMortas(): void {
    let j = 0;
    for (const e of this.lista) {
      if (e.vivo) this.lista[j++] = e;
      else if (this.porIdMapa.get(e.id) === e) this.porIdMapa.delete(e.id);
    }
    this.lista.length = j;
  }

  removerTodas(filtro: (e: Entidade) => boolean): void {
    for (const e of this.lista) if (filtro(e)) this.remover(e);
    this.limparMortas();
  }

  porId<T extends Entidade = Entidade>(id: string): T | undefined {
    return this.porIdMapa.get(id) as T | undefined;
  }

  todas(): readonly Entidade[] {
    return this.lista;
  }

  categoria(c: Entidade['categoria']): Entidade[] {
    return this.lista.filter((e) => e.vivo && e.categoria === c);
  }

  proximas(x: number, y: number, raio: number, filtro?: (e: Entidade) => boolean): Entidade[] {
    const r2 = raio * raio;
    const resultado: Entidade[] = [];
    for (const e of this.lista) {
      if (!e.vivo) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= r2 && (!filtro || filtro(e))) resultado.push(e);
    }
    return resultado;
  }

  criar(espec: EspecEntidade, regiao: IdRegiao): Entidade[] {
    const jogo = this.jogo();
    const fabrica = this.fabricas[espec.tipo];
    if (!fabrica) {
      console.warn(`[entidades] sem fábrica para "${espec.tipo}"`);
      return [];
    }
    const posicao = jogo.mundo.localParaMundo(regiao, espec.x, espec.y);
    try {
      const r = fabrica(espec, posicao, regiao, jogo);
      const criadas = r === null ? [] : Array.isArray(r) ? r : [r];
      for (const e of criadas) {
        e.regiao = e.regiao ?? regiao;
        this.adicionar(e);
      }
      return criadas;
    } catch (erro) {
      console.error(`[entidades] erro ao criar "${espec.tipo}"`, espec, erro);
      return [];
    }
  }
}
