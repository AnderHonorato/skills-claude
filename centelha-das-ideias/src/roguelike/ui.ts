/**
 * Interface do roguelike: escolha de personagem, HUD (experiência, vida, tempo,
 * habilidades com recarga, chefe), cartas de subida de nível, pausa, fim de
 * partida e controles de toque (joystick + esquiva).
 */
import { ELEMENTOS, HABILIDADES, PASSIVAS, habilidade, passiva } from './dados/habilidades';
import { PERSONAGENS, type DefPersonagem, type IdPersonagem } from './dados/personagens';
import { CORES_JOGADOR } from './jogo/jogador';
import type { Partida } from './jogo/partida';
import { PainelSala } from './ui-sala';
import {
  ATRIBUTOS_BASE,
  MAX_ATIVAS,
  MAX_PASSIVAS,
  descreverMelhoria,
  valoresHabilidade,
  type Atributos,
  type Oferta,
} from './nucleo/progresso';

const ROTULOS: Partial<Record<keyof Atributos, { nome: string; formato: 'pct' | 'num' | 'mult' }>> =
  {
    vidaMaxima: { nome: 'Vida', formato: 'num' },
    regeneracao: { nome: 'Regeneração', formato: 'num' },
    velocidade: { nome: 'Velocidade', formato: 'mult' },
    dano: { nome: 'Dano', formato: 'mult' },
    area: { nome: 'Área', formato: 'mult' },
    recarga: { nome: 'Recarga', formato: 'mult' },
    quantidade: { nome: 'Projéteis', formato: 'num' },
    velocidadeProjetil: { nome: 'Vel. projéteis', formato: 'mult' },
    duracao: { nome: 'Duração', formato: 'mult' },
    ima: { nome: 'Ímã', formato: 'num' },
    sorte: { nome: 'Sorte', formato: 'pct' },
    armadura: { nome: 'Armadura', formato: 'num' },
    xp: { nome: 'Experiência', formato: 'mult' },
  };

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe?: string,
  texto?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function relogio(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Chips com o que o personagem tem de diferente da base. */
function chipsAtributos(def: DefPersonagem): { texto: string; bom: boolean }[] {
  const r: { texto: string; bom: boolean }[] = [];
  for (const [k, v] of Object.entries(def.atributos) as [keyof Atributos, number][]) {
    const rot = ROTULOS[k];
    if (!rot) continue;
    const base = ATRIBUTOS_BASE[k];
    const menorMelhor = k === 'recarga';
    let texto: string;
    let delta: number;
    if (rot.formato === 'mult') {
      delta = Math.round((v / (base || 1) - 1) * 100);
      texto = `${rot.nome} ${delta > 0 ? '+' : ''}${delta}%`;
    } else if (rot.formato === 'pct') {
      delta = Math.round((v - base) * 100);
      texto = `${rot.nome} ${delta > 0 ? '+' : ''}${delta}%`;
    } else {
      delta = k === 'vidaMaxima' ? v - base : v;
      texto =
        k === 'vidaMaxima'
          ? `${rot.nome} ${v}`
          : `${rot.nome} ${delta > 0 ? '+' : ''}${Math.round(delta * 100) / 100}`;
    }
    r.push({ texto, bom: menorMelhor ? delta < 0 : delta > 0 });
  }
  return r;
}

export class InterfaceSobrevivencia {
  private raiz: HTMLElement;
  private camadaMenu = el('div', 'rg-menu');
  private hud = el('div', 'rg-hud');
  private modal = el('div', 'rg-modal');
  private toque = el('div', 'rg-toque');
  private estadoDesenhado = '';
  /** Personagem escolhido no menu (sempre o mesmo que a partida conhece). */
  private get selecao(): IdPersonagem {
    return this.partida.personagemId;
  }

  // HUD
  private barraXp = el('div', 'rg-xp-preench');
  private textoNivel = el('div', 'rg-xp-nivel');
  private barraVida = el('div', 'rg-vida-preench');
  private textoVida = el('div', 'rg-vida-texto');
  private textoTempo = el('div', 'rg-tempo');
  private textoAbates = el('div', 'rg-abates');
  private slotsAtivas: {
    raiz: HTMLElement;
    icone: HTMLElement;
    nivel: HTMLElement;
    sombra: HTMLElement;
    id: string;
  }[] = [];
  private slotsPassivas: {
    raiz: HTMLElement;
    icone: HTMLElement;
    nivel: HTMLElement;
    id: string;
  }[] = [];
  private chefe = el('div', 'rg-chefe');
  private chefeBarra = el('div', 'rg-chefe-preench');
  private chefeNome = el('div', 'rg-chefe-nome');
  private avisoChefe = el('div', 'rg-aviso-chefe');
  private banner = el('div', 'rg-banner');
  private bannerTexto = el('div', 'rg-banner-texto');
  private bannerSub = el('div', 'rg-banner-sub');
  private ultimoBanner = '';
  private numeros: HTMLElement[] = [];
  private vinheta = el('div', 'rg-vinheta');
  private dashBotao = el('button', 'rg-dash');
  private cache = new Map<string, string>();
  /** Multijogador local: painel da sala, etiquetas sobre os colegas e mini barras de vida. */
  readonly sala: PainelSala;
  private etiquetas: HTMLElement[] = [];
  private equipe = el('div', 'rg-equipe');
  private linhasEquipe: { raiz: HTMLElement; nome: HTMLElement; barra: HTMLElement }[] = [];

  constructor(
    private partida: Partida,
    raiz: HTMLElement
  ) {
    this.raiz = raiz;
    raiz.classList.add('rg');
    this.sala = new PainelSala(partida);
    this.sala.aoMudar = () => {
      this.estadoDesenhado = '';
      this.renderizarEstado();
    };
    raiz.append(this.vinheta, this.hud, this.camadaMenu, this.modal, this.toque, this.sala.raiz);
    this.montarHud();
    this.montarToque();
    partida.aoMudar = () => this.renderizarEstado();
    window.addEventListener('keydown', (e) => this.tecla(e));
    this.renderizarEstado();
  }

  // ------------------------------------------------------------------ teclado do menu

  private tecla(e: KeyboardEvent): void {
    const p = this.partida;
    if (this.sala.aberto) return;
    if (p.estado === 'menu') {
      const i = PERSONAGENS.findIndex((d) => d.id === this.selecao);
      const colunas = window.innerWidth < 720 ? 2 : 3;
      let n = i;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') n = (i + 1) % PERSONAGENS.length;
      else if (e.code === 'ArrowLeft' || e.code === 'KeyA')
        n = (i - 1 + PERSONAGENS.length) % PERSONAGENS.length;
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') n = (i + colunas) % PERSONAGENS.length;
      else if (e.code === 'ArrowUp' || e.code === 'KeyW')
        n = (i - colunas + PERSONAGENS.length) % PERSONAGENS.length;
      else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.comecar();
        return;
      }
      if (n !== i) this.selecionar(PERSONAGENS[n].id);
    } else if (p.estado === 'fim') {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        this.comecar();
      } else if (e.code === 'Escape') this.voltarAoMenu();
    }
  }

  // ------------------------------------------------------------------ estados

  /** Estado que a tela mostra (em grupo, a pausa é só deste aparelho). */
  private get estadoTela(): string {
    const p = this.partida;
    if (p.pausaLocal && (p.estado === 'jogando' || p.estado === 'nivel')) return 'pausa';
    return p.estado;
  }

  private renderizarEstado(): void {
    const p = this.partida;
    const est = this.estadoTela;
    const s = this.sala.sessao;
    const chave = [
      est,
      est === 'nivel'
        ? p.ofertas.map((o) => o.id + o.nivelAtual).join(',') +
          p.rerrolagens +
          (p.local.escolheu ? p.jogadores.map((jg) => (jg.escolheu ? 1 : 0)).join('') : '')
        : '',
      this.selecao,
      s ? `${s.papel}:${s.membros.map((m) => m.indice + m.personagem).join(',')}` : 'solo',
    ].join('|');
    if (chave === this.estadoDesenhado) return;
    this.estadoDesenhado = chave;
    this.raiz.dataset.estado = est;
    if (est !== 'menu') this.sala.raiz.hidden = true;
    this.camadaMenu.hidden = est !== 'menu';
    this.hud.hidden = est === 'menu';
    this.toque.hidden = est !== 'jogando';
    this.modal.replaceChildren();
    this.modal.hidden = true;
    if (est === 'menu') this.desenharMenu();
    else if (est === 'nivel') this.desenharNivel();
    else if (est === 'pausa') this.desenharPausa();
    else if (est === 'fim') this.desenharFim();
  }

  private voltarAoMenu(): void {
    const s = this.sala.sessao;
    if (s?.papel === 'anfitriao') s.voltarParaSala();
    else if (s) s.sair();
    else this.partida.voltarMenu();
  }

  private selecionar(id: IdPersonagem, falar = true): void {
    if (this.selecao === id && !falar) return;
    this.partida.escolherPersonagem(id);
    this.sala.sessao?.trocarPersonagem(id);
    this.partida.audio.tocar('uiNavegar');
    if (falar) {
      const def = this.partida.def;
      this.partida.vozes.falar(def.falas.inicio[0], def.voz, true, 0.9);
    }
    this.estadoDesenhado = '';
    this.renderizarEstado();
  }

  private comecar(): void {
    this.partida.audio.desbloquear();
    const s = this.sala.sessao;
    if (s) {
      if (s.papel === 'anfitriao') {
        this.partida.audio.tocar('uiConfirmar');
        s.iniciarPartida();
      }
      return;
    }
    this.partida.audio.tocar('uiConfirmar');
    this.partida.iniciar();
  }

  private desenharMenu(): void {
    const c = this.camadaMenu;
    c.replaceChildren();
    const painel = el('div', 'rg-menu-painel');
    const topo = el('div', 'rg-menu-topo');
    topo.append(
      el('div', 'rg-menu-sobre', 'Claude — A Centelha das Ideias'),
      el('h1', 'rg-menu-titulo', 'Sobrevivência'),
      el('p', 'rg-menu-lema', 'Escolha uma mente, sobreviva ao Ruído e evolua até 10 habilidades.')
    );
    painel.append(topo);

    const grade = el('div', 'rg-cartas-personagem');
    for (const def of PERSONAGENS) {
      const b = el('button', 'rg-carta-personagem');
      b.type = 'button';
      b.style.setProperty('--cor', def.cor);
      if (def.id === this.selecao) b.classList.add('selecionado');
      const bolinha = el('span', 'rg-personagem-cor');
      const nome = el('span', 'rg-personagem-nome', def.nome);
      const tit = el('span', 'rg-personagem-titulo', def.titulo);
      b.append(bolinha, nome, tit);
      b.addEventListener('click', () => {
        this.partida.audio.desbloquear();
        if (this.selecao === def.id) this.comecar();
        else this.selecionar(def.id);
      });
      b.setAttribute('aria-pressed', String(def.id === this.selecao));
      grade.append(b);
    }
    painel.append(grade);

    const def = PERSONAGENS.find((d) => d.id === this.selecao)!;
    const hab = habilidade(def.habilidadeInicial);
    const det = el('div', 'rg-detalhe');
    det.style.setProperty('--cor', def.cor);
    det.append(
      el('div', 'rg-detalhe-nome', `${def.nome} · ${def.titulo}`),
      el('p', 'rg-detalhe-desc', def.descricao)
    );
    const habEl = el('div', 'rg-detalhe-hab');
    const ic = el('span', 'rg-icone', hab.icone);
    ic.style.setProperty('--cor', hab.cor);
    const txt = el('div');
    txt.append(
      el('strong', undefined, `Começa com: ${hab.nome}`),
      el('span', 'rg-elemento', ` · ${ELEMENTOS[hab.elemento].nome}`),
      el('div', 'rg-detalhe-hab-desc', hab.descricao)
    );
    habEl.append(ic, txt);
    det.append(habEl);
    const chips = el('div', 'rg-chips');
    for (const ch of chipsAtributos(def))
      chips.append(el('span', ch.bom ? 'rg-chip bom' : 'rg-chip ruim', ch.texto));
    det.append(chips);
    let melhor = 0;
    try {
      melhor = Number(localStorage.getItem(`centelha-sobrevivencia:melhor:${def.id}`) ?? 0);
    } catch {
      melhor = 0;
    }
    det.append(
      el(
        'div',
        'rg-recorde',
        melhor > 0 ? `Seu recorde: ${relogio(melhor)}` : 'Ainda sem recorde com esta mente'
      )
    );
    painel.append(det);

    const acoes = el('div', 'rg-menu-acoes');
    const s = this.sala.sessao;
    const jogar = el(
      'button',
      'rg-botao principal',
      !s
        ? `Jogar com ${def.nome}`
        : s.papel === 'anfitriao'
          ? `Começar com ${s.membros.length} jogador${s.membros.length > 1 ? 'es' : ''}`
          : 'Esperando o anfitrião começar…'
    );
    jogar.type = 'button';
    jogar.disabled = s?.papel === 'convidado';
    jogar.addEventListener('click', () => this.comecar());
    acoes.append(jogar);
    const junto = el(
      'button',
      'rg-botao rg-botao-junto',
      s ? `Sala: ${s.membros.length}/4 jogadores` : 'Jogar junto (mesmo Wi-Fi)'
    );
    junto.type = 'button';
    junto.addEventListener('click', () => {
      this.partida.audio.desbloquear();
      this.sala.abrir();
    });
    acoes.append(junto);
    painel.append(acoes);

    const rod = el('div', 'rg-menu-rodape');
    const ajuda = el('span', 'rg-ajuda');
    ajuda.textContent = window.matchMedia?.('(pointer: coarse)').matches
      ? 'Arraste para andar · botão para esquivar · as habilidades disparam sozinhas'
      : 'WASD/setas: andar · Espaço: esquiva · 1–4: escolher carta · R: sortear de novo · Esc: pausa';
    const link = el('a', 'rg-link', 'Jogar a aventura clássica →');
    link.href = '?modo=aventura';
    rod.append(ajuda, link);
    painel.append(rod);
    c.append(painel);
    c.append(
      el(
        'div',
        'rg-contagem',
        `${HABILIDADES.length} habilidades · ${PASSIVAS.length} passivas · ${PERSONAGENS.length} mentes`
      )
    );
  }

  private desenharNivel(): void {
    const p = this.partida;
    this.modal.hidden = false;
    if (p.local.escolheu || p.local.caido) {
      const caixa = el('div', 'rg-caixa rg-caixa-espera');
      const faltam = p.jogadores.filter((jg) => !jg.escolheu).map((jg) => jg.def.nome);
      caixa.append(
        el('div', 'rg-nivel-sobre', 'Subiu de nível!'),
        el('h2', undefined, 'Esperando os outros escolherem…'),
        el('p', 'rg-nivel-dica', faltam.length ? `Falta: ${faltam.join(', ')}` : 'Quase…')
      );
      this.modal.append(caixa);
      return;
    }
    const caixa = el('div', 'rg-caixa rg-caixa-nivel');
    caixa.append(
      el('div', 'rg-nivel-sobre', 'Subiu de nível!'),
      el('h2', 'rg-nivel-titulo', `Nível ${p.nivel - p.niveisPendentes + 1}`),
      el('p', 'rg-nivel-dica', 'Escolha uma melhoria. O que você já tem aparece mais vezes.')
    );
    const cartas = el('div', 'rg-cartas');
    p.ofertas.forEach((o, i) => cartas.append(this.carta(o, i)));
    caixa.append(cartas);
    const rod = el('div', 'rg-nivel-rodape');
    const rer = el('button', 'rg-botao', `Sortear de novo (${p.rerrolagens}) · R`);
    rer.type = 'button';
    rer.disabled = p.rerrolagens <= 0;
    rer.addEventListener('click', () => p.rerrolar());
    rod.append(
      rer,
      el(
        'span',
        'rg-slots-info',
        `Ativas ${p.build.ativas.length}/${MAX_ATIVAS} · Passivas ${p.build.passivas.length}/${MAX_PASSIVAS}`
      )
    );
    caixa.append(rod);
    this.modal.append(caixa);
  }

  private carta(o: Oferta, i: number): HTMLElement {
    const p = this.partida;
    const b = el('button', 'rg-carta');
    b.type = 'button';
    b.style.animationDelay = `${i * 70}ms`;
    let icone = '';
    let nome = '';
    let cor = '#ffd27a';
    let corpo = '';
    let tag = '';
    let sub = '';
    if (o.tipo === 'ativa') {
      const d = habilidade(o.id);
      icone = d.icone;
      nome = d.nome;
      cor = d.cor;
      corpo = descreverMelhoria(d, o.nivelAtual);
      sub = `${ELEMENTOS[d.elemento].nome} · ${ELEMENTOS[d.elemento].efeito}`;
      if (o.nivelAtual > 0) {
        const v = valoresHabilidade(d, o.nivelAtual + 1, p.atributos);
        sub += ` · recarga ${v.recarga.toFixed(1)}s`;
      }
    } else if (o.tipo === 'passiva') {
      const d = passiva(o.id);
      icone = d.icone;
      nome = d.nome;
      cor = '#b8c9ff';
      const val =
        d.formato === 'porcento'
          ? `${d.porNivel > 0 ? '+' : ''}${Math.round(d.porNivel * 100)}%`
          : d.formato === 'metros'
            ? `+${d.porNivel} m`
            : `+${d.porNivel}`;
      corpo = `${d.descricao} ${val}`;
      sub = 'Passiva';
    } else if (o.tipo === 'cura') {
      icone = '♥';
      nome = 'Respirar fundo';
      cor = '#ff7a9a';
      corpo = 'Recupera 30% da vida.';
      sub = 'Tudo no máximo';
    } else {
      icone = '◈';
      nome = 'Fragmentos';
      cor = '#ffd27a';
      corpo = '+25 de ouro.';
      sub = 'Tudo no máximo';
    }
    if (o.novo) tag = 'NOVA';
    else if (o.tipo === 'ativa' || o.tipo === 'passiva')
      tag = `Nv ${o.nivelAtual} → ${o.nivelAtual + 1}`;
    b.style.setProperty('--cor', cor);
    if (o.evolucao) b.classList.add('evolucao');
    if (o.novo) b.classList.add('nova');
    const topo = el('div', 'rg-carta-topo');
    topo.append(
      el('span', 'rg-tecla', String(i + 1)),
      el('span', 'rg-carta-tag', o.evolucao ? '★ EVOLUÇÃO' : tag)
    );
    const ic = el('div', 'rg-carta-icone', icone);
    const n = el('div', 'rg-carta-nome', nome);
    const s = el('div', 'rg-carta-sub', sub);
    const c = el('div', 'rg-carta-corpo', corpo);
    b.append(topo, ic, n, s, c);
    if (o.tipo === 'ativa' || o.tipo === 'passiva') {
      const pontos = el('div', 'rg-carta-pontos');
      for (let k = 1; k <= 10; k++) {
        const pt = el(
          'span',
          k <= o.nivelAtual ? 'cheio' : k === o.nivelAtual + 1 ? 'proximo' : ''
        );
        if (k === 5 || k === 10) pt.classList.add('marco');
        pontos.append(pt);
      }
      b.append(pontos);
    }
    b.addEventListener('click', () => p.escolherOferta(i));
    return b;
  }

  private desenharPausa(): void {
    const p = this.partida;
    this.modal.hidden = false;
    const caixa = el('div', 'rg-caixa rg-caixa-pausa');
    caixa.append(el('h2', undefined, 'Pausa'));
    if (p.papel !== 'solo')
      caixa.append(
        el(
          'p',
          'rg-nivel-dica',
          'Em grupo o jogo continua para os outros. Você fica protegido até voltar.'
        )
      );
    const cont = el('button', 'rg-botao principal', 'Continuar');
    cont.type = 'button';
    cont.addEventListener('click', () => p.pausar(false));
    caixa.append(cont);
    for (const [canal, nome] of [
      ['geral', 'Volume geral'],
      ['musica', 'Música'],
      ['efeitos', 'Efeitos e vozes'],
    ] as const) {
      const linha = el('label', 'rg-controle');
      const r = el('input');
      r.type = 'range';
      r.min = '0';
      r.max = '1';
      r.step = '0.05';
      r.value = String(p.audio.volume(canal));
      r.addEventListener('input', () => p.audio.definirVolume(canal, Number(r.value)));
      linha.append(el('span', undefined, nome), r);
      caixa.append(linha);
    }
    const vozes = el('label', 'rg-controle');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = p.vozes.ativo;
    cb.addEventListener('change', () => {
      p.vozes.ativo = cb.checked;
      if (!cb.checked) p.vozes.silenciar();
    });
    vozes.append(el('span', undefined, 'Vozes dos personagens'), cb);
    caixa.append(vozes);
    caixa.append(this.listaBuild());
    const s = this.sala.sessao;
    const menu = el(
      'button',
      'rg-botao',
      !s
        ? 'Desistir e voltar ao menu'
        : s.papel === 'anfitriao'
          ? 'Encerrar a partida (todos voltam à sala)'
          : 'Sair da sala'
    );
    menu.type = 'button';
    menu.addEventListener('click', () => {
      p.pausar(false);
      this.voltarAoMenu();
    });
    caixa.append(menu);
    this.modal.append(caixa);
  }

  private listaBuild(): HTMLElement {
    const p = this.partida;
    const lista = el('div', 'rg-build');
    for (const a of p.build.ativas) {
      const d = habilidade(a.id);
      const item = el('div', 'rg-build-item');
      const ic = el('span', 'rg-icone', d.icone);
      ic.style.setProperty('--cor', d.cor);
      item.append(ic, el('span', undefined, `${d.nome} · Nv ${a.nivel}`));
      lista.append(item);
    }
    for (const a of p.build.passivas) {
      const d = passiva(a.id);
      const item = el('div', 'rg-build-item');
      const ic = el('span', 'rg-icone passiva', d.icone);
      item.append(ic, el('span', undefined, `${d.nome} · Nv ${a.nivel}`));
      lista.append(item);
    }
    return lista;
  }

  private desenharFim(): void {
    const p = this.partida;
    this.modal.hidden = false;
    const caixa = el('div', 'rg-caixa rg-caixa-fim');
    const recorde = p.tempo >= p.melhorTempo - 0.5 && p.tempo > 5;
    caixa.append(
      el('div', 'rg-nivel-sobre', recorde ? 'Novo recorde!' : 'O Ruído venceu desta vez'),
      el('h2', 'rg-fim-tempo', relogio(p.tempo))
    );
    const stats = el('div', 'rg-stats');
    for (const [rot, val] of [
      ['Nível', String(p.nivel)],
      ['Abates', String(p.abates)],
      ['Chefes', String(p.chefesDerrotados)],
      ['Recorde', relogio(p.melhorTempo)],
    ]) {
      const s = el('div', 'rg-stat');
      s.append(el('strong', undefined, val), el('span', undefined, rot));
      stats.append(s);
    }
    caixa.append(stats);
    const rel = p.relatorio();
    const total = Math.max(
      1,
      rel.reduce((a, r) => a + r.dano, 0)
    );
    const tab = el('div', 'rg-relatorio');
    for (const r of rel) {
      const linha = el('div', 'rg-rel-linha');
      const ic = el('span', 'rg-icone', r.icone);
      ic.style.setProperty('--cor', r.cor);
      const barra = el('div', 'rg-rel-barra');
      const preench = el('div', 'rg-rel-preench');
      preench.style.width = `${(r.dano / total) * 100}%`;
      preench.style.background = r.cor;
      barra.append(preench);
      const info = el('div', 'rg-rel-info');
      info.append(
        el('span', undefined, `${r.nome} · Nv ${r.nivel}`),
        el('span', 'rg-rel-num', r.dano.toLocaleString('pt-BR'))
      );
      const col = el('div', 'rg-rel-col');
      col.append(info, barra);
      linha.append(ic, col);
      tab.append(linha);
    }
    caixa.append(tab);
    const acoes = el('div', 'rg-menu-acoes');
    const s = this.sala.sessao;
    const nov = el(
      'button',
      'rg-botao principal',
      s?.papel === 'convidado' ? 'Esperando o anfitrião…' : 'Jogar de novo'
    );
    nov.type = 'button';
    nov.disabled = s?.papel === 'convidado';
    nov.addEventListener('click', () => this.comecar());
    const trocar = el(
      'button',
      'rg-botao',
      !s ? 'Trocar personagem' : s.papel === 'anfitriao' ? 'Voltar à sala' : 'Sair da sala'
    );
    trocar.type = 'button';
    trocar.addEventListener('click', () => this.voltarAoMenu());
    acoes.append(nov, trocar);
    caixa.append(acoes);
    this.modal.append(caixa);
  }

  // ------------------------------------------------------------------ HUD

  private montarHud(): void {
    const xp = el('div', 'rg-xp');
    xp.append(this.barraXp, this.textoNivel);
    const topo = el('div', 'rg-topo');
    const vida = el('div', 'rg-vida');
    vida.append(this.barraVida, this.textoVida);
    const centro = el('div', 'rg-centro');
    centro.append(this.textoTempo, this.textoAbates);
    const pausa = el('button', 'rg-pausa', 'II');
    pausa.type = 'button';
    pausa.setAttribute('aria-label', 'Pausar');
    pausa.addEventListener('click', () => this.partida.pausar(true));
    topo.append(vida, centro, pausa);
    this.chefe.append(this.chefeNome, el('div', 'rg-chefe-barra'));
    (this.chefe.lastChild as HTMLElement).append(this.chefeBarra);
    this.chefe.hidden = true;
    this.banner.append(this.bannerTexto, this.bannerSub);
    this.banner.hidden = true;
    const slots = el('div', 'rg-slots');
    const ativas = el('div', 'rg-slots-ativas');
    for (let i = 0; i < MAX_ATIVAS; i++) {
      const raiz = el('div', 'rg-slot vazio');
      const icone = el('span', 'rg-slot-icone');
      const sombra = el('span', 'rg-slot-sombra');
      const nivel = el('span', 'rg-slot-nivel');
      raiz.append(icone, sombra, nivel);
      ativas.append(raiz);
      this.slotsAtivas.push({ raiz, icone, nivel, sombra, id: '' });
    }
    const passivas = el('div', 'rg-slots-passivas');
    for (let i = 0; i < MAX_PASSIVAS; i++) {
      const raiz = el('div', 'rg-slot passiva vazio');
      const icone = el('span', 'rg-slot-icone');
      const nivel = el('span', 'rg-slot-nivel');
      raiz.append(icone, nivel);
      passivas.append(raiz);
      this.slotsPassivas.push({ raiz, icone, nivel, id: '' });
    }
    slots.append(ativas, passivas);
    const numeros = el('div', 'rg-numeros');
    for (let i = 0; i < 70; i++) {
      const n = el('div', 'rg-numero');
      n.hidden = true;
      numeros.append(n);
      this.numeros.push(n);
    }
    const etiquetas = el('div', 'rg-etiquetas');
    for (let i = 0; i < 4; i++) {
      const e = el('div', 'rg-etiqueta');
      e.hidden = true;
      etiquetas.append(e);
      this.etiquetas.push(e);
      const raiz = el('div', 'rg-equipe-linha');
      raiz.hidden = true;
      const nome = el('span', 'rg-equipe-nome');
      const fundo = el('div', 'rg-equipe-vida');
      const barra = el('div', 'rg-equipe-preench');
      fundo.append(barra);
      raiz.append(nome, fundo);
      this.equipe.append(raiz);
      this.linhasEquipe.push({ raiz, nome, barra });
    }
    this.hud.append(
      numeros,
      etiquetas,
      xp,
      topo,
      this.equipe,
      this.chefe,
      this.avisoChefe,
      this.banner,
      slots
    );
  }

  private montarToque(): void {
    const grosso = window.matchMedia?.('(pointer: coarse)').matches;
    this.raiz.classList.toggle('rg-tem-toque', !!grosso);
    const zona = el('div', 'rg-toque-zona');
    const base = el('div', 'rg-toque-base');
    const pino = el('div', 'rg-toque-pino');
    base.hidden = pino.hidden = true;
    zona.append(base, pino);
    this.toque.append(zona);
    let dedo: number | null = null;
    let origem = { x: 0, y: 0 };
    const RAIO = 56;
    const mover = (x: number, y: number) => {
      let dx = x - origem.x;
      let dy = y - origem.y;
      const d = Math.hypot(dx, dy);
      if (d > RAIO) {
        origem.x += (dx / d) * (d - RAIO);
        origem.y += (dy / d) * (d - RAIO);
        base.style.left = `${origem.x}px`;
        base.style.top = `${origem.y}px`;
        dx = x - origem.x;
        dy = y - origem.y;
      }
      pino.style.left = `${origem.x + dx}px`;
      pino.style.top = `${origem.y + dy}px`;
      const m = Math.min(1, Math.hypot(dx, dy) / RAIO);
      const f = m < 0.12 ? 0 : m;
      const n = Math.hypot(dx, dy) || 1;
      this.partida.entrada.definirJoystick((dx / n) * f, (dy / n) * f);
    };
    zona.addEventListener('pointerdown', (e) => {
      if (dedo !== null) return;
      dedo = e.pointerId;
      zona.setPointerCapture(e.pointerId);
      origem = { x: e.clientX, y: e.clientY };
      base.style.left = `${origem.x}px`;
      base.style.top = `${origem.y}px`;
      base.hidden = pino.hidden = false;
      mover(e.clientX, e.clientY);
      this.partida.audio.desbloquear();
    });
    zona.addEventListener('pointermove', (e) => {
      if (e.pointerId === dedo) mover(e.clientX, e.clientY);
    });
    const soltar = (e: PointerEvent) => {
      if (e.pointerId !== dedo) return;
      dedo = null;
      base.hidden = pino.hidden = true;
      this.partida.entrada.definirJoystick(0, 0);
    };
    zona.addEventListener('pointerup', soltar);
    zona.addEventListener('pointercancel', soltar);

    this.dashBotao.type = 'button';
    this.dashBotao.textContent = 'Esquiva';
    this.dashBotao.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.partida.entrada.definirComandoVirtual('esquivar', true);
    });
    const soltarDash = () => this.partida.entrada.definirComandoVirtual('esquivar', false);
    this.dashBotao.addEventListener('pointerup', soltarDash);
    this.dashBotao.addEventListener('pointercancel', soltarDash);
    this.dashBotao.addEventListener('pointerleave', soltarDash);
    this.toque.append(this.dashBotao);
  }

  private definir(
    chave: string,
    alvo: HTMLElement,
    prop: 'texto' | 'largura' | 'fundo',
    valor: string
  ): void {
    const k = `${chave}:${prop}`;
    if (this.cache.get(k) === valor) return;
    this.cache.set(k, valor);
    if (prop === 'texto') alvo.textContent = valor;
    else if (prop === 'largura') alvo.style.width = valor;
    else alvo.style.background = valor;
  }

  /** Chamado a cada quadro. */
  atualizar(): void {
    const p = this.partida;
    this.renderizarEstado();
    if (p.estado === 'menu') return;
    const at = p.atributos;
    this.definir(
      'xp',
      this.barraXp,
      'largura',
      `${Math.min(100, (p.xp / p.xpProximo) * 100).toFixed(1)}%`
    );
    this.definir('nivel', this.textoNivel, 'texto', `Nv ${p.nivel}`);
    const frac = Math.max(0, p.vida / at.vidaMaxima);
    this.definir('vida', this.barraVida, 'largura', `${(frac * 100).toFixed(1)}%`);
    this.definir(
      'vidaT',
      this.textoVida,
      'texto',
      `${Math.ceil(p.vida)} / ${Math.round(at.vidaMaxima)}`
    );
    this.barraVida.classList.toggle('baixa', frac < 0.3);
    this.definir('tempo', this.textoTempo, 'texto', relogio(p.tempo));
    this.definir(
      'abates',
      this.textoAbates,
      'texto',
      `☠ ${p.abates}${p.ouro ? `  ◈ ${p.ouro}` : ''}`
    );
    this.vinheta.style.opacity = String(
      frac < 0.3
        ? 0.35 + Math.sin(performance.now() / 180) * 0.15
        : p.invencivel > 0.3 && p.invencivel < 1.2 && p.estado === 'jogando'
          ? 0.35
          : 0
    );

    // slots
    const slots = p.slotsHud();
    for (let i = 0; i < MAX_ATIVAS; i++) {
      const s = this.slotsAtivas[i];
      const h = slots[i];
      if (!h) {
        if (s.id !== '') {
          s.id = '';
          s.raiz.className = 'rg-slot vazio';
          s.icone.textContent = '';
          s.nivel.textContent = '';
        }
        continue;
      }
      if (s.id !== h.id) {
        s.id = h.id;
        s.raiz.className = 'rg-slot';
        s.raiz.title = h.nome;
        s.raiz.style.setProperty('--cor', h.cor);
        s.icone.textContent = h.icone;
      }
      this.definir(`sn${i}`, s.nivel, 'texto', h.nivel >= 10 ? 'MAX' : String(h.nivel));
      s.raiz.classList.toggle('evoluido', h.nivel >= 5);
      s.raiz.classList.toggle('travada', h.travada);
      const r = Math.round(h.recarga * 100);
      this.definir(
        `sr${i}`,
        s.sombra,
        'fundo',
        r <= 0 ? 'transparent' : `conic-gradient(rgba(20,16,28,.72) ${r}%, transparent 0)`
      );
    }
    for (let i = 0; i < MAX_PASSIVAS; i++) {
      const s = this.slotsPassivas[i];
      const b = p.build.passivas[i];
      if (!b) continue;
      if (s.id !== b.id) {
        s.id = b.id;
        s.raiz.className = 'rg-slot passiva';
        const d = passiva(b.id);
        s.raiz.title = d.nome;
        s.icone.textContent = d.icone;
      }
      this.definir(`pn${i}`, s.nivel, 'texto', b.nivel >= 10 ? 'MAX' : String(b.nivel));
    }

    // chefe
    const c = p.chefeAtual;
    this.chefe.hidden = !c;
    if (c) {
      this.definir('chefeN', this.chefeNome, 'texto', c.def.nome);
      this.definir(
        'chefeV',
        this.chefeBarra,
        'largura',
        `${Math.max(0, (c.vida / c.vidaMax) * 100).toFixed(1)}%`
      );
    }
    const falta = p.proximoChefe - p.tempo;
    const mostrarAviso = !c && falta > 0 && falta < 10 && p.estado === 'jogando';
    this.avisoChefe.hidden = !mostrarAviso;
    if (mostrarAviso)
      this.definir(
        'aviso',
        this.avisoChefe,
        'texto',
        `Algo grande se aproxima… ${Math.ceil(falta)}`
      );

    // banner
    const bn = p.banner;
    this.banner.hidden = !bn;
    if (bn) {
      const k = bn.texto + bn.sub;
      if (k !== this.ultimoBanner) {
        this.ultimoBanner = k;
        this.bannerTexto.textContent = bn.texto;
        this.bannerSub.textContent = bn.sub;
        this.banner.style.setProperty('--cor', bn.cor);
        this.banner.classList.remove('entra');
        void this.banner.offsetWidth;
        this.banner.classList.add('entra');
      }
      this.banner.style.opacity = String(Math.min(1, bn.vida / 0.4));
    } else this.ultimoBanner = '';

    // números de dano
    const ns = p.numeros;
    const inicio = Math.max(0, ns.length - this.numeros.length);
    let k = 0;
    for (let i = inicio; i < ns.length; i++) {
      const n = ns[i];
      const div = this.numeros[k++];
      const t = p.paraTela(n.x, n.y, n.z);
      if (!t.visivel) {
        div.hidden = true;
        continue;
      }
      div.hidden = false;
      const txt = n.critico ? `${Math.round(n.valor)}!` : String(Math.round(n.valor));
      if (div.textContent !== txt) div.textContent = txt;
      div.style.transform = `translate(${t.x.toFixed(0)}px, ${t.y.toFixed(0)}px) translate(-50%, -50%) scale(${n.critico ? 1.35 : 1})`;
      div.style.opacity = String(Math.min(1, n.vida * 2.2));
      div.style.color = n.cor;
      div.classList.toggle('critico', n.critico);
    }
    for (; k < this.numeros.length; k++) if (!this.numeros[k].hidden) this.numeros[k].hidden = true;

    // multijogador: etiquetas sobre cada um e mini barras dos colegas
    const grupo = p.jogadores.length > 1;
    for (let i = 0; i < 4; i++) {
      const jg = p.jogadores[i];
      const e = this.etiquetas[i];
      const linha = this.linhasEquipe[i];
      if (!grupo || !jg) {
        e.hidden = true;
        linha.raiz.hidden = true;
        continue;
      }
      const cor = CORES_JOGADOR[jg.indice] ?? '#fff';
      const t = p.paraTela(jg.x, 2.1, jg.z);
      e.hidden = !t.visivel;
      if (t.visivel) {
        const txt = jg.caido
          ? `${jg.def.nome} caiu · ${Math.round(jg.resgate * 100)}%`
          : jg.ausente
            ? `${jg.def.nome} · pausado`
            : `J${jg.indice + 1} ${jg.def.nome}${jg.local ? ' (você)' : ''}`;
        if (e.textContent !== txt) e.textContent = txt;
        e.style.transform = `translate(${t.x.toFixed(0)}px, ${t.y.toFixed(0)}px) translate(-50%, -100%)`;
        e.style.setProperty('--cor', cor);
        e.classList.toggle('caido', jg.caido);
      }
      linha.raiz.hidden = jg.local;
      if (!jg.local) {
        linha.raiz.style.setProperty('--cor', cor);
        const nome = `J${jg.indice + 1} ${jg.def.nome}`;
        if (linha.nome.textContent !== nome) linha.nome.textContent = nome;
        linha.barra.style.width = `${Math.max(0, (jg.vida / jg.atributos.vidaMaxima) * 100).toFixed(0)}%`;
        linha.raiz.classList.toggle('caido', jg.caido);
      }
    }

    // botão de esquiva: mostra a recarga
    this.dashBotao.style.setProperty('--recarga', String(Math.max(0, p.recargaDash / 1.4)));
  }
}
