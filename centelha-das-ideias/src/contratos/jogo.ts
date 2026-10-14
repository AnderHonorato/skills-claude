/**
 * Interface central do jogo e das APIs entre módulos.
 *
 * Responsáveis (ver docs/contratos.md):
 *  - Núcleo (orquestrador): Jogo, Mundo, Entidades, Entrada, Camera, Particulas, Flags,
 *    Salvamento, Cenas, Jogador.
 *  - Combate e inimigos: ApiCombate.
 *  - Habilidades e enigmas: ApiHabilidades.
 *  - Narrativa e conteúdo: ApiDialogo, ApiMissoes.
 *  - Interface: ApiUi.
 *  - Áudio: ApiAudio (src/contratos/audio.ts).
 */
import type { CameraVisao, ConsultaMapa, Luz } from './arte';
import type { ApiAudio } from './audio';
import type {
  Acao,
  Condicao,
  Direcao8,
  EstadoAnimClaude,
  Humor,
  IdArma,
  IdHabilidade,
  IdItem,
  IdMelhoria,
  IdRegiao,
  Recompensa,
  Vetor,
} from './base';
import type {
  DefinicaoArma,
  DefinicaoMissao,
  DefinicaoMundo,
  DefinicaoNpc,
  DefinicaoRegiao,
  EspecEntidade,
} from './dados';
import type { Dano, Entidade } from './entidades';
import type { MapaEventos, NomeEvento } from './eventos';

// ----------------------------------------------------------------------------
// Entrada
// ----------------------------------------------------------------------------

export type Comando =
  | 'cima'
  | 'baixo'
  | 'esquerda'
  | 'direita'
  | 'correr'
  | 'pular'
  | 'esquivar'
  | 'atacar'
  | 'interagir'
  | 'observar'
  | 'conectar'
  | 'criar'
  | 'arma1'
  | 'arma2'
  | 'arma3'
  | 'arma4'
  | 'armaProxima'
  | 'curar'
  | 'mapa'
  | 'pausa'
  | 'avancar'
  | 'voltar';

export interface Entrada {
  /** Segurando agora. */
  segurando(c: Comando): boolean;
  /** Apertou neste passo de atualização. */
  apertou(c: Comando): boolean;
  soltou(c: Comando): boolean;
  /** Vetor de movimento (magnitude 0..1; joystick analógico no toque). */
  movimento(): Vetor;
  /** Correndo (Shift ou joystick no limite). */
  correndo(): boolean;
  /** Ponto do mundo sob o mouse (null no toque ou sem mouse). */
  mira(): Vetor | null;
  /** Direção de mira explícita do toque (arrastar botão de habilidade), normalizada. */
  miraToque(): Vetor | null;
  usandoToque(): boolean;
  // usado pelos controles de toque (src/ui):
  definirComandoVirtual(c: Comando, ativo: boolean): void;
  definirJoystick(x: number, y: number): void;
  definirMiraToque(direcao: Vetor | null): void;
  /** Consome um "apertou" para não disparar duas ações. */
  consumir(c: Comando): void;
}

// ----------------------------------------------------------------------------
// Mundo
// ----------------------------------------------------------------------------

export interface Mundo {
  definicao: DefinicaoMundo;
  consulta: ConsultaMapa;
  larguraPx: number;
  alturaPx: number;
  tamanhoBloco: number;
  regiaoPorId(id: IdRegiao): DefinicaoRegiao | undefined;
  regiaoEm(x: number, y: number): IdRegiao | null;
  /** Converte blocos locais da região para px do mundo (centro do bloco para inteiros). */
  localParaMundo(regiao: IdRegiao, x: number, y: number): Vetor;
  /** px do mundo -> bloco do mundo. */
  bloco(x: number, y: number): { tx: number; ty: number };
  codigoEm(tx: number, ty: number): string;
  /** Altura da superfície (0, 24 ou 48) no ponto em px. */
  alturaChaoEm(x: number, y: number): number;
  /** Pode existir apoio aqui (não é vão)? */
  temChao(x: number, y: number): boolean;
  /** Bloco andável para alguém na altura absoluta `alturaAbs` (chão + z). */
  passavel(tx: number, ty: number, alturaAbs: number): boolean;
  /** Linha de visão livre (paredes, árvores, fronteira e sólidos que bloqueiam visão). */
  linhaDeVisao(a: Vetor, b: Vetor): boolean;
  /** Altera um bloco em tempo de jogo. `permanente` grava no salvamento. */
  definirBloco(tx: number, ty: number, codigo: string, permanente?: boolean): void;
  /** Sobreposição temporária (ponte de luz, piso revelado). null remove. */
  sobrepor(tx: number, ty: number, codigo: string | null, dono: string): void;
  restaurada(regiao: IdRegiao): boolean;
  /** Retângulo da fronteira atual em px. */
  fronteiraPx(): { x: number; y: number; largura: number; altura: number };
  /** Ponto andável mais próximo (busca em espiral). */
  pontoSeguroProximo(x: number, y: number): Vetor;
  /**
   * Registra uma superfície extra (ex.: plataforma móvel sobre o vão). Retorna função de
   * remoção. O provedor devolve a altura da superfície em (x, y) ou null se não houver.
   */
  adicionarSuperficie(fn: (x: number, y: number) => number | null): () => void;
}

