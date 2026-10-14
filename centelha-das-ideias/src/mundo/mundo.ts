import { BLOCO } from '../configuracao';
import type { ConsultaMapa } from '../contratos/arte';
import type { IdRegiao, IdTema, Vetor } from '../contratos/base';
import type { DefinicaoMundo, DefinicaoRegiao } from '../contratos/dados';
import type { Mundo } from '../contratos/jogo';
import { hash2 } from '../motor/matematica';
import { CODIGO_FRONTEIRA, infoBloco } from './tiles';

/**
 * Grade única do mundo, montada a partir das regiões cadastradas em src/dados/mundo.ts.
 * Fora de qualquer região há vazio. A fronteira em desenvolvimento é aplicada aqui a partir
 * de `definicao.fronteira` (única fonte de verdade).
 */
export class MundoJogo implements Mundo {
  readonly definicao: DefinicaoMundo;
  readonly tamanhoBloco = BLOCO;
  readonly larguraBlocos: number;
  readonly alturaBlocos: number;
  readonly larguraPx: number;
  readonly alturaPx: number;
  readonly consulta: ConsultaMapa;

  private blocos: string[];
  private originais: string[];
  private regiaoIndice: Int16Array;
  private regioes: DefinicaoRegiao[];
  private sobreposicoes = new Map<number, { codigo: string; dono: string }>();
  /** Blocos alterados permanentemente (salvos). Chave "tx,ty". */
  readonly alterados = new Map<string, string>();
  private restauradas = new Set<IdRegiao>();
  /** Notificado quando blocos mudam (para redesenhar o chão). */
  aoMudarBloco: ((tx: number, ty: number) => void) | null = null;
  aoMudarRegiao: ((regiao: IdRegiao) => void) | null = null;

  constructor(definicao: DefinicaoMundo) {
    this.definicao = definicao;
    this.regioes = definicao.regioes;
    let largura = 0;
    let altura = 0;
    for (const r of this.regioes) {
      const linhas = r.mapa;
      const w = Math.max(...linhas.map((l) => l.length));
      largura = Math.max(largura, r.origem.x + w);
      altura = Math.max(altura, r.origem.y + linhas.length);
    }
    const f = definicao.fronteira.area;
    largura = Math.max(largura, f.x + f.largura + 2);
    altura = Math.max(altura, f.y + f.altura + 2);
    this.larguraBlocos = largura;
    this.alturaBlocos = altura;
    this.larguraPx = largura * BLOCO;
    this.alturaPx = altura * BLOCO;
    this.blocos = new Array(largura * altura).fill(' ');
    this.regiaoIndice = new Int16Array(largura * altura).fill(-1);
    this.regioes.forEach((r, indice) => {
      r.mapa.forEach((linha, y) => {
        for (let x = 0; x < linha.length; x++) {
          const tx = r.origem.x + x;
          const ty = r.origem.y + y;
          const i = ty * largura + tx;
          const c = linha[x]!;
          if (c !== ' ' || this.regiaoIndice[i] === -1) {
            this.blocos[i] = c;
          }
          if (c !== ' ') this.regiaoIndice[i] = indice;
        }
      });
    });
    this.aplicarFronteira();
    this.originais = [...this.blocos];
    this.consulta = this.criarConsulta();
  }

  private aplicarFronteira(): void {
    const f = this.definicao.fronteira.area;
    for (let ty = f.y; ty < f.y + f.altura; ty++) {
      for (let tx = f.x; tx < f.x + f.largura; tx++) {
        if (!this.dentro(tx, ty)) continue;
        this.blocos[ty * this.larguraBlocos + tx] = CODIGO_FRONTEIRA;
      }
    }
  }

  private criarConsulta(): ConsultaMapa {
    const mundo = this;
    return {
      largura: this.larguraBlocos,
      altura: this.alturaBlocos,
      tamanhoBloco: BLOCO,
      bloco: (tx, ty) => mundo.codigoEm(tx, ty),
      tema: (tx, ty) => mundo.temaEm(tx, ty),
      regiao: (tx, ty) => mundo.regiaoDoBloco(tx, ty),
      alturaChao: (tx, ty) => infoBloco(mundo.codigoEm(tx, ty)).alturaChao,
      restaurada: (r) => (r ? mundo.restaurada(r) : true),
      semente: (tx, ty, canal = 0) => hash2(tx, ty, canal),
    };
  }

  dentro(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.larguraBlocos && ty < this.alturaBlocos;
  }

  regiaoPorId(id: IdRegiao): DefinicaoRegiao | undefined {
    return this.regioes.find((r) => r.id === id);
  }

