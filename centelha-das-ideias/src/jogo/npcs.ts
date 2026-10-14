/**
 * NPCs vivos: seguem uma rotina com objetivo (regar, consertar, vigiar, polir),
 * olham para o Claude, comentam ao passar, fogem de inimigos e podem ser atacados
 * (reagem, ficam tontos e guardam mágoa até ouvir um pedido de desculpas).
 */
import * as THREE from 'three';
import { aproximar, aproximarAngulo, escolher } from '../nucleo/matematica';
import type { DefinicaoNpc, Humor } from '../nucleo/tipos';
import { Emote } from '../render/emotes';
import { criarModeloNpc, type ModeloPersonagem } from '../render/modelos';
import type { Alvo, Contexto, Golpe } from './contexto';

type EstadoNpc = 'andar' | 'agir' | 'conversar' | 'fugir' | 'tonto' | 'medo';

export class Npc implements Alvo {
  readonly modelo: ModeloPersonagem;
  readonly emote: Emote;
  x: number;
  y = 0;
  z: number;
  vx = 0;
  vz = 0;
  vy = 0;
  raio = 0.5;
  altura: number;
  vivo = true;
  angulo = 0;
  estado: EstadoNpc = 'agir';
  private passo = 0;
  private espera = 1;
  private fase = Math.random() * 10;
  private humor: Humor = 'neutro';
  private humorTempo = 0;
  private flash = 0;
  private golpesRecentes = 0;
  private recargaGolpe = 0;
  private recargaLatido = 4 + Math.random() * 6;
  private fugirDe = { x: 0, z: 0 };
  private tempoEstado = 0;
  conversando = false;
  falando = false;
  private sombra: THREE.Mesh;

