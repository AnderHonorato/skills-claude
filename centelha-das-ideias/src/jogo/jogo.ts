import { criarAudio } from '../audio/indice';
import { efeito } from '../arte/efeitos';
import { BLOCO, INTERVALO_AUTOSALVAR, JOGADOR, PASSO_FIXO, RAIO_ATIVIDADE } from '../configuracao';
import type { Luz } from '../contratos/arte';
import type { IdSom } from '../contratos/audio';
import type {
  Acao,
  Humor,
  IdArma,
  IdMelhoria,
  IdRegiao,
  Recompensa,
  Vetor,
} from '../contratos/base';
import type { EspecEntidade } from '../contratos/dados';
import type { MapaEventos, NomeEvento } from '../contratos/eventos';
import type {
  ApiCombate,
  ApiDialogo,
  ApiHabilidades,
  ApiMissoes,
  ApiUi,
  EstadoJogo,
  Jogo,
} from '../contratos/jogo';
import type { ApiAudio } from '../contratos/audio';
import { VERSAO_SALVAMENTO, type DadosSalvos } from '../contratos/salvamento';
import { CENAS } from '../dados/cenas';
import { MUNDO } from '../dados/mundo';
import { NOMES_HABILIDADES, fabricasBase } from '../entidades/base';
import { Gerenciador } from '../entidades/gerenciador';
import { JogadorClaude } from '../entidades/jogador';
import { CameraJogo } from '../motor/camera';
import { EntradaJogo } from '../motor/entrada';
import { BarramentoEventos } from '../motor/eventos';
import { Particulas } from '../motor/particulas';
import type { Tela } from '../motor/tela';
import { Chao } from '../mundo/chao';
import { FisicaJogo } from '../mundo/fisica';
import { MundoJogo } from '../mundo/mundo';
import { posicaoSegura } from '../mundo/seguranca';
import { Cenas } from '../sistemas/cenas';
import { criarCombate } from '../sistemas/combate/indice';
import { criarDialogo } from '../sistemas/dialogo/indice';
import { FlagsJogo } from '../sistemas/flags';
import { criarHabilidades } from '../sistemas/habilidades/indice';
import { criarMissoes } from '../sistemas/missoes/indice';
import {
  completar,
  configuracoesPadrao,
  estatisticasPadrao,
  existeSalvamento,
  gravarSalvamento,
  lerSalvamento,
} from '../sistemas/salvamento';
import { criarUi } from '../ui/indice';
import { Renderizador } from './renderizador';

const NOMES_ARMAS: Record<IdArma, string> = {
  espada: 'Espada de Madeira',
  colher: 'Colher Gigante',
  martelo: 'Martelo de Borracha',
  cajado: 'Cajado de Ideias',
};
const TECLA_ARMA: Record<IdArma, string> = { espada: '1', colher: '2', martelo: '3', cajado: '4' };
const TECLA_HABILIDADE = { observar: 'Q', conectar: 'R', criar: 'F' } as const;
const TEXTO_MELHORIA: Record<IdMelhoria, string> = {
  botasMola: 'Botas de Mola: pulos mais altos alcançam plataformas elevadas.',
  carretelDuplo: 'Carretel Duplo: uma conexão a mais ao mesmo tempo.',
  lenteAmpla: 'Lente Ampla: Observar alcança mais longe.',
  moldeEstavel: 'Molde Estável: suas criações duram mais.',
};

/** O jogo: dono do estado global, da ordem de atualização e das regras transversais. */
export class JogoCentelha implements Jogo {
  tempo = 0;
  estado: EstadoJogo = 'titulo';
  readonly mundo: MundoJogo;
  readonly entidades: Gerenciador;
  readonly fisica: FisicaJogo;
  readonly entrada: EntradaJogo;
  readonly camera = new CameraJogo();
  readonly particulas = new Particulas();
  readonly flags = new FlagsJogo();
  readonly luzes: Luz[] = [];
  readonly jogador: JogadorClaude;
  readonly combate: ApiCombate;
  readonly habilidades: ApiHabilidades;
  readonly dialogo: ApiDialogo;
  readonly missoes: ApiMissoes;
  readonly ui: ApiUi;
  readonly audio: ApiAudio;
  readonly cenas: Cenas;
  readonly chao: Chao;
  readonly renderizador: Renderizador;

