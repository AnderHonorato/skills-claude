/**
 * Salvamento local versionado, com migrações e validação de posição.
 * Regras: nunca remova campos; ao mudar o formato, suba VERSAO_SALVAMENTO e escreva
 * uma migração. Posições inválidas (vão, dentro de parede, além da fronteira) são
 * corrigidas ao carregar: expandir o mundo nunca quebra um salvamento.
 */
import type { MundoFisico } from './fisica';
import type { Fronteira, IdArma, IdHabilidade, IdNpc, IdRegiao, Ponto } from './tipos';

export const VERSAO_SALVAMENTO = 2;
export const CHAVE_SALVAMENTO = 'centelha-das-ideias:salvamento';

export interface DadosSalvos {
  versao: 2;
  versaoConteudo: number;
  criadoEm: number;
  atualizadoEm: number;
  tempoJogo: number;
  posicao: { x: number; y: number; z: number };
  regiao: IdRegiao;
  checkpoint: string;
  vida: number;
  vidaMaxima: number;
  inspiracao: number;
  armas: Partial<Record<IdArma, { xp: number }>>;
  armaAtual: IdArma | null;
  habilidades: IdHabilidade[];
  flags: string[];
  contadores: Record<string, number>;
  afinidade: Record<IdNpc, number>;
  missoesAtivas: string[];
  missoesConcluidas: string[];
  /** Ids de objetos e inimigos removidos para sempre (faíscas, baús, inimigos de missão). */
  removidos: string[];
  configuracoes: {
    volumeGeral: number;
    volumeMusica: number;
    volumeEfeitos: number;
    tremor: boolean;
    qualidade: 'alta' | 'media' | 'baixa';
  };
}

type Bruto = Record<string, unknown>;

export function salvamentoVazio(agora = Date.now()): DadosSalvos {
  return {
    versao: 2,
    versaoConteudo: 2,
    criadoEm: agora,
    atualizadoEm: agora,
    tempoJogo: 0,
    posicao: { x: 0, y: 0, z: 3 },
    regiao: 'jardim',
    checkpoint: 'pedra-jardim',
    vida: 5,
    vidaMaxima: 5,
    inspiracao: 100,
    armas: {},
    armaAtual: null,
    habilidades: [],
    flags: [],
    contadores: {},
    afinidade: { lumi: 0, pipo: 0, bento: 0, eco: 0, vela: 0 },
    missoesAtivas: [],
    missoesConcluidas: [],
    removidos: [],
    configuracoes: {
      volumeGeral: 0.8,
      volumeMusica: 0.55,
      volumeEfeitos: 0.85,
      tremor: true,
      qualidade: 'alta',
    },
  };
}

/**
 * Migrações: a chave é a versão de origem. v1 era o protótipo 2D (posições em pixels
 * de um mapa de blocos que não existe mais): mantém o que tem significado no mundo novo
 * (vida, armas que existem, habilidades, configurações) e recomeça no Jardim.
 */
export const MIGRACOES: Record<number, (d: Bruto) => Bruto> = {
  1: (v1) => {
    const novo = salvamentoVazio(Number(v1.criadoEm) || Date.now()) as unknown as Bruto;
    const j = (v1.jogador ?? {}) as Bruto;
    const armasValidas: IdArma[] = ['galho', 'espada', 'martelo', 'colher', 'cajado', 'escudo'];
    const armas: Partial<Record<IdArma, { xp: number }>> = {};
    for (const a of Array.isArray(j.armas) ? j.armas : []) {
      const id =
        a === 'espadaMadeira'
          ? 'espada'
          : a === 'marteloBorracha'
            ? 'martelo'
            : a === 'colherGigante'
              ? 'colher'
              : a;
      if (armasValidas.includes(id as IdArma)) armas[id as IdArma] = { xp: 0 };
    }
    novo.armas = armas;
    novo.armaAtual = (Object.keys(armas)[0] as IdArma | undefined) ?? null;
    if (armas.galho) novo.flags = ['tem_galho'];
    const vm = Number(j.vidaMaxima);
    if (vm >= 3 && vm <= 10) novo.vidaMaxima = Math.round(vm);
    novo.vida = novo.vidaMaxima;
    const cfg = (v1.configuracoes ?? {}) as Bruto;
    const atual = novo.configuracoes as DadosSalvos['configuracoes'];
    novo.configuracoes = {
      ...atual,
      volumeGeral: typeof cfg.volumeGeral === 'number' ? cfg.volumeGeral : atual.volumeGeral,
      volumeMusica: typeof cfg.volumeMusica === 'number' ? cfg.volumeMusica : atual.volumeMusica,
      volumeEfeitos:
        typeof cfg.volumeEfeitos === 'number' ? cfg.volumeEfeitos : atual.volumeEfeitos,
    };
    const est = (v1.estatisticas ?? {}) as Bruto;
    novo.tempoJogo = Number(est.tempoAtivo) || 0;
    novo.versao = 2;
    return novo;
  },
};

