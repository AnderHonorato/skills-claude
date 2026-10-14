/**
 * Interface em HTML sobre o 3D: corações, inspiração, arma com nível e experiência,
 * habilidades, missão atual com direção, minimapa, mapa completo (com a fronteira),
 * balões de fala, caixa de diálogo com escolhas, título, pausa (volume, qualidade,
 * reiniciar) e tela de derrota.
 */
import { ARMAS, NIVEL_MAXIMO, ORDEM_ARMAS, progressoNivel } from '../dados/armas';
import { TOTAL_FAISCAS } from '../dados/missoes';
import { ARBUSTOS, FRONTEIRA, PONTO_CHECKPOINT, SOLIDOS_FIXOS, dadosRegiao } from '../dados/mundo';
import type { JogoCentelha, LinhaDialogo, Ui } from '../jogo/jogo';
import { lerSalvamento } from '../nucleo/salvamento';
import type { IdArma } from '../nucleo/tipos';
import { instalarToque } from './toque';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe = '',
  texto = ''
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto) e.textContent = texto;
  return e;
}

const CORACAO = (fracao: number) =>
  `<svg viewBox="0 0 24 22" class="coracao"><defs><clipPath id="m${Math.round(fracao * 100)}"><rect x="0" y="0" width="${24 * fracao}" height="22"/></clipPath></defs><path d="M12 21 C 4 15, 0 11, 0 6.5 A 6 6 0 0 1 12 4 A 6 6 0 0 1 24 6.5 C 24 11, 20 15, 12 21 Z" fill="#3a2f3f" stroke="#2b2530" stroke-width="1.5"/><path clip-path="url(#m${Math.round(fracao * 100)})" d="M12 21 C 4 15, 0 11, 0 6.5 A 6 6 0 0 1 12 4 A 6 6 0 0 1 24 6.5 C 24 11, 20 15, 12 21 Z" fill="#ff5f7e"/></svg>`;

const ICONE_ARMA: Record<IdArma, string> = {
  galho: '🌿',
  espada: '🗡️',
  martelo: '🔨',
  colher: '🥄',
  cajado: '🔮',
  escudo: '🛡️',
};

export class Interface implements Ui {
  private raiz: HTMLElement;
  private hud: HTMLElement;
  private coracoes: HTMLElement;
  private barraInsp: HTMLElement;
  private painelArma: HTMLElement;
  private listaArmas: HTMLElement;
  private habilidades: HTMLElement;
  private missao: HTMLElement;
  private minimapa: HTMLCanvasElement;
  private mensagens: HTMLElement;
  private prompt: HTMLElement;
  private baloes: { e: HTMLElement; alvo: { x: number; y: number; z: number }; vida: number }[] =
    [];
  private caixaDialogo: HTMLElement;
  private textoDialogo: HTMLElement;
  private nomeDialogo: HTMLElement;
  private opcoesDialogo: HTMLElement;
  private dicaDialogo: HTMLElement;
  private escrevendo = { texto: '', pos: 0, ativo: false };
  private menuPausa: HTMLElement | null = null;
  private telaDerrota: HTMLElement | null = null;
  private mapa: HTMLElement | null = null;
  private faixaRegiao: HTMLElement;
  private avisoEl: HTMLElement;
  private chefe: HTMLElement;
  private toque: { atualizar(): void };
  private cacheHud = '';
  private tempo = 0;