  private eventos = new BarramentoEventos();
  private checkpoint: DadosSalvos['checkpoint'] = null;
  private descobertas = new Set<IdRegiao>();
  private removidas = new Set<string>();
  private stats = estatisticasPadrao();
  private config = configuracoesPadrao();
  private criadoEm = Date.now();
  private tempoAutosalvar = 0;
  private salvarPendente = -1;
  private especsInimigos: { espec: EspecEntidade; regiao: IdRegiao }[] = [];
  private regiaoAtual: IdRegiao | null = null;
  private fronteiraPerto = false;
  private derrotaTempo = -1;
  private focoTemporario = 0;
  ruidoVisual = 0;

  constructor(
    readonly tela: Tela,
    raizUi: HTMLElement
  ) {
    this.mundo = new MundoJogo(MUNDO);
    this.entidades = new Gerenciador(() => this);
    this.fisica = new FisicaJogo(this.mundo, () => this.entidades);
    this.entrada = new EntradaJogo(tela.canvas);
    this.entrada.conversorMira = (x, y) => this.camera.telaParaMundo(x, y);
    this.jogador = new JogadorClaude(this);
    this.chao = new Chao(this.mundo);
    this.mundo.aoMudarBloco = (tx, ty) => this.chao.invalidarBloco(tx, ty);
    this.mundo.aoMudarRegiao = () => this.chao.invalidarTudo();
    this.camera.limites = {
      x: -BLOCO * 2,
      y: -BLOCO * 2,
      largura: this.mundo.larguraPx + BLOCO * 4,
      altura: this.mundo.alturaPx + BLOCO * 4,
    };

    this.audio = criarAudio();
    this.combate = criarCombate(this);
    this.habilidades = criarHabilidades(this);
    this.dialogo = criarDialogo(this);
    this.missoes = criarMissoes(this);
    this.cenas = new Cenas(this, CENAS);
    this.ui = criarUi(this, raizUi);
    this.renderizador = new Renderizador(this);

    this.entidades.registrarFabricas(fabricasBase);
    this.entidades.registrarFabricas(this.habilidades.fabricas);
    this.entidades.registrarFabricas(this.combate.fabricas);
    this.entidades.registrarFabricas(this.dialogo.fabricas);

    this.flags.aoMudar = (flag, valor) => this.emitir('flag', { flag, valor });
    tela.aoRedimensionar(() => this.ajustarTela());
    this.ajustarTela();
    this.instalarOuvintes();
    this.camera.centralizar(this.mundo.larguraPx / 2, this.mundo.alturaPx / 2);
  }

  private ajustarTela(): void {
    this.camera.ajustarTela(this.tela.larguraCss, this.tela.alturaCss);
    this.chao.definirEscala(this.camera.zoom * this.tela.dpr);
  }

  // -------------------------------------------------------------------------
  // eventos
  // -------------------------------------------------------------------------

  emitir<N extends NomeEvento>(nome: N, dados: MapaEventos[N]): void {
    this.eventos.emitir(nome, dados);
  }

  ouvir<N extends NomeEvento>(nome: N, fn: (dados: MapaEventos[N]) => void): () => void {
    return this.eventos.ouvir(nome, fn);
  }

