/**
 * Estado de um jogador da partida. No modo solo existe um só; no multijogador local
 * (mesmo Wi-Fi) cada pessoa tem o seu, com personagem, build e vida próprios.
 */
import type { Humor } from '../../nucleo/tipos';
import { ModeloClaude } from '../../render/modelo-claude';
import type { DefHabilidade } from '../dados/habilidades';
import { personagem, type DefPersonagem, type IdPersonagem } from '../dados/personagens';
import {
  calcularAtributos,
  type Atributos,
  type EstadoBuild,
  type Oferta,
} from '../nucleo/progresso';

export const MAX_JOGADORES = 4;

/** Cores das etiquetas dos jogadores (J1..J4). */
export const CORES_JOGADOR = ['#ffd27a', '#7ad7ff', '#ff8ac0', '#9dff8a'];

export interface HabAtiva {
  def: DefHabilidade;
  /** Código único na partida: índice do jogador × nº de habilidades + índice da habilidade. */
  idx: number;
  nivel: number;
  timer: number;
  ativaAte: number;
  fase: number;
  danoTotal: number;
  disparos: number;
}

export class Jogador {
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  angulo = 0;
  dirX = 0;
  dirZ = 1;
  vida = 100;
  invencivel = 0;
  dash = 0;
  recargaDash = 0;
  dashX = 0;
  dashZ = 0;
  humor: Humor = 'neutro';
  humorT = 0;
  atributos: Atributos = calcularAtributos({}, { ativas: [], passivas: [] });
  build: EstadoBuild = { ativas: [], passivas: [] };
  habs: HabAtiva[] = [];
  ofertas: Oferta[] = [];
  rerrolagens = 2;
  ultimaFalaDano = 0;
  def: DefPersonagem;
  modelo: ModeloClaude;
  /** Caído: não age; um colega perto o levanta. */
  caido = false;
  /** Progresso do resgate (0..1). */
  resgate = 0;
  /** Já escolheu a carta deste nível (multijogador). */
  escolheu = true;
  /** Última posição recebida pela rede (jogadores remotos). */
  rede = { x: 0, z: 0, vx: 0, vz: 0, angulo: 0, dash: false, t: 0 };
  /** Pausa local do dono (o jogo continua para os outros). */
  ausente = false;

  constructor(
    readonly indice: number,
    public personagemId: IdPersonagem,
    /** Controlado por este aparelho. */
    readonly local: boolean
  ) {
    this.def = personagem(personagemId);
    this.modelo = new ModeloClaude(this.def.aparencia);
  }

  trocarPersonagem(id: IdPersonagem): void {
    this.personagemId = id;
    this.def = personagem(id);
    this.modelo = new ModeloClaude(this.def.aparencia);
  }
}
