import type { DefinicaoCena, PassoCena } from '../contratos/dados';
import type { ApiCenas, Jogo } from '../contratos/jogo';

/**
 * Executor de cenas curtas e puláveis. Ao pular, todas as ações restantes são aplicadas
 * para garantir o mesmo estado final.
 */
export class Cenas implements ApiCenas {
  private atual: DefinicaoCena | null = null;
  private indice = 0;
  private restante = 0;
  private estadoAnterior: Jogo['estado'] = 'jogando';

  constructor(
    private jogo: Jogo,
    private definicoes: DefinicaoCena[]
  ) {}

  executar(id: string): void {
    const def = this.definicoes.find((c) => c.id === id);
    if (!def) {
      console.warn(`[cenas] cena desconhecida "${id}"`);
      return;
    }
    if (this.atual) this.pular();
    this.atual = def;
    this.indice = -1;
    this.restante = 0;
    this.estadoAnterior = this.jogo.estado === 'cena' ? 'jogando' : this.jogo.estado;
    this.jogo.estado = 'cena';
    this.jogo.jogador.controleBloqueado = true;
    this.jogo.emitir('cenaIniciada', { id });
    this.proximo();
  }

  ativa(): boolean {
    return this.atual !== null;
  }

  pular(): void {
    if (!this.atual) return;
    for (let i = Math.max(0, this.indice + 1); i < this.atual.passos.length; i++) {
      const p = this.atual.passos[i]!;
      if (p.tipo === 'acoes') this.jogo.executarAcoes(p.acoes, this.atual.id);
    }
    this.terminar();
  }

  atualizar(dt: number): void {
    if (!this.atual) return;
    if (this.jogo.entrada.apertou('voltar')) {
      this.pular();
      return;
    }
    const passo = this.atual.passos[this.indice];
    if (passo?.tipo === 'fala' && this.jogo.entrada.apertou('avancar')) {
      this.restante = 0;
    }
    this.restante -= dt;
    if (this.restante <= 0) this.proximo();
  }

  private proximo(): void {
    if (!this.atual) return;
    this.indice++;
    const passo: PassoCena | undefined = this.atual.passos[this.indice];
    if (!passo) {
      this.terminar();
      return;
    }
    const jogo = this.jogo;
    switch (passo.tipo) {
      case 'camera': {
        const alvo = jogo.entidades.porId(passo.alvo);
        if (alvo)
          jogo.camera.focar(
            { x: alvo.x, y: alvo.y - jogo.mundo.alturaChaoEm(alvo.x, alvo.y) },
            passo.duracao
          );
        this.restante = passo.duracao;
        break;
      }
      case 'cameraJogador':
        jogo.camera.focar(null, passo.duracao);
        this.restante = passo.duracao;
        break;
      case 'esperar':
        this.restante = passo.duracao;
        break;
      case 'fala': {
        const duracao = passo.duracao ?? Math.max(1.6, passo.texto.length * 0.055);
        jogo.dialogo.latir(passo.quem, passo.texto, duracao);
        this.restante = duracao;
        break;
      }
      case 'acoes':
        jogo.executarAcoes(passo.acoes, this.atual.id);
        this.restante = 0;
        this.proximo();
        return;
      case 'tremor':
        jogo.camera.tremer(passo.intensidade, passo.duracao);
        this.restante = 0;
        this.proximo();
        return;
    }
  }

  private terminar(): void {
    const def = this.atual;
    this.atual = null;
    this.jogo.camera.focar(null);
    if (def) this.jogo.executarAcoes(def.aoTerminar, def.id);
    if (this.jogo.estado === 'cena')
      this.jogo.estado = this.estadoAnterior === 'dialogo' ? 'jogando' : this.estadoAnterior;
    if (this.jogo.estado === 'cena') this.jogo.estado = 'jogando';
    this.jogo.jogador.controleBloqueado = false;
    if (def) this.jogo.emitir('cenaTerminada', { id: def.id });
  }
}