  private instalarOuvintes(): void {
    // Humor de Claude reage a eventos reais (docs/design.md §4).
    this.ouvir('revelado', () => this.definirHumor('curioso', 2));
    this.ouvir('regiaoEntrou', (d) => d.primeiraVez && this.definirHumor('curioso', 2.5));
    this.ouvir('inimigoAlerta', () => {
      if (this.jogador.humor !== 'determinado') this.definirHumor('assustado', 1.1);
    });
    this.ouvir('chefeApareceu', () => this.definirHumor('assustado', 2));
    const alegria = () => {
      this.definirHumor('alegre', 2.5);
      if (this.jogador.noChao && !this.jogador.ataque) this.jogador.animar('comemoracao', 1.1);
    };
    this.ouvir('enigmaResolvido', alegria);
    this.ouvir('ajudouNpc', alegria);
    this.ouvir('missaoConcluida', alegria);
    const falha = () => {
      this.definirHumor('frustrado', 1.3);
      this.jogador.ativarDeterminacao();
      setTimeout(() => {
        if (this.jogador.humor === 'frustrado') this.definirHumor('determinado', 3);
      }, 1300);
    };
    this.ouvir('enigmaFalhou', falha);
    this.ouvir('conexaoFalhou', () => this.definirHumor('frustrado', 0.9));
    this.ouvir('jogadorQueda', () => {
      this.stats.quedas++;
    });
    this.ouvir('jogadorDerrotado', () => {
      this.stats.derrotas++;
      this.derrotaTempo = 1.4;
    });
    this.ouvir('inimigoDerrotado', () => {
      this.stats.inimigosDerrotados++;
    });
    this.ouvir('missaoAtualizada', () => this.agendarSalvamento());
    this.ouvir('missaoConcluida', () => this.agendarSalvamento());
    this.ouvir('itemObtido', () => this.agendarSalvamento());
    this.ouvir('enigmaResolvido', () => this.agendarSalvamento());
    this.ouvir('habilidadeDesbloqueada', () => this.agendarSalvamento());
  }

  // -------------------------------------------------------------------------
  // ciclo
  // -------------------------------------------------------------------------

  /** Um passo fixo de lógica. */
  passo(dt: number): void {
    this.entrada.iniciarPasso();
    try {
      this.ui.atualizar(dt);
      if (this.estado === 'titulo') {
        this.tempo += dt;
        this.particulas.atualizar(dt);
        return;
      }
      if (this.estado === 'pausado' || this.ui.menuAberto()) return;

      this.luzes.length = 0;
      this.tempo += dt;
      if (this.estado === 'jogando') this.stats.tempoAtivo += dt;
      else if (this.estado === 'dialogo' || this.estado === 'cena') this.stats.tempoCenas += dt;

      const emDialogo = this.dialogo.ativo();
      this.dialogo.atualizar(dt);
      if (emDialogo) {
        this.entrada.consumir('pular');
        this.entrada.consumir('interagir');
        this.entrada.consumir('atacar');
      }
      if (this.dialogo.ativo() && this.estado === 'jogando') this.estado = 'dialogo';
      else if (!this.dialogo.ativo() && this.estado === 'dialogo') this.estado = 'jogando';
      this.cenas.atualizar(dt);

      this.jogador.atualizar(dt, this);
      this.combate.atualizar(dt);
      this.habilidades.atualizar(dt);
      const j = this.jogador;
      const r2 = RAIO_ATIVIDADE * RAIO_ATIVIDADE;
      for (const e of this.entidades.todas()) {
        if (!e.vivo || e === j) continue;
        if (!e.sempreAtiva) {
          const dx = e.x - j.x;
          const dy = e.y - j.y;
          if (dx * dx + dy * dy > r2) continue;
        }
        try {
          e.atualizar(dt, this);
        } catch (erro) {
          console.error(`[jogo] erro ao atualizar ${e.id}`, erro);
          e.vivo = false;
        }
      }
      this.missoes.atualizar(dt);
      this.particulas.atualizar(dt);
      this.entidades.limparMortas();
      this.atualizarCamera(dt);
      this.verificarRegiao();
      this.verificarFronteira();
      this.atualizarRuido(dt);
      this.audio.definirIntensidade(this.combate.intensidade());
      this.audio.definirOuvinte(j.x, j.y);

      if (this.derrotaTempo > 0) {
        this.derrotaTempo -= dt;
        if (this.derrotaTempo <= 0) {
          this.estado = 'derrota';
          this.ui.mostrarDerrota();
        }
      }
      if (this.focoTemporario > 0) {
        this.focoTemporario -= dt;
        if (this.focoTemporario <= 0 && !this.cenas.ativa()) this.camera.focar(null);
      }
      if (this.estado === 'jogando') {
        this.tempoAutosalvar += dt;
        if (this.tempoAutosalvar >= INTERVALO_AUTOSALVAR) this.salvar();
      }
      if (this.salvarPendente > 0) {
        this.salvarPendente -= dt;
        if (this.salvarPendente <= 0) this.salvar();
      }
    } finally {
      this.entrada.finalizarPasso();
    }
  }

  desenhar(): void {
    this.renderizador.desenhar();
  }

