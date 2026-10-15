/**
 * Inimigos do Ruído com ataques sempre telegrafados:
 * - Chiado: treme e marca um círculo vermelho no chão, depois pula no ponto marcado.
 * - Zumbido: acende a antena, risca uma linha vermelha e dispara um eco por ela.
 * - Estática Grande: pancada em área (círculo crescendo) e ondas que se pula por cima.
 * Perdem o Claude de vista quando ele se esconde no mato.
 */
import * as THREE from 'three';
import { aproximar, aproximarAngulo, diferencaAngulo } from '../nucleo/matematica';
import type { SpawnInimigo, TipoInimigo } from '../nucleo/tipos';
import { Emote } from '../render/emotes';
import { criarModeloInimigo, type ModeloInimigo } from '../render/modelos';
import type { Alvo, Contexto, Golpe } from './contexto';

type EstadoIA =
  | 'vagar'
  | 'perseguir'
  | 'telegrafar'
  | 'atacar'
  | 'recuperar'
  | 'atordoado'
  | 'dormindo'
  | 'procurar'
  | 'morto';

interface Tabela {
  vida: number;
  velocidade: number;
  visao: number;
  raio: number;
  xp: number;
  alcanceAtaque: number;
}

const TABELA: Record<TipoInimigo, Tabela> = {
  chiado: { vida: 3, velocidade: 3.3, visao: 9, raio: 0.55, xp: 10, alcanceAtaque: 3.6 },
  zumbido: { vida: 2.4, velocidade: 3.6, visao: 11, raio: 0.5, xp: 12, alcanceAtaque: 9 },
  estatica: { vida: 34, velocidade: 2.1, visao: 13, raio: 1.25, xp: 80, alcanceAtaque: 4.5 },
};

/** Marcador de aviso no chão (círculo ou linha). */
class Aviso {
  readonly malha: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  constructor(tipo: 'circulo' | 'linha') {
    this.mat = new THREE.MeshBasicMaterial({
      color: '#ff3b3b',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
    });
    const geo =
      tipo === 'circulo' ? new THREE.RingGeometry(0.0, 1, 32) : new THREE.PlaneGeometry(0.7, 1);
    if (tipo === 'linha') geo.translate(0, 0.5, 0);
    this.malha = new THREE.Mesh(geo, this.mat);
    this.malha.rotation.x = -Math.PI / 2;
    this.malha.renderOrder = 4;
    this.malha.visible = false;
  }
  mostrar(
    x: number,
    y: number,
    z: number,
    escala: number,
    progresso: number,
    angulo = 0,
    comprimento = 1
  ): void {
    this.malha.visible = true;
    this.malha.position.set(x, y + 0.06, z);
    this.malha.rotation.set(-Math.PI / 2, 0, angulo);
    this.malha.scale.set(escala, comprimento, 1);
    this.mat.opacity = 0.25 + progresso * 0.45 + Math.sin(progresso * 40) * 0.08;
  }
  esconder(): void {
    this.malha.visible = false;
  }
}

export class Inimigo implements Alvo {
  readonly modelo: ModeloInimigo;
  readonly emote: Emote;
  readonly tab: Tabela;
  x: number;
  y = 0;
  z: number;
  vx = 0;
  vz = 0;
  vy = 0;
  raio: number;
  altura: number;
  vida: number;
  vivo = true;
  estado: EstadoIA = 'vagar';
  private t = 0;
  private angulo = Math.random() * Math.PI * 2;
  private alvoVagar = { x: 0, z: 0 };
  private alvoAtaque = { x: 0, z: 0, ang: 0 };
  private flash = 0;
  private recarga = 1;
  private viuJogador = 0;
  private fase = Math.random() * 10;
  private avisoC = new Aviso('circulo');
  private avisoL = new Aviso('linha');
  private morreuEm = 0;
  private acertouAtaque = false;
  private faseChefe = 1;
  private golpesSeguidos = 0;
  private chao = 0;