// ----------------------------------------------------------------------------
// Entidades
// ----------------------------------------------------------------------------

export interface GerenciadorEntidades {
  adicionar<T extends Entidade>(e: T): T;
  remover(e: Entidade | string): void;
  porId<T extends Entidade = Entidade>(id: string): T | undefined;
  todas(): readonly Entidade[];
  categoria(c: Entidade['categoria']): Entidade[];
  /** Entidades cujo centro está a até `raio` px de (x, y). */
  proximas(x: number, y: number, raio: number, filtro?: (e: Entidade) => boolean): Entidade[];
  /** Cria entidades a partir de especificações de dados (usa as fábricas registradas). */
  criar(espec: EspecEntidade, regiao: IdRegiao): Entidade[];
}

/** Fábrica de entidades registrada por um módulo para um tipo de especificação. */
export type FabricaEntidade = (
  espec: EspecEntidade,
  posicao: Vetor,
  regiao: IdRegiao,
  jogo: Jogo
) => Entidade | Entidade[] | null;

export type MapaFabricas = Partial<Record<EspecEntidade['tipo'], FabricaEntidade>>;

/**
 * Movimento com colisão no chão (blocos, alturas, sólidos). Use para TODA entidade que anda.
 * Retorna quanto efetivamente andou.
 */
export interface Fisica {
  mover(
    e: Entidade,
    dx: number,
    dy: number,
    opcoes?: { ignorarSolidos?: boolean; podeCairEmVao?: boolean; alturaAbs?: number }
  ): Vetor;
}

// ----------------------------------------------------------------------------
// Jogador
// ----------------------------------------------------------------------------

export interface Jogador extends Entidade {
  categoria: 'jogador';
  vz: number;
  direcao: Direcao8;
  /** Ângulo de mira/frente em radianos (0 = leste, PI/2 = sul). */
  angulo: number;
  vida: number;
  vidaMaxima: number;
  inspiracao: number;
  inspiracaoMaxima: number;
  armas: IdArma[];
  armaAtual: IdArma | null;
  habilidades: Set<IdHabilidade>;
  melhorias: Set<IdMelhoria>;
  itens: Partial<Record<IdItem, number>>;
  estado: EstadoAnimClaude;
  tempoEstado: number;
  humor: Humor;
  noChao: boolean;
  invulneravelPor: number;
  /** Bônus de determinação ativo (segundos restantes). */
  determinacaoPor: number;
  /** Ataque em andamento (preenchido pelo sistema de combate). */
  ataque: {
    arma: IdArma;
    t: number;
    duracao: number;
    combo: number;
    angulo: number;
    acertou: Set<string>;
  } | null;
  habilidadeEmUso: IdHabilidade | null;
  /** Força uma animação temporária (comemoração, interação, habilidade...). */
  animar(estado: EstadoAnimClaude, duracao: number): void;
  receberDano(dano: Dano, jogo: Jogo): boolean;
  curar(quantidade: number): void;
  /** Bloqueia o controle (cenas, diálogo, derrota). */
  controleBloqueado: boolean;
  /** Empurrão externo (px/s) aplicado com atrito. */
  empurrar(vx: number, vy: number): void;
  /** Recupera o último ponto seguro (após queda). */
  ultimoPontoSeguro: Vetor;
  /** Entidade com interação disponível agora (para o botão/aviso contextual). */
  alvoInteracao: Entidade | null;
  /** Mistura de humor para transições (0..1) e humor anterior. */
  humorAnterior: Humor;
  misturaHumor: number;
}

// ----------------------------------------------------------------------------
// Sistemas de módulos
// ----------------------------------------------------------------------------