  private atualizarCamera(dt: number): void {
    const j = this.jogador;
    const chao = this.mundo.temChao(j.x, j.y) ? this.mundo.alturaChaoEm(j.x, j.y) : 0;
    this.camera.seguir(j.x + j.vx * 0.22, j.y - chao - 8 + j.vy * 0.22);
    this.camera.atualizar(dt);
  }

  private verificarRegiao(): void {
    const r = this.mundo.regiaoEm(this.jogador.x, this.jogador.y);
    if (!r || r === this.regiaoAtual) return;
    this.regiaoAtual = r;
    const primeira = !this.descobertas.has(r);
    this.descobertas.add(r);
    const def = this.mundo.regiaoPorId(r);
    if (def) this.audio.musica(def.musica as never);
    this.emitir('regiaoEntrou', { regiao: r, primeiraVez: primeira });
    if (primeira && def) this.ui.mensagem(def.nome, 'conquista');
    this.agendarSalvamento();
  }

  private verificarFronteira(): void {
    const f = MUNDO.fronteira;
    const a = f.area;
    const tx = this.jogador.x / BLOCO;
    const ty = this.jogador.y / BLOCO;
    const dx = Math.max(a.x - tx, 0, tx - (a.x + a.largura));
    const dy = Math.max(a.y - ty, 0, ty - (a.y + a.altura));
    const perto = Math.hypot(dx, dy) <= f.raioAviso;
    if (perto !== this.fronteiraPerto) {
      this.fronteiraPerto = perto;
      this.emitir('fronteiraProxima', { perto });
      if (perto) {
        this.audio.tocar('fronteira');
        this.definirHumor('curioso', 2);
      }
    }
  }

  fronteiraProxima(): boolean {
    return this.fronteiraPerto;
  }

  private atualizarRuido(dt: number): void {
    const r = this.regiaoAtual;
    const def = r ? this.mundo.regiaoPorId(r) : undefined;
    const alvo = def?.comRuido && !this.mundo.restaurada(def.id) ? 1 : 0;
    this.ruidoVisual += (alvo - this.ruidoVisual) * Math.min(1, dt * 1.5);
  }

  // -------------------------------------------------------------------------
  // regras transversais
  // -------------------------------------------------------------------------

  definirHumor(h: Humor, duracao = 2): void {
    this.jogador.definirHumorEvento(h, duracao);
  }

  executarAcoes(acoes: Acao[] | undefined, origem = ''): void {
    if (!acoes) return;
    for (const a of acoes) {
      try {
        this.executarAcao(a);
      } catch (erro) {
        console.error(`[jogo] erro na ação ${a.tipo} (${origem})`, erro);
      }
    }
  }

  private executarAcao(a: Acao): void {
    switch (a.tipo) {
      case 'flag':
        this.flags.definir(a.flag, a.valor ?? true);
        break;
      case 'dar':
        this.darRecompensa(a.recompensa, a.texto);
        break;
      case 'dialogo':
        this.dialogo.iniciar(a.dialogo, a.falante);
        break;
      case 'humor':
        this.definirHumor(a.humor, a.duracao ?? 2);
        break;
      case 'som':
        this.audio.tocar(a.som as IdSom);
        break;
      case 'ativar':
        this.definirAtivo(a.alvo, true);
        break;
      case 'desativar':
        this.definirAtivo(a.alvo, false);
        break;
      case 'cena':
        this.cenas.executar(a.cena);
        break;
      case 'desbloquear': {
        const j = this.jogador;
        if (j.habilidades.has(a.habilidade)) break;
        j.habilidades.add(a.habilidade);
        this.audio.tocar('itemObtido');
        efeito(this.particulas, 'luzCriada', j.x, j.y, { z: 14, intensidade: 2 });
        this.ui.mensagem(
          `Nova habilidade: ${NOMES_HABILIDADES[a.habilidade]} (${TECLA_HABILIDADE[a.habilidade]})`,
          'conquista'
        );
        this.emitir('habilidadeDesbloqueada', { habilidade: a.habilidade });
        this.definirHumor('alegre', 2.5);
        j.animar('comemoracao', 1.2);
        break;
      }
      case 'checkpoint':
        this.registrarCheckpoint(a.id, this.jogador.x, this.jogador.y);
        break;
      case 'restaurarRegiao':
        this.restaurarRegiao(a.regiao);
        break;
      case 'mensagem':
        this.ui.mensagem(a.texto, a.estilo ?? 'dica');
        break;
      case 'camera': {
        const alvo = this.entidades.porId(a.alvo);
        if (alvo && !this.cenas.ativa()) {
          this.camera.focar(
            { x: alvo.x, y: alvo.y - this.mundo.alturaChaoEm(alvo.x, alvo.y) },
            0.6
          );
          this.focoTemporario = a.duracao;
        }
        break;
      }
      case 'comemorar':
        this.jogador.animar('comemoracao', 1.2);
        this.definirHumor('alegre', 2.5);
        this.emitir('comemoracao', {});
        this.audio.tocar('comemoracao');
        break;
      case 'removerEntidade':
        this.removerPermanente(a.id);
        break;
      case 'iniciarMissao':
        this.flags.definir(`missao:${a.missao}:iniciada`, true);
        break;
    }
  }

