/**
 * O Claude jogável: movimento analógico em 360°, corrida, pulo com tempo de coiote
 * e altura variável, esquiva, golpes que funcionam andando e pulando, combos,
 * especiais de cada arma, defesa com escudo, esconderijo no mato, queda no vazio
 * com volta segura e emoções com gatilhos reais.
 */
import * as THREE from 'three';
import { ARMAS, danoArma, type DefinicaoArma } from '../dados/armas';
import { LAGOS } from '../dados/mundo';
import { DEGRAU } from '../nucleo/fisica';
import { aproximar, diferencaAngulo } from '../nucleo/matematica';
import type { Humor, IdArma } from '../nucleo/tipos';
import { ModeloClaude } from '../render/modelo-claude';
import type { Pegadas } from '../render/pegadas';
import { ArmaMagica, type Movimento } from './arma-magica';
import type { Alvo, Contexto } from './contexto';

const VEL_ANDAR = 6.2;
const VEL_CORRER = 8.6;
const GRAVIDADE = 32;
const PULO = 11.6;
const RAIO = 0.42;
const ALTURA = 1.15;

export class Jogador {
  readonly modelo = new ModeloClaude();
  readonly arma: ArmaMagica;
  x = 0;
  y = 0;
  z = 0;
  vx = 0;
  vz = 0;
  vy = 0;
  angulo = 0;
  noChao = true;
  chao = 0;
  private coiote = 0;
  private bufferPulo = 0;
  private segurandoPulo = false;

  esquiva = -1;
  private recargaEsquiva = 0;
  private dirEsquiva = { x: 0, z: 1 };
  invencivel = 0;
  ferido = 0;

  // golpes
  private golpeT = -1;
  private golpeDur = 0;
  private golpeAng = 0;
  private golpeArco = 0;
  private golpeAlcance = 0;
  private golpeMov: Movimento = 'corte';
  private golpeEspecial = false;
  private golpeAtivo: [number, number] = [0.2, 0.7];
  private atingidos = new Set<string>();
  private combo = 0;
  private janelaCombo = 0;
  private recargaGolpe = 0;
  private segurandoAtaque = 0;
  defendendo = false;
  private investida = 0;
  private mergulho = false;
  domo = 0;

  // emoção
  humor: Humor = 'neutro';
  private humorTempo = 0;
  private parado = 0;
  conjurando = 0;
  falando = false;

  escondido = false;
  private moitaAtual = -1;
  inspiracao = 100;
  private recargaInspiracao = 0;
  pontoSeguro = { x: 0, y: 0, z: 0 };
  private tempoSeguro = 0;
  private passoAnterior = 0;
  private ladoPasso = 1;
  private tempoEmAgua = 0;
  vivo = true;
  /** Bloqueia controles (diálogo, cena). */
  travado = false;
  emCombate = 0;

  constructor(
    private ctx: Contexto,
    private pegadas: Pegadas
  ) {
    this.arma = new ArmaMagica(ctx.brilhos);
  }

  get velocidade(): number {
    return Math.hypot(this.vx, this.vz);
  }

  posicionar(x: number, y: number, z: number): void {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = this.vz = this.vy = 0;
    this.chao = y;
    this.noChao = true;
    this.pontoSeguro = { x, y, z };
  }

  sentir(h: Humor, duracao = 2.5): void {
    // emoções mais fortes não são atropeladas por mais fracas
    if (this.humorTempo > 0 && PRIORIDADE[h] < PRIORIDADE[this.humor]) return;
    this.humor = h;
    this.humorTempo = duracao;
    this.parado = 0;
    const emotes: Partial<Record<Humor, Parameters<typeof this.modelo.emote.mostrar>[0]>> = {
      surpreso: 'exclamacao',
      curioso: 'pergunta',
      carinho: 'coracao',
      raiva: 'raiva',
      medo: 'suor',
      envergonhado: 'suor',
      triste: 'reticencias',
    };
    const e = emotes[h];
    if (e) this.modelo.emote.mostrar(e, Math.min(2, duracao));
    if (h === 'feliz') this.modelo.emote.mostrar('nota', 1.4);
    if (h === 'determinado') this.modelo.emote.mostrar('estrela', 1.2);
  }

  private definicao(): DefinicaoArma | null {
    const id = this.ctx.estado.armaAtual;
    return id ? ARMAS[id] : null;
  }