  constructor(
    readonly spawn: SpawnInimigo,
    private ctx: Contexto
  ) {
    this.tab = TABELA[spawn.tipo];
    this.x = spawn.x;
    this.z = spawn.z;
    this.raio = this.tab.raio;
    this.vida = this.tab.vida;
    this.modelo = criarModeloInimigo(spawn.tipo);
    this.altura = this.modelo.altura;
    this.emote = new Emote(this.altura + 0.5);
    this.modelo.raiz.add(this.emote.sprite);
    this.alvoVagar = { x: spawn.x, z: spawn.z };
    this.chao = Math.max(0, ctx.fisica.alturaChao(this.x, this.z, 10));
    this.y = this.chao;
    if (spawn.tipo === 'zumbido') this.y = this.chao;
  }

  get id(): string {
    return this.spawn.id;
  }

  objetos(): THREE.Object3D[] {
    return [this.modelo.raiz, this.avisoC.malha, this.avisoL.malha];
  }

  adormecer(): void {
    if (!this.vivo) return;
    this.estado = 'dormindo';
    this.emote.mostrar('zz', 2.5);
  }

  renascer(): void {
    this.vivo = true;
    this.vida = this.tab.vida;
    this.x = this.spawn.x;
    this.z = this.spawn.z;
    this.y = this.chao;
    this.estado = 'vagar';
    this.modelo.raiz.visible = true;
    this.modelo.raiz.scale.setScalar(1);
    this.faseChefe = 1;
  }

  receberGolpe(g: Golpe): boolean {
    if (!this.vivo) return false;
    const chefe = this.spawn.tipo === 'estatica';
    this.vida -= g.dano;
    this.flash = 0.15;
    const resist = chefe ? 0.25 : 1;
    this.vx += g.dx * g.empurrao * resist;
    this.vz += g.dz * g.empurrao * resist;
    if (g.lancar && !chefe) this.vy = g.lancar;
    if (this.estado === 'dormindo' || this.estado === 'vagar' || this.estado === 'procurar') {
      this.estado = 'perseguir';
      this.emote.mostrar('exclamacao', 1);
    }
    if (g.atordoar && !chefe) {
      this.estado = 'atordoado';
      this.t = g.atordoar;
      this.avisoC.esconder();
      this.avisoL.esconder();
    } else if (!chefe && this.estado === 'telegrafar' && g.dano >= 1) {
      // golpe interrompe a preparação do ataque
      this.estado = 'recuperar';
      this.t = 0.5;
      this.avisoC.esconder();
      this.avisoL.esconder();
    }
    this.golpesSeguidos++;
    this.ctx.audio.tocar('inimigoFerido', { x: this.x, y: this.z, tom: chefe ? 0.6 : 1 });
    if (this.vida <= 0) this.morrer();
    return true;
  }

  private morrer(): void {
    this.vivo = false;
    this.estado = 'morto';
    this.morreuEm = this.ctx.tempo;
    this.avisoC.esconder();
    this.avisoL.esconder();
    const cx = this.x;
    const cy = this.y + this.altura * 0.5;
    const cz = this.z;
    this.ctx.audio.tocar(this.spawn.tipo === 'estatica' ? 'chefeDerrotado' : 'inimigoDerrotado', {
      x: cx,
      y: cz,
    });
    this.ctx.brilhos.explosao(cx, cy, cz, this.spawn.tipo === 'estatica' ? 60 : 24, {
      cor: '#c9b8ff',
      tamanho: 0.3,
      vida: 0.8,
      velocidade: 6,
    });
    this.ctx.poeira.explosao(cx, cy, cz, 14, {
      cor: '#6b5a8e',
      tamanho: 0.4,
      vida: 0.6,
      velocidade: 4,
      gravidade: 6,
    });
    this.ctx.tremer(this.spawn.tipo === 'estatica' ? 0.8 : 0.2);
    this.ctx.aoDerrotar(this.id, cx, cy, cz, this.tab.xp, this.spawn.missao);
  }