  constructor(
    private jogo: JogoCentelha,
    raiz: HTMLElement
  ) {
    this.raiz = raiz;
    this.hud = el('div', 'hud');
    this.coracoes = el('div', 'hud-coracoes');
    const insp = el('div', 'hud-insp');
    this.barraInsp = el('div', 'hud-insp-barra');
    insp.append(el('span', 'hud-insp-rotulo', 'Inspiração'), this.barraInsp);
    const esquerda = el('div', 'hud-esquerda');
    this.missao = el('div', 'hud-missao');
    esquerda.append(this.coracoes, insp, this.missao);
    this.painelArma = el('div', 'hud-arma');
    this.listaArmas = el('div', 'hud-armas');
    this.habilidades = el('div', 'hud-habilidades');
    const baixo = el('div', 'hud-baixo');
    baixo.append(this.painelArma, this.listaArmas, this.habilidades);
    this.minimapa = el('canvas', 'hud-minimapa');
    this.minimapa.width = this.minimapa.height = 300;
    this.minimapa.title = 'Mapa (M)';
    this.minimapa.addEventListener('click', () => this.alternarMapa());
    this.mensagens = el('div', 'hud-mensagens');
    this.prompt = el('div', 'hud-prompt');
    this.faixaRegiao = el('div', 'faixa-regiao');
    this.avisoEl = el('div', 'aviso-fronteira');
    this.chefe = el('div', 'barra-chefe');
    this.hud.append(
      esquerda,
      baixo,
      this.minimapa,
      this.mensagens,
      this.prompt,
      this.faixaRegiao,
      this.avisoEl,
      this.chefe
    );
    this.hud.hidden = true;
    raiz.append(this.hud);

    // diálogo
    this.caixaDialogo = el('div', 'dialogo');
    this.nomeDialogo = el('div', 'dialogo-nome');
    this.textoDialogo = el('div', 'dialogo-texto');
    this.opcoesDialogo = el('div', 'dialogo-opcoes');
    this.dicaDialogo = el('div', 'dialogo-dica', 'Toque, clique ou Espaço para continuar');
    this.caixaDialogo.append(
      this.nomeDialogo,
      this.textoDialogo,
      this.opcoesDialogo,
      this.dicaDialogo
    );
    this.caixaDialogo.hidden = true;
    this.caixaDialogo.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).closest('.dialogo-opcao')) return;
      e.preventDefault();
      this.avancarDialogo();
    });
    raiz.append(this.caixaDialogo);

    this.toque = instalarToque(jogo, raiz);
  }

  menuAberto(): boolean {
    return !!this.mapa || !!this.titulo_;
  }

  // ------------------------------------------------------------------ HUD

  atualizar(dt: number): void {
    this.tempo += dt;
    const j = this.jogo;
    const em = j.estadoJogo;
    this.hud.hidden = em === 'titulo';
    this.toque.atualizar();
    if (em === 'titulo') return;
    const e = j.estado;
    const jog = j.jogador;

    // corações (meio coração de precisão)
    const chaveVida = `${e.vida}/${e.vidaMaxima}`;
    if (this.coracoes.dataset.v !== chaveVida) {
      this.coracoes.dataset.v = chaveVida;
      let html = '';
      for (let i = 0; i < e.vidaMaxima; i++) html += CORACAO(Math.max(0, Math.min(1, e.vida - i)));
      this.coracoes.innerHTML = html;
      this.coracoes.classList.remove('pulsar');
      void this.coracoes.offsetWidth;
      this.coracoes.classList.add('pulsar');
    }
    this.coracoes.classList.toggle('perigo', e.vida <= 1.5);
    this.barraInsp.style.width = `${jog.inspiracao}%`;

    // arma
    const id = e.armaAtual;
    const chave = `${id}|${id ? e.armas[id]?.xp : 0}|${e.armasObtidas().join()}|${Math.floor(jog.inspiracao / 5)}|${[...e.habilidades].join()}`;
    if (chave !== this.cacheHud) {
      this.cacheHud = chave;
      if (id) {
        const d = ARMAS[id];
        const nivel = e.nivelArma(id);
        const prog = progressoNivel(e.armas[id]?.xp ?? 0);
        const espLiberado = nivel >= d.especial.nivel;
        const espPronto = espLiberado && jog.inspiracao >= d.especial.custo;
        this.painelArma.innerHTML = `
          <div class="arma-icone" style="--cor:${d.brilho}">${ICONE_ARMA[id]}</div>
          <div class="arma-info">
            <div class="arma-nome">${d.nome} <span class="arma-cat">${d.categoria}</span></div>
            <div class="arma-nivel">${'★'.repeat(nivel)}${'☆'.repeat(NIVEL_MAXIMO - nivel)} <span>Nv ${nivel}</span></div>
            <div class="arma-xp"><div style="width:${Math.round(prog * 100)}%"></div></div>
            <div class="arma-esp ${espPronto ? 'pronto' : ''}">${espLiberado ? `Especial: ${d.especial.nome} (L)` : `Especial no Nv ${d.especial.nivel}`}</div>
          </div>`;
      } else
        this.painelArma.innerHTML = `<div class="arma-vazia">Sem arma — procure algo brilhando</div>`;
      this.listaArmas.innerHTML = '';
      ORDEM_ARMAS.forEach((a, i) => {
        if (!e.armas[a]) return;
        const b = el('button', `arma-slot ${a === id ? 'ativa' : ''}`);
        b.innerHTML = `<span class="tecla">${i + 1}</span>${ICONE_ARMA[a]}<span class="nv">${e.nivelArma(a)}</span>`;
        b.title = `${ARMAS[a].nome} — nível ${e.nivelArma(a)}`;
        b.addEventListener('pointerdown', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          j.usarArma(a);
        });
        this.listaArmas.append(b);
      });
      this.habilidades.innerHTML = (['observar', 'conectar', 'criar'] as const)
        .map(
          (h, i) =>
            `<div class="hab ${e.habilidades.has(h) ? '' : 'bloqueada'}"><span class="tecla">${['Q', 'R', 'F'][i]}</span>${['Observar', 'Conectar', 'Criar'][i]}</div>`
        )
        .join('');
    }

    // missão + direção
    const m = j.missaoAtual();
    if (m) {
      const pos = j.posicaoAlvo(m.etapa);
      let seta = '';
      if (pos) {
        const ang = Math.atan2(pos.z - jog.z, pos.x - jog.x);
        const dist = Math.round(Math.hypot(pos.x - jog.x, pos.z - jog.z));
        seta = `<span class="seta" style="transform:rotate(${ang}rad)">➤</span><span class="dist">${dist} m</span>`;
      }
      const prog = m.etapa.progresso
        ? ` (${Math.min(e.contador(m.etapa.progresso[0]), m.etapa.progresso[1])}/${m.etapa.progresso[1]})`
        : '';
      const html = `<div class="missao-titulo">${m.missao.titulo}</div><div class="missao-etapa">${m.etapa.texto}${prog}</div><div class="missao-dir">${seta}</div>`;
      if (this.missao.innerHTML !== html) this.missao.innerHTML = html;
      this.missao.hidden = false;
    } else {
      this.missao.innerHTML = `<div class="missao-etapa">Explore! Faíscas: ${e.contador('faiscas')}/${TOTAL_FAISCAS}</div>`;
    }

    // prompt de interação
    const it = j.interacao;
    if (it && em === 'jogando') {
      const p = j.paraTela(it.x, it.y, it.z);
      this.prompt.hidden = !p.visivel;
      this.prompt.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      const txt = `<span class="tecla">E</span> ${it.texto}`;
      if (this.prompt.innerHTML !== txt) this.prompt.innerHTML = txt;
    } else this.prompt.hidden = true;

    // balões
    for (const b of this.baloes) {
      b.vida -= dt;
      const p = j.paraTela(b.alvo.x, b.alvo.y + 2.3, b.alvo.z);
      b.e.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%) scale(${Math.min(1, 3 - Math.max(0, 2.8 - b.vida))})`;
      b.e.style.opacity = String(Math.min(1, b.vida * 3));
      b.e.hidden = !p.visivel;
      if (b.vida <= 0) b.e.remove();
    }
    this.baloes = this.baloes.filter((b) => b.vida > 0);

    // chefe
    const c = j.chefeAtivo;
    if (c) {
      this.chefe.hidden = false;
      this.chefe.innerHTML = `<div class="chefe-nome">Estática Grande</div><div class="chefe-barra"><div style="width:${Math.max(0, (c.vida / c.tab.vida) * 100)}%"></div></div>`;
    } else this.chefe.hidden = true;

    // diálogo: máquina de escrever
    if (this.escrevendo.ativo) {
      this.escrevendo.pos += dt * 55;
      const n = Math.floor(this.escrevendo.pos);
      this.textoDialogo.textContent = this.escrevendo.texto.slice(0, n);
      if (n % 4 === 0 && n < this.escrevendo.texto.length && Math.random() < 0.6) {
        /* bipes de voz ficam no áudio da fala inicial */
      }
      if (n >= this.escrevendo.texto.length) {
        this.escrevendo.ativo = false;
        this.opcoesDialogo.hidden = false;
      }
    }

    this.desenharMapa(this.minimapa, true);
    if (this.mapa) this.desenharMapa(this.mapa.querySelector('canvas')!, false);
  }

  mensagem(texto: string, duracao = 3): void {
    const m = el('div', 'mensagem', texto);
    this.mensagens.append(m);
    while (this.mensagens.children.length > 3) this.mensagens.firstElementChild?.remove();
    setTimeout(() => m.classList.add('saindo'), duracao * 1000);
    setTimeout(() => m.remove(), duracao * 1000 + 400);
  }

  balao(alvo: { x: number; y: number; z: number }, texto: string, duracao: number): void {
    const e = el('div', 'balao', texto);
    this.raiz.append(e);
    this.baloes.push({ e, alvo, vida: duracao });
  }

  regiao(nome: string): void {
    this.faixaRegiao.textContent = nome;
    this.faixaRegiao.classList.remove('mostrar');
    void this.faixaRegiao.offsetWidth;
    this.faixaRegiao.classList.add('mostrar');
  }

  aviso(texto: string | null): void {
    this.avisoEl.textContent = texto ?? '';
    this.avisoEl.classList.toggle('mostrar', !!texto);
  }

  // ------------------------------------------------------------------ diálogo

  dialogo(linha: LinhaDialogo | null): void {
    if (!linha) {
      this.caixaDialogo.hidden = true;
      return;
    }
    this.caixaDialogo.hidden = false;
    this.caixaDialogo.dataset.quem = linha.quem;
    this.nomeDialogo.textContent = linha.nome;
    this.nomeDialogo.hidden = !linha.nome;
    this.escrevendo = { texto: linha.fala, pos: 0, ativo: true };
    this.textoDialogo.textContent = '';
    this.opcoesDialogo.innerHTML = '';
    this.opcoesDialogo.hidden = true;
    linha.opcoes.forEach((o, i) => {
      const b = el('button', 'dialogo-opcao');
      b.innerHTML = `<span class="tecla">${i + 1}</span> ${o.texto}`;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.jogo.escolher(i);
      });
      this.opcoesDialogo.append(b);
    });
    this.dicaDialogo.hidden = linha.opcoes.length > 0;
  }

  private avancarDialogo(): void {
    if (this.escrevendo.ativo) {
      this.escrevendo.pos = this.escrevendo.texto.length;
      return;
    }
    if (this.opcoesDialogo.children.length === 0) this.jogo.escolher(null);
  }

  // ------------------------------------------------------------------ telas

  titulo(temSalvamento: boolean): void {
    this.titulo_?.remove();
    if (this.jogo.estadoJogo !== 'titulo') {
      this.titulo_ = null;
      return;
    }
    const t = el('div', 'tela-titulo');
    t.innerHTML = `
      <div class="titulo-logo"><span class="centelha">✦</span><h1>Claude</h1><h2>A Centelha das Ideias</h2></div>
      <div class="titulo-botoes"></div>
      <div class="titulo-ajuda">
        <b>Teclado:</b> WASD/setas andar · Shift correr · Espaço pular · J ou clique atacar · L especial · C/K esquivar · E falar/usar · Q Observar · R Conectar · F Criar · 1–6 armas · M mapa · Esc pausa<br/>
        <b>Celular:</b> arraste à esquerda para andar, botões à direita (dá para andar, pular e atacar ao mesmo tempo).
      </div>`;
    const botoes = t.querySelector('.titulo-botoes')!;
    if (temSalvamento) {
      const c = el('button', 'botao principal', 'Continuar');
      c.addEventListener('click', () => {
        this.jogo.audio.desbloquear();
        this.fecharTitulo();
        this.jogo.continuar();
      });
      botoes.append(c);
    }
    const n = el('button', `botao ${temSalvamento ? '' : 'principal'}`, 'Novo jogo');
    n.addEventListener('click', () => {
      if (temSalvamento && !confirm('Começar de novo apaga o progresso salvo. Continuar?')) return;
      this.jogo.audio.desbloquear();
      this.fecharTitulo();
      this.jogo.novoJogo();
    });
    botoes.append(n);
    this.raiz.append(t);
    this.titulo_ = t;
  }
  private titulo_: HTMLElement | null = null;

  private fecharTitulo(): void {
    this.titulo_?.remove();
    this.titulo_ = null;
  }

  pausa(ativa: boolean): void {
    this.menuPausa?.remove();
    this.menuPausa = null;
    if (!ativa) return;
    const j = this.jogo;
    const p = el('div', 'tela-pausa');
    const caixa = el('div', 'caixa-menu');
    caixa.append(el('h2', '', 'Pausa'));
    const botao = (texto: string, fn: () => void, classe = '') => {
      const b = el('button', `botao ${classe}`, texto);
      b.addEventListener('click', fn);
      caixa.append(b);
    };
    botao('Continuar', () => j.alternarPausa(false), 'principal');
    botao('Mapa', () => {
      j.alternarPausa(false);
      this.alternarMapa(true);
    });
    for (const [canal, nome] of [
      ['geral', 'Volume geral'],
      ['musica', 'Música'],
      ['efeitos', 'Efeitos'],
    ] as const) {
      const linha = el('label', 'linha-volume');
      linha.append(el('span', '', nome));
      const r = el('input');
      r.type = 'range';
      r.min = '0';
      r.max = '100';
      r.value = String(Math.round(j.audio.volume(canal) * 100));
      r.addEventListener('input', () => {
        j.audio.definirVolume(canal, Number(r.value) / 100);
        if (canal !== 'musica') j.audio.tocar('uiNavegar');
      });
      linha.append(r);
      caixa.append(linha);
    }
    const qual = el('label', 'linha-volume');
    qual.append(el('span', '', 'Gráficos'));
    const sel = el('select');
    for (const [v, n] of [
      ['alta', 'Alta'],
      ['media', 'Média'],
      ['baixa', 'Leve'],
    ]) {
      const o = el('option', '', n);
      o.value = v;
      o.selected = j.qualidade === v;
      sel.append(o);
    }
    sel.addEventListener('change', () => j.definirQualidade(sel.value as 'alta'));
    qual.append(sel);
    caixa.append(qual);
    const tremor = el('label', 'linha-volume');
    tremor.append(el('span', '', 'Tremor da câmera'));
    const cb = el('input');
    cb.type = 'checkbox';
    cb.checked = j.tremorAtivo;
    cb.addEventListener('change', () => (j.tremorAtivo = cb.checked));
    tremor.append(cb);
    caixa.append(tremor);
    botao('Voltar à última Pedra de Memória', () => {
      j.alternarPausa(false);
      j.renascer();
    });
    botao('Salvar e ir ao título', () => {
      this.pausa(false);
      j.voltarAoTitulo();
    });
    const info = el('div', 'pausa-info');
    const s = lerSalvamento();
    const min = Math.floor(j.tempoJogo / 60);
    info.innerHTML = `Tempo de jogo: ${min} min · Faíscas: ${j.estado.contador('faiscas')}/${TOTAL_FAISCAS}${s ? ' · Progresso salvo automaticamente' : ''}`;
    caixa.append(info);
    p.append(caixa);
    this.raiz.append(p);
    this.menuPausa = p;
  }

  derrota(): void {
    this.telaDerrota?.remove();
    const d = el('div', 'tela-derrota');
    d.innerHTML = `<div class="caixa-menu"><h2>A centelha piscou...</h2><p>Mas ideias boas sempre voltam.</p></div>`;
    const b = el('button', 'botao principal', 'Tentar de novo');
    b.addEventListener('click', () => {
      d.remove();
      this.telaDerrota = null;
      this.jogo.renascer();
    });
    d.querySelector('.caixa-menu')!.append(b);
    this.raiz.append(d);
    this.telaDerrota = d;
  }

  alternarMapa(forcar?: boolean): void {
    if (this.mapa && forcar !== true) {
      this.mapa.remove();
      this.mapa = null;
      return;
    }
    if (this.mapa) return;
    const m = el('div', 'tela-mapa');
    const c = el('canvas');
    c.width = 900;
    c.height = 900;
    const legenda = el('div', 'mapa-legenda');
    legenda.innerHTML = `<span><i style="background:#d97757"></i>Você</span><span><i style="background:#ffd27a"></i>Objetivo</span><span><i style="background:#9df0ff"></i>Pedra de Memória</span><span><i style="background:#fff2a8"></i>Faísca</span><span><i class="listra"></i>Fronteira (em desenvolvimento)</span>`;
    const fechar = el('button', 'botao', 'Fechar (M)');
    fechar.addEventListener('click', () => this.alternarMapa());
    m.append(el('h2', '', 'Mapa do Mundo das Ideias'), c, legenda, fechar);
    m.addEventListener('pointerdown', (e) => {
      if (e.target === m) this.alternarMapa();
    });
    this.raiz.append(m);
    this.mapa = m;
  }

  // ------------------------------------------------------------------ mapa

  private desenharMapa(c: HTMLCanvasElement, mini: boolean): void {
    const g = c.getContext('2d');
    if (!g) return;
    const j = this.jogo;
    const jog = j.jogador;
    const W = c.width;
    g.clearRect(0, 0, W, W);
    g.save();
    let escala: number;
    let cx: number;
    let cz: number;
    if (mini) {
      g.beginPath();
      g.arc(W / 2, W / 2, W / 2 - 4, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = 'rgba(30,26,40,0.55)';
      g.fillRect(0, 0, W, W);
      escala = 4.2;
      cx = jog.x;
      cz = jog.z;
    } else {
      g.fillStyle = '#20263a';
      g.fillRect(0, 0, W, W);
      escala = W / 190;
      cx = 12;
      cz = -66;
    }
    const px = (x: number) => W / 2 + (x - cx) * escala;
    const pz = (z: number) => W / 2 + (z - cz) * escala;
    // ilhas e pontes
    for (const s of SOLIDOS_FIXOS) {
      if (s.seFlag && !j.estado.temFlag(s.seFlag)) continue;
      if (s.tipo === 'ilha') {
        const r = dadosRegiao(s.regiao ?? 'jardim');
        g.fillStyle = s.visual === 'esboco' ? 'rgba(169,182,230,0.4)' : r.grama[0];
        g.beginPath();
        g.arc(px(s.x), pz(s.z), (s.r ?? 1) * escala, 0, Math.PI * 2);
        g.fill();
      } else if (s.tipo === 'ponte') {
        g.fillStyle = s.visual === 'luz' ? '#ffe9a8' : '#b07a4a';
        g.fillRect(
          px(s.x - (s.w ?? 1) / 2),
          pz(s.z - (s.d ?? 1) / 2),
          (s.w ?? 1) * escala,
          (s.d ?? 1) * escala
        );
      } else if (
        s.tipo === 'predio' ||
        s.tipo === 'farol' ||
        (s.tipo === 'rocha' && s.visual === 'colina')
      ) {
        g.fillStyle = s.tipo === 'farol' ? '#f6f1e7' : 'rgba(80,60,50,0.55)';
        if (s.forma === 'cilindro') {
          g.beginPath();
          g.arc(px(s.x), pz(s.z), (s.r ?? 1) * escala, 0, Math.PI * 2);
          g.fill();
        } else
          g.fillRect(
            px(s.x - (s.w ?? 1) / 2),
            pz(s.z - (s.d ?? 1) / 2),
            (s.w ?? 1) * escala,
            (s.d ?? 1) * escala
          );
      }
    }
    // moitas
    g.fillStyle = 'rgba(40,90,40,0.55)';
    for (const b of ARBUSTOS) {
      g.beginPath();
      g.arc(px(b.x), pz(b.z), b.r * escala, 0, Math.PI * 2);
      g.fill();
    }
    // fronteira: faixa listrada
    {
      const x0 = px(FRONTEIRA.x - FRONTEIRA.w / 2);
      const z0 = pz(FRONTEIRA.z - 0.8);
      const w = FRONTEIRA.w * escala;
      const h = Math.max(4, 1.6 * escala);
      g.fillStyle = '#ffd27a';
      g.fillRect(x0, z0, w, h);
      g.strokeStyle = '#e5534b';
      g.lineWidth = Math.max(2, escala * 0.5);
      g.save();
      g.beginPath();
      g.rect(x0, z0, w, h);
      g.clip();
      for (let i = -h; i < w + h; i += h * 1.4) {
        g.beginPath();
        g.moveTo(x0 + i, z0 + h);
        g.lineTo(x0 + i + h, z0);
        g.stroke();
      }
      g.restore();
      if (!mini) {
        g.fillStyle = '#ffd27a';
        g.font = '600 20px Fredoka, system-ui';
        g.textAlign = 'center';
        g.fillText('Em desenvolvimento', px(FRONTEIRA.x), pz(FRONTEIRA.z) - 16);
      }
    }
    // pedras de memória
    g.fillStyle = '#9df0ff';
    for (const p of Object.values(PONTO_CHECKPOINT)) {
      g.beginPath();
      g.arc(px(p.x), pz(p.z), mini ? 4 : 6, 0, Math.PI * 2);
      g.fill();
    }
    // faíscas restantes (só no mapa grande)
    if (!mini) {
      g.fillStyle = '#fff2a8';
      for (const f of j.objetos.faiscasRestantes()) {
        g.beginPath();
        g.arc(px(f.x), pz(f.z), 3.5, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#f6f1e7';
      g.font = '600 18px Fredoka, system-ui';
      g.textAlign = 'center';
      for (const id of ['jardim', 'oficina', 'vale', 'farol'] as const) {
        const r = dadosRegiao(id);
        g.fillText(r.nome, px(r.centro.x), pz(r.centro.z) - r.raio * escala * 0.55);
      }
    }
    // NPCs
    for (const n of j.npcs) {
      g.fillStyle = '#f6f1e7';
      g.beginPath();
      g.arc(px(n.x), pz(n.z), mini ? 5 : 7, 0, Math.PI * 2);
      g.fill();
      if (!mini) {
        g.fillStyle = '#2b2530';
        g.font = '600 14px Fredoka, system-ui';
        g.fillText(n.def.nome, px(n.x), pz(n.z) - 10);
      }
    }
    // inimigos próximos (só minimapa)
    if (mini) {
      g.fillStyle = '#e5534b';
      for (const i of j.inimigos) {
        if (!i.vivo || Math.hypot(i.x - jog.x, i.z - jog.z) > 30) continue;
        g.beginPath();
        g.arc(px(i.x), pz(i.z), i.ehChefe ? 7 : 4, 0, Math.PI * 2);
        g.fill();
      }
    }
    // objetivo
    const m = j.missaoAtual();
    const alvo = m ? j.posicaoAlvo(m.etapa) : null;
    if (alvo) {
      const pulso = 1 + Math.sin(this.tempo * 5) * 0.2;
      let ax = px(alvo.x);
      let az = pz(alvo.z);
      if (mini) {
        const dx = ax - W / 2;
        const dz = az - W / 2;
        const d = Math.hypot(dx, dz);
        const max = W / 2 - 16;
        if (d > max) {
          ax = W / 2 + (dx / d) * max;
          az = W / 2 + (dz / d) * max;
        }
      }
      g.fillStyle = '#ffd27a';
      g.strokeStyle = '#2b2530';
      g.lineWidth = 3;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = (i % 2 ? 6 : 14) * pulso;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(ax + Math.cos(a) * r, az + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      g.stroke();
    }
    // jogador (seta)
    g.translate(px(jog.x), pz(jog.z));
    g.rotate(-jog.angulo + Math.PI);
    g.fillStyle = '#d97757';
    g.strokeStyle = '#f6f1e7';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -14);
    g.lineTo(9, 10);
    g.lineTo(0, 5);
    g.lineTo(-9, 10);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    if (mini) {
      g.strokeStyle = 'rgba(246,241,231,0.85)';
      g.lineWidth = 6;
      g.beginPath();
      g.arc(W / 2, W / 2, W / 2 - 4, 0, Math.PI * 2);
      g.stroke();
    }
  }
}
