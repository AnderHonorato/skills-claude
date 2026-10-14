import { desenharClaude } from '../arte/claude';
import { efeito } from '../arte/efeitos';
import { BLOCO, JOGADOR } from '../configuracao';
import type { VisualClaude } from '../contratos/arte';
import type {
  Direcao8,
  EstadoAnimClaude,
  Humor,
  IdArma,
  IdHabilidade,
  IdItem,
  IdMelhoria,
  Vetor,
} from '../contratos/base';
import type { Dano, Entidade } from '../contratos/entidades';
import type { Jogador, Jogo } from '../contratos/jogo';
import { anguloParaDirecao, aproximar, limitar } from '../motor/matematica';
import type { MundoJogo } from '../mundo/mundo';

const ORDEM_ARMAS: IdArma[] = ['espada', 'colher', 'martelo', 'cajado'];

/** Claude controlado pelo jogador. */
export class JogadorClaude implements Jogador {
  id = 'claude';
  categoria = 'jogador' as const;
  x = 0;
  y = 0;
  z = 0;
  vz = 0;
  raio = JOGADOR.raio;
  vivo = true;
  regiao: string | null = null;
  sempreAtiva = true;
  raioSombra = 9;

  direcao: Direcao8 = 2;
  angulo = Math.PI / 2;
  vida = JOGADOR.vidaInicial;
  vidaMaxima = JOGADOR.vidaInicial;
  inspiracao = JOGADOR.inspiracaoInicial;
  inspiracaoMaxima = JOGADOR.inspiracaoInicial;
  armas: IdArma[] = [];
  armaAtual: IdArma | null = null;
  habilidades = new Set<IdHabilidade>();
  melhorias = new Set<IdMelhoria>();
  itens: Partial<Record<IdItem, number>> = {};
  estado: EstadoAnimClaude = 'repouso';
  tempoEstado = 0;
  humor: Humor = 'neutro';
  humorAnterior: Humor = 'neutro';
  misturaHumor = 1;
  noChao = true;
  invulneravelPor = 0;
  determinacaoPor = 0;
  ataque: Jogador['ataque'] = null;
  habilidadeEmUso: IdHabilidade | null = null;
  controleBloqueado = false;
  ultimoPontoSeguro: Vetor = { x: 0, y: 0 };
  alvoInteracao: Entidade | null = null;

  // movimento
  vx = 0;
  vy = 0;
  private empurraoX = 0;
  private empurraoY = 0;
  private coiote = 0;
  private bufferPulo = 0;
  private esquivaRestante = 0;
  private esquivaRecarga = 0;
  private esquivaDir: Vetor = { x: 0, y: 1 };
  private aterrissagem = 0;
  private animForcada: EstadoAnimClaude | null = null;
  private animForcadaRestante = 0;
  private tempoQueda = 0;
  private tempoSeguro = 0;
  private tempoBeirada = 0;
  private velocidadeQueda = 0;
  fasePasso = 0;
  private ultimoMeioPasso = 0;
  private acumuladorInspiracao = 0;
  // humor e olhos
  private humorRestante = 0;
  private humorEvento: Humor | null = null;
  palpebra = 0;
  private proximoPiscar = 3;
  private piscando = 0;
  olhar: Vetor = { x: 0, y: 0 };

  constructor(private jogo: Jogo) {}

  private get mundo(): MundoJogo {
    return this.jogo.mundo as MundoJogo;
  }

  posicionar(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.z = 0;
    this.vz = 0;
    this.vx = 0;
    this.vy = 0;
    this.empurraoX = 0;
    this.empurraoY = 0;
    this.noChao = true;
    this.ultimoPontoSeguro = { x, y };
    this.regiao = this.mundo.regiaoEm(x, y);
  }

  profundidade(): number {
    return this.y + this.mundo.alturaChaoEm(this.x, this.y);
  }

  animar(estado: EstadoAnimClaude, duracao: number): void {
    this.animForcada = estado;
    this.animForcadaRestante = duracao;
  }

  definirHumorEvento(h: Humor, duracao: number): void {
    this.humorEvento = h;
    this.humorRestante = duracao;
  }

  private ultimaDeterminacao = -999;

  /**
   * Determinação ("aprender com o erro"): recargas 25% mais rápidas por 10 s após falhar.
   * No máximo uma vez a cada 30 s, para não virar recurso explorável.
   */
  ativarDeterminacao(forcar = false): void {
    const agora = this.jogo.tempo;
    if (!forcar && agora - this.ultimaDeterminacao < 30) return;
    this.ultimaDeterminacao = agora;
    this.determinacaoPor = 10;
  }

