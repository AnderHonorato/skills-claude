/**
 * Sessão multijogador: o anfitrião roda a partida "de verdade" (inimigos, cristais,
 * experiência, vida) e manda o estado para os convidados; cada aparelho manda a
 * posição do seu próprio jogador. Todos simulam as habilidades localmente, então os
 * efeitos aparecem completos em todas as telas.
 */
import type { IdPersonagem } from '../dados/personagens';
import { MAX_JOGADORES } from '../jogo/jogador';
import type { GanchosRede, Partida } from '../jogo/partida';
import type { Canal, Mensagem } from './canal';

export interface MembroSala {
  indice: number;
  personagem: IdPersonagem;
}

export class Sessao {
  /** Anfitrião: canal de cada convidado. Convidado: canal 0 = anfitrião. */
  private canais = new Map<number, Canal>();
  membros: MembroSala[] = [];
  meuIndice = 0;
  /** Alguma mudança na sala (para a interface redesenhar). */
  aoMudar: () => void = () => {};
  /** O anfitrião saiu ou a conexão caiu (convidado). */
  aoEncerrar: (motivo: string) => void = () => {};
  private tPos = 0;
  private tEstado = 0;
  private tCristais = 0;
  private encerrada = false;

  constructor(
    private partida: Partida,
    readonly papel: 'anfitriao' | 'convidado'
  ) {
    if (papel === 'anfitriao')
      this.membros = [{ indice: 0, personagem: partida.local.personagemId }];
  }

  get emPartida(): boolean {
    return this.partida.rede === this.ganchos;
  }

  numeroConectados(): number {
    return this.membros.length;
  }

  // ------------------------------------------------------------------ anfitrião

  /** Um novo convidado conectou (WebRTC ou servidor local). */
  adicionarConvidado(canal: Canal): void {
    if (this.papel !== 'anfitriao') return;
    let indice = -1;
    for (let k = 1; k < MAX_JOGADORES; k++)
      if (!this.membros.some((m) => m.indice === k)) {
        indice = k;
        break;
      }
    if (indice < 0 || this.emPartida) {
      canal.enviar({
        t: 'recusado',
        motivo: indice < 0 ? 'A sala está cheia (4 jogadores).' : 'A partida já começou.',
      });
      setTimeout(() => canal.fechar(), 300);
      return;
    }
    this.canais.set(indice, canal);
    this.membros.push({ indice, personagem: 'claude' });
    canal.aoMensagem = (m) => this.doConvidado(indice, m);
    canal.aoFechar = () => this.convidadoSaiu(indice);
    canal.enviar({ t: 'boasvindas', indice });
    this.mandarSala();
    this.partida.audio.tocar('uiConfirmar');
    this.aoMudar();
  }

  private convidadoSaiu(indice: number): void {
    if (!this.canais.has(indice)) return;
    this.canais.delete(indice);
    this.membros = this.membros.filter((m) => m.indice !== indice);
    if (this.emPartida) this.partida.removerJogador(indice);
    this.mandarSala();
    this.aoMudar();
  }

  private doConvidado(indice: number, m: Mensagem): void {
    const p = this.partida;
    switch (m.t) {
      case 'perfil': {
        const membro = this.membros.find((x) => x.indice === indice);
        if (membro && typeof m.personagem === 'string')
          membro.personagem = m.personagem as IdPersonagem;
        this.mandarSala();
        this.aoMudar();
        break;
      }
      case 'eu':
        if (this.emPartida) p.importarPosicoes(m.j as number[][]);
        break;
      case 'escolha':
        if (this.emPartida) p.escolhaRemota(indice, Number(m.i));
        break;
      case 'rerrolar':
        if (this.emPartida) p.rerrolarRemoto(indice);
        break;
    }
  }

  private mandarSala(): void {
    this.transmitir({ t: 'sala', membros: this.membros });
  }

  /** Muda o personagem deste aparelho na sala. */
  trocarPersonagem(id: IdPersonagem): void {
    const eu = this.membros.find((m) => m.indice === this.meuIndice);
    if (eu) eu.personagem = id;
    if (this.papel === 'anfitriao') this.mandarSala();
    else this.canais.get(0)?.enviar({ t: 'perfil', personagem: id });
    this.aoMudar();
  }

