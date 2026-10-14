/**
 * Eventos do barramento global (src/motor/eventos.ts).
 * Qualquer módulo pode emitir e ouvir. Mantenha cargas pequenas e serializáveis.
 */
import type { Humor, IdHabilidade, IdRegiao, Recompensa } from './base';

export interface MapaEventos {
  flag: { flag: string; valor: boolean };

  jogadorFerido: { dano: number; vida: number };
  jogadorCurado: { quantidade: number };
  jogadorDerrotado: Record<string, never>;
  jogadorRenasceu: Record<string, never>;
  jogadorQueda: Record<string, never>;
  jogadorPulou: Record<string, never>;
  jogadorAterrissou: { velocidadeQueda: number };
  jogadorEsquivou: Record<string, never>;

  ataqueRealizado: { arma: string; acertou: boolean };
  golpeBloqueado: { x: number; y: number };
  inimigoAlerta: { id: string; especie: string };
  inimigoDerrotado: { id: string; especie: string; x: number; y: number; grupo?: string };
  grupoDerrotado: { grupo: string };

  enigmaResolvido: { id: string };
  enigmaFalhou: { id: string; motivo?: string };
  enigmaReiniciado: { id: string };
  zonaEnigma: { id: string | null };

  conexaoCriada: { origem: string; destino: string };
  conexaoDesfeita: { origem: string; destino: string };
  conexaoFalhou: { motivo: string };
  habilidadeUsada: { habilidade: IdHabilidade };
  habilidadeDesbloqueada: { habilidade: IdHabilidade };
  revelado: { id: string; tipo: string };

  itemObtido: { recompensa: Recompensa; texto: string };
  missaoIniciada: { id: string };
  missaoAtualizada: { id: string; etapa: number };
  missaoConcluida: { id: string };
  ajudouNpc: { npc: string };

  regiaoEntrou: { regiao: IdRegiao; primeiraVez: boolean };
  regiaoRestaurada: { regiao: IdRegiao };
  checkpoint: { id: string };
  salvo: Record<string, never>;

  dialogoIniciado: { id: string };
  dialogoTerminado: { id: string };
  cenaIniciada: { id: string };
  cenaTerminada: { id: string };

  chefeApareceu: Record<string, never>;
  chefeFase: { fase: number };
  chefeDerrotado: Record<string, never>;

  fronteiraProxima: { perto: boolean };
  humorMudou: { humor: Humor };
  comemoracao: Record<string, never>;
}

export type NomeEvento = keyof MapaEventos;