  empurrar(vx: number, vy: number): void {
    this.empurraoX += vx;
    this.empurraoY += vy;
  }

  curar(quantidade: number): void {
    const antes = this.vida;
    this.vida = Math.min(this.vidaMaxima, this.vida + quantidade);
    if (this.vida > antes) this.jogo.emitir('jogadorCurado', { quantidade: this.vida - antes });
  }

  receberDano(dano: Dano, jogo: Jogo): boolean {
    if (this.invulneravelPor > 0) return false;
    if (this.estado === 'derrotado' || this.estado === 'caindoNoVao') return false;
    if (this.esquivaRestante > 0) return false;
    this.vida = Math.max(0, this.vida - dano.quantidade);
    this.invulneravelPor = JOGADOR.invulneravelAposDano;
    const dx = this.x - dano.origem.x;
    const dy = this.y - dano.origem.y;
    const d = Math.hypot(dx, dy) || 1;
    const forca = dano.empurrao ?? 150;
    this.empurrar((dx / d) * forca, (dy / d) * forca);
    this.animar('dano', 0.3);
    jogo.camera.tremer(4, 0.25);
    jogo.audio.tocar('danoRecebido', { x: this.x, y: this.y });
    efeito(jogo.particulas, 'faiscaForte', this.x, this.y, { z: 10, cor: '#FF8F7E' });
    jogo.emitir('jogadorFerido', { dano: dano.quantidade, vida: this.vida });
    if (this.vida <= 0) {
      this.derrotar();
    } else if (this.vida <= 1) {
      this.definirHumorEvento('assustado', 1.6);
    } else {
      this.definirHumorEvento('assustado', 0.6);
    }
    return true;
  }

  private derrotar(): void {
    this.estado = 'derrotado';
    this.tempoEstado = 0;
    this.controleBloqueado = true;
    this.ataque = null;
    this.definirHumorEvento('frustrado', 99);
    this.jogo.audio.tocar('derrota');
    this.jogo.emitir('jogadorDerrotado', {});
  }

  /** Volta a jogar após derrota (posição definida por quem chama). */
  reviver(): void {
    this.vida = this.vidaMaxima;
    this.controleBloqueado = false;
    this.estado = 'repouso';
    this.invulneravelPor = 1.5;
    this.ativarDeterminacao(true);
    this.humorEvento = null;
    this.animar('recuperacao', 0.6);
    this.definirHumorEvento('determinado', 4);
  }

