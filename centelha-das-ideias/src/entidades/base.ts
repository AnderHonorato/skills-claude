/**
 * Entidades simples do núcleo: decoração, luz, placa, gatilho, coletável, arma no chão,
 * Pedra-Memória, baú, santuário e gaiola. (Mecanismos de energia/enigmas ficam em
 * src/sistemas/habilidades; NPCs em src/sistemas/dialogo; inimigos em src/sistemas/combate.)
 */
import { desenharArma } from '../arte/claude';
import { desenharDecoracao, desenharMecanismo } from '../arte/cenario';
import { efeito } from '../arte/efeitos';
import type { TipoMecanismo, VisualMecanismo } from '../contratos/arte';
import type { Acao, Condicao, IdArma, IdHabilidade, IdNpc, Recompensa } from '../contratos/base';
import type { EspecEntidade } from '../contratos/dados';
import type { CategoriaEntidade, Entidade } from '../contratos/entidades';
import type { Jogo, MapaFabricas } from '../contratos/jogo';
import { BLOCO } from '../configuracao';

const NOMES_ARMAS: Record<IdArma, string> = {
  espada: 'Espada de Madeira',
  colher: 'Colher Gigante',
  martelo: 'Martelo de Borracha',
  cajado: 'Cajado de Ideias',
};

export const NOMES_HABILIDADES: Record<IdHabilidade, string> = {
  observar: 'Observar',
  conectar: 'Conectar',
  criar: 'Criar',
};

/** Base para entidades estáticas. */
abstract class EntidadeSimples implements Entidade {
  vivo = true;
  z = 0;
  raio = 10;
  regiao: string | null = null;
  abstract categoria: CategoriaEntidade;
  constructor(
    public id: string,
    public x: number,
    public y: number
  ) {}
  atualizar(_dt: number, _jogo: Jogo): void {}
  abstract desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void;
}

function visualBase(
  jogo: Jogo,
  tipo: TipoMecanismo,
  x: number,
  y: number,
  extra: Partial<VisualMecanismo> = {}
): VisualMecanismo {
  const tema = jogo.mundo.consulta.tema(Math.floor(x / BLOCO), Math.floor(y / BLOCO));
  return {
    tipo,
    x,
    ySolo: y - jogo.mundo.alturaChaoEm(x, y),
    ativo: false,
    energizado: false,
    revelacao: 1,
    oculto: false,
    progresso: 0,
    tempo: jogo.tempo,
    tema,
    destacado: jogo.jogador.alvoInteracao?.id === extra.variante,
    ...extra,
  };
}

// ---------------------------------------------------------------------------

class Decoracao extends EntidadeSimples {
  categoria = 'decoracao' as const;
  raioSombra = 0;
  constructor(
    id: string,
    x: number,
    y: number,
    private modelo: string,
    private escala: number,
    solido: boolean
  ) {
    super(id, x, y);
    this.solido = solido;
    this.raio = 9 * escala;
  }
  solido: boolean;
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    desenharDecoracao(
      ctx,
      this.modelo,
      this.x,
      this.y - jogo.mundo.alturaChaoEm(this.x, this.y),
      jogo.tempo,
      this.escala
    );
  }
}

class LuzFixa extends EntidadeSimples {
  categoria = 'efeito' as const;
  constructor(
    x: number,
    y: number,
    private raioLuz: number,
    private cor: string,
    private intensidade: number
  ) {
    super('', x, y);
  }
  atualizar(_dt: number, jogo: Jogo): void {
    jogo.luzes.push({
      x: this.x,
      y: this.y,
      raio: this.raioLuz,
      cor: this.cor,
      intensidade: this.intensidade,
    });
  }
  desenhar(): void {}
}