  /** O jogador está visível para este inimigo? */
  private ve(dist: number): boolean {
    const j = this.ctx.jogador;
    if (!j.vivo) return false;
    if (j.escondido) return dist < 1.7;
    return dist < this.tab.visao;
  }

  atualizar(dt: number): void {
    const ctx = this.ctx;
    this.emote.atualizar(dt);
    if (!this.vivo) {
      // encolhe e some
      const s = Math.max(0, this.modelo.raiz.scale.x - dt * 4);
      this.modelo.raiz.scale.setScalar(s);
      this.modelo.raiz.visible = s > 0.01;
      // renasce depois de um tempo (exceto inimigos de missão)
      if (!this.spawn.missao && ctx.tempo - this.morreuEm > 75) {
        const j = ctx.jogador;
        if (Math.hypot(j.x - this.spawn.x, j.z - this.spawn.z) > 26) this.renascer();
      }
      return;
    }
    this.t -= dt;
    this.recarga = Math.max(0, this.recarga - dt);
    this.flash = Math.max(0, this.flash - dt);
    this.fase += dt;
    const j = ctx.jogador;
    const dx = j.x - this.x;
    const dz = j.z - this.z;
    const dist = Math.hypot(dx, dz);
    const angJ = Math.atan2(dx, dz);
    let velAlvo = 0;
    let dirX = 0;
    let dirZ = 0;
    const tipo = this.spawn.tipo;

    switch (this.estado) {
      case 'dormindo': {
        const correndo = j.velocidade > 7;
        if (!j.escondido && (dist < 2.2 || (correndo && dist < 4.5))) {
          this.estado = 'perseguir';
          this.emote.mostrar('exclamacao', 1.2);
          ctx.audio.tocar('inimigoAlerta', { x: this.x, y: this.z });
        } else if (Math.random() < dt * 0.3) this.emote.mostrar('zz', 2.5);
        break;
      }
      case 'vagar': {
        if (this.ve(dist)) {
          this.estado = 'perseguir';
          this.emote.mostrar('exclamacao', 1);
          ctx.audio.tocar('inimigoAlerta', { x: this.x, y: this.z });
          break;
        }
        if (this.t <= 0 || Math.hypot(this.alvoVagar.x - this.x, this.alvoVagar.z - this.z) < 0.5) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * 4;
          this.alvoVagar = { x: this.spawn.x + Math.cos(a) * d, z: this.spawn.z + Math.sin(a) * d };
          this.t = 2 + Math.random() * 3;
        }
        const vx = this.alvoVagar.x - this.x;
        const vz = this.alvoVagar.z - this.z;
        const vd = Math.hypot(vx, vz);
        if (vd > 0.5) {
          dirX = vx / vd;
          dirZ = vz / vd;
          velAlvo = this.tab.velocidade * 0.35;
        }
        break;
      }
      case 'procurar': {
        if (this.ve(dist)) {
          this.estado = 'perseguir';
          break;
        }
        if (this.t <= 0) {
          this.estado = 'vagar';
          this.t = 0;
        }
        break;
      }
      case 'perseguir': {
        if (!this.ve(dist)) {
          this.viuJogador += dt;
          if (this.viuJogador > 0.8) {
            this.estado = 'procurar';
            this.t = 2.5;
            this.emote.mostrar('pergunta', 1.6);
            this.viuJogador = 0;
            break;
          }
        } else this.viuJogador = 0;
        // volta se for longe demais de casa
        if (Math.hypot(this.x - this.spawn.x, this.z - this.spawn.z) > 18) {
          this.estado = 'vagar';
          this.t = 0;
          break;
        }
        if (tipo === 'zumbido') {
          // mantém distância e alinha o tiro
          const ideal = 6.5;
          const s = dist > ideal + 1 ? 1 : dist < ideal - 1.5 ? -1 : 0;
          dirX = (dx / (dist || 1)) * s + Math.cos(this.fase) * 0.4;
          dirZ = (dz / (dist || 1)) * s + Math.sin(this.fase) * 0.4;
          velAlvo = this.tab.velocidade * (s === 0 ? 0.5 : 1);
          if (dist < this.tab.alcanceAtaque && this.recarga <= 0) this.telegrafar(angJ);
        } else {
          dirX = dx / (dist || 1);
          dirZ = dz / (dist || 1);
          velAlvo = this.tab.velocidade * (this.faseChefe === 2 ? 1.35 : 1);
          if (dist < this.tab.alcanceAtaque && this.recarga <= 0) this.telegrafar(angJ);
        }
        break;
      }
      case 'telegrafar': {
        const total =
          tipo === 'chiado' ? 0.65 : tipo === 'zumbido' ? 0.85 : this.faseChefe === 2 ? 0.8 : 1.05;
        const prog = 1 - Math.max(0, this.t) / total;
        if (tipo === 'chiado') {
          this.avisoC.mostrar(
            this.alvoAtaque.x,
            ctx.fisica.alturaChao(this.alvoAtaque.x, this.alvoAtaque.z, 10),
            this.alvoAtaque.z,
            1.1 * prog + 0.2,
            prog
          );
          this.modelo.corpo.position.x = Math.sin(this.fase * 70) * 0.06;
        } else if (tipo === 'zumbido') {
          this.avisoL.mostrar(
            this.x,
            this.chao,
            this.z,
            1,
            prog,
            this.alvoAtaque.ang + Math.PI,
            12
          );
          this.angulo = this.alvoAtaque.ang;
        } else {
          if (this.golpesSeguidos % 3 === 2)
            this.avisoC.mostrar(this.x, this.chao, this.z, 2 + prog * 1.5, prog);
          else this.avisoC.mostrar(this.x, this.chao, this.z, 4.4 * prog, prog);
          this.modelo.corpo.position.x = Math.sin(this.fase * 50) * 0.08;
        }
        if (this.t <= 0) this.atacar();
        break;
      }
      case 'atacar': {
        if (tipo === 'chiado') {
          // pulo no ponto marcado
          if (
            !this.acertouAtaque &&
            Math.hypot(j.x - this.x, j.z - this.z) < this.raio + 0.5 &&
            Math.abs(j.y - this.y) < 1.2
          ) {
            if (
              j.receberDano(1, Math.sin(this.alvoAtaque.ang), Math.cos(this.alvoAtaque.ang), this)
            )
              this.acertouAtaque = true;
          }
          if (this.t <= 0 && this.y <= this.chao + 0.01) {
            this.estado = 'recuperar';
            this.t = 0.9;
            this.emote.mostrar('estrela', 0.9);
            ctx.poeira.explosao(this.x, this.chao + 0.1, this.z, 8, {
              cor: '#9a86c9',
              tamanho: 0.3,
              vida: 0.5,
              velocidade: 3,
            });
          }
        } else if (this.t <= 0) {
          this.estado = 'recuperar';
          this.t = tipo === 'estatica' ? 1.1 : 0.6;
        }
        break;
      }
      case 'recuperar':
      case 'atordoado': {
        if (this.estado === 'atordoado' && Math.random() < dt * 6) {
          ctx.brilhos.emitir({
            x: this.x + Math.sin(this.fase * 6) * 0.4,
            y: this.y + this.altura + 0.1,
            z: this.z + Math.cos(this.fase * 6) * 0.4,
            vida: 0.4,
            tamanho: 0.18,
            cor: '#ffd27a',
          });
        }
        this.modelo.corpo.position.x = 0;
        if (this.t <= 0) {
          this.estado = 'perseguir';
          this.recarga = tipo === 'estatica' ? 1.4 : 1.2 + Math.random() * 0.8;
        }
        break;
      }
    }