  atualizar(dt: number, jogo: Jogo): void {
    this.invulneravelPor = Math.max(0, this.invulneravelPor - dt);
    this.determinacaoPor = Math.max(0, this.determinacaoPor - dt);
    this.esquivaRecarga = Math.max(0, this.esquivaRecarga - dt);
    this.aterrissagem = Math.max(0, this.aterrissagem - dt);
    this.animForcadaRestante = Math.max(0, this.animForcadaRestante - dt);
    if (this.animForcadaRestante <= 0) this.animForcada = null;
    this.atualizarOlhos(dt);
    this.atualizarHumor(dt);
    this.regenerarInspiracao(dt);

    if (this.estado === 'derrotado') {
      this.tempoEstado += dt;
      return;
    }
    if (this.estado === 'caindoNoVao') {
      this.atualizarQuedaNoVao(dt);
      return;
    }

    const entrada = jogo.entrada;
    const livre = !this.controleBloqueado && jogo.estado === 'jogando';
    let mov: Vetor = livre ? entrada.movimento() : { x: 0, y: 0 };
    const correndo = livre && entrada.correndo();
    const noAgua =
      this.noChao &&
      this.mundo.codigoEm(Math.floor(this.x / BLOCO), Math.floor(this.y / BLOCO)) === '~';

    // ----- esquiva -----
    if (
      livre &&
      entrada.apertou('esquivar') &&
      this.esquivaRecarga <= 0 &&
      this.noChao &&
      !this.ataque
    ) {
      const m = Math.hypot(mov.x, mov.y);
      this.esquivaDir =
        m > 0.1
          ? { x: mov.x / m, y: mov.y / m }
          : { x: Math.cos(this.angulo), y: Math.sin(this.angulo) };
      this.esquivaRestante = JOGADOR.esquivaDuracao;
      this.esquivaRecarga = JOGADOR.esquivaRecarga;
      this.invulneravelPor = Math.max(this.invulneravelPor, JOGADOR.esquivaInvulneravel);
      jogo.audio.tocar('esquiva', { tom: 0.95 + Math.random() * 0.1 });
      jogo.emitir('jogadorEsquivou', {});
    }

    // ----- velocidade horizontal -----
    let alvoVx: number;
    let alvoVy: number;
    if (this.esquivaRestante > 0) {
      this.esquivaRestante -= dt;
      alvoVx = this.esquivaDir.x * JOGADOR.esquivaVelocidade;
      alvoVy = this.esquivaDir.y * JOGADOR.esquivaVelocidade;
      this.vx = alvoVx;
      this.vy = alvoVy;
      if (Math.random() < 0.6) efeito(jogo.particulas, 'rastroEsquiva', this.x, this.y, { z: 8 });
    } else {
      const ataqueLento = this.ataque ? 0.35 : 1;
      const vel =
        (correndo ? JOGADOR.velocidadeCorrer : JOGADOR.velocidadeAndar) *
        ataqueLento *
        (noAgua ? 0.6 : 1);
      alvoVx = mov.x * vel;
      alvoVy = mov.y * vel;
      const acel = this.noChao ? JOGADOR.aceleracaoChao : JOGADOR.aceleracaoAr;
      const dvx = alvoVx - this.vx;
      const dvy = alvoVy - this.vy;
      const dv = Math.hypot(dvx, dvy);
      const passo = acel * dt;
      if (dv <= passo) {
        this.vx = alvoVx;
        this.vy = alvoVy;
      } else {
        this.vx += (dvx / dv) * passo;
        this.vy += (dvy / dv) * passo;
      }
    }
    this.empurraoX = aproximar(this.empurraoX, 0, 9, dt);
    this.empurraoY = aproximar(this.empurraoY, 0, 9, dt);

    // ----- mover com colisão -----
    const dx = (this.vx + this.empurraoX) * dt;
    const dy = (this.vy + this.empurraoY) * dt;
    const podeCair = !this.noChao || this.tempoBeirada > 0.35;
    const antesX = this.x;
    const antesY = this.y;
    const movido = jogo.fisica.mover(this, dx, dy, { podeCairEmVao: podeCair });
    // Beirada: segurando contra o vazio por um tempo permite descer de propósito.
    if (this.noChao && this.esquivaRestante <= 0 && (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01)) {
      const bloqueado = Math.hypot(dx - movido.x, dy - movido.y) > 0.3 * Math.hypot(dx, dy);
      const frente = { x: this.x + Math.sign(dx) * 10, y: this.y + Math.sign(dy) * 10 };
      if (bloqueado && !this.mundo.temChao(frente.x, frente.y)) {
        if (this.tempoBeirada === 0) this.definirHumorEvento('assustado', 0.5);
        this.tempoBeirada += dt;
      } else {
        this.tempoBeirada = 0;
      }
    } else if (this.noChao) {
      this.tempoBeirada = 0;
    }
    const andou = Math.hypot(this.x - antesX, this.y - antesY);

    // ----- direção -----
    if (this.ataque) {
      this.angulo = this.ataque.angulo;
    } else if (this.esquivaRestante > 0) {
      this.angulo = Math.atan2(this.esquivaDir.y, this.esquivaDir.x);
    } else if (Math.hypot(mov.x, mov.y) > 0.15) {
      this.angulo = Math.atan2(mov.y, mov.x);
    }
    this.direcao = anguloParaDirecao(this.angulo);

    // ----- pulo e gravidade -----
    this.bufferPulo = Math.max(0, this.bufferPulo - dt);
    this.coiote = Math.max(0, this.coiote - dt);
    if (livre && entrada.apertou('pular')) this.bufferPulo = JOGADOR.tempoBufferPulo;
    if (this.bufferPulo > 0 && (this.noChao || this.coiote > 0) && this.esquivaRestante <= 0) {
      this.pular();
    }
    this.atualizarVertical(dt);
    if ((this.estado as EstadoAnimClaude) === 'caindoNoVao') return;

    // ----- passos -----
    if (this.noChao && andou > 0.05) {
      this.fasePasso = (this.fasePasso + andou / (JOGADOR.passada * 2)) % 1;
      const meio = Math.floor(this.fasePasso * 2);
      if (meio !== this.ultimoMeioPasso) {
        this.ultimoMeioPasso = meio;
        jogo.audio.tocar(noAgua ? 'passoAgua' : 'passo', {
          volume: correndo ? 0.55 : 0.35,
          tom: 0.9 + Math.random() * 0.2,
        });
        if (noAgua) efeito(jogo.particulas, 'respingo', this.x, this.y, { intensidade: 0.4 });
        else if (correndo)
          efeito(jogo.particulas, 'poeiraPasso', this.x, this.y, { intensidade: 0.5 });
      }
    }

    // ----- ponto seguro -----
    this.tempoSeguro += dt;
    if (this.noChao && this.tempoSeguro > 0.25) {
      this.tempoSeguro = 0;
      const { tx, ty } = this.mundo.bloco(this.x, this.y);
      if (
        this.mundo.blocoSeguro(tx, ty) &&
        this.mundo.temChao(this.x + 14, this.y) &&
        this.mundo.temChao(this.x - 14, this.y) &&
        this.mundo.temChao(this.x, this.y + 14) &&
        this.mundo.temChao(this.x, this.y - 14) &&
        this.mundo.alturaChaoEm(this.x, this.y) === 0
      ) {
        this.ultimoPontoSeguro = { x: this.x, y: this.y };
      }
    }
    this.regiao = this.mundo.regiaoEm(this.x, this.y) ?? this.regiao;

    // ----- ações -----
    if (livre) this.processarAcoes(jogo);
    this.escolherAnimacao(dt, correndo);
    this.atualizarAlvoInteracao(jogo);
  }