  constructor(
    readonly def: DefinicaoNpc,
    private ctx: Contexto
  ) {
    this.x = def.x;
    this.z = def.z;
    this.modelo = criarModeloNpc(def.id);
    this.altura = this.modelo.altura;
    this.emote = new Emote(this.altura + 0.45);
    this.modelo.raiz.add(this.emote.sprite);
    this.y = Math.max(0, ctx.fisica.alturaChao(this.x, this.z, 10));
    this.sombra = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 16),
      new THREE.MeshBasicMaterial({
        color: '#1d1720',
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      })
    );
    this.sombra.rotation.x = -Math.PI / 2;
  }

  get id(): string {
    return `npc:${this.def.id}`;
  }

  objetos(): THREE.Object3D[] {
    return [this.modelo.raiz, this.sombra];
  }

  sentir(h: Humor, duracao = 3): void {
    this.humor = h;
    this.humorTempo = duracao;
    const mapa: Partial<Record<Humor, Parameters<Emote['mostrar']>[0]>> = {
      surpreso: 'exclamacao',
      curioso: 'pergunta',
      carinho: 'coracao',
      feliz: 'nota',
      raiva: 'raiva',
      medo: 'suor',
      triste: 'reticencias',
    };
    const e = mapa[h];
    if (e) this.emote.mostrar(e, 1.4);
  }

  receberGolpe(g: Golpe): boolean {
    if (this.recargaGolpe > 0 || this.conversando) return false;
    this.recargaGolpe = 0.5;
    this.flash = 0.15;
    this.vx = g.dx * g.empurrao * 0.8;
    this.vz = g.dz * g.empurrao * 0.8;
    this.vy = g.lancar ? g.lancar * 0.6 : 3;
    this.golpesRecentes++;
    const ctx = this.ctx;
    ctx.audio.tocar('danoRecebido', { x: this.x, y: this.z, tom: 1.4 });
    ctx.balao(this, escolher(this.def.aoApanhar), 2.2);
    ctx.estado.aplicar([{ tipo: 'afinidade', npc: this.def.id, delta: -1 }]);
    if (ctx.estado.afinidade[this.def.id] <= -1) ctx.estado.ligar(`bravo_${this.def.id}`);
    if (this.golpesRecentes >= 3) {
      this.estado = 'tonto';
      this.tempoEstado = 2.4;
      this.sentir('dor', 2.4);
    } else {
      this.estado = 'fugir';
      this.tempoEstado = 1.6;
      this.fugirDe = { x: ctx.jogador.x, z: ctx.jogador.z };
      this.sentir('raiva', 4);
    }
    return false; // bater em amigo não dá experiência
  }

  /** Começa ou termina uma conversa (vira para o Claude). */
  conversar(ativo: boolean): void {
    this.conversando = ativo;
    if (ativo) this.estado = 'conversar';
    else {
      this.estado = 'agir';
      this.espera = 1.2;
    }
  }

  definirHumor(h: Humor, duracao = 3): void {
    this.sentir(h, duracao);
  }

  atualizar(dt: number, perigos: { x: number; z: number }[]): void {
    const ctx = this.ctx;
    this.fase += dt;
    this.emote.atualizar(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.recargaGolpe = Math.max(0, this.recargaGolpe - dt);
    this.humorTempo = Math.max(0, this.humorTempo - dt);
    this.golpesRecentes = Math.max(0, this.golpesRecentes - dt * 0.25);
    this.tempoEstado -= dt;
    const j = ctx.jogador;
    const dj = Math.hypot(j.x - this.x, j.z - this.z);
    const bravo = ctx.estado.temFlag(`bravo_${this.def.id}`);
    if (this.humorTempo <= 0) this.humor = bravo ? 'triste' : 'neutro';

    // perigo por perto: foge e se assusta
    let perigo: { x: number; z: number } | null = null;
    for (const p of perigos) if (Math.hypot(p.x - this.x, p.z - this.z) < 5.5) perigo = p;
    if (
      perigo &&
      this.estado !== 'conversar' &&
      this.estado !== 'tonto' &&
      this.estado !== 'fugir'
    ) {
      this.estado = 'medo';
      this.fugirDe = perigo;
      this.tempoEstado = 1.5;
      if (this.humor !== 'medo') this.sentir('medo', 2);
    }

    let velAlvo = 0;
    let dirX = 0;
    let dirZ = 0;
    const rot = this.def.rotina;
    const atual = rot[this.passo % rot.length];
    let acao: string | undefined;

    switch (this.estado) {
      case 'andar': {
        const dx = atual.x - this.x;
        const dz = atual.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) {
          this.estado = 'agir';
          this.espera = atual.espera;
        } else {
          dirX = dx / d;
          dirZ = dz / d;
          velAlvo = this.def.id === 'pipo' ? 3.6 : this.def.id === 'bento' ? 1.6 : 2.0;
        }
        break;
      }
      case 'agir': {
        acao = atual.acao;
        this.espera -= dt;
        // olha para o Claude quando ele chega perto
        if (dj < 3.5) {
          this.angulo = aproximarAngulo(this.angulo, Math.atan2(j.x - this.x, j.z - this.z), 6, dt);
          acao = undefined;
        } else if (acao === 'regar' || acao === 'martelar' || acao === 'polir') {
          // vira para o objeto de trabalho (frente da rotina)
          this.angulo = aproximarAngulo(this.angulo, this.passo % 2 ? 0.5 : -0.5, 3, dt);
        }
        if (this.espera <= 0) {
          this.passo = (this.passo + 1) % rot.length;
          this.estado = 'andar';
        }
        break;
      }
      case 'conversar': {
        this.angulo = aproximarAngulo(this.angulo, Math.atan2(j.x - this.x, j.z - this.z), 8, dt);
        break;
      }
      case 'fugir':
      case 'medo': {
        const dx = this.x - this.fugirDe.x;
        const dz = this.z - this.fugirDe.z;
        const d = Math.hypot(dx, dz) || 1;
        dirX = dx / d;
        dirZ = dz / d;
        velAlvo = this.estado === 'medo' ? 3 : 4;
        if (this.tempoEstado <= 0) {
          this.estado = 'andar';
        }
        break;
      }
      case 'tonto': {
        if (Math.random() < dt * 8) {
          ctx.brilhos.emitir({
            x: this.x + Math.sin(this.fase * 7) * 0.45,
            y: this.y + this.altura + 0.15,
            z: this.z + Math.cos(this.fase * 7) * 0.45,
            vida: 0.45,
            tamanho: 0.18,
            cor: '#ffd27a',
          });
        }
        if (this.tempoEstado <= 0) this.estado = 'andar';
        break;
      }
    }

    // comentários ao passar
    this.recargaLatido -= dt;
    if (dj < 6 && this.recargaLatido <= 0 && !this.conversando && this.estado !== 'tonto') {
      this.recargaLatido = 9 + Math.random() * 8;
      ctx.balao(this, bravo ? 'Hmpf.' : escolher(this.def.latidos), 2.4);
      ctx.audio.tocar('falaNpc', { x: this.x, y: this.z, voz: this.def.id });
    }

    // física simples
    this.vx = aproximar(this.vx, dirX * velAlvo, 6, dt);
    this.vz = aproximar(this.vz, dirZ * velAlvo, 6, dt);
    const p = { x: this.x + this.vx * dt, z: this.z + this.vz * dt };
    ctx.fisica.resolver(p, this.y, this.raio, 1.2);
    const chao = ctx.fisica.alturaChao(p.x, p.z, this.y + 0.3);
    if (chao !== -Infinity) {
      this.x = p.x;
      this.z = p.z;
    } else {
      this.vx = this.vz = 0;
    }
    const chaoAqui = Math.max(-5, ctx.fisica.alturaChao(this.x, this.z, this.y + 0.3));
    this.vy -= 28 * dt;
    this.y += this.vy * dt;
    if (this.y <= chaoAqui) {
      this.y = chaoAqui;
      this.vy = acao === 'pular' && Math.random() < dt * 3 ? 5 : 0;
    }
    if (velAlvo > 0.1) this.angulo = aproximarAngulo(this.angulo, Math.atan2(dirX, dirZ), 8, dt);

    // moita: Eco se esconde
    const escondido = acao === 'esconder' && ctx.moitaEm(this.x, this.z) >= 0;

    // animação
    const m = this.modelo;
    const vel = Math.hypot(this.vx, this.vz);
    const t = this.fase;
    m.raiz.position.set(this.x, this.y, this.z);
    m.raiz.rotation.y = this.angulo;
    m.raiz.visible = !escondido || dj < 3;
    const andando = vel > 0.3;
    const ritmo = t * (this.def.id === 'pipo' ? 14 : 9);
    m.corpo.position.y = andando ? Math.abs(Math.sin(ritmo)) * 0.07 : Math.sin(t * 2) * 0.012;
    m.peE.rotation.x = andando ? Math.sin(ritmo) * 0.8 : 0;
    m.peD.rotation.x = andando ? -Math.sin(ritmo) * 0.8 : 0;
    let be = andando ? -Math.sin(ritmo) * 0.7 : 0;
    let bd = andando ? Math.sin(ritmo) * 0.7 : 0;
    let bez = -0.15;
    let bdz = 0.15;
    let inclina = 0;
    let rolar = 0;
    switch (acao) {
      case 'regar':
        bd = -1.3;
        if (m.ferramenta) m.ferramenta.rotation.z = -0.6 + Math.sin(t * 2) * 0.2;
        if (Math.random() < dt * 10) {
          const f = new THREE.Vector3(0, 0, 0);
          m.bracoD.localToWorld(f.set(0.25, -0.6, 0.5));
          ctx.poeira.emitir({
            x: f.x,
            y: f.y,
            z: f.z,
            vy: -2,
            vida: 0.4,
            tamanho: 0.12,
            cor: '#8fd3ff',
            gravidade: 6,
          });
        }
        break;
      case 'martelar':
        bd = -1.6 + Math.abs(Math.sin(t * 6)) * 1.4;
        if (Math.sin(t * 6) > 0.97 && Math.random() < 0.5) {
          ctx.brilhos.emitir({
            x: this.x + Math.sin(this.angulo) * 0.7,
            y: this.y + 0.9,
            z: this.z + Math.cos(this.angulo) * 0.7,
            vy: 2,
            vida: 0.3,
            tamanho: 0.15,
            cor: '#ffd27a',
          });
          if (dj < 10)
            ctx.audio.tocar('runaAtivar', { x: this.x, y: this.z, volume: 0.25, tom: 1.8 });
        }
        break;
      case 'polir':
        bd = -1.4 + Math.sin(t * 5) * 0.3;
        bdz = 0.4 + Math.cos(t * 5) * 0.3;
        break;
      case 'olhar':
        m.corpo.rotation.y = Math.sin(t * 0.9) * 0.5;
        break;
      case 'pular':
        bez = -2.5;
        bdz = 2.5;
        break;
      case 'esconder':
        inclina = 0.3;
        m.corpo.position.y -= 0.15;
        break;
    }
    if (acao !== 'olhar') m.corpo.rotation.y = aproximar(m.corpo.rotation.y, 0, 5, dt);
    if (this.estado === 'medo' || this.estado === 'fugir') {
      be = -2.6 + Math.sin(t * 20) * 0.3;
      bd = -2.6 - Math.sin(t * 20) * 0.3;
      rolar = Math.sin(t * 30) * 0.05;
    }
    if (this.estado === 'tonto') rolar = Math.sin(t * 5) * 0.25;
    if (this.falando) {
      bd = -0.8 + Math.sin(t * 7) * 0.4;
      m.corpo.position.y += Math.abs(Math.sin(t * 9)) * 0.03;
    }
    if (this.humor === 'feliz' || this.humor === 'carinho')
      m.corpo.position.y += Math.abs(Math.sin(t * 6)) * 0.06;
    if (this.humor === 'triste') inclina += 0.15;
    if (this.humor === 'raiva') rolar += Math.sin(t * 35) * 0.03;
    m.bracoE.rotation.x = aproximar(m.bracoE.rotation.x, be, 10, dt);
    m.bracoD.rotation.x = aproximar(m.bracoD.rotation.x, bd, 10, dt);
    m.bracoE.rotation.z = aproximar(m.bracoE.rotation.z, bez, 10, dt);
    m.bracoD.rotation.z = aproximar(m.bracoD.rotation.z, bdz, 10, dt);
    m.corpo.rotation.x = aproximar(m.corpo.rotation.x, inclina, 8, dt);
    m.corpo.rotation.z = rolar;
    const helice = m.corpo.getObjectByName('helice');
    if (helice) helice.rotation.y += dt * (andando ? 25 : 6);
    const eng = m.corpo.getObjectByName('engrenagem');
    if (eng) eng.rotation.z += dt * 2;
    const chama = m.corpo.getObjectByName('chama');
    if (chama) chama.scale.setScalar(1 + Math.sin(t * 12) * 0.2);
    m.rosto.definirHumor(this.estado === 'tonto' ? 'dor' : this.humor);
    m.rosto.olhar.set(this.estado === 'agir' && dj < 3.5 ? 0 : Math.sin(t * 0.6) * 0.4, 0);
    m.rosto.atualizar(dt);
    for (const mat of m.materiais)
      mat.emissive.setRGB(this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0, this.flash > 0 ? 1 : 0);
    this.sombra.position.set(this.x, chaoAqui + 0.03, this.z);
    this.sombra.visible = m.raiz.visible;
  }
}
