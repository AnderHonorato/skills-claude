/**
 * Projéteis: orbes de ideia do Claude (com perseguição e explosão), ecos dos Zumbidos
 * (refletidos pelo escudo) e ondas da Estática Grande (pule por cima!). Qualquer sólido,
 * inclusive a parede da fronteira, destrói o projétil.
 */
import * as THREE from 'three';
import type { Contexto, DadosProjetil } from './contexto';

interface Projetil extends DadosProjetil {
  malha: THREE.Object3D;
  vivo: boolean;
  atingidos: Set<string>;
}

const geoBola = new THREE.IcosahedronGeometry(1, 1);

export class Projeteis {
  private lista: Projetil[] = [];

  constructor(private ctx: Contexto) {}

  criar(d: DadosProjetil): void {
    let malha: THREE.Object3D;
    if (d.onda) {
      const anel = new THREE.Mesh(
        new THREE.TorusGeometry(1, 0.22, 6, 48),
        new THREE.MeshBasicMaterial({ color: d.cor, transparent: true, opacity: 0.85 })
      );
      anel.rotation.x = -Math.PI / 2;
      malha = anel;
    } else {
      malha = new THREE.Mesh(geoBola, new THREE.MeshBasicMaterial({ color: d.cor }));
      malha.scale.setScalar(d.raio);
    }
    malha.position.set(d.x, d.y, d.z);
    this.ctx.cena.add(malha);
    this.lista.push({ ...d, malha, vivo: true, atingidos: new Set() });
  }

  limpar(): void {
    for (const p of this.lista) this.ctx.cena.remove(p.malha);
    this.lista = [];
  }

  atualizar(dt: number): void {
    const ctx = this.ctx;
    const j = ctx.jogador;
    for (const p of this.lista) {
      if (!p.vivo) continue;
      p.vida -= dt;
      if (p.vida <= 0) {
        p.vivo = false;
        continue;
      }
      if (p.onda) {
        const o = p.onda;
        o.raio += o.velocidade * dt;
        p.malha.position.set(o.cx, p.y + 0.35, o.cz);
        p.malha.scale.set(o.raio, o.raio, 1);
        ((p.malha as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity =
          0.9 * (1 - o.raio / o.maximo);
        const d = Math.hypot(j.x - o.cx, j.z - o.cz);
        if (Math.abs(d - o.raio) < 0.55 && j.y < p.y + 0.7 && !p.atingidos.has('j')) {
          p.atingidos.add('j');
          j.receberDano(p.dano, (j.x - o.cx) / (d || 1), (j.z - o.cz) / (d || 1), {
            x: o.cx,
            z: o.cz,
          });
        }
        if (o.raio > o.maximo) p.vivo = false;
        continue;
      }
      // perseguição suave
      if (p.teleguiado && p.dono === 'jogador') {
        let melhor: { x: number; y: number; z: number } | null = null;
        let menor = 9;
        for (const a of ctx.alvos()) {
          if (!a.vivo || a.id.startsWith('npc:') || p.atingidos.has(a.id)) continue;
          const d = Math.hypot(a.x - p.x, a.z - p.z);
          if (d < menor) {
            menor = d;
            melhor = a;
          }
        }
        if (melhor) {
          const v = Math.hypot(p.vx, p.vz);
          const dx = melhor.x - p.x;
          const dz = melhor.z - p.z;
          const d = Math.hypot(dx, dz) || 1;
          p.vx += ((dx / d) * v - p.vx) * Math.min(1, dt * 5);
          p.vz += ((dz / d) * v - p.vz) * Math.min(1, dt * 5);
        }
      }
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.malha.position.set(p.x, p.y + Math.sin(ctx.tempo * 20) * 0.03, p.z);
      if (Math.random() < 0.7)
        ctx.brilhos.emitir({
          x: p.x,
          y: p.y,
          z: p.z,
          vida: 0.25,
          tamanho: p.raio * 0.9,
          cor: p.cor,
        });
      // paredes, troncos e a fronteira bloqueiam
      if (ctx.fisica.bloqueado(p.x, p.z, p.y)) {
        this.estourar(p);
        continue;
      }
      if (p.dono === 'inimigo') {
        const d = Math.hypot(j.x - p.x, j.z - p.z);
        if (d < p.raio + 0.45 && p.y > j.y - 0.2 && p.y < j.y + 1.5) {
          if (j.defendendoDe(p.x, p.z)) {
            // reflexo do escudo
            p.dono = 'jogador';
            p.vx *= -1.3;
            p.vz *= -1.3;
            p.dano *= ctx.estado.nivelArma() >= 3 ? 2 : 1.2;
            p.cor = '#a8f0ff';
            ((p.malha as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(p.cor);
            p.vida = 1.5;
            ctx.audio.tocar('refletir', { x: p.x, y: p.z });
            ctx.estado.ganharXp(3);
          } else {
            j.receberDano(
              p.dano,
              p.vx / (Math.hypot(p.vx, p.vz) || 1),
              p.vz / (Math.hypot(p.vx, p.vz) || 1),
              { x: p.x - p.vx, z: p.z - p.vz }
            );
            this.estourar(p);
          }
        }
      } else {
        for (const a of ctx.alvos()) {
          if (!a.vivo || a.id.startsWith('npc:') || p.atingidos.has(a.id)) continue;
          const d = Math.hypot(a.x - p.x, a.z - p.z);
          if (d < p.raio + a.raio && p.y > a.y - 0.3 && p.y < a.y + a.altura + 0.3) {
            p.atingidos.add(a.id);
            const v = Math.hypot(p.vx, p.vz) || 1;
            if (
              a.receberGolpe({
                dano: p.dano,
                dx: p.vx / v,
                dz: p.vz / v,
                empurrao: 3,
                origem: 'jogador',
              })
            )
              ctx.estado.ganharXp(2);
            ctx.audio.tocar('acerto', { x: a.x, y: a.z, tom: 1.3 });
            if (p.explode) {
              for (const b of ctx.alvos()) {
                if (b === a || !b.vivo || b.id.startsWith('npc:')) continue;
                if (Math.hypot(b.x - p.x, b.z - p.z) < 2.5)
                  b.receberGolpe({
                    dano: p.dano * 0.6,
                    dx: 0,
                    dz: 0,
                    empurrao: 4,
                    origem: 'jogador',
                  });
              }
              ctx.brilhos.explosao(p.x, p.y, p.z, 20, {
                cor: p.cor,
                tamanho: 0.3,
                vida: 0.5,
                velocidade: 5,
              });
            }
            if (!p.atravessa) {
              this.estourar(p);
              break;
            }
          }
        }
      }
    }
    for (const p of this.lista) if (!p.vivo) ctx.cena.remove(p.malha);
    this.lista = this.lista.filter((p) => p.vivo);
  }

  private estourar(p: Projetil): void {
    p.vivo = false;
    this.ctx.brilhos.explosao(p.x, p.y, p.z, 10, {
      cor: p.cor,
      tamanho: 0.2,
      vida: 0.35,
      velocidade: 3,
    });
  }
}
