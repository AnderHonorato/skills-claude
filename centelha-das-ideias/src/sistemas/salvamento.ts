import { CHAVE_SALVAMENTO } from '../configuracao';
import type { DefinicaoMundo } from '../contratos/dados';
import { VERSAO_SALVAMENTO, type DadosSalvos } from '../contratos/salvamento';

/**
 * Salvamento local versionado.
 *
 * Regras:
 *  - Nunca apagar progresso: migrações só acrescentam/convertem campos.
 *  - Cada migração leva da versão N para N+1.
 *  - Após migrar, a posição é validada contra o mundo atual (ver validarPosicao no jogo).
 */
type Migracao = (dados: Record<string, unknown>) => Record<string, unknown>;

/** MIGRACOES[n] converte da versão n para n+1. */
export const MIGRACOES: Record<number, Migracao> = {
  // Exemplo para a próxima atualização:
  // 1: (d) => ({ ...d, versao: 2, novoCampo: valorPadrao }),
};

export function configuracoesPadrao(): DadosSalvos['configuracoes'] {
  return {
    volumeGeral: 0.8,
    volumeMusica: 0.6,
    volumeEfeitos: 0.8,
    tremorCamera: true,
    controlesToque: 'auto',
  };
}

export function estatisticasPadrao(): DadosSalvos['estatisticas'] {
  return {
    tempoAtivo: 0,
    tempoCenas: 0,
    derrotas: 0,
    quedas: 0,
    inimigosDerrotados: 0,
    segredos: 0,
  };
}

/** Garante todos os campos com padrões (tolerante a dados parciais ou antigos). */
export function completar(d: Partial<DadosSalvos>, mundo: DefinicaoMundo): DadosSalvos {
  const agora = Date.now();
  const j = (d.jogador ?? {}) as Partial<DadosSalvos['jogador']>;
  return {
    versao: VERSAO_SALVAMENTO,
    versaoConteudo: d.versaoConteudo ?? mundo.versaoConteudo,
    criadoEm: d.criadoEm ?? agora,
    atualizadoEm: d.atualizadoEm ?? agora,
    jogador: {
      x: j.x ?? 0,
      y: j.y ?? 0,
      regiao: j.regiao ?? mundo.regiaoInicial,
      vida: j.vida ?? 3,
      vidaMaxima: j.vidaMaxima ?? 3,
      inspiracao: j.inspiracao ?? 3,
      inspiracaoMaxima: j.inspiracaoMaxima ?? 3,
      armas: Array.isArray(j.armas) ? j.armas : [],
      armaAtual: j.armaAtual ?? null,
      habilidades: Array.isArray(j.habilidades) ? j.habilidades : [],
      melhorias: Array.isArray(j.melhorias) ? j.melhorias : [],
      itens: j.itens ?? {},
    },
    checkpoint: d.checkpoint ?? null,
    flags: d.flags ?? {},
    missoes: d.missoes ?? {},
    missaoAcompanhada: d.missaoAcompanhada ?? null,
    regioesDescobertas: d.regioesDescobertas ?? [],
    blocosAlterados: d.blocosAlterados ?? {},
    removidas: d.removidas ?? [],
    estatisticas: { ...estatisticasPadrao(), ...(d.estatisticas ?? {}) },
    configuracoes: { ...configuracoesPadrao(), ...(d.configuracoes ?? {}) },
  };
}

/** Aplica migrações sequenciais. Lança erro se a versão for mais nova que o jogo. */
export function migrar(bruto: Record<string, unknown>, mundo: DefinicaoMundo): DadosSalvos {
  let dados = { ...bruto };
  let versao = typeof dados.versao === 'number' ? dados.versao : 1;
  if (versao > VERSAO_SALVAMENTO) {
    throw new Error(
      `Salvamento da versão ${versao} é mais novo que o jogo (${VERSAO_SALVAMENTO}).`
    );
  }
  while (versao < VERSAO_SALVAMENTO) {
    const m = MIGRACOES[versao];
    if (!m) throw new Error(`Sem migração da versão ${versao}.`);
    dados = m(dados);
    versao = typeof dados.versao === 'number' ? dados.versao : versao + 1;
  }
  return completar(dados as Partial<DadosSalvos>, mundo);
}

function armazenamento(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function lerSalvamento(mundo: DefinicaoMundo): DadosSalvos | null {
  const s = armazenamento();
  if (!s) return null;
  try {
    const texto = s.getItem(CHAVE_SALVAMENTO);
    if (!texto) return null;
    return migrar(JSON.parse(texto) as Record<string, unknown>, mundo);
  } catch (erro) {
    console.error('[salvamento] não foi possível ler; guardando cópia de segurança', erro);
    try {
      const texto = s.getItem(CHAVE_SALVAMENTO);
      if (texto) s.setItem(`${CHAVE_SALVAMENTO}:backup:${Date.now()}`, texto);
    } catch {
      /* ignora */
    }
    return null;
  }
}

export function gravarSalvamento(dados: DadosSalvos): boolean {
  const s = armazenamento();
  if (!s) return false;
  try {
    dados.atualizadoEm = Date.now();
    s.setItem(CHAVE_SALVAMENTO, JSON.stringify(dados));
    return true;
  } catch (erro) {
    console.error('[salvamento] falha ao gravar', erro);
    return false;
  }
}

export function existeSalvamento(): boolean {
  try {
    return !!armazenamento()?.getItem(CHAVE_SALVAMENTO);
  } catch {
    return false;
  }
}

export function apagarSalvamento(): void {
  try {
    armazenamento()?.removeItem(CHAVE_SALVAMENTO);
  } catch {
    /* ignora */
  }
}