  restaurarRegiao(regiao: IdRegiao): void {
    if (this.flags.obter(`restaurada:${regiao}`)) return;
    this.flags.definir(`restaurada:${regiao}`, true);
    this.mundo.marcarRestaurada(regiao, true);
    this.audio.tocar('restauracao');
    this.emitir('regiaoRestaurada', { regiao });
  }

  darRecompensa(r: Recompensa, texto?: string): void {
    const j = this.jogador;
    const partes: string[] = [];
    if (r.arma && !j.armas.includes(r.arma)) {
      j.armas.push(r.arma);
      j.armaAtual = r.arma;
      partes.push(`Nova arma: ${NOMES_ARMAS[r.arma]} (tecla ${TECLA_ARMA[r.arma]})`);
    }
    if (r.item) {
      j.itens[r.item.id] = (j.itens[r.item.id] ?? 0) + r.item.quantidade;
      if (!texto)
        partes.push(
          r.item.id === 'caldo' ? `Caldo Quente x${r.item.quantidade} (H para curar)` : 'Faísca'
        );
    }
    if (r.vidaMaxima) {
      j.vidaMaxima = Math.min(JOGADOR.vidaMaxima, j.vidaMaxima + r.vidaMaxima);
      j.vida = Math.min(j.vidaMaxima, j.vida + r.vidaMaxima);
      partes.push('Coração extra!');
      this.audio.tocar('coracaoObtido');
    }
    if (r.inspiracaoMaxima) {
      j.inspiracaoMaxima = Math.min(
        JOGADOR.inspiracaoMaxima,
        j.inspiracaoMaxima + r.inspiracaoMaxima
      );
      j.inspiracao = Math.min(j.inspiracaoMaxima, j.inspiracao + r.inspiracaoMaxima);
      partes.push('Inspiração máxima aumentou!');
    }
    if (r.melhoria && !j.melhorias.has(r.melhoria)) {
      j.melhorias.add(r.melhoria);
      partes.push(TEXTO_MELHORIA[r.melhoria]);
    }
    if (r.inspiracao) j.inspiracao = Math.min(j.inspiracaoMaxima, j.inspiracao + r.inspiracao);
    if (r.cura) j.curar(r.cura);
    if (r.habilidade) this.executarAcao({ tipo: 'desbloquear', habilidade: r.habilidade });
    const mensagem =
      texto && partes.length ? `${texto} — ${partes.join(' ')}` : (texto ?? partes.join(' '));
    if (mensagem) this.ui.mensagem(mensagem, 'conquista');
    this.audio.tocar('itemObtido');
    efeito(this.particulas, 'brilhoItem', j.x, j.y, { z: 20, intensidade: 1.2 });
    this.emitir('itemObtido', { recompensa: r, texto: mensagem });
    this.definirHumor('alegre', 2);
    if (j.noChao) j.animar('comemoracao', 1);
  }

  definirAtivo(alvo: string, ativo: boolean): void {
    const e = this.entidades.porId(alvo);
    if (e?.definirAtivo) e.definirAtivo(ativo, this);
    else this.flags.definir(`ativo:${alvo}`, ativo);
  }

  removerPermanente(id: string): void {
    this.removidas.add(id);
    this.entidades.remover(id);
  }

  removidaPermanente(id: string): boolean {
    return this.removidas.has(id);
  }

