/**
 * Efeitos de partículas prontos (RESPONSÁVEL: agente de Arte de Cenário/Efeitos).
 * Todos os módulos disparam efeitos por nome: efeito(jogo.particulas, 'poeiraPasso', x, y).
 * Versão provisória do orquestrador. Lista de nomes é contrato.
 */
import type { SistemaParticulas } from '../contratos/jogo';
import { PALETA } from './paleta';

export type NomeEfeito =
  | 'poeiraPasso'
  | 'poeiraAterrissagem'
  | 'respingo'
  | 'faiscaAcerto'
  | 'faiscaForte'
  | 'faiscaBloqueio'
  | 'centelha'
  | 'revelacao'
  | 'energia'
  | 'fumacaRuido'
  | 'brilhoItem'
  | 'confete'
  | 'folhas'
  | 'quebra'
  | 'cura'
  | 'derrotaInimigo'
  | 'ondaChao'
  | 'rastroEsquiva'
  | 'luzCriada'
  | 'estatica';

export interface OpcoesEfeito {
  /** Altura inicial (px). */
  z?: number;
  /** Direção principal (rad). */
  angulo?: number;
  /** Multiplicador de quantidade/intensidade. */
  intensidade?: number;
  cor?: string;
}

export function efeito(
  particulas: SistemaParticulas,
  nome: NomeEfeito,
  x: number,
  y: number,
  opcoes: OpcoesEfeito = {}
): void {
  const n = Math.round(6 * (opcoes.intensidade ?? 1));
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = 20 + Math.random() * 40;
    particulas.emitir({
      x,
      y,
      z: opcoes.z ?? 2,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v * 0.5,
      vz: 20 + Math.random() * 30,
      gravidade: 120,
      vida: 0.4 + Math.random() * 0.3,
      tamanho: 2.5,
      tamanhoFinal: 0.5,
      cor: opcoes.cor ?? (nome.startsWith('faisca') ? PALETA.luz : PALETA.areia),
      aditiva: nome === 'centelha' || nome === 'energia' || nome === 'luzCriada',
    });
  }
}