  regiaoDoBloco(tx: number, ty: number): IdRegiao | null {
    if (!this.dentro(tx, ty)) return null;
    const i = this.regiaoIndice[ty * this.larguraBlocos + tx]!;
    if (i >= 0) return this.regioes[i]!.id;
    // Blocos vazios herdam a região do retângulo que os contém (para tema do fundo).
    for (const r of this.regioes) {
      const w = r.mapa[0]?.length ?? 0;
      if (
        tx >= r.origem.x &&
        ty >= r.origem.y &&
        tx < r.origem.x + w &&
        ty < r.origem.y + r.mapa.length
      ) {
        return r.id;
      }
    }
    return null;
  }

  temaEm(tx: number, ty: number): IdTema {
    const f = this.definicao.fronteira.area;
    if (tx >= f.x - 1 && tx <= f.x + f.largura && ty >= f.y - 1 && ty <= f.y + f.altura) {
      if (this.codigoEm(tx, ty) === CODIGO_FRONTEIRA) return 'construcao';
    }
    const r = this.regiaoDoBloco(tx, ty);
    return (r ? this.regiaoPorId(r)?.tema : undefined) ?? 'jardim';
  }

  regiaoEm(x: number, y: number): IdRegiao | null {
    return this.regiaoDoBloco(Math.floor(x / BLOCO), Math.floor(y / BLOCO));
  }

  localParaMundo(regiao: IdRegiao, x: number, y: number): Vetor {
    const r = this.regiaoPorId(regiao);
    const ox = r?.origem.x ?? 0;
    const oy = r?.origem.y ?? 0;
    return { x: (ox + x + 0.5) * BLOCO, y: (oy + y + 0.5) * BLOCO };
  }

  bloco(x: number, y: number): { tx: number; ty: number } {
    return { tx: Math.floor(x / BLOCO), ty: Math.floor(y / BLOCO) };
  }

  codigoEm(tx: number, ty: number): string {
    if (!this.dentro(tx, ty)) return ' ';
    const i = ty * this.larguraBlocos + tx;
    const s = this.sobreposicoes.get(i);
    return s ? s.codigo : this.blocos[i]!;
  }

  alturaChaoEm(x: number, y: number): number {
    const tx = Math.floor(x / BLOCO);
    const ty = Math.floor(y / BLOCO);
    const info = infoBloco(this.codigoEm(tx, ty));
    if (!info.chao) {
      const extra = this.superficieExtra(x, y);
      if (extra !== null) return extra;
    }
    return info.alturaChao;
  }

  temChao(x: number, y: number): boolean {
    if (infoBloco(this.codigoEm(Math.floor(x / BLOCO), Math.floor(y / BLOCO))).chao) return true;
    return this.superficieExtra(x, y) !== null;
  }

  private superficies: ((x: number, y: number) => number | null)[] = [];

  adicionarSuperficie(fn: (x: number, y: number) => number | null): () => void {
    this.superficies.push(fn);
    return () => {
      this.superficies = this.superficies.filter((f) => f !== fn);
    };
  }

  private superficieExtra(x: number, y: number): number | null {
    for (const fn of this.superficies) {
      const h = fn(x, y);
      if (h !== null) return h;
    }
    return null;
  }

  passavel(tx: number, ty: number, alturaAbs: number): boolean {
    const info = infoBloco(this.codigoEm(tx, ty));
    if (!info.chao) return true; // vão: dá para "andar" e cair
    if (info.obstaculo === Number.POSITIVE_INFINITY) return false;
    const topo = info.alturaChao + info.obstaculo;
    return alturaAbs >= topo - 2;
  }

  bloqueiaVisaoEm(tx: number, ty: number): boolean {
    return !!infoBloco(this.codigoEm(tx, ty)).bloqueiaVisao;
  }

  linhaDeVisao(a: Vetor, b: Vetor): boolean {
    // Amostra a reta a cada 6 px; ignora os blocos de origem e destino.
    const inicio = this.bloco(a.x, a.y);
    const final = this.bloco(b.x, b.y);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const passos = Math.max(1, Math.ceil(dist / 6));
    for (let i = 1; i < passos; i++) {
      const t = i / passos;
      const tx = Math.floor((a.x + (b.x - a.x) * t) / BLOCO);
      const ty = Math.floor((a.y + (b.y - a.y) * t) / BLOCO);
      if ((tx === inicio.tx && ty === inicio.ty) || (tx === final.tx && ty === final.ty)) continue;
      if (this.bloqueiaVisaoEm(tx, ty)) return false;
    }
    return true;
  }