  private pular(): void {
    const jogo = this.jogo;
    this.vz = this.melhorias.has('botasMola') ? JOGADOR.impulsoPuloBotas : JOGADOR.impulsoPulo;
    this.noChao = false;
    this.coiote = 0;
    this.bufferPulo = 0;
    this.z = Math.max(this.z, 0.5);
    jogo.audio.tocar('pulo', { tom: 0.95 + Math.random() * 0.1 });
    efeito(jogo.particulas, 'poeiraPasso', this.x, this.y, { intensidade: 0.8 });
    jogo.emitir('jogadorPulou', {});
  }

  private atualizarVertical(dt: number): void {
    const temChao = this.mundo.temChao(this.x, this.y);
    if (this.noChao) {
      if (!temChao) {
        this.noChao = false;
        this.vz = 0;
        this.coiote = this.tempoBeirada > 0.35 ? 0 : JOGADOR.tempoCoiote;
      } else if (this.z > 0.5) {
        this.noChao = false;
        this.vz = 0;
      } else {
        this.z = 0;
      }
      return;
    }
    this.vz -= JOGADOR.gravidade * dt;
    this.z += this.vz * dt;
    this.velocidadeQueda = Math.max(this.velocidadeQueda, -this.vz);
    if (this.z <= 0) {
      if (temChao) {
        this.z = 0;
        this.noChao = true;
        const vq = this.velocidadeQueda;
        this.velocidadeQueda = 0;
        this.vz = 0;
        this.aterrissagem = vq > JOGADOR.quedaPesada ? 0.18 : 0.1;
        this.jogo.audio.tocar('aterrissagem', {
          volume: limitar(vq / 400, 0.25, 0.9),
          tom: 0.95 + Math.random() * 0.1,
        });
        efeito(this.jogo.particulas, 'poeiraAterrissagem', this.x, this.y, {
          intensidade: limitar(vq / 300, 0.4, 1.4),
        });
        this.jogo.emitir('jogadorAterrissou', { velocidadeQueda: vq });
      } else if (this.z < -6) {
        this.iniciarQuedaNoVao();
      }
    }
  }

  private iniciarQuedaNoVao(): void {
    this.estado = 'caindoNoVao';
    this.tempoEstado = 0;
    this.tempoQueda = 0;
    this.ataque = null;
    this.vx = 0;
    this.vy = 0;
    this.jogo.audio.tocar('quedaVao');
    this.definirHumorEvento('frustrado', 1.2);
  }

  private atualizarQuedaNoVao(dt: number): void {
    this.tempoQueda += dt;
    this.tempoEstado += dt;
    this.z -= 120 * dt;
    if (this.tempoQueda > 0.75) {
      const p = this.ultimoPontoSeguro;
      this.x = p.x;
      this.y = p.y;
      this.z = 0;
      this.vz = 0;
      this.noChao = true;
      this.estado = 'repouso';
      this.tempoBeirada = 0;
      const emEnigma = (() => {
        try {
          return !!this.jogo.habilidades.enigmaAtual();
        } catch {
          return false;
        }
      })();
      const dano = emEnigma ? 0 : JOGADOR.danoQueda;
      this.vida = Math.max(Math.min(this.vida, 0.5), this.vida - dano);
      this.invulneravelPor = 1.2;
      this.ativarDeterminacao();
      this.animar('recuperacao', 0.5);
      this.definirHumorEvento('determinado', 3);
      this.jogo.emitir('jogadorQueda', {});
      if (dano > 0) this.jogo.emitir('jogadorFerido', { dano, vida: this.vida });
    }
  }