    // fase 2 do chefe
    if (tipo === 'estatica' && this.faseChefe === 1 && this.vida < this.tab.vida * 0.5) {
      this.faseChefe = 2;
      ctx.audio.tocar('chefeFase', { x: this.x, y: this.z });
      ctx.mensagem('A Estática Grande ficou mais barulhenta!');
      this.emote.mostrar('raiva', 1.5);
    }

    // movimento com física
    const acel = this.estado === 'atacar' ? 0 : 6;
    this.vx = aproximar(this.vx, dirX * velAlvo, acel, dt);
    this.vz = aproximar(this.vz, dirZ * velAlvo, acel, dt);
    const p = { x: this.x + this.vx * dt, z: this.z + this.vz * dt };
    ctx.fisica.resolver(p, this.y, this.raio, 1);
    // nunca sai do chão andando (não cai das ilhas)
    const chaoNovo = ctx.fisica.alturaChao(p.x, p.z, this.y + 0.3);
    if (chaoNovo !== -Infinity) {
      this.x = p.x;
      this.z = p.z;
      this.chao = Math.max(-5, chaoNovo);
    } else {
      this.vx *= -0.3;
      this.vz *= -0.3;
    }
    this.vy -= 30 * dt;
    this.y += this.vy * dt;
    if (this.y <= this.chao) {
      this.y = this.chao;
      this.vy = 0;
    }
    if (velAlvo > 0.1 && this.estado !== 'telegrafar')
      this.angulo = aproximarAngulo(this.angulo, Math.atan2(dirX, dirZ), 8, dt);
    if (this.estado === 'perseguir' || this.estado === 'telegrafar')
      this.angulo = aproximarAngulo(
        this.angulo,
        tipo === 'zumbido' && this.estado === 'telegrafar' ? this.alvoAtaque.ang : angJ,
        10,
        dt
      );