  estatisticas(): DadosSalvos['estatisticas'] {
    return this.stats;
  }

  configuracoes(): DadosSalvos['configuracoes'] {
    return this.config;
  }

  aplicarConfiguracoes(c: Partial<DadosSalvos['configuracoes']>): void {
    this.config = { ...this.config, ...c };
    this.audio.definirVolume('geral', this.config.volumeGeral);
    this.audio.definirVolume('musica', this.config.volumeMusica);
    this.audio.definirVolume('efeitos', this.config.volumeEfeitos);
    this.camera.tremorAtivado = this.config.tremorCamera;
    this.agendarSalvamento();
  }

  regioesDescobertas(): ReadonlySet<IdRegiao> {
    return this.descobertas;
  }

  checkpointAtual(): string | null {
    return this.checkpoint?.id ?? null;
  }

  registrarCheckpoint(id: string, x: number, y: number): void {
    const regiao = this.mundo.regiaoEm(x, y) ?? MUNDO.regiaoInicial;
    const seguro = this.mundo.pontoSeguroProximo(x, y);
    this.checkpoint = { id, x: seguro.x, y: seguro.y, regiao };
    this.emitir('checkpoint', { id });
    this.salvar();
  }

  // -------------------------------------------------------------------------
  // partida: novo jogo, continuar, renascer
  // -------------------------------------------------------------------------

  temSalvamento(): boolean {
    return existeSalvamento();
  }

  mostrarTitulo(): void {
    this.estado = 'titulo';
    this.ui.mostrarTitulo(this.temSalvamento());
    this.audio.musica('titulo');
  }

  novoJogo(): void {
    const dados = completar({}, MUNDO);
    const def = this.mundo.regiaoPorId(MUNDO.regiaoInicial)!;
    const p = this.mundo.localParaMundo(def.id, def.entrada.x, def.entrada.y);
    dados.jogador.x = p.x;
    dados.jogador.y = p.y;
    dados.configuracoes = { ...this.config };
    this.criadoEm = Date.now();
    this.iniciarComDados(dados, false);
    this.salvar();
  }

  continuar(): void {
    const dados = lerSalvamento(MUNDO);
    if (!dados) {
      this.novoJogo();
      return;
    }
    this.iniciarComDados(dados, true);
  }

  private iniciarComDados(d: DadosSalvos, validar: boolean): void {
    this.entidades.removerTodas(() => true);
    this.particulas.limpar();
    this.mundo.reiniciar();
    this.chao.invalidarTudo();
    this.flags.carregar(d.flags);
    this.removidas = new Set(d.removidas);
    this.descobertas = new Set(d.regioesDescobertas);
    this.stats = { ...d.estatisticas };
    this.criadoEm = d.criadoEm;
    this.checkpoint = d.checkpoint;
    this.regiaoAtual = null;
    this.derrotaTempo = -1;
    this.fronteiraPerto = false;
    this.aplicarConfiguracoes(d.configuracoes);
    this.mundo.aplicarAlterados(d.blocosAlterados);
    for (const r of MUNDO.regioes) {
      if (d.flags[`restaurada:${r.id}`]) this.mundo.marcarRestaurada(r.id, true);
    }

    const j = this.jogador;
    j.vida = Math.max(1, d.jogador.vida);
    j.vidaMaxima = d.jogador.vidaMaxima;
    j.inspiracao = d.jogador.inspiracao;
    j.inspiracaoMaxima = d.jogador.inspiracaoMaxima;
    j.armas = [...d.jogador.armas];
    j.armaAtual = d.jogador.armaAtual;
    j.habilidades = new Set(d.jogador.habilidades);
    j.melhorias = new Set(d.jogador.melhorias);
    j.itens = { ...d.jogador.itens };
    j.controleBloqueado = false;
    j.estado = 'repouso';
    j.invulneravelPor = 1;
    j.ataque = null;
    this.entidades.adicionar(j);

    this.criarEntidadesDoMundo();
    this.missoes.carregar(d.missoes);
    this.missoes.acompanhar(d.missaoAcompanhada);

    const pos = validar ? this.validarPosicao(d) : { x: d.jogador.x, y: d.jogador.y };
    j.posicionar(pos.x, pos.y);
    this.camera.centralizar(pos.x, pos.y - 8);
    this.estado = 'jogando';
    this.tempoAutosalvar = 0;
    this.verificarRegiao();
  }