  private processarAcoes(jogo: Jogo): void {
    const e = jogo.entrada;
    // armas
    const trocar = (i: number) => {
      const id = ORDEM_ARMAS[i];
      if (id && this.armas.includes(id) && this.armaAtual !== id) {
        this.armaAtual = id;
        jogo.audio.tocar('uiNavegar');
      }
    };
    if (e.apertou('arma1')) trocar(0);
    if (e.apertou('arma2')) trocar(1);
    if (e.apertou('arma3')) trocar(2);
    if (e.apertou('arma4')) trocar(3);
    if (e.apertou('armaProxima') && this.armas.length > 1) {
      const possuidas = ORDEM_ARMAS.filter((a) => this.armas.includes(a));
      const i = possuidas.indexOf(this.armaAtual ?? possuidas[0]!);
      this.armaAtual = possuidas[(i + 1) % possuidas.length]!;
      jogo.audio.tocar('uiNavegar');
    }
    // interação tem prioridade sobre ataque quando há alvo
    if (e.apertou('interagir') && this.alvoInteracao) {
      const alvo = this.alvoInteracao;
      this.angulo = Math.atan2(alvo.y - this.y, alvo.x - this.x);
      this.animar('interacao', 0.35);
      alvo.aoInteragir?.(jogo);
      e.consumir('interagir');
      e.consumir('avancar');
    }
    if (e.apertou('atacar') && this.armaAtual && this.esquivaRestante <= 0) {
      jogo.combate.atacar();
    }
    const usar = (h: IdHabilidade) => {
      if (!this.habilidades.has(h)) return;
      jogo.habilidades.usar(h, { ponto: e.mira(), direcao: e.miraToque() });
    };
    if (e.apertou('observar')) usar('observar');
    if (e.apertou('conectar')) usar('conectar');
    if (e.apertou('criar')) usar('criar');
    if (e.apertou('curar')) this.usarCaldo();
  }

  usarCaldo(): void {
    const jogo = this.jogo;
    const n = this.itens.caldo ?? 0;
    if (n <= 0 || this.vida >= this.vidaMaxima) return;
    this.itens.caldo = n - 1;
    this.curar(2);
    this.animar('interacao', 0.4);
    jogo.audio.tocar('curar');
    efeito(jogo.particulas, 'cura', this.x, this.y, { z: 10 });
    this.definirHumorEvento('alegre', 1);
  }

  private escolherAnimacao(dt: number, correndo: boolean): void {
    let novo: EstadoAnimClaude;
    const velocidade = Math.hypot(this.vx, this.vy);
    if (this.animForcada) novo = this.animForcada;
    else if (this.ataque) novo = 'ataque';
    else if (this.esquivaRestante > 0) novo = 'esquiva';
    else if (!this.noChao) novo = this.vz > 0 ? 'pulo' : 'queda';
    else if (this.aterrissagem > 0) novo = 'aterrissagem';
    else if (velocidade > 100 && correndo) novo = 'corrida';
    else if (velocidade > 8) novo = 'caminhada';
    else novo = 'repouso';
    if (novo !== this.estado) {
      this.estado = novo;
      this.tempoEstado = 0;
    } else {
      this.tempoEstado += dt;
    }
  }

