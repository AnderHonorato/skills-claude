/**
 * Estado do progresso (puro): flags, contadores, afinidade com NPCs, armas e experiência,
 * habilidades, missões e vida. Avalia condições e aplica efeitos dos diálogos.
 */
import { ARMAS, NIVEL_MAXIMO, nivelPorXp } from '../dados/armas';
import type { Condicao, Efeito, Humor, IdArma, IdHabilidade, IdNpc } from './tipos';

export type AvisoEstado =
  | { tipo: 'arma'; id: IdArma }
  | { tipo: 'nivel'; id: IdArma; nivel: number }
  | { tipo: 'habilidade'; id: IdHabilidade }
  | { tipo: 'missaoNova'; id: string }
  | { tipo: 'missaoConcluida'; id: string }
  | { tipo: 'vidaMaxima'; total: number }
  | { tipo: 'mensagem'; texto: string }
  | { tipo: 'humorClaude'; humor: Humor; duracao: number }
  | { tipo: 'humorNpc'; npc: IdNpc; humor: Humor; duracao: number }
  | { tipo: 'seguir'; npc: IdNpc; ativo: boolean }
  | { tipo: 'afinidade'; npc: IdNpc; valor: number; delta: number }
  | { tipo: 'curar'; quantidade: number };

export class EstadoProgresso {
  flags = new Set<string>();
  contadores: Record<string, number> = {};
  afinidade: Record<IdNpc, number> = { lumi: 0, pipo: 0, bento: 0, eco: 0, vela: 0 };
  armas: Partial<Record<IdArma, { xp: number }>> = {};
  armaAtual: IdArma | null = null;
  habilidades = new Set<IdHabilidade>();
  missoesAtivas: string[] = [];
  missoesConcluidas = new Set<string>();
  vida = 5;
  vidaMaxima = 5;
  /** Ouvinte de avisos (apresentação: HUD, sons, emoções). */
  aoAviso: (a: AvisoEstado) => void = () => {};

  temFlag(f: string): boolean {
    return this.flags.has(f);
  }

  ligar(f: string, valor = true): void {
    if (valor) this.flags.add(f);
    else this.flags.delete(f);
  }

  contador(nome: string): number {
    return this.contadores[nome] ?? 0;
  }

  avaliar(c: Condicao | undefined): boolean {
    if (!c) return true;
    if (c.flag && !this.flags.has(c.flag)) return false;
    if (c.semFlag && this.flags.has(c.semFlag)) return false;
    if (c.afinidadeMin && this.afinidade[c.afinidadeMin[0]] < c.afinidadeMin[1]) return false;
    if (c.afinidadeMax && this.afinidade[c.afinidadeMax[0]] > c.afinidadeMax[1]) return false;
    if (c.temArma && !this.armas[c.temArma]) return false;
    if (c.semArma && this.armas[c.semArma]) return false;
    if (c.temHabilidade && !this.habilidades.has(c.temHabilidade)) return false;
    if (c.missaoAtiva && !this.missoesAtivas.includes(c.missaoAtiva)) return false;
    if (c.missaoConcluida && !this.missoesConcluidas.has(c.missaoConcluida)) return false;
    if (c.contador && this.contador(c.contador[0]) < c.contador[1]) return false;
    if (c.algum && !c.algum.some((s) => this.avaliar(s))) return false;
    return true;
  }

  aplicar(efeitos: Efeito[] | undefined): void {
    if (!efeitos) return;
    for (const e of efeitos) this.aplicarUm(e);
  }

  private aplicarUm(e: Efeito): void {
    switch (e.tipo) {
      case 'flag':
        this.ligar(e.flag, e.valor ?? true);
        break;
      case 'contador':
        this.contadores[e.nome] = this.contador(e.nome) + e.delta;
        break;
      case 'afinidade': {
        const v = Math.max(-5, Math.min(5, this.afinidade[e.npc] + e.delta));
        this.afinidade[e.npc] = v;
        this.aoAviso({ tipo: 'afinidade', npc: e.npc, valor: v, delta: e.delta });
        break;
      }
      case 'iniciarMissao':
        if (!this.missoesAtivas.includes(e.id) && !this.missoesConcluidas.has(e.id)) {
          this.missoesAtivas.push(e.id);
          this.aoAviso({ tipo: 'missaoNova', id: e.id });
        }
        break;
      case 'concluirMissao':
        if (!this.missoesConcluidas.has(e.id)) {
          this.missoesAtivas = this.missoesAtivas.filter((m) => m !== e.id);
          this.missoesConcluidas.add(e.id);
          this.aoAviso({ tipo: 'missaoConcluida', id: e.id });
        }
        break;
      case 'arma':
        this.darArma(e.id);
        break;
      case 'habilidade':
        if (!this.habilidades.has(e.id)) {
          this.habilidades.add(e.id);
          this.aoAviso({ tipo: 'habilidade', id: e.id });
        }
        break;
      case 'vidaMaxima':
        this.vidaMaxima = Math.min(10, this.vidaMaxima + e.delta);
        this.vida = this.vidaMaxima;
        this.aoAviso({ tipo: 'vidaMaxima', total: this.vidaMaxima });
        break;
      case 'curar':
        this.vida = Math.min(this.vidaMaxima, this.vida + e.quantidade);
        this.aoAviso({ tipo: 'curar', quantidade: e.quantidade });
        break;
      case 'xp':
        this.ganharXp(e.quantidade);
        break;
      case 'humorClaude':
        this.aoAviso({ tipo: 'humorClaude', humor: e.humor, duracao: e.duracao ?? 3 });
        break;
      case 'humorNpc':
        this.aoAviso({ tipo: 'humorNpc', npc: e.npc, humor: e.humor, duracao: e.duracao ?? 3 });
        break;
      case 'seguir':
        this.aoAviso({ tipo: 'seguir', npc: e.npc, ativo: e.ativo });
        break;
      case 'mensagem':
        this.aoAviso({ tipo: 'mensagem', texto: e.texto });
        break;
    }
  }

  darArma(id: IdArma): void {
    if (this.armas[id]) return;
    this.armas[id] = { xp: 0 };
    this.armaAtual = id;
    this.aoAviso({ tipo: 'arma', id });
  }

  nivelArma(id: IdArma | null = this.armaAtual): number {
    if (!id) return 0;
    return nivelPorXp(this.armas[id]?.xp ?? 0);
  }

  /** Dá experiência à arma atual; avisa quando sobe de nível. */
  ganharXp(qtd: number, id: IdArma | null = this.armaAtual): void {
    if (!id) return;
    const reg = this.armas[id];
    if (!reg) return;
    const antes = nivelPorXp(reg.xp);
    reg.xp += qtd;
    const depois = nivelPorXp(reg.xp);
    if (depois > antes) this.aoAviso({ tipo: 'nivel', id, nivel: Math.min(NIVEL_MAXIMO, depois) });
  }

  armasObtidas(): IdArma[] {
    return (Object.keys(ARMAS) as IdArma[]).filter((a) => this.armas[a]);
  }
}
