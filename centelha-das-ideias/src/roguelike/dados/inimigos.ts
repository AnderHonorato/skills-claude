/**
 * Inimigos do Ruído e a curva das hordas. A pressão cresce com o tempo: mais
 * inimigos por segundo, tipos novos, mais vida e eventos de horda e chefes.
 */

export type IdInimigo =
  | 'chiado'
  | 'spam'
  | 'zumbido'
  | 'estatica'
  | 'alucinacao'
  | 'glitch'
  | 'trollBug'
  | 'chefe'
  | 'virus'
  | 'verme'
  | 'trojan'
  | 'loopInfinito'
  | 'vazamento'
  | 'ponteiroNulo'
  | 'pilha'
  | 'bloco'
  | 'ransomware';

export interface DefInimigo {
  id: IdInimigo;
  nome: string;
  vida: number;
  velocidade: number;
  dano: number;
  raio: number;
  /** Tamanho do cristal que deixa: 0 pequeno, 1 médio, 2 grande, 3 enorme. */
  cristal: 0 | 1 | 2 | 3;
  cor: string;
  /** A partir de quantos segundos aparece e peso no sorteio. */
  aparece: number;
  peso: number;
  /** Voz sintetizada (perfil de bipe/formante). */
  voz: string;
  grito: string[];
  comportamento:
    | 'perseguir'
    | 'enxame'
    | 'voador'
    | 'tanque'
    | 'atirador'
    | 'teleporte'
    | 'elite'
    | 'chefe'
    | 'replicar'
    | 'serpente'
    | 'disfarce'
    | 'orbitar'
    | 'vazar'
    | 'mirar'
    | 'pilha';
  altura: number;
  /** Aviso mostrado na primeira vez que aparece na partida. */
  descricao?: string;
}