class Placa extends EntidadeSimples {
  categoria = 'decoracao' as const;
  solido = true;
  raio = 8;
  raioSombra = 8;
  constructor(
    id: string,
    x: number,
    y: number,
    private texto: string
  ) {
    super(id, x, y);
  }
  textoInteracao(): string {
    return 'Ler';
  }
  aoInteragir(jogo: Jogo): void {
    jogo.dialogo.latir(this.id, this.texto, 5);
    jogo.audio.tocar('uiAbrir');
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'placa', this.x, this.y, { destacado: jogo.jogador.alvoInteracao === this })
    );
  }
}

class Gatilho extends EntidadeSimples {
  categoria = 'gatilho' as const;
  sempreAtiva = true;
  private dentro = false;
  constructor(
    id: string,
    private area: { x: number; y: number; largura: number; altura: number },
    private acoes: Acao[],
    private condicao: Condicao | undefined,
    private umaVez: boolean
  ) {
    super(id, area.x + area.largura / 2, area.y + area.altura / 2);
  }
  atualizar(_dt: number, jogo: Jogo): void {
    const j = jogo.jogador;
    const a = this.area;
    const agora = j.x >= a.x && j.x <= a.x + a.largura && j.y >= a.y && j.y <= a.y + a.altura;
    if (agora && !this.dentro && jogo.estado === 'jogando') {
      const flag = `gatilho:${this.id}`;
      if (!(this.umaVez && jogo.flags.obter(flag)) && jogo.flags.avaliar(this.condicao)) {
        if (this.umaVez) jogo.flags.definir(flag, true);
        jogo.executarAcoes(this.acoes, this.id);
      }
    }
    this.dentro = agora;
  }
  desenhar(): void {}
}

class Coletavel extends EntidadeSimples {
  categoria = 'coletavel' as const;
  raioSombra = 5;
  revelavel: boolean;
  private visivel: boolean;
  constructor(
    id: string,
    x: number,
    y: number,
    private item: 'faisca' | 'coracao' | 'centelha' | 'caldo',
    oculto: boolean,
    private permanente: boolean
  ) {
    super(id, x, y);
    this.visivel = !oculto;
    this.revelavel = oculto;
  }
  aoSerRevelada(jogo: Jogo): void {
    if (this.visivel) return;
    this.visivel = true;
    jogo.emitir('revelado', { id: this.id, tipo: 'coletavel' });
    efeito(jogo.particulas, 'revelacao', this.x, this.y, { z: 8 });
  }
  atualizar(_dt: number, jogo: Jogo): void {
    if (!this.visivel) return;
    this.z = 6 + Math.sin(jogo.tempo * 3 + this.x) * 2;
    const j = jogo.jogador;
    if (
      Math.hypot(j.x - this.x, j.y - this.y) < 16 &&
      Math.abs(j.z - 0) < 30 &&
      j.estado !== 'derrotado'
    ) {
      this.coletar(jogo);
    }
  }
  private coletar(jogo: Jogo): void {
    const j = jogo.jogador;
    switch (this.item) {
      case 'faisca':
        j.itens.faisca = (j.itens.faisca ?? 0) + 1;
        jogo.flags.definir(`faisca:${this.id}`, true);
        jogo.audio.tocar('faiscaObtida');
        jogo.ui.mensagem(`Faísca encontrada! (${j.itens.faisca}/3)`, 'conquista');
        jogo.emitir('itemObtido', {
          recompensa: { item: { id: 'faisca', quantidade: 1 } },
          texto: 'Faísca',
        });
        jogo.definirHumor('alegre', 2);
        break;
      case 'coracao':
        j.curar(1);
        jogo.audio.tocar('coracaoObtido');
        break;
      case 'centelha':
        j.inspiracao = Math.min(j.inspiracaoMaxima, j.inspiracao + 1);
        jogo.audio.tocar('centelhaObtida', { tom: 0.9 + Math.random() * 0.2 });
        break;
      case 'caldo':
        j.itens.caldo = (j.itens.caldo ?? 0) + 1;
        jogo.audio.tocar('itemObtido');
        jogo.ui.mensagem('Caldo Quente (+1). Use com H para curar.', 'dica');
        break;
    }
    efeito(jogo.particulas, this.item === 'coracao' ? 'cura' : 'brilhoItem', this.x, this.y, {
      z: this.z,
    });
    if (this.permanente) jogo.removerPermanente(this.id);
    else jogo.entidades.remover(this);
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    if (!this.visivel) return;
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'coletavel', this.x, this.y - this.z, {
        variante: this.item,
        ativo: true,
        oculto: this.revelavel,
      })
    );
  }
}