  private atualizarAlvoInteracao(jogo: Jogo): void {
    let melhor: Entidade | null = null;
    let melhorNota = Infinity;
    const fx = Math.cos(this.angulo);
    const fy = Math.sin(this.angulo);
    for (const e of jogo.entidades.proximas(this.x, this.y, 64)) {
      if (e === this || !e.textoInteracao) continue;
      const alcance = e.alcanceInteracao ?? 34;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > alcance) continue;
      if (!e.textoInteracao(jogo)) continue;
      const frente = d > 1 ? (dx * fx + dy * fy) / d : 1;
      const nota = d - frente * 12;
      if (nota < melhorNota) {
        melhorNota = nota;
        melhor = e;
      }
    }
    this.alvoInteracao = melhor;
  }

  private atualizarOlhos(dt: number): void {
    if (this.piscando > 0) {
      this.piscando -= dt;
      const t = 1 - this.piscando / 0.14;
      this.palpebra = t < 0.5 ? t * 2 : (1 - t) * 2;
      if (this.piscando <= 0) this.palpebra = 0;
    } else {
      this.proximoPiscar -= dt;
      if (this.proximoPiscar <= 0) {
        this.piscando = 0.14;
        this.proximoPiscar = 2.2 + Math.random() * 3.5;
      }
    }
    // olhar acompanha o alvo de interação ou o inimigo mais próximo
    let alvo: Entidade | null = this.alvoInteracao;
    if (!alvo) {
      const inimigos = this.jogo.entidades.proximas(
        this.x,
        this.y,
        140,
        (e) => e.categoria === 'inimigo' || e.categoria === 'chefe'
      );
      alvo = inimigos[0] ?? null;
    }
    const alvoOlhar = alvo
      ? { x: limitar((alvo.x - this.x) / 60, -1, 1), y: limitar((alvo.y - this.y) / 60, -1, 1) }
      : { x: 0, y: 0 };
    this.olhar.x = aproximar(this.olhar.x, alvoOlhar.x, 8, dt);
    this.olhar.y = aproximar(this.olhar.y, alvoOlhar.y, 8, dt);
  }

  private atualizarHumor(dt: number): void {
    if (this.humorRestante > 0) {
      this.humorRestante -= dt;
      if (this.humorRestante <= 0) this.humorEvento = null;
    }
    let base: Humor = 'neutro';
    try {
      if (this.jogo.habilidades.enigmaAtual()) base = 'concentrado';
    } catch {
      /* sistema ainda não pronto */
    }
    if (this.determinacaoPor > 0 && base === 'neutro') base = 'determinado';
    const alvo = this.humorEvento ?? base;
    if (alvo !== this.humor) {
      this.humorAnterior = this.humor;
      this.humor = alvo;
      this.misturaHumor = 0;
      this.jogo.emitir('humorMudou', { humor: alvo });
    }
    this.misturaHumor = Math.min(1, this.misturaHumor + dt / 0.25);
  }

  private regenerarInspiracao(dt: number): void {
    if (this.inspiracao >= this.inspiracaoMaxima) {
      this.acumuladorInspiracao = 0;
      return;
    }
    this.acumuladorInspiracao += dt;
    const emCombate = this.jogo.combate.intensidade() > 0.3;
    const intervalo = emCombate ? JOGADOR.recargaInspiracao : JOGADOR.recargaInspiracaoForaCombate;
    if (this.acumuladorInspiracao >= intervalo) {
      this.acumuladorInspiracao = 0;
      this.inspiracao = Math.min(this.inspiracaoMaxima, this.inspiracao + 1);
    }
  }

  visual(): VisualClaude {
    const alturaChao = this.mundo.temChao(this.x, this.y)
      ? this.mundo.alturaChaoEm(this.x, this.y)
      : 0;
    const caindo = this.estado === 'caindoNoVao';
    const ataque = this.ataque
      ? {
          progresso: limitar(this.ataque.t / this.ataque.duracao, 0, 1),
          combo: this.ataque.combo,
          angulo: this.ataque.angulo,
        }
      : null;
    return {
      x: this.x,
      ySolo: this.y - alturaChao,
      z: this.z,
      direcao: this.direcao,
      estado: this.estado,
      tempoEstado: this.tempoEstado,
      fasePasso: this.fasePasso,
      velocidade: limitar(Math.hypot(this.vx, this.vy) / JOGADOR.velocidadeCorrer, 0, 1),
      vz: this.vz,
      humor: this.humor,
      humorAnterior: this.humorAnterior,
      misturaHumor: this.misturaHumor,
      palpebra: this.palpebra,
      arma: this.armaAtual,
      ataque,
      habilidade: this.habilidadeEmUso,
      invulneravel:
        this.invulneravelPor > 0 && this.estado !== 'derrotado' && this.estado !== 'recuperacao',
      escala: caindo ? Math.max(0.15, 1 - this.tempoQueda * 1.1) : 1,
      alpha: caindo ? Math.max(0, 1 - this.tempoQueda * 1.2) : 1,
      tempo: this.jogo.tempo,
      olhar: { ...this.olhar },
      determinado: this.determinacaoPor > 0,
    };
  }

  desenhar(ctx: CanvasRenderingContext2D): void {
    desenharClaude(ctx, this.visual());
  }
}
