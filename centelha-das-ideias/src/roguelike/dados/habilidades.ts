/**
 * Habilidades do roguelike. Ativas disparam sozinhas, cada uma com recarga e
 * velocidade próprias (rotativas, direcionais, de área, aleatórias...). Todas sobem
 * até o nível 10; nos níveis 5 e 10 elas EVOLUEM (efeito visual e mecânico extra).
 */

export type Elemento =
  | 'fogo'
  | 'gelo'
  | 'raio'
  | 'luz'
  | 'vento'
  | 'terra'
  | 'veneno'
  | 'arcano'
  | 'gravidade'
  | 'som'
  | 'agua'
  | 'cristal'
  | 'codigo';

export type Comportamento =
  | 'orbita'
  | 'projetil'
  | 'cadeia'
  | 'nova'
  | 'chicote'
  | 'aura'
  | 'chuva'
  | 'zona'
  | 'laser'
  | 'ricochete'
  | 'bumerangue'
  | 'poca'
  | 'drone'
  | 'muro'
  | 'coletor'
  | 'breakpoint';

export interface Valores {
  /** Dano por acerto. */
  dano: number;
  /** Segundos entre ativações. */
  recarga: number;
  /** Velocidade (m/s para projéteis, rad/s para órbitas). */
  velocidade: number;
  /** Raio/tamanho em metros. */
  area: number;
  /** Quantos projéteis/objetos por ativação. */
  quantidade: number;
  /** Quanto tempo dura (s). */
  duracao: number;
  /** Quantos inimigos atravessa (projéteis). */
  perfura: number;
  /** Alcance de busca de alvos (m). */
  alcance: number;
}

export interface DefHabilidade {
  id: string;
  nome: string;
  descricao: string;
  elemento: Elemento;
  comportamento: Comportamento;
  /** Ícone (glifo) e cores do efeito. */
  icone: string;
  cor: string;
  cor2: string;
  base: Valores;
  /** Níveis em que ganha +1 de quantidade. */
  maisQuantidade: number[];
  /** Texto das evoluções nos níveis 5 e 10. */
  evolucao5: string;
  evolucao10: string;
}

export const ELEMENTOS: Record<Elemento, { nome: string; cor: string; efeito: string }> = {
  fogo: { nome: 'Fogo', cor: '#ff7a3d', efeito: 'Queima: dano contínuo' },
  gelo: { nome: 'Gelo', cor: '#8fe3ff', efeito: 'Lentidão; congela na evolução' },
  raio: { nome: 'Raio', cor: '#ffe45c', efeito: 'Atordoa por um instante' },
  luz: { nome: 'Luz', cor: '#fff3c4', efeito: 'Golpes críticos mais frequentes' },
  vento: { nome: 'Vento', cor: '#b8ffe0', efeito: 'Empurra os inimigos' },
  terra: { nome: 'Terra', cor: '#c99a5b', efeito: 'Lança para o alto e atordoa' },
  veneno: { nome: 'Veneno', cor: '#9dff5c', efeito: 'Envenena e acumula' },
  arcano: { nome: 'Arcano', cor: '#c58bff', efeito: 'Persegue alvos' },
  gravidade: { nome: 'Gravidade', cor: '#8a6bff', efeito: 'Puxa inimigos' },
  som: { nome: 'Som', cor: '#ff9fd8', efeito: 'Empurrão forte' },
  agua: { nome: 'Água', cor: '#5cb8ff', efeito: 'Empurra e deixa lento' },
  cristal: { nome: 'Cristal', cor: '#d6f4ff', efeito: 'Protege e fragmenta' },
  codigo: { nome: 'Código', cor: '#39ff88', efeito: 'Trava: atordoa e corrompe' },
};

const v = (p: Partial<Valores>): Valores => ({
  dano: 10,
  recarga: 2,
  velocidade: 10,
  area: 1,
  quantidade: 1,
  duracao: 1,
  perfura: 1,
  alcance: 12,
  ...p,
});