export const INIMIGOS: Record<IdInimigo, DefInimigo> = {
  chiado: {
    id: 'chiado',
    nome: 'Chiado',
    vida: 9,
    velocidade: 2.6,
    dano: 6,
    raio: 0.45,
    cristal: 0,
    cor: '#7b6aa8',
    aparece: 0,
    peso: 10,
    voz: 'chiado',
    grito: ['shhh', 'krrr'],
    comportamento: 'perseguir',
    altura: 1,
  },
  spam: {
    id: 'spam',
    nome: 'Spam',
    vida: 3.5,
    velocidade: 3.9,
    dano: 4,
    raio: 0.3,
    cristal: 0,
    cor: '#ff6b8a',
    aparece: 25,
    peso: 6,
    voz: 'spam',
    grito: ['compre!', 'clique!'],
    comportamento: 'enxame',
    altura: 0.6,
  },
  zumbido: {
    id: 'zumbido',
    nome: 'Zumbido',
    vida: 7,
    velocidade: 4.4,
    dano: 6,
    raio: 0.4,
    cristal: 0,
    cor: '#4f9fb0',
    aparece: 50,
    peso: 6,
    voz: 'zumbido',
    grito: ['bzzz'],
    comportamento: 'voador',
    altura: 1.4,
  },
  estatica: {
    id: 'estatica',
    nome: 'Estática',
    vida: 55,
    velocidade: 1.8,
    dano: 15,
    raio: 0.85,
    cristal: 1,
    cor: '#4b3d6b',
    aparece: 100,
    peso: 3,
    voz: 'estatica',
    grito: ['GRRR'],
    comportamento: 'tanque',
    altura: 1.7,
  },
  alucinacao: {
    id: 'alucinacao',
    nome: 'Alucinação',
    vida: 16,
    velocidade: 2.3,
    dano: 7,
    raio: 0.5,
    cristal: 1,
    cor: '#ff9fd8',
    aparece: 140,
    peso: 3,
    voz: 'alucinacao',
    grito: ['isso é verdade!', 'confia em mim'],
    comportamento: 'atirador',
    altura: 1.3,
  },
  glitch: {
    id: 'glitch',
    nome: 'Glitch',
    vida: 22,
    velocidade: 3.1,
    dano: 10,
    raio: 0.5,
    cristal: 1,
    cor: '#5cffd0',
    aparece: 200,
    peso: 3,
    voz: 'glitch',
    grito: ['err', '404'],
    comportamento: 'teleporte',
    altura: 1.1,
  },
  trollBug: {
    id: 'trollBug',
    nome: 'Bug Gigante',
    vida: 260,
    velocidade: 2.3,
    dano: 22,
    raio: 1.3,
    cristal: 2,
    cor: '#c94b4b',
    aparece: 270,
    peso: 0.6,
    voz: 'trollbug',
    grito: ['CRASH'],
    comportamento: 'elite',
    altura: 2.4,
  },
  chefe: {
    id: 'chefe',
    nome: 'Grande Ruído',
    vida: 2200,
    velocidade: 2.2,
    dano: 30,
    raio: 2.1,
    cristal: 3,
    cor: '#2b1f45',
    aparece: 99999,
    peso: 0,
    voz: 'chefe',
    grito: ['EU SOU O RUÍDO!'],
    comportamento: 'chefe',
    altura: 4,
  },
  virus: {
    id: 'virus',
    nome: 'Vírus',
    vida: 11,
    velocidade: 2.8,
    dano: 7,
    raio: 0.42,
    cristal: 0,
    cor: '#39ff88',
    aparece: 40,
    peso: 5,
    voz: 'spam',
    grito: ['replicando', 'cópia!'],
    comportamento: 'replicar',
    altura: 1,
    descricao: 'Se copia sozinho de tempos em tempos. Mate rápido!',
  },
  verme: {
    id: 'verme',
    nome: 'Worm',
    vida: 18,
    velocidade: 4.3,
    dano: 8,
    raio: 0.42,
    cristal: 0,
    cor: '#ffb347',
    aparece: 80,
    peso: 3,
    voz: 'zumbido',
    grito: ['sssss'],
    comportamento: 'serpente',
    altura: 0.8,
    descricao: 'Rasteja em zigue-zague pela rede, rápido demais.',
  },
  trojan: {
    id: 'trojan',
    nome: 'Cavalo de Troia',
    vida: 45,
    velocidade: 0,
    dano: 6,
    raio: 0.75,
    cristal: 3,
    cor: '#ffd27a',
    aparece: 120,
    peso: 0.8,
    voz: 'estatica',
    grito: ['surpresa!'],
    comportamento: 'disfarce',
    altura: 1.2,
    descricao: 'Parece um presente... chegue perto e ele solta vírus. Destrua de longe!',
  },
  loopInfinito: {
    id: 'loopInfinito',
    nome: 'Loop Infinito',
    vida: 30,
    velocidade: 3.6,
    dano: 9,
    raio: 0.55,
    cristal: 1,
    cor: '#7ad7ff',
    aparece: 110,
    peso: 2,
    voz: 'glitch',
    grito: ['de novo', 'de novo', 'de novo'],
    comportamento: 'orbitar',
    altura: 1.1,
    descricao: 'Gira em volta de você, fechando o círculo.',
  },
  vazamento: {
    id: 'vazamento',
    nome: 'Vazamento de Memória',
    vida: 75,
    velocidade: 1.4,
    dano: 10,
    raio: 0.9,
    cristal: 1,
    cor: '#8a6bff',
    aparece: 160,
    peso: 2,
    voz: 'estatica',
    grito: ['glub'],
    comportamento: 'vazar',
    altura: 1.1,
    descricao: 'Deixa poças que deixam você lento — e cresce com o tempo.',
  },
  ponteiroNulo: {
    id: 'ponteiroNulo',
    nome: 'Ponteiro Nulo',
    vida: 22,
    velocidade: 2.4,
    dano: 14,
    raio: 0.45,
    cristal: 1,
    cor: '#ff5c5c',
    aparece: 230,
    peso: 2,
    voz: 'glitch',
    grito: ['null', 'NullPointerException'],
    comportamento: 'mirar',
    altura: 1.3,
    descricao: 'Marca um ponto no chão e se teleporta para lá. Saia da marca!',
  },
  pilha: {
    id: 'pilha',
    nome: 'Stack Overflow',
    vida: 95,
    velocidade: 1.6,
    dano: 16,
    raio: 0.9,
    cristal: 2,
    cor: '#ffa04d',
    aparece: 300,
    peso: 1.2,
    voz: 'trollbug',
    grito: ['estourou!'],
    comportamento: 'pilha',
    altura: 2.2,
    descricao: 'Ao cair, desmonta em blocos que continuam atacando.',
  },
  bloco: {
    id: 'bloco',
    nome: 'Bloco da Pilha',
    vida: 16,
    velocidade: 3.3,
    dano: 6,
    raio: 0.4,
    cristal: 0,
    cor: '#ffc27a',
    aparece: 99999,
    peso: 0,
    voz: 'spam',
    grito: ['push'],
    comportamento: 'perseguir',
    altura: 0.7,
  },
  ransomware: {
    id: 'ransomware',
    nome: 'Ransomware',
    vida: 3000,
    velocidade: 2,
    dano: 32,
    raio: 2,
    cristal: 3,
    cor: '#1f3b2a',
    aparece: 99999,
    peso: 0,
    voz: 'chefe',
    grito: ['PAGUE O RESGATE!'],
    comportamento: 'chefe',
    altura: 3.6,
  },
};

/** Inimigos por segundo no tempo t (s). */
export function taxaSurgimento(t: number): number {
  return 0.75 + t / 42 + Math.pow(t / 150, 2) * 2.4;
}

/** Multiplicador de vida no tempo t. */
export function multVida(t: number): number {
  return 1 + t / 160 + Math.pow(t / 360, 2);
}

export function multDano(t: number): number {
  return 1 + t / 360;
}

export const INTERVALO_CHEFE = 180;
export const INTERVALO_HORDA = 60;
export const MAX_INIMIGOS = 420;

export const VALOR_CRISTAL = [1, 4, 15, 60];
