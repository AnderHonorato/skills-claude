/**
 * Contexto compartilhado entre o jogo e as entidades (jogador, NPCs, inimigos, objetos).
 */
import type * as THREE from 'three';
import type { ApiAudio } from '../audio/contrato';
import type { EntradaJogo } from '../motor/entrada';
import type { EstadoProgresso } from '../nucleo/estado';
import type { MundoFisico } from '../nucleo/fisica';
import type { SistemaParticulas } from '../render/particulas';

/** Algo que pode levar golpe (inimigo ou NPC). */
export interface Alvo {
  id: string;
  x: number;
  y: number;
  z: number;
  raio: number;
  altura: number;
  vivo: boolean;
  /** Retorna true se o golpe contou (para dar experiência). */
  receberGolpe(g: Golpe): boolean;
}

export interface Golpe {
  dano: number;
  /** Direção do empurrão (normalizada) e força. */
  dx: number;
  dz: number;
  empurrao: number;
  /** Lança para cima (colher). */
  lancar?: number;
  atordoar?: number;
  critico?: boolean;
  origem: 'jogador' | 'reflexo';
}

export interface Contexto {
  cena: THREE.Scene;
  fisica: MundoFisico;
  estado: EstadoProgresso;
  audio: ApiAudio;
  entrada: EntradaJogo;
  poeira: SistemaParticulas;
  brilhos: SistemaParticulas;
  tempo: number;
  tremer(forca: number): void;
  congelar(segundos: number): void;
  mensagem(texto: string, duracao?: number): void;
  /** Fala curta num balão sobre alguém. */
  balao(quem: { x: number; y: number; z: number }, texto: string, duracao?: number): void;
  /** Índice da moita que contém o ponto (ou -1). */
  moitaEm(x: number, z: number): number;
  agitarMoita(i: number, forca: number): void;
  alvos(): Alvo[];
  /** Posição e estado do jogador para a IA. */
  jogador: {
    x: number;
    y: number;
    z: number;
    escondido: boolean;
    velocidade: number;
    vivo: boolean;
    receberDano(dano: number, dx: number, dz: number, fonte: { x: number; z: number }): boolean;
    defendendoDe(x: number, z: number): boolean;
  };
  projetil(p: DadosProjetil): void;
  /** Inimigo derrotado (para missões, experiência e quedas). */
  aoDerrotar(id: string, x: number, y: number, z: number, xp: number, missao?: string): void;
}

export interface DadosProjetil {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  dono: 'jogador' | 'inimigo';
  dano: number;
  raio: number;
  cor: string;
  vida: number;
  /** Persegue o alvo mais próximo. */
  teleguiado?: boolean;
  atravessa?: boolean;
  explode?: boolean;
  /** Onda circular que se expande (pular por cima). */
  onda?: { cx: number; cz: number; raio: number; velocidade: number; maximo: number };
}