class ArmaNoChao extends EntidadeSimples {
  categoria = 'coletavel' as const;
  raioSombra = 7;
  alcanceInteracao = 30;
  constructor(
    id: string,
    x: number,
    y: number,
    private arma: IdArma
  ) {
    super(id, x, y);
  }
  textoInteracao(): string {
    return `Pegar ${NOMES_ARMAS[this.arma]}`;
  }
  aoInteragir(jogo: Jogo): void {
    jogo.darRecompensa({ arma: this.arma }, NOMES_ARMAS[this.arma]);
    jogo.removerPermanente(this.id);
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    const y =
      this.y - jogo.mundo.alturaChaoEm(this.x, this.y) - 10 - Math.sin(jogo.tempo * 2.5) * 2;
    desenharArma(ctx, this.arma, this.x - 8, y + 4, -Math.PI / 4, 1);
    if (jogo.jogador.alvoInteracao === this) {
      ctx.strokeStyle = 'rgba(255, 233, 176, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(this.x, this.y, 12, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

class PedraMemoria extends EntidadeSimples {
  categoria = 'mecanismo' as const;
  solido = true;
  raio = 9;
  raioSombra = 11;
  private espera = 0;
  constructor(id: string, x: number, y: number) {
    super(id, x, y);
  }
  atualizar(dt: number, jogo: Jogo): void {
    this.espera = Math.max(0, this.espera - dt);
    const ativa = jogo.checkpointAtual() === this.id;
    if (ativa)
      jogo.luzes.push({ x: this.x, y: this.y - 10, raio: 70, cor: '#FFE9B0', intensidade: 0.6 });
    const j = jogo.jogador;
    if (this.espera > 0 || jogo.estado !== 'jogando') return;
    if (Math.hypot(j.x - this.x, j.y - this.y) < 30) {
      this.espera = 4;
      const nova = !ativa;
      if (nova || j.vida < j.vidaMaxima || (j.itens.caldo !== undefined && j.itens.caldo < 2)) {
        j.curar(j.vidaMaxima);
        if (j.itens.caldo !== undefined && j.itens.caldo < 2) j.itens.caldo = 2;
        jogo.registrarCheckpoint(this.id, this.x, this.y + 20);
        jogo.audio.tocar('checkpoint');
        efeito(jogo.particulas, 'cura', this.x, this.y, { z: 16, intensidade: 1.4 });
        if (nova) jogo.ui.mensagem('Pedra-Memória: progresso salvo e vida restaurada.', 'dica');
      }
    }
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    const ativa = jogo.checkpointAtual() === this.id;
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'pedraMemoria', this.x, this.y, { ativo: ativa, energizado: ativa })
    );
  }
}

class Bau extends EntidadeSimples {
  categoria = 'mecanismo' as const;
  solido = true;
  raio = 10;
  raioSombra = 12;
  revelavel: boolean;
  private visivel: boolean;
  private abertura = 0;
  constructor(
    id: string,
    x: number,
    y: number,
    private conteudo: Recompensa,
    private texto: string | undefined,
    oculto: boolean
  ) {
    super(id, x, y);
    this.visivel = !oculto;
    this.revelavel = oculto;
  }
  private aberto(jogo: Jogo): boolean {
    return jogo.flags.obter(`bau:${this.id}`);
  }
  aoSerRevelada(jogo: Jogo): void {
    if (this.visivel) return;
    this.visivel = true;
    jogo.flags.definir(`revelado:${this.id}`, true);
    jogo.emitir('revelado', { id: this.id, tipo: 'bau' });
    efeito(jogo.particulas, 'revelacao', this.x, this.y, { z: 8 });
  }
  atualizar(dt: number, jogo: Jogo): void {
    if (!this.visivel && jogo.flags.obter(`revelado:${this.id}`)) this.visivel = true;
    this.solido = this.visivel;
    if (this.aberto(jogo)) this.abertura = Math.min(1, this.abertura + dt * 3);
  }
  textoInteracao(jogo: Jogo): string | null {
    return this.visivel && !this.aberto(jogo) ? 'Abrir' : null;
  }
  aoInteragir(jogo: Jogo): void {
    if (this.aberto(jogo)) return;
    jogo.flags.definir(`bau:${this.id}`, true);
    jogo.audio.tocar('bauAbrir');
    efeito(jogo.particulas, 'brilhoItem', this.x, this.y, { z: 12, intensidade: 1.5 });
    jogo.darRecompensa(this.conteudo, this.texto);
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    if (!this.visivel) return;
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'bau', this.x, this.y, {
        ativo: this.aberto(jogo),
        progresso: this.abertura,
        oculto: this.revelavel,
        destacado: jogo.jogador.alvoInteracao === this,
      })
    );
  }
}