  /** Anfitrião: começa (ou recomeça) a partida com quem está na sala. */
  iniciarPartida(): void {
    if (this.papel !== 'anfitriao') return;
    const p = this.partida;
    const eu = this.membros.find((m) => m.indice === 0)!;
    eu.personagem = p.local.personagemId;
    p.configurarJogadores(this.membros, 0, 'anfitriao');
    p.rede = this.ganchos;
    p.iniciar();
    this.transmitir({ t: 'iniciar', membros: this.membros });
    this.transmitir(p.exportarNivel());
    this.transmitir(p.exportarCristais());
    this.transmitir(p.exportarEstado());
  }

  private transmitir(m: Mensagem, rapido = false): void {
    for (const c of this.canais.values()) c.enviar(m, rapido);
  }

  // ------------------------------------------------------------------ convidado

  /** Convidado: conectou ao anfitrião. */
  conectar(canal: Canal): void {
    this.canais.set(0, canal);
    canal.aoMensagem = (m) => this.doAnfitriao(m);
    canal.aoFechar = () => this.encerrar('A conexão com o anfitrião caiu.');
  }

  private doAnfitriao(m: Mensagem): void {
    const p = this.partida;
    switch (m.t) {
      case 'boasvindas':
        this.meuIndice = Number(m.indice);
        this.canais.get(0)?.enviar({ t: 'perfil', personagem: p.local.personagemId });
        this.aoMudar();
        break;
      case 'recusado':
        this.encerrar(String(m.motivo ?? 'O anfitrião recusou a entrada.'));
        break;
      case 'sala':
        this.membros = m.membros as MembroSala[];
        this.aoMudar();
        break;
      case 'iniciar':
        this.membros = m.membros as MembroSala[];
        p.configurarJogadores(this.membros, this.meuIndice, 'convidado');
        p.rede = this.ganchos;
        p.iniciar();
        break;
      case 'estado':
        if (this.emPartida) p.importarEstado(m);
        break;
      case 'cristais':
        if (this.emPartida) p.importarCristais(m);
        break;
      case 'pos':
        if (this.emPartida) p.importarPosicoes(m.j as number[][]);
        break;
      case 'nivel':
        if (this.emPartida) p.importarNivel(m);
        break;
      case 'menu':
        if (this.emPartida) {
          p.rede = null;
          p.voltarMenu();
        }
        this.aoMudar();
        break;
      case 'fechar':
        this.encerrar('O anfitrião fechou a sala.');
        break;
    }
  }

  // ------------------------------------------------------------------ comum

  /** Ganchos chamados pela partida durante o jogo. */
  readonly ganchos: GanchosRede = {
    aposPasso: (dt) => {
      const p = this.partida;
      this.tPos += dt;
      this.tEstado += dt;
      this.tCristais += dt;
      if (this.tPos >= 1 / 20) {
        this.tPos = 0;
        if (this.papel === 'anfitriao')
          this.transmitir({ t: 'pos', j: p.exportarPosicoes(false) }, true);
        else this.canais.get(0)?.enviar({ t: 'eu', j: p.exportarPosicoes(true) }, true);
      }
      if (this.papel !== 'anfitriao') return;
      if (this.tEstado >= 0.2) {
        this.tEstado = 0;
        this.transmitir(p.exportarEstado());
      }
      if (this.tCristais >= 1) {
        this.tCristais = 0;
        this.transmitir(p.exportarCristais());
      }
    },
    nivelAberto: () => {
      if (this.papel === 'anfitriao') this.transmitir(this.partida.exportarNivel());
    },
    escolha: (i) => this.canais.get(0)?.enviar({ t: 'escolha', i }),
    rerrolar: () => this.canais.get(0)?.enviar({ t: 'rerrolar' }),
    fim: () => {
      if (this.papel === 'anfitriao') this.transmitir(this.partida.exportarEstado());
    },
  };

  /** Anfitrião voltou ao menu da sala (todos voltam para o lobby). */
  voltarParaSala(): void {
    if (this.papel === 'anfitriao') this.transmitir({ t: 'menu' });
    this.partida.rede = null;
    this.partida.voltarMenu();
    this.aoMudar();
  }

  private encerrar(motivo: string): void {
    if (this.encerrada) return;
    this.encerrada = true;
    for (const c of this.canais.values()) c.fechar();
    this.canais.clear();
    this.partida.rede = null;
    if (this.partida.estado !== 'menu') this.partida.voltarMenu();
    this.partida.modoSolo();
    this.aoEncerrar(motivo);
  }

  /** Sai da sala (anfitrião fecha para todos). */
  sair(): void {
    if (this.papel === 'anfitriao') this.transmitir({ t: 'fechar' });
    setTimeout(() => this.encerrar('Você saiu da sala.'), 100);
  }
}