export interface ApiCombate {
  atualizar(dt: number): void;
  /** Chamado quando o jogador aperta Atacar. Controla tempo, acerto e animação. */
  atacar(): void;
  /** Aplica dano a qualquer entidade atingível (usa receberDano). */
  causarDano(alvo: Entidade, dano: Dano): boolean;
  atordoar(alvo: Entidade, segundos: number): void;
  amarrar(a: Entidade, b: Entidade, segundos: number): void;
  definicaoArma(id: IdArma): DefinicaoArma;
  /** Algum inimigo perseguindo/atacando (intensidade da música). */
  intensidade(): number;
  /** Desenho no chão (telegrafias), chamado antes dos objetos ordenados. */
  desenharChao(ctx: CanvasRenderingContext2D): void;
  /** Desenho por cima dos objetos (projéteis brilhantes, arcos de golpe). */
  desenharSobre(ctx: CanvasRenderingContext2D): void;
  /** Fábricas de inimigos, chefe e projéteis. */
  fabricas: MapaFabricas;
}

export interface MiraHabilidade {
  /** Ponto alvo no mundo (mouse) ou null para mira automática. */
  ponto: Vetor | null;
  /** Direção explícita (toque arrastado) ou null. */
  direcao: Vetor | null;
}

export interface ConexaoAtiva {
  origem: string;
  destino: string;
  idade: number;
}

export interface ApiHabilidades {
  atualizar(dt: number): void;
  usar(h: IdHabilidade, mira: MiraHabilidade): void;
  /** Fração de recarga restante (0 = pronta). */
  recarga(h: IdHabilidade): number;
  disponivel(h: IdHabilidade): boolean;
  conexoes(): readonly ConexaoAtiva[];
  /** Desfaz uma conexão (usado pelo inimigo Cortador). */
  desfazerConexao(origem: string, destino: string): void;
  /** Nó selecionado aguardando o segundo toque de Conectar. */
  selecao(): string | null;
  /** Segundos restantes da revelação de Observar. */
  observacaoRestante(): number;
  revelado(id: string): boolean;
  energizado(id: string): boolean;
  /** Id da zona de enigma onde Claude está (ou null). */
  enigmaAtual(): string | null;
  reiniciarEnigma(id: string): void;
  /** Próxima dica do enigma atual (ou null). */
  dicaAtual(): string | null;
  /** Alvo que Conectar/Criar usaria agora (para destacar). */
  alvoSugerido(h: IdHabilidade): string | null;
  desenharChao(ctx: CanvasRenderingContext2D): void;
  desenharSobre(ctx: CanvasRenderingContext2D): void;
  /** Fábricas de mecanismos, baús, santuários, gatilhos e zonas de enigma. */
  fabricas: MapaFabricas;
}

export interface EstadoFala {
  /** Id da entidade que fala ('claude' = jogador). */
  quem: string;
  nome: string;
  cor: string;
  texto: string;
  /** Caracteres já revelados (efeito de digitação). */
  revelado: number;
  escolhas: string[] | null;
  escolhaDestacada: number;
}

export interface Latido {
  quem: string;
  texto: string;
  restante: number;
  cor: string;
}

export interface ApiDialogo {
  atualizar(dt: number): void;
  iniciar(dialogo: string, falante?: string): void;
  ativo(): boolean;
  fala(): EstadoFala | null;
  avancar(): void;
  escolher(indice: number): void;
  destacarEscolha(indice: number): void;
  pular(): void;
  /** Balão curto que não bloqueia o jogo. */
  latir(quem: string, texto: string, duracao?: number): void;
  latidos(): readonly Latido[];
  definicaoNpc(id: string): DefinicaoNpc | undefined;
  /** Fábricas de NPCs (com rotinas). */
  fabricas: MapaFabricas;
}

export interface EstadoMissao {
  definicao: DefinicaoMissao;
  /** Índice da etapa atual; -1 concluída. */
  etapa: number;
}

export interface ApiMissoes {
  atualizar(dt: number): void;
  ativas(): EstadoMissao[];
  concluidas(): EstadoMissao[];
  acompanhada(): string | null;
  acompanhar(id: string | null): void;
  /** Posição (px do mundo) do objetivo da missão, se houver marcador. */
  marcador(id: string): Vetor | null;
  /** Recarrega estados a partir do salvamento. */
  carregar(etapas: Record<string, number>): void;
  exportar(): Record<string, number>;
}