class Santuario extends EntidadeSimples {
  categoria = 'mecanismo' as const;
  solido = true;
  raio = 11;
  raioSombra = 13;
  alcanceInteracao = 40;
  constructor(
    id: string,
    x: number,
    y: number,
    private habilidade: IdHabilidade
  ) {
    super(id, x, y);
  }
  private usado(jogo: Jogo): boolean {
    return jogo.jogador.habilidades.has(this.habilidade);
  }
  atualizar(_dt: number, jogo: Jogo): void {
    jogo.luzes.push({
      x: this.x,
      y: this.y - 14,
      raio: this.usado(jogo) ? 50 : 80,
      cor: '#FFD27A',
      intensidade: 0.7,
    });
  }
  textoInteracao(jogo: Jogo): string | null {
    return this.usado(jogo) ? null : 'Tocar o santuário';
  }
  aoInteragir(jogo: Jogo): void {
    if (this.usado(jogo)) return;
    jogo.flags.definir(`santuario:${this.id}`, true);
    jogo.executarAcoes([{ tipo: 'desbloquear', habilidade: this.habilidade }], this.id);
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'santuario', this.x, this.y, {
        ativo: this.usado(jogo),
        energizado: !this.usado(jogo),
        variante: this.habilidade,
        destacado: jogo.jogador.alvoInteracao === this,
      })
    );
  }
}

class Gaiola extends EntidadeSimples {
  categoria = 'mecanismo' as const;
  solido = true;
  raio = 12;
  raioSombra = 14;
  private abertura = 0;
  constructor(
    id: string,
    x: number,
    y: number,
    private prisioneiro: IdNpc,
    private flag: string,
    private grupoGuardiao: string | undefined
  ) {
    super(id, x, y);
  }
  private aberta(jogo: Jogo): boolean {
    return jogo.flags.obter(this.flag);
  }
  atualizar(dt: number, jogo: Jogo): void {
    if (this.aberta(jogo)) {
      this.abertura = Math.min(1, this.abertura + dt * 2);
      this.solido = false;
    }
  }
  textoInteracao(jogo: Jogo): string | null {
    return this.aberta(jogo) ? null : 'Abrir a gaiola';
  }
  aoInteragir(jogo: Jogo): void {
    if (this.aberta(jogo)) return;
    if (this.grupoGuardiao && !jogo.flags.obter(`grupo:${this.grupoGuardiao}`)) {
      jogo.dialogo.latir('claude', 'Os guardiões de Ruído ainda estão por perto...', 2.5);
      jogo.definirHumor('assustado', 1);
      return;
    }
    jogo.flags.definir(this.flag, true);
    jogo.audio.tocar('gaiolaAberta');
    efeito(jogo.particulas, 'quebra', this.x, this.y, { z: 12, cor: '#B4ADC8', intensidade: 1.5 });
    efeito(jogo.particulas, 'confete', this.x, this.y, { z: 16 });
    jogo.emitir('ajudouNpc', { npc: this.prisioneiro });
    jogo.definirHumor('alegre', 2.5);
    jogo.jogador.animar('comemoracao', 1.1);
  }
  desenhar(ctx: CanvasRenderingContext2D, jogo: Jogo): void {
    desenharMecanismo(
      ctx,
      visualBase(jogo, 'gaiola', this.x, this.y, {
        ativo: this.aberta(jogo),
        progresso: this.abertura,
        destacado: jogo.jogador.alvoInteracao === this,
        variante: this.prisioneiro,
      })
    );
  }
}