  trocarArma(id: IdArma): void {
    if (!this.ctx.estado.armas[id] || this.ctx.estado.armaAtual === id) return;
    this.ctx.estado.armaAtual = id;
    this.ctx.audio.tocar('itemObtido', { tom: 1.3, volume: 0.5 });
    this.defendendo = false;
  }

  receberDano(dano: number, dx: number, dz: number, fonte: { x: number; z: number }): boolean {
    if (!this.vivo || this.invencivel > 0 || this.esquiva >= 0 || this.domo > 0) return false;
    if (this.defendendoDe(fonte.x, fonte.z)) {
      this.ctx.audio.tocar('bloqueado', { x: this.x, y: this.z });
      this.ctx.brilhos.explosao(this.x + dx * -0.6, this.y + 0.8, this.z + dz * -0.6, 10, {
        cor: '#a8f0ff',
        tamanho: 0.2,
        vida: 0.4,
      });
      this.vx += dx * 3;
      this.vz += dz * 3;
      this.ctx.estado.ganharXp(2);
      if (this.ctx.estado.nivelArma() >= 5)
        this.ctx.estado.vida = Math.min(this.ctx.estado.vidaMaxima, this.ctx.estado.vida + 0.25);
      return false;
    }
    const est = this.ctx.estado;
    est.vida = Math.max(0, est.vida - dano);
    this.invencivel = 1.1;
    this.ferido = 0.5;
    this.vx = dx * 9;
    this.vz = dz * 9;
    if (this.noChao) this.vy = 4.5;
    this.noChao = false;
    this.modelo.piscarBranco();
    this.modelo.impulso(-2);
    this.ctx.audio.tocar('danoRecebido', { x: this.x, y: this.z });
    this.ctx.tremer(0.35);
    this.ctx.congelar(0.06);
    this.ctx.poeira.explosao(this.x, this.y + 0.6, this.z, 8, {
      cor: '#ffd6c9',
      tamanho: 0.25,
      vida: 0.4,
    });
    this.emCombate = 6;
    this.sentir(est.vida <= 1.5 ? 'medo' : 'dor', 0.7);
    setTimeout(() => {
      if (this.vivo) this.sentir(est.vida <= 1.5 ? 'medo' : 'raiva', 2.2);
    }, 700);
    if (est.vida <= 0) this.vivo = false;
    return true;
  }

  defendendoDe(fx: number, fz: number): boolean {
    if (!this.defendendo) return false;
    const a = Math.atan2(fx - this.x, fz - this.z);
    return Math.abs(diferencaAngulo(this.angulo, a)) < 1.2;
  }

  /** Mira automática: inimigo mais próximo à frente. */
  private mirar(angBase: number, alcance: number, alvos: Alvo[]): number {
    let melhor = angBase;
    let menor = Infinity;
    for (const a of alvos) {
      if (!a.vivo || a.id.startsWith('npc:')) continue;
      const d = Math.hypot(a.x - this.x, a.z - this.z);
      if (d > alcance + 2.2) continue;
      const ang = Math.atan2(a.x - this.x, a.z - this.z);
      const dif = Math.abs(diferencaAngulo(angBase, ang));
      if (dif > 1.25) continue;
      const custo = d + dif * 2;
      if (custo < menor) {
        menor = custo;
        melhor = ang;
      }
    }
    return melhor;
  }