export const HABILIDADES: DefHabilidade[] = [
  {
    id: 'centelhaOrbital',
    nome: 'Centelha Orbital',
    descricao: 'Faíscas de ideia giram em volta de você, queimando quem encosta.',
    elemento: 'luz',
    comportamento: 'orbita',
    icone: '✦',
    cor: '#ffd27a',
    cor2: '#fff3c4',
    base: v({ dano: 9, recarga: 3, velocidade: 3.2, area: 2.2, quantidade: 2, duracao: 3.2 }),
    maisQuantidade: [2, 4, 7, 9],
    evolucao5: 'Órbita dupla: um segundo anel gira ao contrário',
    evolucao10: 'Sol Particular: órbita permanente que nunca apaga',
  },
  {
    id: 'raioCadeia',
    nome: 'Raio em Cadeia',
    descricao: 'Um relâmpago atinge o inimigo mais próximo e salta para os vizinhos.',
    elemento: 'raio',
    comportamento: 'cadeia',
    icone: 'ϟ',
    cor: '#ffe45c',
    cor2: '#ffffff',
    base: v({ dano: 13, recarga: 1.6, area: 4.5, quantidade: 3, alcance: 11 }),
    maisQuantidade: [2, 3, 5, 6, 8, 9],
    evolucao5: 'Tempestade: dispara duas cadeias de uma vez',
    evolucao10: 'Sobrecarga: cada salto explode em faíscas',
  },
  {
    id: 'bolaFogo',
    nome: 'Bola de Fogo',
    descricao: 'Lança bolas de fogo no inimigo mais próximo, que explodem e incendeiam.',
    elemento: 'fogo',
    comportamento: 'projetil',
    icone: '🔥',
    cor: '#ff7a3d',
    cor2: '#ffd27a',
    base: v({
      dano: 18,
      recarga: 1.5,
      velocidade: 12,
      area: 1.8,
      quantidade: 1,
      perfura: 1,
      alcance: 14,
    }),
    maisQuantidade: [3, 6, 9],
    evolucao5: 'Fogo Persistente: explosões deixam chão em chamas',
    evolucao10: 'Fênix: bolas de fogo enormes que atravessam tudo',
  },
  {
    id: 'lancaGelo',
    nome: 'Lança de Gelo',
    descricao: 'Lança perfurante na direção em que você anda. Deixa os inimigos lentos.',
    elemento: 'gelo',
    comportamento: 'projetil',
    icone: '❄',
    cor: '#8fe3ff',
    cor2: '#ffffff',
    base: v({
      dano: 14,
      recarga: 1.2,
      velocidade: 18,
      area: 0.6,
      quantidade: 1,
      perfura: 4,
      alcance: 16,
    }),
    maisQuantidade: [2, 4, 6, 8, 10],
    evolucao5: 'Congelamento: acertos congelam por 1 segundo',
    evolucao10: 'Leque Glacial: lanças em leque que se partem em estilhaços',
  },
  {
    id: 'novaGlacial',
    nome: 'Nova Glacial',
    descricao: 'Anel de gelo que se expande a partir de você e deixa tudo lento.',
    elemento: 'gelo',
    comportamento: 'nova',
    icone: '✺',
    cor: '#bdf2ff',
    cor2: '#5cc8ff',
    base: v({ dano: 12, recarga: 4.5, velocidade: 12, area: 6, quantidade: 1 }),
    maisQuantidade: [7],
    evolucao5: 'Inverno: a nova congela todo mundo que toca',
    evolucao10: 'Era do Gelo: três ondas seguidas',
  },
  {
    id: 'chuvaMeteoros',
    nome: 'Chuva de Meteoros',
    descricao: 'Meteoros caem sobre grupos de inimigos. A sombra avisa onde vão cair.',
    elemento: 'fogo',
    comportamento: 'chuva',
    icone: '☄',
    cor: '#ff5a2b',
    cor2: '#ffd27a',
    base: v({ dano: 30, recarga: 4, area: 2.4, quantidade: 2, duracao: 0.6, alcance: 13 }),
    maisQuantidade: [2, 4, 6, 8, 10],
    evolucao5: 'Crateras: impactos deixam brasas',
    evolucao10: 'Armagedom: meteoros gigantes em dobro',
  },
  {
    id: 'laminaVento',
    nome: 'Lâmina de Vento',
    descricao: 'Bumerangue de vento: vai até o inimigo e volta cortando de novo.',
    elemento: 'vento',
    comportamento: 'bumerangue',
    icone: '➰',
    cor: '#b8ffe0',
    cor2: '#ffffff',
    base: v({
      dano: 12,
      recarga: 1.8,
      velocidade: 14,
      area: 0.9,
      quantidade: 1,
      perfura: 99,
      alcance: 9,
    }),
    maisQuantidade: [3, 5, 7, 9],
    evolucao5: 'Ciclone: as lâminas giram em volta enquanto voltam',
    evolucao10: 'Furacão: lâminas gigantes que empurram tudo',
  },
  {
    id: 'chicoteLuz',
    nome: 'Chicote de Luz',
    descricao: 'Corte horizontal na frente (e atrás, ao evoluir). Rápido e preciso.',
    elemento: 'luz',
    comportamento: 'chicote',
    icone: '〰',
    cor: '#fff3c4',
    cor2: '#ffd27a',
    base: v({ dano: 16, recarga: 1.1, area: 3.4, quantidade: 1 }),
    maisQuantidade: [3, 6],
    evolucao5: 'Duplo: corta para frente e para trás',
    evolucao10: 'Aurora: cortes em cruz que brilham',
  },
  {
    id: 'auraSagrada',
    nome: 'Aura Serena',
    descricao: 'Campo calmo em volta de você que fere o ruído continuamente.',
    elemento: 'luz',
    comportamento: 'aura',
    icone: '◎',
    cor: '#fff3c4',
    cor2: '#ffb8f0',
    base: v({ dano: 4, recarga: 0.45, area: 2.6 }),
    maisQuantidade: [],
    evolucao5: 'Calmaria: inimigos dentro ficam lentos',
    evolucao10: 'Santuário: a aura também cura você',
  },
  {
    id: 'tornado',
    nome: 'Tornado',
    descricao: 'Tornados que vagueiam, puxando e girando inimigos.',
    elemento: 'vento',
    comportamento: 'zona',
    icone: '🌪',
    cor: '#d8fff0',
    cor2: '#8af0c8',
    base: v({ dano: 6, recarga: 6, velocidade: 3, area: 1.8, quantidade: 1, duracao: 4 }),
    maisQuantidade: [3, 6, 9],
    evolucao5: 'Vendaval: tornados maiores e mais rápidos',
    evolucao10: 'Olho da Tempestade: tornados seguem você',
  },
  {
    id: 'misseis',
    nome: 'Mísseis de Ideia',
    descricao: 'Orbes arcanos que perseguem os inimigos sozinhos.',
    elemento: 'arcano',
    comportamento: 'projetil',
    icone: '✸',
    cor: '#c58bff',
    cor2: '#ffffff',
    base: v({
      dano: 9,
      recarga: 1.3,
      velocidade: 10,
      area: 0.5,
      quantidade: 2,
      perfura: 1,
      alcance: 16,
    }),
    maisQuantidade: [2, 4, 6, 8, 10],
    evolucao5: 'Enxame: mísseis se dividem ao acertar',
    evolucao10: 'Constelação: chuva de mísseis em espiral',
  },
  {
    id: 'espinhosTerra',
    nome: 'Espinhos de Terra',
    descricao: 'Espinhos rompem o chão debaixo dos inimigos e os lançam para cima.',
    elemento: 'terra',
    comportamento: 'chuva',
    icone: '⛰',
    cor: '#c99a5b',
    cor2: '#ffe0a8',
    base: v({ dano: 20, recarga: 2.8, area: 1.6, quantidade: 3, duracao: 0.35, alcance: 10 }),
    maisQuantidade: [2, 4, 6, 8],
    evolucao5: 'Fissura: espinhos em linha',
    evolucao10: 'Terremoto: o chão inteiro treme ao redor',
  },
  {
    id: 'laserGiratorio',
    nome: 'Feixe Giratório',
    descricao: 'Um laser que gira em volta de você, varrendo tudo.',
    elemento: 'luz',
    comportamento: 'laser',
    icone: '✷',
    cor: '#ff5cf0',
    cor2: '#ffffff',
    base: v({ dano: 6, recarga: 5, velocidade: 2.6, area: 7, quantidade: 1, duracao: 2.5 }),
    maisQuantidade: [4, 8],
    evolucao5: 'Prisma: feixes coloridos e mais grossos',
    evolucao10: 'Supernova: feixes que não param de girar',
  },
  {
    id: 'discoDados',
    nome: 'Disco de Dados',
    descricao: 'Discos que ricocheteiam pelas bordas da tela, acertando tudo no caminho.',
    elemento: 'cristal',
    comportamento: 'ricochete',
    icone: '◉',
    cor: '#d6f4ff',
    cor2: '#5cc8ff',
    base: v({
      dano: 10,
      recarga: 4,
      velocidade: 13,
      area: 0.7,
      quantidade: 1,
      duracao: 4,
      perfura: 99,
    }),
    maisQuantidade: [2, 4, 6, 8, 10],
    evolucao5: 'Disco Duro: discos maiores e mais pesados',
    evolucao10: 'Nuvem: discos que nunca somem',
  },
  {
    id: 'nuvemToxica',
    nome: 'Nuvem Tóxica',
    descricao: 'Poças de veneno caem perto dos inimigos e corroem quem passa.',
    elemento: 'veneno',
    comportamento: 'poca',
    icone: '☣',
    cor: '#9dff5c',
    cor2: '#3fbf3f',
    base: v({ dano: 5, recarga: 3.5, area: 2, quantidade: 1, duracao: 3, alcance: 9 }),
    maisQuantidade: [3, 5, 7, 9],
    evolucao5: 'Pântano: poças maiores que deixam lento',
    evolucao10: 'Praga: veneno se espalha de inimigo em inimigo',
  },
  {
    id: 'relampagoCeleste',
    nome: 'Relâmpago Celeste',
    descricao: 'Raios caem do céu em inimigos aleatórios.',
    elemento: 'raio',
    comportamento: 'chuva',
    icone: '⚡',
    cor: '#9fd8ff',
    cor2: '#ffffff',
    base: v({ dano: 22, recarga: 2.2, area: 1.2, quantidade: 2, duracao: 0.12, alcance: 15 }),
    maisQuantidade: [2, 3, 5, 7, 9],
    evolucao5: 'Trovão: raios atordoam em área',
    evolucao10: 'Fúria dos Céus: raios em sequência infinita',
  },
  {
    id: 'escudoCristal',
    nome: 'Escudo de Cristal',
    descricao: 'Fragmentos de cristal orbitam perto, empurrando inimigos e bloqueando tiros.',
    elemento: 'cristal',
    comportamento: 'orbita',
    icone: '◇',
    cor: '#d6f4ff',
    cor2: '#9df0ff',
    base: v({ dano: 7, recarga: 2.5, velocidade: -4.5, area: 1.35, quantidade: 3, duracao: 3.5 }),
    maisQuantidade: [3, 5, 7, 9],
    evolucao5: 'Refletor: tiros bloqueados voltam no inimigo',
    evolucao10: 'Fortaleza: escudo permanente',
  },
  {
    id: 'buracoNegro',
    nome: 'Buraco Negro',
    descricao: 'Uma singularidade nasce no maior grupo de inimigos e os esmaga.',
    elemento: 'gravidade',
    comportamento: 'zona',
    icone: '●',
    cor: '#8a6bff',
    cor2: '#1a0f3a',
    base: v({
      dano: 8,
      recarga: 9,
      velocidade: 0,
      area: 3,
      quantidade: 1,
      duracao: 3.5,
      alcance: 14,
    }),
    maisQuantidade: [6],
    evolucao5: 'Horizonte de Eventos: puxa de muito mais longe',
    evolucao10: 'Big Bang: explode no fim, ferindo tudo',
  },
  {
    id: 'serraCircular',
    nome: 'Serras Circulares',
    descricao: 'Serras grandes giram longe de você, abrindo caminho na horda.',
    elemento: 'cristal',
    comportamento: 'orbita',
    icone: '⚙',
    cor: '#c7ced6',
    cor2: '#ffffff',
    base: v({ dano: 14, recarga: 4, velocidade: 2.2, area: 4.2, quantidade: 1, duracao: 4 }),
    maisQuantidade: [3, 6, 9],
    evolucao5: 'Lâminas Duplas: serras maiores',
    evolucao10: 'Moinho: serras permanentes',
  },
  {
    id: 'pulsoSonico',
    nome: 'Pulso Sônico',
    descricao: 'Onda de som em cone na direção do movimento, empurrando com força.',
    elemento: 'som',
    comportamento: 'nova',
    icone: '))',
    cor: '#ff9fd8',
    cor2: '#ffffff',
    base: v({ dano: 9, recarga: 2.4, velocidade: 16, area: 7, quantidade: 1 }),
    maisQuantidade: [5, 9],
    evolucao5: 'Eco: o pulso volta e acerta de novo',
    evolucao10: 'Grave Total: pulso em 360°',
  },
  {
    id: 'droneDados',
    nome: 'Drone Assistente',
    descricao: 'Um pequeno drone acompanha você e atira no inimigo mais próximo.',
    elemento: 'arcano',
    comportamento: 'drone',
    icone: '⌖',
    cor: '#9df0ff',
    cor2: '#ffffff',
    base: v({
      dano: 7,
      recarga: 0.7,
      velocidade: 16,
      area: 0.35,
      quantidade: 1,
      perfura: 1,
      alcance: 12,
    }),
    maisQuantidade: [4, 7, 10],
    evolucao5: 'Rajada: o drone dispara três tiros',
    evolucao10: 'Esquadrilha: drones com tiros perfurantes',
  },
  {
    id: 'estrelasGemeas',
    nome: 'Estrelas Gêmeas',
    descricao: 'Duas estrelas giram em você e disparam raios estelares sozinhas.',
    elemento: 'arcano',
    comportamento: 'drone',
    icone: '✧',
    cor: '#9ad0ff',
    cor2: '#e2c9ff',
    base: v({
      dano: 8,
      recarga: 1,
      velocidade: 18,
      area: 0.4,
      quantidade: 2,
      perfura: 2,
      alcance: 13,
    }),
    maisQuantidade: [5, 10],
    evolucao5: 'Binárias: tiros em dobro',
    evolucao10: 'Galáxia: estrelas disparam em espiral',
  },
  {
    id: 'cuspeToxico',
    nome: 'Cuspida Venenosa',
    descricao: 'Cuspe em arco que cai em poças venenosas.',
    elemento: 'veneno',
    comportamento: 'projetil',
    icone: '💧',
    cor: '#bfff8a',
    cor2: '#5cbf3f',
    base: v({
      dano: 12,
      recarga: 1.6,
      velocidade: 9,
      area: 1.6,
      quantidade: 1,
      perfura: 1,
      alcance: 11,
    }),
    maisQuantidade: [3, 6, 9],
    evolucao5: 'Ácido: poças corroem armaduras (dano dobrado)',
    evolucao10: 'Chuva Ácida: cuspes em leque',
  },
  {
    id: 'ondaProfunda',
    nome: 'Onda Profunda',
    descricao: 'Uma onda de água em leque empurra e deixa lentos os inimigos.',
    elemento: 'agua',
    comportamento: 'nova',
    icone: '≋',
    cor: '#5cb8ff',
    cor2: '#d6f4ff',
    base: v({ dano: 11, recarga: 2.6, velocidade: 11, area: 7.5, quantidade: 1 }),
    maisQuantidade: [6],
    evolucao5: 'Maré: ondas em volta de você',
    evolucao10: 'Tsunami: onda gigante que esmaga',
  },
  {
    id: 'firewall',
    nome: 'Firewall',
    descricao: 'Um anel de fogo em volta de você: inimigos de fora não passam e queimam.',
    elemento: 'fogo',
    comportamento: 'muro',
    icone: '▦',
    cor: '#ff6a2b',
    cor2: '#ffd27a',
    base: v({ dano: 8, recarga: 8.5, velocidade: 0, area: 3.6, quantidade: 1, duracao: 3 }),
    maisQuantidade: [10],
    evolucao5: 'Firewall dinâmico: o anel anda com você',
    evolucao10: 'Defesa em camadas: dois anéis de fogo',
  },
  {
    id: 'coletorLixo',
    nome: 'Coletor de Lixo',
    descricao: 'Um pulso que puxa os inimigos e apaga de vez quem está quase sem vida.',
    elemento: 'codigo',
    comportamento: 'coletor',
    icone: '♻',
    cor: '#39ff88',
    cor2: '#c8ffd9',
    base: v({ dano: 6, recarga: 5, velocidade: 0, area: 5.5, quantidade: 1 }),
    maisQuantidade: [],
    evolucao5: 'Coleta geral: também puxa os cristais da área',
    evolucao10: 'Coleta agressiva: apaga inimigos com até 25% de vida',
  },
  {
    id: 'breakpoint',
    nome: 'Breakpoint',
    descricao: 'Marca o maior grupo de inimigos e pausa a execução deles: ficam congelados.',
    elemento: 'codigo',
    comportamento: 'breakpoint',
    icone: '⏸',
    cor: '#ff4d6d',
    cor2: '#9fe8ff',
    base: v({
      dano: 14,
      recarga: 6.5,
      velocidade: 0,
      area: 3.4,
      quantidade: 1,
      duracao: 2.2,
      alcance: 14,
    }),
    maisQuantidade: [7],
    evolucao5: 'Inspeção: os pausados levam dano extra',
    evolucao10: 'Depuração total: três breakpoints de uma vez',
  },
  {
    id: 'recursao',
    nome: 'Recursão',
    descricao: 'Um bloco de código que, ao acertar, se divide em dois... que se dividem de novo.',
    elemento: 'codigo',
    comportamento: 'projetil',
    icone: 'ƒ',
    cor: '#39ff88',
    cor2: '#eaffd0',
    base: v({ dano: 11, recarga: 1.7, velocidade: 13, area: 0.5, quantidade: 1, alcance: 14 }),
    maisQuantidade: [6],
    evolucao5: 'Recursão profunda: um nível a mais de divisões',
    evolucao10: 'Estouro de pilha: divide em três a cada nível',
  },
];
export interface DefPassiva {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  atributo: keyof import('../nucleo/progresso').Atributos;
  /** Valor por nível. */
  porNivel: number;
  modo: 'soma' | 'mult';
  formato: 'porcento' | 'numero' | 'metros';
}