// ---------------------------------------------------------------------------

function area(
  jogo: Jogo,
  regiao: string,
  espec: { x: number; y: number; largura: number; altura: number }
) {
  const r = jogo.mundo.regiaoPorId(regiao);
  const ox = (r?.origem.x ?? 0) + espec.x;
  const oy = (r?.origem.y ?? 0) + espec.y;
  return {
    x: ox * BLOCO,
    y: oy * BLOCO,
    largura: espec.largura * BLOCO,
    altura: espec.altura * BLOCO,
  };
}

type Espec<T extends EspecEntidade['tipo']> = Extract<EspecEntidade, { tipo: T }>;

export const fabricasBase: MapaFabricas = {
  decoracao: (e, p) => {
    const d = e as Espec<'decoracao'>;
    return new Decoracao('', p.x, p.y, d.modelo, d.escala ?? 1, !!d.solido);
  },
  luz: (e, p) => {
    const d = e as Espec<'luz'>;
    return new LuzFixa(p.x, p.y, d.raio * BLOCO, d.cor, d.intensidade ?? 0.8);
  },
  placa: (e, p) => {
    const d = e as Espec<'placa'>;
    return new Placa(d.id, p.x, p.y, d.texto);
  },
  gatilho: (e, _p, regiao, jogo) => {
    const d = e as Espec<'gatilho'>;
    return new Gatilho(d.id, area(jogo, regiao, d), d.aoEntrar, d.se, d.umaVez !== false);
  },
  coletavel: (e, p, _r, jogo) => {
    const d = e as Espec<'coletavel'>;
    if (jogo.removidaPermanente(d.id)) return null;
    return new Coletavel(d.id, p.x, p.y, d.item, !!d.oculto, true);
  },
  arma: (e, p, _r, jogo) => {
    const d = e as Espec<'arma'>;
    if (jogo.removidaPermanente(d.id) || jogo.jogador.armas.includes(d.arma)) return null;
    return new ArmaNoChao(d.id, p.x, p.y, d.arma);
  },
  pedraMemoria: (e, p) => new PedraMemoria((e as Espec<'pedraMemoria'>).id, p.x, p.y),
  bau: (e, p) => {
    const d = e as Espec<'bau'>;
    return new Bau(d.id, p.x, p.y, d.conteudo, d.texto, !!d.oculto);
  },
  santuario: (e, p) => {
    const d = e as Espec<'santuario'>;
    return new Santuario(d.id, p.x, p.y, d.habilidade);
  },
  gaiola: (e, p) => {
    const d = e as Espec<'gaiola'>;
    return new Gaiola(d.id, p.x, p.y, d.prisioneiro, d.flag, d.grupoGuardiao);
  },
};

/** Coletável criado em tempo de jogo (ex.: inimigo derrubou uma centelha). */
export function criarColetavelSolto(
  jogo: Jogo,
  x: number,
  y: number,
  item: 'coracao' | 'centelha'
): Entidade {
  const c = new Coletavel('', x, y, item, false, false);
  return jogo.entidades.adicionar(c);
}