  private iniciarGolpe(especial: boolean): void {
    const def = this.definicao();
    if (!def) return;
    const est = this.ctx.estado;
    const nivel = est.nivelArma();
    const alvos = this.ctx.alvos();
    let ang = this.angulo;
    const entradaMov = this.ctx.entrada.movimento();
    if (Math.hypot(entradaMov.x, entradaMov.y) > 0.3) ang = Math.atan2(entradaMov.x, entradaMov.y);
    ang = this.mirar(ang, def.alcance, alvos);
    this.angulo = ang;
    this.golpeAng = ang;
    this.atingidos.clear();
    this.golpeEspecial = especial;
    this.golpeAlcance = def.alcance;
    this.golpeArco = (def.arco * Math.PI) / 180;
    this.emCombate = Math.max(this.emCombate, 4);
    this.parado = 0;
    const cresc = def.crescimento * (nivel >= 4 ? 1.15 : 1);

    if (especial) {
      this.inspiracao -= def.especial.custo;
      this.recargaInspiracao = 1.2;
      this.sentir('determinado', 1.5);
      this.ctx.audio.tocar('energizar', { x: this.x, y: this.z });
      switch (def.id) {
        case 'galho':
          this.golpeMov = 'giro';
          this.golpeDur = nivel >= 4 ? 0.75 : 0.55;
          this.golpeArco = Math.PI * 2;
          this.golpeAlcance = nivel >= 4 ? 3.6 : 2.9;
          this.golpeAtivo = [0.05, 0.95];
          this.arma.golpear('giro', ang, this.golpeDur, {
            crescimento: cresc * 1.2,
            raio: 0.7,
            sentido: 1,
          });
          break;
        case 'espada':
          this.golpeMov = 'investida';
          this.golpeDur = 0.32;
          this.golpeArco = Math.PI * 0.7;
          this.golpeAlcance = 2.4;
          this.golpeAtivo = [0, 1];
          this.investida = 0.3;
          this.arma.golpear('investida', ang, this.golpeDur, { crescimento: cresc });
          break;
        case 'martelo':
          if (!this.noChao) {
            this.mergulho = true;
            this.vy = -26;
            this.golpeDur = 0.6;
            this.golpeT = 0;
            this.golpeAtivo = [2, 2];
            this.arma.golpear('esmagar', ang, 0.6, { crescimento: cresc * 1.2 });
            return;
          }
          this.golpeMov = 'esmagar';
          this.golpeDur = 0.5;
          this.golpeAtivo = [2, 2]; // dano aplicado no tremor
          this.arma.golpear('esmagar', ang, 0.5, { crescimento: cresc * 1.25 });
          setTimeout(
            () => this.tremor(nivel >= 4 ? 5.5 : 4.2, danoArma('martelo', nivel) * 1.2),
            260
          );
          break;
        case 'colher':
          this.golpeMov = 'erguer';
          this.golpeDur = 0.5;
          this.golpeArco = Math.PI * 2;
          this.golpeAlcance = 3.6;
          this.golpeAtivo = [0.3, 0.6];
          this.arma.golpear('erguer', ang, 0.5, { crescimento: cresc * 1.3 });
          break;
        case 'cajado':
          this.golpeMov = 'disparo';
          this.golpeDur = 0.45;
          this.golpeAtivo = [2, 2];
          this.arma.golpear('disparo', ang, 0.45, { crescimento: cresc });
          for (let i = 0; i < 5; i++) {
            const a = ang + (i - 2) * 0.35;
            this.ctx.projetil({
              x: this.x + Math.sin(a) * 0.6,
              y: this.y + 1,
              z: this.z + Math.cos(a) * 0.6,
              vx: Math.sin(a) * 9,
              vz: Math.cos(a) * 9,
              dono: 'jogador',
              dano: danoArma('cajado', nivel),
              raio: 0.35,
              cor: ARMAS.cajado.brilho,
              vida: 2.2,
              teleguiado: true,
              atravessa: nivel >= 4,
              explode: nivel >= 5,
            });
          }
          break;
        case 'escudo':
          this.golpeMov = 'repouso';
          this.golpeDur = 0.3;
          this.golpeAtivo = [2, 2];
          this.domo = nivel >= 4 ? 5 : 3;
          this.ctx.audio.tocar('criarEscudo', { x: this.x, y: this.z });
          break;
      }
      this.golpeT = 0;
      return;
    }

    // golpe normal (com combo)
    if (this.janelaCombo > 0) this.combo = (this.combo + 1) % def.combo;
    else this.combo = 0;
    const final = this.combo === def.combo - 1 && def.combo > 1;
    this.golpeAtivo = [0.18, 0.72];
    this.golpeDur = def.recarga + 0.14 + (final ? 0.08 : 0);
    let mov: Movimento = 'corte';
    let sentido = this.combo % 2 === 0 ? 1 : -1;
    if (def.tipo === 'esmagar') mov = def.id === 'colher' ? 'erguer' : 'esmagar';
    if (def.tipo === 'projetil') mov = 'disparo';
    if (def.tipo === 'escudo') mov = 'estocada';
    if (def.id === 'espada' && final) mov = 'estocada';
    if (def.id === 'galho' && final) {
      mov = 'giro';
      this.golpeArco = Math.PI * 2;
    }
    if (!this.noChao && def.tipo === 'corte') {
      // golpe aéreo: giro completo
      mov = 'giro';
      this.golpeArco = Math.PI * 2;
      sentido = 1;
    }
    if (!this.noChao && def.id === 'martelo') {
      this.mergulho = true;
      this.vy = -22;
      this.golpeMov = 'esmagar';
      this.golpeT = 0;
      this.golpeAtivo = [2, 2];
      this.arma.golpear('esmagar', ang, 0.55, { crescimento: cresc });
      this.ctx.audio.tocar('ataqueMartelo', { x: this.x, y: this.z });
      return;
    }
    if (mov === 'estocada') this.golpeArco = Math.PI * 0.45;
    if (def.id === 'espada' && final) this.golpeAlcance = def.alcance + 0.9;
    this.golpeMov = mov;
    this.golpeT = 0;
    this.arma.golpear(mov, ang, this.golpeDur, {
      arco: this.golpeArco,
      sentido,
      crescimento: final ? cresc * 1.2 : cresc,
      raio: mov === 'giro' ? 0.7 : 0.5,
    });
    const som =
      def.id === 'martelo'
        ? 'ataqueMartelo'
        : def.id === 'colher'
          ? 'ataqueColher'
          : def.id === 'cajado'
            ? 'ataqueCajado'
            : 'ataqueEspada';
    this.ctx.audio.tocar(som, { x: this.x, y: this.z, tom: 1 + this.combo * 0.08 });
    if (def.tipo === 'projetil') {
      const v = 15;
      this.ctx.projetil({
        x: this.x + Math.sin(ang) * 0.8,
        y: this.y + 1.05,
        z: this.z + Math.cos(ang) * 0.8,
        vx: Math.sin(ang) * v,
        vz: Math.cos(ang) * v,
        dono: 'jogador',
        dano: danoArma('cajado', nivel),
        raio: 0.3,
        cor: ARMAS.cajado.brilho,
        vida: 0.9,
        atravessa: nivel >= 4,
        explode: nivel >= 5,
      });
    }
    // pequeno avanço no golpe (dá peso), sem travar o movimento
    if (this.noChao) {
      this.vx += Math.sin(ang) * 2.2;
      this.vz += Math.cos(ang) * 2.2;
    }
  }