    // visual
    const m = this.modelo;
    m.raiz.position.set(
      this.x,
      this.y + (tipo === 'zumbido' ? Math.sin(this.fase * 3) * 0.15 : 0),
      this.z
    );
    m.raiz.rotation.y = this.angulo;
    const quique =
      tipo === 'chiado'
        ? Math.abs(Math.sin(this.fase * 9)) * (Math.hypot(this.vx, this.vz) > 0.5 ? 0.12 : 0.03)
        : 0;
    m.corpo.position.y = quique;
    const esmaga = this.estado === 'telegrafar' ? 1 - 0.15 * Math.min(1, 1 - this.t) : 1;
    m.corpo.scale.set(1 / Math.sqrt(esmaga), esmaga, 1 / Math.sqrt(esmaga));
    if (this.estado === 'atordoado' || this.estado === 'recuperar')
      m.corpo.rotation.z = Math.sin(this.fase * 10) * 0.15;
    else m.corpo.rotation.z = 0;
    if (this.estado === 'dormindo') {
      m.olhos.scale.y = 0.15;
      m.corpo.scale.y = 1 + Math.sin(this.fase * 1.5) * 0.04;
    } else m.olhos.scale.y = 1;
    for (const mat of m.materiais)
      mat.emissive.setRGB(
        this.flash > 0 ? 1 : this.estado === 'telegrafar' ? 0.35 : 0,
        this.flash > 0 ? 1 : 0,
        this.flash > 0 ? 1 : 0
      );
    if (tipo === 'zumbido') {
      const asaE = m.corpo.getObjectByName('asaE');
      const asaD = m.corpo.getObjectByName('asaD');
      if (asaE) asaE.rotation.z = Math.sin(this.fase * 40) * 0.6;
      if (asaD) asaD.rotation.z = -Math.sin(this.fase * 40) * 0.6;
      if (m.antena)
        (m.antena.material as THREE.MeshBasicMaterial).color.set(
          this.estado === 'telegrafar' ? '#ff3b3b' : '#7af0d0'
        );
    }
    if (tipo === 'estatica') {
      const be = m.corpo.getObjectByName('bracoE');
      const bd = m.corpo.getObjectByName('bracoD');
      const erguer = this.estado === 'telegrafar' ? -2.4 : 0;
      if (be) be.rotation.x = aproximar(be.rotation.x, erguer, 10, dt);
      if (bd) bd.rotation.x = aproximar(bd.rotation.x, erguer, 10, dt);
      if (Math.random() < dt * 4)
        ctx.brilhos.emitir({
          x: this.x + (Math.random() - 0.5) * 2,
          y: this.y + 2.2,
          z: this.z + (Math.random() - 0.5) * 1.5,
          vy: 1.5,
          vida: 0.6,
          tamanho: 0.2,
          cor: '#c9b8ff',
        });
    }
    if (this.estado !== 'telegrafar') {
      this.avisoC.esconder();
      this.avisoL.esconder();
    }
  }

  private telegrafar(angJ: number): void {
    const j = this.ctx.jogador;
    this.estado = 'telegrafar';
    const tipo = this.spawn.tipo;
    this.t =
      tipo === 'chiado' ? 0.65 : tipo === 'zumbido' ? 0.85 : this.faseChefe === 2 ? 0.8 : 1.05;
    this.alvoAtaque = { x: j.x, z: j.z, ang: angJ };
    this.ctx.audio.tocar('inimigoTelegrafo', {
      x: this.x,
      y: this.z,
      tom: tipo === 'estatica' ? 0.6 : 1,
    });
  }

  private atacar(): void {
    const ctx = this.ctx;
    const tipo = this.spawn.tipo;
    this.estado = 'atacar';
    this.acertouAtaque = false;
    this.avisoC.esconder();
    this.avisoL.esconder();
    this.modelo.corpo.position.x = 0;
    ctx.audio.tocar('inimigoAtaque', { x: this.x, y: this.z, tom: tipo === 'estatica' ? 0.5 : 1 });
    if (tipo === 'chiado') {
      const dx = this.alvoAtaque.x - this.x;
      const dz = this.alvoAtaque.z - this.z;
      const tempoVoo = 0.5;
      this.vx = dx / tempoVoo;
      this.vz = dz / tempoVoo;
      this.vy = 7.5;
      this.t = tempoVoo;
    } else if (tipo === 'zumbido') {
      const a = this.alvoAtaque.ang;
      ctx.projetil({
        x: this.x + Math.sin(a) * 0.6,
        y: this.y + 1.1,
        z: this.z + Math.cos(a) * 0.6,
        vx: Math.sin(a) * 11,
        vz: Math.cos(a) * 11,
        dono: 'inimigo',
        dano: 1,
        raio: 0.35,
        cor: '#7af0d0',
        vida: 1.3,
      });
      this.t = 0.4;
    } else {
      if (this.golpesSeguidos % 3 === 2 || (this.faseChefe === 2 && Math.random() < 0.5)) {
        // onda que se expande: precisa pular por cima
        ctx.projetil({
          x: this.x,
          y: this.chao,
          z: this.z,
          vx: 0,
          vz: 0,
          dono: 'inimigo',
          dano: 1,
          raio: 0.4,
          cor: '#ff6bd6',
          vida: 3,
          onda: {
            cx: this.x,
            cz: this.z,
            raio: 1.5,
            velocidade: this.faseChefe === 2 ? 7.5 : 6,
            maximo: 15,
          },
        });
        ctx.mensagem('Pule a onda!', 1.5);
      } else {
        // pancada em área
        ctx.tremer(0.6);
        ctx.poeira.explosao(this.x, this.chao + 0.1, this.z, 30, {
          cor: '#9a86c9',
          tamanho: 0.5,
          vida: 0.6,
          velocidade: 8,
        });
        const j = ctx.jogador;
        const d = Math.hypot(j.x - this.x, j.z - this.z);
        if (d < 4.6 && j.y < this.chao + 1.2)
          j.receberDano(
            this.faseChefe === 2 ? 2 : 1.5,
            (j.x - this.x) / (d || 1),
            (j.z - this.z) / (d || 1),
            this
          );
      }
      this.golpesSeguidos++;
      this.t = 0.5;
    }
  }

  get ehChefe(): boolean {
    return this.spawn.tipo === 'estatica';
  }

  dormindo(): boolean {
    return this.estado === 'dormindo';
  }
}

export function anguloPara(ax: number, az: number, bx: number, bz: number, base: number): number {
  return diferencaAngulo(base, Math.atan2(bx - ax, bz - az));
}