export const PASSIVAS: DefPassiva[] = [
  {
    id: 'vigor',
    nome: 'Vigor',
    descricao: 'Vida máxima',
    icone: '♥',
    atributo: 'vidaMaxima',
    porNivel: 12,
    modo: 'soma',
    formato: 'numero',
  },
  {
    id: 'regeneracao',
    nome: 'Regeneração',
    descricao: 'Vida por segundo',
    icone: '✚',
    atributo: 'regeneracao',
    porNivel: 0.25,
    modo: 'soma',
    formato: 'numero',
  },
  {
    id: 'pressa',
    nome: 'Pressa',
    descricao: 'Velocidade de movimento',
    icone: '➶',
    atributo: 'velocidade',
    porNivel: 0.06,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'foco',
    nome: 'Foco',
    descricao: 'Recarga das habilidades',
    icone: '⧗',
    atributo: 'recarga',
    porNivel: -0.045,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'poder',
    nome: 'Poder',
    descricao: 'Dano de tudo',
    icone: '✊',
    atributo: 'dano',
    porNivel: 0.08,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'amplitude',
    nome: 'Amplitude',
    descricao: 'Área dos efeitos',
    icone: '◯',
    atributo: 'area',
    porNivel: 0.07,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'multiplicar',
    nome: 'Multiplicação',
    descricao: 'Projéteis extras (a cada 2 níveis)',
    icone: '⁂',
    atributo: 'quantidade',
    porNivel: 0.5,
    modo: 'soma',
    formato: 'numero',
  },
  {
    id: 'ima',
    nome: 'Ímã de Ideias',
    descricao: 'Raio de coleta de cristais',
    icone: '⊂',
    atributo: 'ima',
    porNivel: 0.45,
    modo: 'soma',
    formato: 'metros',
  },
  {
    id: 'sorte',
    nome: 'Sorte',
    descricao: 'Chance de crítico e de 4ª opção',
    icone: '☘',
    atributo: 'sorte',
    porNivel: 0.035,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'armadura',
    nome: 'Armadura',
    descricao: 'Reduz dano recebido',
    icone: '⛨',
    atributo: 'armadura',
    porNivel: 1,
    modo: 'soma',
    formato: 'numero',
  },
  {
    id: 'rapidez',
    nome: 'Rapidez',
    descricao: 'Velocidade dos projéteis',
    icone: '➹',
    atributo: 'velocidadeProjetil',
    porNivel: 0.07,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'persistencia',
    nome: 'Persistência',
    descricao: 'Duração dos efeitos',
    icone: '∞',
    atributo: 'duracao',
    porNivel: 0.07,
    modo: 'soma',
    formato: 'porcento',
  },
  {
    id: 'sabedoria',
    nome: 'Sabedoria',
    descricao: 'Experiência ganha',
    icone: '✎',
    atributo: 'xp',
    porNivel: 0.07,
    modo: 'soma',
    formato: 'porcento',
  },
];

export function habilidade(id: string): DefHabilidade {
  return HABILIDADES.find((h) => h.id === id)!;
}

export function passiva(id: string): DefPassiva {
  return PASSIVAS.find((p) => p.id === id)!;
}