  /** Onda de choque do martelo. */
  private tremor(raio: number, dano: number): void {
    this.ctx.tremer(0.5);
    this.ctx.audio.tocar('chefeOnda', { x: this.x, y: this.z, tom: 1.4 });
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      this.ctx.poeira.emitir({
        x: this.x + Math.sin(a) * 0.6,
        y: this.y + 0.1,
        z: this.z + Math.cos(a) * 0.6,
        vx: Math.sin(a) * raio * 2.4,
        vz: Math.cos(a) * raio * 2.4,
        vy: 1.5,
        vida: 0.5,
        tamanho: 0.5,
        crescer: 2,
        cor: '#e8d8c0',
        arrasto: 3,
      });
    }
    for (const a of this.ctx.alvos()) {
      if (!a.vivo) continue;
      const d = Math.hypot(a.x - this.x, a.z - this.z);
      if (d > raio + a.raio || Math.abs(a.y - this.y) > 1.6) continue;
      const dx = (a.x - this.x) / (d || 1);
      const dz = (a.z - this.z) / (d || 1);
      if (
        a.receberGolpe({
          dano,
          dx,
          dz,
          empurrao: 10,
          atordoar: this.ctx.estado.nivelArma() >= 5 ? 1.5 : 0.6,
          origem: 'jogador',
        })
      )
        this.ctx.estado.ganharXp(3);
    }
  }

  private aplicarGolpe(): void {
    const def = this.definicao();
    if (!def) return;
    const nivel = this.ctx.estado.nivelArma();
    const p = this.golpeT / this.golpeDur;
    if (p < this.golpeAtivo[0] || p > this.golpeAtivo[1]) return;
    let dano =
      danoArma(def.id, nivel) *
      (this.golpeEspecial ? 1.6 : 1) *
      (this.combo === def.combo - 1 && def.combo > 1 ? 1.4 : 1);
    for (const a of this.ctx.alvos()) {
      if (!a.vivo || this.atingidos.has(a.id)) continue;
      const dx = a.x - this.x;
      const dz = a.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > this.golpeAlcance + a.raio) continue;
      if (a.y > this.y + 1.8 || a.y + a.altura < this.y - 0.5) continue;
      if (this.golpeArco < Math.PI * 1.99) {
        const ang = Math.atan2(dx, dz);
        if (
          Math.abs(diferencaAngulo(this.golpeAng, ang)) > this.golpeArco / 2 + 0.25 &&
          d > a.raio + 0.5
        )
          continue;
      }
      this.atingidos.add(a.id);
      const critico = nivel >= 5 && Math.random() < 0.2;
      if (critico) dano *= 1.8;
      const ok = a.receberGolpe({
        dano,
        dx: dx / (d || 1),
        dz: dz / (d || 1),
        empurrao: def.empurrao * (this.golpeEspecial ? 1.5 : 1),
        lancar: def.id === 'colher' ? (this.golpeEspecial ? 13 : 7) : undefined,
        atordoar: def.id === 'espada' && this.golpeEspecial && nivel >= 4 ? 1.2 : undefined,
        critico,
        origem: 'jogador',
      });
      if (ok) {
        this.ctx.estado.ganharXp(2);
        this.ctx.congelar(critico ? 0.09 : 0.05);
        this.ctx.tremer(def.id === 'martelo' ? 0.3 : 0.15);
        this.ctx.audio.tocar(critico || def.id === 'martelo' ? 'acertoForte' : 'acerto', {
          x: a.x,
          y: a.z,
        });
        const pp = new THREE.Vector3(
          a.x - (dx / (d || 1)) * a.raio,
          a.y + a.altura * 0.5,
          a.z - (dz / (d || 1)) * a.raio
        );
        this.ctx.brilhos.explosao(pp.x, pp.y, pp.z, critico ? 22 : 12, {
          cor: critico ? '#ffd27a' : def.brilho,
          tamanho: 0.22,
          vida: 0.4,
          velocidade: 6,
        });
        if (def.id === 'galho')
          this.ctx.poeira.explosao(pp.x, pp.y, pp.z, 5, {
            cor: '#7fd06a',
            tamanho: 0.18,
            vida: 0.9,
            gravidade: 3,
            ondular: 2,
            velocidade: 3,
          });
        // escudo: golpe empurra e quebra o ataque
      }
    }
  }

  atualizar(dt: number): void {
    const ctx = this.ctx;
    const ent = ctx.entrada;
    const est = ctx.estado;
    const def = this.definicao();
    this.invencivel = Math.max(0, this.invencivel - dt);
    this.ferido = Math.max(0, this.ferido - dt);
    this.recargaEsquiva = Math.max(0, this.recargaEsquiva - dt);
    this.recargaGolpe = Math.max(0, this.recargaGolpe - dt);
    this.janelaCombo = Math.max(0, this.janelaCombo - dt);
    this.humorTempo = Math.max(0, this.humorTempo - dt);
    this.conjurando = Math.max(0, this.conjurando - dt);
    this.emCombate = Math.max(0, this.emCombate - dt);
    this.domo = Math.max(0, this.domo - dt);
    this.recargaInspiracao = Math.max(0, this.recargaInspiracao - dt);
    if (this.recargaInspiracao <= 0)
      this.inspiracao = Math.min(100, this.inspiracao + dt * (this.emCombate > 0 ? 7 : 16));
    if (this.humorTempo <= 0 && this.humor !== 'sonolento') {
      this.humor = est.vida <= 1.5 ? 'medo' : this.escondido ? 'curioso' : 'neutro';
    }

    // ---------------- entrada
    let mx = 0;
    let mz = 0;
    let correr = false;
    if (!this.travado && this.vivo) {
      const m = ent.movimento();
      mx = m.x;
      mz = m.y;
      correr = ent.correndo();
      if (ent.apertou('pular')) this.bufferPulo = 0.13;
      this.segurandoPulo = ent.segurando('pular');
      if (ent.apertou('esquivar') && this.recargaEsquiva <= 0 && this.noChao && this.esquiva < 0) {
        const mag = Math.hypot(mx, mz);
        this.dirEsquiva =
          mag > 0.2
            ? { x: mx / mag, z: mz / mag }
            : { x: Math.sin(this.angulo), z: Math.cos(this.angulo) };
        this.esquiva = 0;
        this.recargaEsquiva = 0.55;
        this.angulo = Math.atan2(this.dirEsquiva.x, this.dirEsquiva.z);
        ctx.audio.tocar('esquiva', { x: this.x, y: this.z });
        ctx.poeira.explosao(this.x, this.y + 0.1, this.z, 6, {
          cor: '#e8d8c0',
          tamanho: 0.3,
          vida: 0.4,
          velocidade: 2,
        });
      }
      // ataque: tocar golpeia; com escudo, segurar defende
      if (def) {
        if (ent.segurando('atacar')) this.segurandoAtaque += dt;
        else this.segurandoAtaque = 0;
        const defender = def.tipo === 'escudo' && this.segurandoAtaque > 0.18 && this.esquiva < 0;
        if (defender !== this.defendendo) {
          this.defendendo = defender;
          this.arma.defender(defender, this.angulo);
        }
        if (this.defendendo) this.arma.defender(true, this.angulo);
        if (ent.apertou('atacar') && this.recargaGolpe <= 0 && this.esquiva < 0 && !this.mergulho) {
          this.iniciarGolpe(false);
          this.recargaGolpe = def.recarga;
        }
        if (ent.apertou('especial') && this.esquiva < 0 && !this.mergulho) {
          const nivel = est.nivelArma();
          if (nivel < def.especial.nivel) {
            ctx.mensagem(`${def.especial.nome} libera no nível ${def.especial.nivel} da arma.`);
            ctx.audio.tocar('conectarFalha');
          } else if (this.inspiracao < def.especial.custo) {
            ctx.mensagem('Inspiração insuficiente: espere ela recarregar.');
            ctx.audio.tocar('conectarFalha');
            this.sentir('triste', 0.8);
          } else {
            this.iniciarGolpe(true);
            this.recargaGolpe = 0.45;
          }
        }
      } else if (ent.apertou('atacar')) {
        ctx.mensagem('Você ainda não tem arma. Procure algo brilhando no chão!');
      }
    } else {
      this.segurandoPulo = false;
      if (this.defendendo) {
        this.defendendo = false;
        this.arma.defender(false, this.angulo);
      }
    }

    // ---------------- movimento horizontal
    const mag = Math.min(1, Math.hypot(mx, mz));
    let velMax = (correr ? VEL_CORRER : VEL_ANDAR) * (mag > 0.15 ? Math.max(0.35, mag) : 0);
    if (this.golpeT >= 0) velMax *= this.noChao ? 0.78 : 1;
    if (this.defendendo) velMax *= 0.45;
    if (this.escondido) velMax *= 0.8;
    this.tempoEmAgua =
      ctx.fisica.alturaChao(this.x, this.z, this.y) <= 0.05 && emLago(this.x, this.z)
        ? this.tempoEmAgua + dt
        : 0;
    if (this.tempoEmAgua > 0) velMax *= 0.7;
    const alvoVx = mag > 0.15 ? (mx / Math.max(mag, 1e-4)) * velMax : 0;
    const alvoVz = mag > 0.15 ? (mz / Math.max(mag, 1e-4)) * velMax : 0;
    const acel = this.noChao ? (mag > 0.15 ? 14 : 18) : 6;
    if (this.esquiva >= 0) {
      this.esquiva += dt / 0.3;
      const vel = 16 * (1 - this.esquiva * 0.6);
      this.vx = this.dirEsquiva.x * vel;
      this.vz = this.dirEsquiva.z * vel;
      if (this.esquiva >= 1) this.esquiva = -1;
    } else if (this.investida > 0) {
      this.investida -= dt;
      this.vx = Math.sin(this.golpeAng) * 20;
      this.vz = Math.cos(this.golpeAng) * 20;
      ctx.brilhos.emitir({
        x: this.x,
        y: this.y + 0.6,
        z: this.z,
        vida: 0.3,
        tamanho: 0.3,
        cor: ARMAS.espada.brilho,
      });
    } else {
      this.vx = aproximar(this.vx, alvoVx, acel, dt);
      this.vz = aproximar(this.vz, alvoVz, acel, dt);
    }
    if (mag > 0.15 && this.golpeT < 0 && this.esquiva < 0 && !this.defendendo)
      this.angulo = Math.atan2(mx, mz);

    // ---------------- pulo
    this.bufferPulo = Math.max(0, this.bufferPulo - dt);
    if (this.noChao) this.coiote = 0.12;
    else this.coiote = Math.max(0, this.coiote - dt);
    if (this.bufferPulo > 0 && this.coiote > 0 && this.esquiva < 0) {
      this.vy = PULO;
      this.noChao = false;
      this.coiote = 0;
      this.bufferPulo = 0;
      ctx.audio.tocar('pulo', { x: this.x, y: this.z });
      ctx.poeira.explosao(this.x, this.y + 0.05, this.z, 6, {
        cor: '#efe2cc',
        tamanho: 0.28,
        vida: 0.4,
        velocidade: 2.2,
      });
      this.parado = 0;
    }
    if (!this.noChao) {
      let g = GRAVIDADE;
      if (this.vy > 0 && !this.segurandoPulo) g *= 2.1; // pulo curto
      if (this.vy < 0) g *= 1.25;
      this.vy -= g * dt;
      this.vy = Math.max(this.vy, -38);
    }

    // ---------------- integração com colisão
    const antesX = this.x;
    const antesZ = this.z;
    const nx = this.x + this.vx * dt;
    const nz = this.z + this.vz * dt;
    const p = { x: nx, z: nz };
    const col = ctx.fisica.resolver(p, this.y, RAIO, ALTURA);
    if (col.fronteira) this.aoTocarFronteira();
    // não cai da borda andando (só pulando)
    if (this.noChao && this.esquiva < 0 && this.investida <= 0) {
      if (ctx.fisica.alturaChao(p.x, p.z, this.y) === -Infinity) {
        const soX = ctx.fisica.alturaChao(p.x, this.z, this.y) > -Infinity;
        const soZ = ctx.fisica.alturaChao(this.x, p.z, this.y) > -Infinity;
        p.x = soX ? p.x : this.x;
        p.z = soZ && !soX ? p.z : soX ? this.z : this.z;
        if (!soX && !soZ) {
          p.x = this.x;
          p.z = this.z;
        }
      }
    } else if (
      this.noChao &&
      ctx.fisica.alturaChao(p.x, p.z, this.y) === -Infinity &&
      (this.esquiva >= 0 || this.investida > 0)
    ) {
      // esquiva e investida também param na borda
      p.x = this.x;
      p.z = this.z;
    }
    this.x = p.x;
    this.z = p.z;
    this.vx = (this.x - antesX) / dt;
    this.vz = (this.z - antesZ) / dt;

    // ---------------- vertical
    const chao = ctx.fisica.alturaChao(this.x, this.z, this.y);
    this.chao = chao;
    this.y += this.vy * dt;
    if (this.y <= chao && this.vy <= 0) {
      if (!this.noChao) this.aoAterrissar();
      this.y = chao;
      this.vy = 0;
      this.noChao = true;
    } else if (this.noChao && this.y > chao + 0.02) {
      if (this.y - chao <= DEGRAU)
        this.y = chao; // desce degraus colado no chão
      else this.noChao = false;
    }
    if (this.y < -18) this.caiuNoVazio();

    // ponto seguro: chão firme longe de bordas
    this.tempoSeguro += dt;
    if (this.noChao && this.tempoSeguro > 0.3 && this.esquiva < 0) {
      this.tempoSeguro = 0;
      let firme = true;
      for (let i = 0; i < 6 && firme; i++) {
        const a = (i / 6) * Math.PI * 2;
        if (
          ctx.fisica.alturaChao(this.x + Math.cos(a) * 1.2, this.z + Math.sin(a) * 1.2, this.y) ===
          -Infinity
        )
          firme = false;
      }
      if (firme) this.pontoSeguro = { x: this.x, y: this.y, z: this.z };
    }

    // ---------------- golpe em andamento
    if (this.golpeT >= 0) {
      this.golpeT += dt;
      this.aplicarGolpe();
      if (this.golpeT >= this.golpeDur) {
        this.golpeT = -1;
        this.janelaCombo = 0.38;
        this.golpeEspecial = false;
      }
    }

    // ---------------- mato alto (esconderijo)
    const moita = ctx.moitaEm(this.x, this.z);
    if (moita >= 0 && this.y < this.chao + 0.8) {
      if (moita !== this.moitaAtual) {
        ctx.audio.tocar('passo', { x: this.x, y: this.z, tom: 0.6, volume: 1.2 });
        ctx.poeira.explosao(this.x, this.y + 0.8, this.z, 6, {
          cor: '#5fae5a',
          tamanho: 0.18,
          vida: 1,
          gravidade: 2,
          ondular: 2.5,
          velocidade: 2,
        });
        if (this.moitaAtual < 0) this.sentir('curioso', 1.2);
      }
      ctx.agitarMoita(moita, 0.4 + Math.min(1, this.velocidade / 6) * 0.6);
      this.escondido = true;
    } else this.escondido = false;
    this.moitaAtual = moita;

    // ---------------- passos e pegadas
    if (this.noChao && this.velocidade > 1) {
      this.passoAnterior += dt * (this.velocidade / 2.2);
      if (this.passoAnterior > 1) {
        this.passoAnterior = 0;
        this.ladoPasso *= -1;
        if (this.tempoEmAgua > 0) {
          ctx.audio.tocar('passoAgua', { x: this.x, y: this.z, volume: 0.6 });
          ctx.poeira.emitir({
            x: this.x,
            y: this.y + 0.05,
            z: this.z,
            vida: 0.6,
            tamanho: 0.6,
            crescer: 2.5,
            cor: '#d8f2ff',
          });
        } else {
          ctx.audio.tocar('passo', { x: this.x, y: this.z, volume: 0.5 });
          this.pegadas.marcar(this.x, this.y, this.z, this.angulo, this.ladoPasso);
          if (this.velocidade > 7)
            ctx.poeira.emitir({
              x: this.x,
              y: this.y + 0.08,
              z: this.z,
              vy: 0.6,
              vida: 0.5,
              tamanho: 0.25,
              crescer: 2,
              cor: '#efe2cc',
            });
        }
      }
    }

    // ---------------- sono quando fica parado muito tempo
    if (this.velocidade < 0.2 && this.golpeT < 0 && !this.travado) this.parado += dt;
    else if (this.travado) this.parado = 0;
    else {
      if (this.humor === 'sonolento') {
        this.humor = 'surpreso';
        this.humorTempo = 0.6;
      }
      this.parado = 0;
    }
    if (this.parado > 14 && this.humor !== 'sonolento') {
      this.humor = 'sonolento';
      this.humorTempo = 999;
      this.modelo.emote.mostrar('zz', 3);
    }
    if (this.humor === 'sonolento' && Math.random() < dt * 0.4)
      this.modelo.emote.mostrar('zz', 2.5);

    // ---------------- modelo
    this.modelo.raiz.position.set(this.x, this.y, this.z);
    const piscando = this.invencivel > 0 && Math.floor(this.invencivel * 14) % 2 === 0;
    this.modelo.raiz.visible = !piscando || this.ferido > 0;
    this.modelo.atualizar(dt, {
      velocidade: this.velocidade,
      noChao: this.noChao,
      vy: this.vy,
      angulo: this.angulo,
      golpe: this.golpeT >= 0 ? this.golpeT / this.golpeDur : -1,
      anguloGolpe: this.golpeAng,
      esquiva: this.esquiva,
      ferido: this.ferido * 2,
      humor: this.humor,
      escondido: this.escondido,
      defendendo: this.defendendo,
      falando: this.falando,
      conjurando: this.conjurando,
    });
    this.modelo.posicionarSombra(this.x, chao, this.z, this.y - chao);
    const mao = this.modelo.mao.getWorldPosition(new THREE.Vector3());
    this.arma.equipar(est.armaAtual, est.nivelArma());
    this.arma.atualizar(dt, this.x, this.y, this.z, this.angulo, mao, this.escondido);
  }

  private aoAterrissar(): void {
    const ctx = this.ctx;
    const forca = Math.min(1, Math.abs(this.vy) / 20);
    ctx.audio.tocar('aterrissagem', { x: this.x, y: this.z, volume: 0.4 + forca * 0.6 });
    ctx.poeira.explosao(this.x, this.chao + 0.05, this.z, 4 + Math.floor(forca * 8), {
      cor: '#efe2cc',
      tamanho: 0.3,
      vida: 0.45,
      velocidade: 2 + forca * 3,
    });
    if (this.mergulho) {
      this.mergulho = false;
      const nivel = ctx.estado.nivelArma();
      this.tremor(nivel >= 4 ? 5 : 3.8, danoArma('martelo', nivel) * 1.3);
      this.modelo.impulso(-4);
    }
  }

  private aoTocarFronteira(): void {
    // a fronteira bloqueia andar, esquivar e investir: corta a velocidade na hora
    this.esquiva = -1;
    this.investida = 0;
  }

  private caiuNoVazio(): void {
    const ctx = this.ctx;
    ctx.audio.tocar('quedaVao');
    const p = this.pontoSeguro;
    this.posicionar(p.x, p.y, p.z);
    this.invencivel = 1.2;
    const dano = 0.5;
    ctx.estado.vida = Math.max(0.5, ctx.estado.vida - dano);
    this.sentir('envergonhado', 2);
    ctx.mensagem('Opa! Você caiu no céu e voltou para um lugar seguro.');
  }
}

/** Lagos rasos (deixam o passo mais lento). */
function emLago(x: number, z: number): boolean {
  for (const l of LAGOS) if (Math.hypot(x - l.x, z - l.z) < l.r - 0.2) return true;
  return false;
}

const PRIORIDADE: Record<Humor, number> = {
  neutro: 0,
  sonolento: 0,
  curioso: 1,
  feliz: 2,
  carinho: 2,
  envergonhado: 2,
  triste: 2,
  determinado: 2,
  surpreso: 3,
  medo: 3,
  raiva: 3,
  dor: 4,
};