  definirBloco(tx: number, ty: number, codigo: string, permanente = false): void {
    if (!this.dentro(tx, ty)) return;
    const i = ty * this.larguraBlocos + tx;
    if (this.blocos[i] === CODIGO_FRONTEIRA) return; // a fronteira só muda pelos dados
    this.blocos[i] = codigo;
    if (permanente) this.alterados.set(`${tx},${ty}`, codigo);
    this.aoMudarBloco?.(tx, ty);
  }

  /** Reaplica alterações permanentes vindas do salvamento. */
  aplicarAlterados(alterados: Record<string, string>): void {
    for (const [chave, codigo] of Object.entries(alterados)) {
      const [sx, sy] = chave.split(',');
      const tx = Number(sx);
      const ty = Number(sy);
      if (!Number.isFinite(tx) || !Number.isFinite(ty)) continue;
      this.definirBloco(tx, ty, codigo, true);
    }
  }

  /** Volta ao mapa original (novo jogo). */
  reiniciar(): void {
    this.blocos = [...this.originais];
    this.sobreposicoes.clear();
    this.alterados.clear();
    this.restauradas.clear();
  }

  sobrepor(tx: number, ty: number, codigo: string | null, dono: string): void {
    if (!this.dentro(tx, ty)) return;
    const i = ty * this.larguraBlocos + tx;
    if (this.blocos[i] === CODIGO_FRONTEIRA) return; // nada atravessa a fronteira
    const atual = this.sobreposicoes.get(i);
    if (codigo === null) {
      if (atual && atual.dono === dono) {
        this.sobreposicoes.delete(i);
        this.aoMudarBloco?.(tx, ty);
      }
      return;
    }
    this.sobreposicoes.set(i, { codigo, dono });
    this.aoMudarBloco?.(tx, ty);
  }

  restaurada(regiao: IdRegiao): boolean {
    const def = this.regiaoPorId(regiao);
    if (!def?.comRuido) return true;
    return this.restauradas.has(regiao);
  }

  marcarRestaurada(regiao: IdRegiao, valor: boolean): void {
    const tinha = this.restauradas.has(regiao);
    if (valor) this.restauradas.add(regiao);
    else this.restauradas.delete(regiao);
    if (tinha !== valor) this.aoMudarRegiao?.(regiao);
  }

  fronteiraPx(): { x: number; y: number; largura: number; altura: number } {
    const f = this.definicao.fronteira.area;
    return { x: f.x * BLOCO, y: f.y * BLOCO, largura: f.largura * BLOCO, altura: f.altura * BLOCO };
  }

  /** Bloco seguro para ficar parado (chão de nível 0..alto, sem obstáculo). */
  blocoSeguro(tx: number, ty: number): boolean {
    const c = this.codigoEm(tx, ty);
    const info = infoBloco(c);
    if (!info.chao || info.obstaculo > 0 || info.agua) return false;
    if (c === 'L' || c === 'i') return false;
    return true;
  }

  pontoSeguroProximo(x: number, y: number): Vetor {
    const { tx, ty } = this.bloco(x, y);
    for (let raio = 0; raio < 40; raio++) {
      for (let dy = -raio; dy <= raio; dy++) {
        for (let dx = -raio; dx <= raio; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== raio) continue;
          const bx = tx + dx;
          const by = ty + dy;
          if (this.blocoSeguro(bx, by) && this.vizinhosSeguros(bx, by) >= 3) {
            return { x: (bx + 0.5) * BLOCO, y: (by + 0.5) * BLOCO };
          }
        }
      }
    }
    return { x, y };
  }

  private vizinhosSeguros(tx: number, ty: number): number {
    let n = 0;
    if (this.blocoSeguro(tx + 1, ty)) n++;
    if (this.blocoSeguro(tx - 1, ty)) n++;
    if (this.blocoSeguro(tx, ty + 1)) n++;
    if (this.blocoSeguro(tx, ty - 1)) n++;
    return n;
  }

  /** Distância (em blocos) até a fronteira atual ou anteriores. */
  distanciaFronteiras(x: number, y: number): number {
    const tx = x / BLOCO;
    const ty = y / BLOCO;
    let menor = Infinity;
    for (const f of [this.definicao.fronteira, ...this.definicao.fronteirasAnteriores]) {
      const a = f.area;
      const dx = Math.max(a.x - tx, 0, tx - (a.x + a.largura));
      const dy = Math.max(a.y - ty, 0, ty - (a.y + a.altura));
      menor = Math.min(menor, Math.hypot(dx, dy));
    }
    return menor;
  }
}
