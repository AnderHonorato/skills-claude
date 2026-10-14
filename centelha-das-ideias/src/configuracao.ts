/** Constantes globais de jogo. Valores de equilíbrio documentados em docs/design.md. */

export const BLOCO = 32;

/** Alturas de superfície (px). */
export const ALTURA_PLATAFORMA = 24;
export const ALTURA_PLATAFORMA_ALTA = 48;

export const JOGADOR = {
  raio: 7,
  velocidadeAndar: 90,
  velocidadeCorrer: 150,
  aceleracaoChao: 1100,
  aceleracaoAr: 520,
  impulsoPulo: 260,
  impulsoPuloBotas: 330,
  gravidade: 900,
  tempoCoiote: 0.1,
  tempoBufferPulo: 0.12,
  esquivaVelocidade: 270,
  esquivaDuracao: 0.22,
  esquivaInvulneravel: 0.26,
  esquivaRecarga: 0.6,
  invulneravelAposDano: 1.0,
  vidaInicial: 3,
  inspiracaoInicial: 3,
  recargaInspiracao: 12,
  passada: 22,
  /** Velocidade de queda (px/s) a partir da qual a aterrissagem é "pesada". */
  quedaPesada: 320,
};

/** Raio (px) em torno do jogador onde entidades são atualizadas. */
export const RAIO_ATIVIDADE = 960;

/** Taxa fixa de atualização da lógica. */
export const PASSO_FIXO = 1 / 60;

/** Câmera: blocos mínimos visíveis na vertical e horizontal. */
export const CAMERA = {
  blocosVerticais: 11.5,
  blocosHorizontais: 20,
  zoomMaximo: 3,
  suavizacao: 7,
  antecipacao: 26,
};

/** Tamanho dos pedaços de chão pré-desenhados (em blocos). */
export const BLOCOS_POR_PEDACO = 12;

export const CHAVE_SALVAMENTO = 'centelha-das-ideias:salvamento';
export const INTERVALO_AUTOSALVAR = 30;