export interface ApiUi {
  atualizar(dt: number): void;
  /** Desenho em coordenadas de tela (balões, indicadores, avisos) após o mundo. */
  desenharTela(ctx: CanvasRenderingContext2D): void;
  mensagem(texto: string, estilo?: 'dica' | 'conquista' | 'aviso'): void;
  /** Tela de título com Novo jogo / Continuar. */
  mostrarTitulo(temSalvamento: boolean): void;
  mostrarDerrota(): void;
  alternarPausa(forcar?: boolean): void;
  alternarMapa(forcar?: boolean): void;
  /** Algum menu aberto que pausa o jogo. */
  menuAberto(): boolean;
}

export interface ApiCenas {
  executar(id: string): void;
  ativa(): boolean;
  pular(): void;
  atualizar(dt: number): void;
}

export interface Flags {
  obter(flag: string): boolean;
  definir(flag: string, valor?: boolean): void;
  avaliar(c: Condicao | undefined): boolean;
  todas(): Record<string, boolean>;
}

export interface Camera extends CameraVisao {
  seguir(x: number, y: number): void;
  tremer(intensidade: number, duracao: number): void;
  /** Foco temporário em um ponto (cenas). null volta ao jogador. */
  focar(ponto: Vetor | null, duracao?: number): void;
  mundoParaTela(x: number, y: number): Vetor;
  telaParaMundo(x: number, y: number): Vetor;
  /** Tamanho da tela em px CSS. */
  larguraTela: number;
  alturaTela: number;
}

export interface Particula {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  vida: number;
  vidaMaxima: number;
  tamanho: number;
  tamanhoFinal: number;
  cor: string;
  forma: 'circulo' | 'quadrado' | 'brilho' | 'anel' | 'risco' | 'losango';
  gravidade: number;
  atrito: number;
  aditiva: boolean;
  rotacao: number;
  giro: number;
}

export interface SistemaParticulas {
  emitir(p: Partial<Particula> & { x: number; y: number }): void;
  quantidade(): number;
}

export type EstadoJogo = 'titulo' | 'jogando' | 'pausado' | 'dialogo' | 'cena' | 'derrota';

export interface Jogo {
  tempo: number;
  estado: EstadoJogo;
  readonly jogador: Jogador;
  readonly mundo: Mundo;
  readonly entidades: GerenciadorEntidades;
  readonly fisica: Fisica;
  readonly entrada: Entrada;
  readonly camera: Camera;
  readonly particulas: SistemaParticulas;
  readonly flags: Flags;
  readonly luzes: Luz[];
  readonly combate: ApiCombate;
  readonly habilidades: ApiHabilidades;
  readonly dialogo: ApiDialogo;
  readonly missoes: ApiMissoes;
  readonly ui: ApiUi;
  readonly audio: ApiAudio;
  readonly cenas: ApiCenas;

  emitir<N extends NomeEvento>(nome: N, dados: MapaEventos[N]): void;
  ouvir<N extends NomeEvento>(nome: N, fn: (dados: MapaEventos[N]) => void): () => void;

  executarAcoes(acoes: Acao[] | undefined, origem?: string): void;
  darRecompensa(r: Recompensa, texto?: string): void;
  definirAtivo(alvo: string, ativo: boolean): void;
  /** Define humor de Claude com prioridade por duração. */
  definirHumor(h: Humor, duracao?: number): void;
  /** Salva agora (silencioso). */
  salvar(): void;
  /** Tocar Pedra-Memória: salva e define retorno. */
  registrarCheckpoint(id: string, x: number, y: number): void;
  /** Id da Pedra-Memória atual (ou null). */
  checkpointAtual(): string | null;
  /** Novo jogo / continuar / tentar de novo. */
  novoJogo(): void;
  continuar(): void;
  renascer(): void;
  /** Remove entidade e registra para não reaparecer. */
  removerPermanente(id: string): void;
  removidaPermanente(id: string): boolean;
  /** Estatísticas acumuladas (tempo ativo etc.). */
  estatisticas(): import('./salvamento').DadosSalvos['estatisticas'];
  configuracoes(): import('./salvamento').DadosSalvos['configuracoes'];
  aplicarConfiguracoes(c: Partial<import('./salvamento').DadosSalvos['configuracoes']>): void;
  /** Regiões já visitadas. */
  regioesDescobertas(): ReadonlySet<IdRegiao>;
  /** Claude está perto da fronteira em desenvolvimento (ver evento fronteiraProxima). */
  fronteiraProxima(): boolean;
  temSalvamento(): boolean;
  /** Volta à tela de título (salva antes). */
  mostrarTitulo(): void;
}
