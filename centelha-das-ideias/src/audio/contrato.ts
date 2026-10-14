/** Catálogo fixo de sons e músicas. Novos ids passam pelo orquestrador. */

export const SONS = [
  'passo',
  'passoAgua',
  'pulo',
  'aterrissagem',
  'esquiva',
  'ataqueEspada',
  'ataqueColher',
  'ataqueMartelo',
  'ataqueCajado',
  'acerto',
  'acertoForte',
  'bloqueado',
  'danoRecebido',
  'curar',
  'observar',
  'revelar',
  'conectarInicio',
  'conectarOk',
  'conectarFalha',
  'desconectar',
  'criarPonte',
  'criarEscudo',
  'criarAliado',
  'refletir',
  'energizar',
  'portaAbrir',
  'portaFechar',
  'placaPressionada',
  'caixaEmpurrar',
  'runaAtivar',
  'runaErro',
  'enigmaResolvido',
  'itemObtido',
  'coracaoObtido',
  'centelhaObtida',
  'faiscaObtida',
  'checkpoint',
  'falaNpc',
  'falaClaude',
  'uiConfirmar',
  'uiVoltar',
  'uiNavegar',
  'uiAbrir',
  'missaoNova',
  'missaoConcluida',
  'inimigoAlerta',
  'inimigoTelegrafo',
  'inimigoAtaque',
  'inimigoFerido',
  'inimigoDerrotado',
  'projetilEco',
  'escudoQuebrado',
  'atordoado',
  'cortarFio',
  'chefeRugido',
  'chefeOnda',
  'chefeFase',
  'chefeDerrotado',
  'quedaVao',
  'derrota',
  'fronteira',
  'gaiolaAberta',
  'paredeQuebrada',
  'espinhoCortado',
  'comemoracao',
  'restauracao',
  'alavanca',
  'bauAbrir',
] as const;

export type IdSom = (typeof SONS)[number];

export const MUSICAS = [
  'titulo',
  'jardim',
  'oficina',
  'vale',
  'farol',
  'chefe',
  'vitoria',
  'construcao',
] as const;

export type IdMusica = (typeof MUSICAS)[number];

export interface OpcoesSom {
  /** 0..1 (multiplica o volume de efeitos). */
  volume?: number;
  /** Multiplicador de frequência (1 = normal). Use pequenas variações. */
  tom?: number;
  /** Posição no mundo para panorâmica e atenuação por distância. */
  x?: number;
  y?: number;
  /** Nome do falante (para variar o timbre das falas). */
  voz?: string;
}

export interface ApiAudio {
  /** Deve ser chamado dentro de um gesto do usuário (toque/clique/tecla). */
  desbloquear(): void;
  tocar(som: IdSom, opcoes?: OpcoesSom): void;
  musica(id: IdMusica | null): void;
  /** 0 = exploração, 1 = combate intenso (camadas extras). */
  definirIntensidade(valor: number): void;
  definirVolume(canal: 'geral' | 'musica' | 'efeitos', valor: number): void;
  volume(canal: 'geral' | 'musica' | 'efeitos'): number;
  /** Pausa/retoma tudo (menu de pausa, aba oculta). */
  suspender(suspenso: boolean): void;
  /** Posição do ouvinte (câmera) para sons posicionais. */
  definirOuvinte(x: number, y: number): void;
}