  /** Garante retomada em lugar seguro (ver src/mundo/seguranca.ts). */
  validarPosicao(d: DadosSalvos): Vetor {
    return posicaoSegura(this.mundo, d);
  }

  private criarEntidadesDoMundo(): void {
    this.especsInimigos = [];
    for (const r of MUNDO.regioes) {
      for (const espec of r.entidades) {
        if ('id' in espec && espec.id && this.removidas.has(espec.id)) continue;
        if (espec.tipo === 'inimigo' || espec.tipo === 'chefe') {
          this.especsInimigos.push({ espec, regiao: r.id });
        }
        this.entidades.criar(espec, r.id);
      }
    }
  }

  /** Recria inimigos (após derrota) mantendo o progresso. */
  private recriarInimigos(): void {
    this.entidades.removerTodas(
      (e) => e.categoria === 'inimigo' || e.categoria === 'chefe' || e.categoria === 'projetil'
    );
    for (const { espec, regiao } of this.especsInimigos) {
      if ('id' in espec && espec.id && this.removidas.has(espec.id)) continue;
      this.entidades.criar(espec, regiao);
    }
  }

  renascer(): void {
    const j = this.jogador;
    const destino =
      this.checkpoint ??
      (() => {
        const def = this.mundo.regiaoPorId(MUNDO.regiaoInicial)!;
        const p = this.mundo.localParaMundo(def.id, def.entrada.x, def.entrada.y);
        return { x: p.x, y: p.y };
      })();
    this.recriarInimigos();
    const enigma = this.habilidades.enigmaAtual();
    if (enigma) this.habilidades.reiniciarEnigma(enigma);
    j.posicionar(destino.x, destino.y);
    j.reviver();
    this.camera.centralizar(destino.x, destino.y);
    this.estado = 'jogando';
    this.derrotaTempo = -1;
    this.emitir('jogadorRenasceu', {});
    this.salvar();
  }

  // -------------------------------------------------------------------------
  // salvamento
  // -------------------------------------------------------------------------

  agendarSalvamento(): void {
    if (this.estado === 'titulo') return;
    if (this.salvarPendente <= 0) this.salvarPendente = 0.8;
  }

  montarSalvamento(): DadosSalvos {
    const j = this.jogador;
    const { tx, ty } = this.mundo.bloco(j.x, j.y);
    const seguro = j.noChao && this.mundo.blocoSeguro(tx, ty);
    const pos = seguro ? { x: j.x, y: j.y } : j.ultimoPontoSeguro;
    return {
      versao: VERSAO_SALVAMENTO,
      versaoConteudo: MUNDO.versaoConteudo,
      criadoEm: this.criadoEm,
      atualizadoEm: Date.now(),
      jogador: {
        x: pos.x,
        y: pos.y,
        regiao: this.mundo.regiaoEm(pos.x, pos.y) ?? MUNDO.regiaoInicial,
        vida: Math.max(1, j.vida),
        vidaMaxima: j.vidaMaxima,
        inspiracao: j.inspiracao,
        inspiracaoMaxima: j.inspiracaoMaxima,
        armas: [...j.armas],
        armaAtual: j.armaAtual,
        habilidades: [...j.habilidades],
        melhorias: [...j.melhorias],
        itens: { ...j.itens },
      },
      checkpoint: this.checkpoint,
      flags: this.flags.todas(),
      missoes: this.missoes.exportar(),
      missaoAcompanhada: this.missoes.acompanhada(),
      regioesDescobertas: [...this.descobertas],
      blocosAlterados: Object.fromEntries(this.mundo.alterados),
      removidas: [...this.removidas],
      estatisticas: { ...this.stats },
      configuracoes: { ...this.config },
    };
  }

  salvar(): void {
    if (this.estado === 'titulo') return;
    if (this.jogador.estado === 'derrotado') return;
    this.tempoAutosalvar = 0;
    this.salvarPendente = -1;
    if (gravarSalvamento(this.montarSalvamento())) this.emitir('salvo', {});
  }
}

/** Passo fixo exportado para o laço principal. */
export const PASSO = PASSO_FIXO;