/** Converte qualquer versão conhecida para a atual. null = irrecuperável. */
export function migrar(bruto: unknown): DadosSalvos | null {
  if (!bruto || typeof bruto !== 'object') return null;
  let d = bruto as Bruto;
  let v = Number(d.versao);
  if (!Number.isFinite(v) || v < 1 || v > VERSAO_SALVAMENTO) return null;
  while (v < VERSAO_SALVAMENTO) {
    const m = MIGRACOES[v];
    if (!m) return null;
    d = m(d);
    v = Number(d.versao);
  }
  // completa campos ausentes (salvamentos parciais ou de builds intermediárias)
  const base = salvamentoVazio();
  const completo = { ...base, ...d } as DadosSalvos;
  completo.configuracoes = { ...base.configuracoes, ...(completo.configuracoes ?? {}) };
  completo.afinidade = { ...base.afinidade, ...(completo.afinidade ?? {}) };
  if (
    !completo.posicao ||
    !Number.isFinite(completo.posicao.x) ||
    !Number.isFinite(completo.posicao.z)
  )
    completo.posicao = base.posicao;
  return completo;
}

/**
 * Garante uma posição jogável: se o ponto salvo está além da fronteira atual, sem chão
 * ou dentro de algo sólido, volta para o retorno da fronteira, o checkpoint ou o início.
 */
export function posicaoSegura(
  fisica: MundoFisico,
  fronteira: Fronteira,
  alem: (p: Ponto, f: Fronteira) => boolean,
  pos: { x: number; z: number },
  alternativas: Ponto[]
): { x: number; y: number; z: number; corrigida: boolean } {
  const ok = (p: Ponto) => !alem(p, fronteira) && fisica.pontoValido(p.x, p.z);
  const comY = (p: Ponto, corrigida: boolean) => ({
    x: p.x,
    y: Math.max(0, fisica.alturaChao(p.x, p.z, 50, 0)),
    z: p.z,
    corrigida,
  });
  if (ok(pos)) return comY(pos, false);
  const candidatos = alem(pos, fronteira) ? [fronteira.retorno, ...alternativas] : alternativas;
  for (const c of candidatos) if (ok(c)) return comY(c, true);
  // último recurso: procura em espiral em volta do primeiro candidato
  const centro = candidatos[0] ?? { x: 0, z: 0 };
  for (let r = 1; r < 20; r++) {
    for (let a = 0; a < 16; a++) {
      const p = {
        x: centro.x + Math.cos((a / 16) * Math.PI * 2) * r,
        z: centro.z + Math.sin((a / 16) * Math.PI * 2) * r,
      };
      if (ok(p)) return comY(p, true);
    }
  }
  return comY(centro, true);
}

export function lerSalvamento(
  armazenamento: Storage | null = obterArmazenamento()
): DadosSalvos | null {
  if (!armazenamento) return null;
  try {
    const texto = armazenamento.getItem(CHAVE_SALVAMENTO);
    if (!texto) return null;
    return migrar(JSON.parse(texto));
  } catch {
    return null;
  }
}

export function gravarSalvamento(
  d: DadosSalvos,
  armazenamento: Storage | null = obterArmazenamento()
): boolean {
  if (!armazenamento) return false;
  try {
    d.atualizadoEm = Date.now();
    armazenamento.setItem(CHAVE_SALVAMENTO, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function apagarSalvamento(armazenamento: Storage | null = obterArmazenamento()): void {
  try {
    armazenamento?.removeItem(CHAVE_SALVAMENTO);
  } catch {
    /* sem armazenamento */
  }
}

function obterArmazenamento(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
