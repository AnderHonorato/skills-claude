/**
 * O mundo em dados: ilhas flutuantes, pontes, regiões, objetos, inimigos e a fronteira.
 * Para expandir: acrescente ilhas/regiões além da fronteira e mova FRONTEIRA para o novo
 * limite (salvamentos antigos continuam válidos, ver nucleo/salvamento.ts).
 */
import { criarAleatorio } from '../nucleo/aleatorio';
import type {
  Arbusto,
  Fronteira,
  IdRegiao,
  ObjetoMundo,
  Ponto,
  Rampa,
  Regiao,
  Solido,
  SpawnInimigo,
} from '../nucleo/tipos';

export const VERSAO_CONTEUDO = 2;

export const MENSAGEM_FRONTEIRA =
  'Esta região está em desenvolvimento. A aventura continua nas próximas atualizações.';

/** Único lugar que define o limite atual do conteúdo. */
export const FRONTEIRA: Fronteira = {
  id: 'fronteira-sonhos',
  x: -2,
  z: -122,
  w: 14,
  d: 1.2,
  mensagem: MENSAGEM_FRONTEIRA,
  raioAviso: 7,
  retorno: { x: -2, z: -104 },
};

/** Lado "além" da fronteira (o que ainda não existe de verdade). */
export function alemDaFronteira(p: Ponto, f: Fronteira = FRONTEIRA): boolean {
  return p.z < f.z - f.d / 2;
}

export const INICIO = { x: 0, z: 3 };

export const REGIOES: Regiao[] = [
  {
    id: 'jardim',
    nome: 'Jardim das Perguntas',
    centro: { x: 0, z: 2 },
    raio: 34,
    musica: 'jardim',
    ceu: ['#8fd3f4', '#fde6c8'],
    nevoa: '#f3e3cf',
    grama: ['#7cc56b', '#a7d86d'],
  },
  {
    id: 'oficina',
    nome: 'Oficina das Conexões',
    centro: { x: 40, z: -42 },
    raio: 22,
    musica: 'oficina',
    ceu: ['#9cc9f0', '#f7d9b8'],
    nevoa: '#ecd9c4',
    grama: ['#8cb86a', '#b9c96a'],
  },
  {
    id: 'vale',
    nome: 'Vale do Ruído',
    centro: { x: 44, z: -92 },
    raio: 27,
    musica: 'vale',
    ceu: ['#6f6aa8', '#c9a3c9'],
    nevoa: '#a99abd',
    grama: ['#5f7f86', '#7d7fa3'],
  },
  {
    id: 'farol',
    nome: 'Farol das Ideias',
    centro: { x: -2, z: -100 },
    raio: 20,
    musica: 'farol',
    ceu: ['#f2a07b', '#fde3b0'],
    nevoa: '#f6d6b4',
    grama: ['#86c27a', '#c4d97a'],
  },
  {
    id: 'sonhos',
    nome: 'Arquipélago dos Sonhos (em desenvolvimento)',
    centro: { x: -2, z: -138 },
    raio: 12,
    musica: 'construcao',
    ceu: ['#b9a7e8', '#f3d6f0'],
    nevoa: '#e2d4f2',
    grama: ['#9ab0d8', '#c8d4ef'],
  },
];

const ilha = (
  regiao: IdRegiao,
  x: number,
  z: number,
  r: number,
  topo = 0,
  visual?: string
): Solido => ({
  forma: 'cilindro',
  tipo: 'ilha',
  regiao,
  x,
  z,
  r,
  base: -14 - r * 0.6,
  topo,
  visual,
});

const ponte = (
  x: number,
  z: number,
  w: number,
  d: number,
  extra: Partial<Solido> = {}
): Solido => ({
  forma: 'caixa',
  tipo: 'ponte',
  x,
  z,
  w,
  d,
  base: -0.9,
  topo: 0,
  ...extra,
});

/** Terreno: ilhas, pontes, plataformas e construções (tudo que tem colisão). */
export const SOLIDOS_FIXOS: Solido[] = [
  // --- Jardim das Perguntas ---
  ilha('jardim', 0, 0, 18),
  ilha('jardim', 17, 9, 10),
  ilha('jardim', -14, 12, 8),
  ilha('jardim', -30, -8, 4.2, 0, 'pipa'),
  {
    forma: 'cilindro',
    tipo: 'pedra',
    regiao: 'jardim',
    x: -20.4,
    z: -5.6,
    r: 1.3,
    base: -3,
    topo: 0,
  },
  {
    forma: 'cilindro',
    tipo: 'pedra',
    regiao: 'jardim',
    x: -23.9,
    z: -7.4,
    r: 1.15,
    base: -3,
    topo: 0.8,
  },
  {
    forma: 'caixa',
    tipo: 'rocha',
    regiao: 'jardim',
    x: -6,
    z: -12,
    w: 5,
    d: 4,
    base: -1,
    topo: 1.4,
  },
  {
    forma: 'caixa',
    tipo: 'rocha',
    regiao: 'jardim',
    x: -9.2,
    z: -12.6,
    w: 2.2,
    d: 2.2,
    base: -1,
    topo: 0.7,
  },
  // ponte das ideias escondidas (o vão é vencido com Observar)
  ponte(16.5, -14, 9.5, 3),
  ponte(31, -14, 5, 3),
  ponte(32, -21.5, 3, 18),
  // --- Oficina das Conexões ---
  ilha('oficina', 40, -42, 16),
  {
    forma: 'caixa',
    tipo: 'predio',
    regiao: 'oficina',
    x: 47,
    z: -49,
    w: 8,
    d: 6,
    base: 0,
    topo: 4.5,
    visual: 'oficina',
  },
  {
    forma: 'caixa',
    tipo: 'predio',
    regiao: 'oficina',
    x: 30.5,
    z: -38.5,
    w: 3,
    d: 3,
    base: 0,
    topo: 2.6,
    visual: 'gerador',
  },
  {
    forma: 'caixa',
    tipo: 'plataforma',
    regiao: 'oficina',
    x: 52,
    z: -38,
    w: 3,
    d: 3,
    base: 0,
    topo: 1.1,
    visual: 'caixote',
  },
  {
    forma: 'caixa',
    tipo: 'plataforma',
    regiao: 'oficina',
    x: 54,
    z: -40.5,
    w: 2.4,
    d: 2.4,
    base: 0,
    topo: 2.1,
    visual: 'caixote',
  },
  {
    forma: 'caixa',
    tipo: 'porta',
    regiao: 'oficina',
    id: 'porta-oficina',
    x: 43,
    z: -57.4,
    w: 5.4,
    d: 0.8,
    base: -1,
    topo: 4,
    semFlag: 'porta_oficina_aberta',
  },
  ponte(43, -63.5, 4, 15),
  // --- Vale do Ruído ---
  ilha('vale', 42, -88, 19),
  ilha('vale', 56, -100, 9),
  ilha('vale', 36, -110, 8, 0.5, 'santuario'),
  // ponte de luz criada com Criar
  ponte(17.4, -92, 14.4, 3, { seFlag: 'ponte_luz', visual: 'luz', id: 'ponte-luz' }),
  // --- Farol das Ideias ---
  ilha('farol', -2, -96, 14),
  {
    forma: 'cilindro',
    tipo: 'rocha',
    regiao: 'farol',
    x: -4,
    z: -102,
    r: 6,
    base: -1,
    topo: 2.4,
    visual: 'colina',
  },
  {
    forma: 'cilindro',
    tipo: 'farol',
    regiao: 'farol',
    x: -4,
    z: -104.2,
    r: 2.1,
    base: 2.4,
    topo: 15,
  },
  // caminho para o arquipélago dos sonhos (ainda em construção)
  ponte(-2, -119.5, 4, 21, { regiao: 'sonhos' }),
  ilha('sonhos', -2, -136, 7, 0, 'esboco'),
  // a fronteira: colisão real que bloqueia andar, esquivar, pular e habilidades
  {
    forma: 'caixa',
    tipo: 'fronteira',
    id: FRONTEIRA.id,
    regiao: 'farol',
    x: FRONTEIRA.x,
    z: FRONTEIRA.z,
    w: FRONTEIRA.w,
    d: FRONTEIRA.d,
    base: -60,
    topo: 60,
  },
];

export const RAMPAS: Rampa[] = [{ x: -4, z: -94, w: 3, d: 6, eixo: 'z', de: 2.4, ate: 0 }];

export const LAGOS: { x: number; z: number; r: number }[] = [
  { x: 8, z: 7, r: 3.2 },
  { x: -12, z: 16, r: 2.4 },
  { x: 50, z: -82, r: 3 },
];

/** Caminhos de terra batida (só visual). */
export const CAMINHOS: Ponto[][] = [
  [
    { x: 0, z: 3 },
    { x: 4, z: -4 },
    { x: 10, z: -11 },
    { x: 13, z: -14 },
  ],
  [
    { x: 0, z: 3 },
    { x: 6, z: 6 },
    { x: 14, z: 8 },
  ],
  [
    { x: 0, z: 3 },
    { x: -8, z: 4 },
    { x: -15, z: -3 },
  ],
  [
    { x: 32, z: -30 },
    { x: 38, z: -40 },
    { x: 43, z: -50 },
    { x: 43, z: -56 },
  ],
  [
    { x: 43, z: -71 },
    { x: 42, z: -80 },
    { x: 34, z: -90 },
    { x: 25, z: -92 },
  ],
  [
    { x: 42, z: -84 },
    { x: 40, z: -100 },
    { x: 36, z: -108 },
  ],
  [
    { x: 10, z: -92 },
    { x: 2, z: -92 },
    { x: -4, z: -91 },
  ],
];

export const PONTO_CHECKPOINT: Record<string, { x: number; z: number; regiao: IdRegiao }> = {
  'pedra-jardim': { x: -3, z: 6, regiao: 'jardim' },
  'pedra-oficina': { x: 35, z: -46, regiao: 'oficina' },
  'pedra-vale': { x: 41, z: -76, regiao: 'vale' },
  'pedra-farol': { x: 4, z: -92, regiao: 'farol' },
};

export const OBJETOS: ObjetoMundo[] = [
  // armas e itens de história
  {
    id: 'galho-inicial',
    tipo: 'armaChao',
    arma: 'galho',
    x: 2.5,
    z: -1.5,
    regiao: 'jardim',
    semFlag: 'tem_galho',
  },
  { id: 'pipa', tipo: 'pipa', x: -30.5, z: -9, regiao: 'jardim', semFlag: 'pipa_pega' },
  // pedras de memória (checkpoint + cura + salvamento)
  ...Object.entries(PONTO_CHECKPOINT).map(([id, p]): ObjetoMundo => ({
    id,
    tipo: 'pedraMemoria',
    x: p.x,
    z: p.z,
    regiao: p.regiao,
  })),
  // flores-pergunta de Lumi
  { id: 'flor-1', tipo: 'flor', x: 10, z: 1.5, regiao: 'jardim' },
  { id: 'flor-2', tipo: 'flor', x: 15, z: 7.5, regiao: 'jardim' },
  { id: 'flor-3', tipo: 'flor', x: 20, z: 12, regiao: 'jardim' },
  { id: 'flor-4', tipo: 'flor', x: 5, z: 10.5, regiao: 'jardim' },
  // plataformas ocultas: só existem depois de reveladas com Observar
  { id: 'oculta-1', tipo: 'oculta', x: 22.6, z: -14, w: 1.8, d: 2.4, topo: 0, regiao: 'jardim' },
  { id: 'oculta-2', tipo: 'oculta', x: 25.2, z: -14, w: 1.8, d: 2.4, topo: 0.4, regiao: 'jardim' },
  { id: 'oculta-4', tipo: 'oculta', x: 27.6, z: -14, w: 1.8, d: 2.4, topo: 0.2, regiao: 'jardim' },
  { id: 'oculta-3', tipo: 'oculta', x: 55.5, z: -43.2, w: 2, d: 2, topo: 3.0, regiao: 'oficina' },
  // circuito da Oficina (Conectar)
  { id: 'no-gerador', tipo: 'no', x: 32.6, z: -36.6, regiao: 'oficina', texto: 'Gerador' },
  { id: 'no-rele-a', tipo: 'no', x: 47, z: -35, regiao: 'oficina', texto: 'Relé do Leste' },
  { id: 'no-rele-b', tipo: 'no', x: 35, z: -52, regiao: 'oficina', texto: 'Relé do Sul' },
  { id: 'no-porta', tipo: 'no', x: 40, z: -55.6, regiao: 'oficina', texto: 'Portão' },
  // vale e farol
  { id: 'santuario', tipo: 'santuario', x: 36, z: -112, y: 0.5, regiao: 'vale' },
  { id: 'soquete-ponte', tipo: 'soquete', x: 24.6, z: -92, regiao: 'vale', semFlag: 'ponte_luz' },
  { id: 'mecanismo-farol', tipo: 'mecanismoFarol', x: -4, z: -101.4, y: 2.4, regiao: 'farol' },
  // baús
  {
    id: 'bau-jardim',
    tipo: 'bau',
    x: -16,
    z: 16.5,
    regiao: 'jardim',
    conteudo: [
      { tipo: 'xp', quantidade: 20 },
      { tipo: 'mensagem', texto: 'Baú: +20 de experiência para a arma atual.' },
    ],
  },
  {
    id: 'bau-oficina',
    tipo: 'bau',
    x: 55.5,
    z: -43.2,
    y: 3.0,
    regiao: 'oficina',
    conteudo: [
      { tipo: 'vidaMaxima', delta: 1 },
      { tipo: 'mensagem', texto: 'Coração de Engrenagem: +1 coração máximo!' },
    ],
  },
  {
    id: 'bau-vale',
    tipo: 'bau',
    x: 61,
    z: -97,
    regiao: 'vale',
    conteudo: [
      { tipo: 'xp', quantidade: 45 },
      { tipo: 'mensagem', texto: 'Baú do Vale: +45 de experiência para a arma atual.' },
    ],
  },
  {
    id: 'bau-farol',
    tipo: 'bau',
    x: -12,
    z: -99,
    regiao: 'farol',
    conteudo: [
      { tipo: 'vidaMaxima', delta: 1 },
      { tipo: 'mensagem', texto: 'Coração do Farol: +1 coração máximo!' },
    ],
  },
  // placas
  {
    id: 'placa-jardim',
    tipo: 'placa',
    x: 3,
    z: 6.5,
    regiao: 'jardim',
    texto: 'Jardim das Perguntas — aqui crescem as dúvidas mais bonitas.',
  },
  {
    id: 'placa-ponte',
    tipo: 'placa',
    x: 12.5,
    z: -11.6,
    regiao: 'jardim',
    texto: 'Ponte das Ideias Escondidas. Quem observa, atravessa. (Observar: Q)',
  },
  {
    id: 'placa-oficina',
    tipo: 'placa',
    x: 34,
    z: -31,
    regiao: 'oficina',
    texto: 'Oficina das Conexões: nada aqui funciona sozinho.',
  },
  {
    id: 'placa-vale',
    tipo: 'placa',
    x: 45.5,
    z: -73,
    regiao: 'vale',
    texto: 'Vale do Ruído. Pise no mato alto: dentro dele ninguém te vê.',
  },
  {
    id: 'placa-sonhos',
    tipo: 'placa',
    x: 1.2,
    z: -108.5,
    regiao: 'farol',
    texto: 'Arquipélago dos Sonhos → (em construção)',
  },
  // faíscas colecionáveis (dão experiência à arma atual)
  ...(
    [
      [-6, -12, 1.4, 'jardim'],
      [-30, -6.5, 0, 'jardim'],
      [-23.9, -7.4, 0.8, 'jardim'],
      [-21, 11, 0, 'jardim'],
      [22, 14, 0, 'jardim'],
      [0, 15, 0, 'jardim'],
      [12, -5, 0, 'jardim'],
      [25.2, -14, 0.4, 'jardim'],
      [32, -26, 0, 'jardim'],
      [31, -52, 0, 'oficina'],
      [54, -40.5, 2.1, 'oficina'],
      [44, -30, 0, 'oficina'],
      [26, -42, 0, 'oficina'],
      [30, -82, 0, 'vale'],
      [55, -84, 0, 'vale'],
      [60, -104, 0, 'vale'],
      [42, -101, 0, 'vale'],
      [31, -113, 0.5, 'vale'],
      [-4, -99, 2.4, 'farol'],
      [7, -102, 0, 'farol'],
      [-11, -90, 0, 'farol'],
      [-2, -114, 0, 'farol'],
    ] as const
  ).map(([x, z, y, regiao], i): ObjetoMundo => ({
    id: `faisca-${i + 1}`,
    tipo: 'faisca',
    x,
    z,
    y,
    regiao,
  })),
];

export const INIMIGOS: SpawnInimigo[] = [
  // jardim: os Chiados que roem as flores (missão de Lumi)
  { id: 'chiado-flor-1', tipo: 'chiado', x: 16, z: 12, missao: 'flores' },
  { id: 'chiado-flor-2', tipo: 'chiado', x: 21, z: 6, missao: 'flores' },
  { id: 'chiado-flor-3', tipo: 'chiado', x: 11, z: 14, missao: 'flores' },
  { id: 'chiado-pipa', tipo: 'chiado', x: -29, z: -6.5 },
  // oficina
  { id: 'zumbido-of-1', tipo: 'zumbido', x: 36, z: -50 },
  { id: 'zumbido-of-2', tipo: 'zumbido', x: 49, z: -37 },
  { id: 'chiado-of-1', tipo: 'chiado', x: 41, z: -53 },
  { id: 'chiado-of-2', tipo: 'chiado', x: 29, z: -45 },
  // vale
  { id: 'chiado-v-1', tipo: 'chiado', x: 38, z: -80 },
  { id: 'chiado-v-2', tipo: 'chiado', x: 47, z: -85 },
  { id: 'chiado-v-3', tipo: 'chiado', x: 33, z: -92 },
  { id: 'chiado-v-4', tipo: 'chiado', x: 51, z: -93 },
  { id: 'chiado-v-5', tipo: 'chiado', x: 58, z: -97 },
  { id: 'zumbido-v-1', tipo: 'zumbido', x: 45, z: -97 },
  { id: 'zumbido-v-2', tipo: 'zumbido', x: 55, z: -105 },
  { id: 'zumbido-v-3', tipo: 'zumbido', x: 29, z: -99 },
  { id: 'estatica-grande', tipo: 'estatica', x: 39, z: -105, missao: 'vale' },
  // farol
  { id: 'zumbido-f-1', tipo: 'zumbido', x: 3, z: -89 },
  { id: 'chiado-f-1', tipo: 'chiado', x: -9, z: -93 },
];

/** Moitas de mato alto: esconderijos (como no LoL). */
export const ARBUSTOS: Arbusto[] = [
  { x: -10, z: -4, r: 1.6 },
  { x: -12.5, z: -1.5, r: 1.3 },
  { x: 14, z: -6, r: 1.5 },
  { x: -4, z: 12.5, r: 1.6 },
  { x: 9, z: 16, r: 1.3 },
  { x: -20, z: 5, r: 1.4 },
  { x: 24, z: 5, r: 1.5 },
  { x: -15, z: 15, r: 1.2 },
  { x: 37, z: -32, r: 1.4 },
  { x: 51, z: -54, r: 1.5 },
  { x: 27, z: -48, r: 1.4 },
  // vale: corredor de mato para passar escondido
  { x: 43, z: -76, r: 1.6 },
  { x: 40, z: -80, r: 1.7 },
  { x: 36, z: -85, r: 1.8 },
  { x: 33, z: -88, r: 1.5 },
  { x: 39, z: -95, r: 1.8 },
  { x: 37, z: -100, r: 1.6 },
  { x: 40, z: -104, r: 1.5 },
  { x: 50, z: -96, r: 1.6 },
  { x: 58, z: -104, r: 1.5 },
  { x: 53, z: -91, r: 1.3 },
  { x: 47, z: -79, r: 1.4 },
  { x: 28, z: -91, r: 1.4 },
  // farol
  { x: 6, z: -98, r: 1.3 },
  { x: -10, z: -94, r: 1.5 },
  { x: 2, z: -106, r: 1.2 },
];

/** Ponto está sobre alguma ilha (ignorando altura), com margem. */
function sobreIlha(x: number, z: number, margem: number): boolean {
  return SOLIDOS_FIXOS.some(
    (s) => s.tipo === 'ilha' && s.r !== undefined && Math.hypot(x - s.x, z - s.z) < s.r - margem
  );
}

function perto(x: number, z: number, pontos: Ponto[], raio: number): boolean {
  return pontos.some((p) => Math.hypot(p.x - x, p.z - z) < raio);
}

export interface Arvore {
  x: number;
  z: number;
  escala: number;
  tipo: 'redonda' | 'pinheiro' | 'torta';
  regiao: IdRegiao;
}

/** Árvores geradas de forma determinística, evitando caminhos, objetos e rotinas. */
export const ARVORES: Arvore[] = (() => {
  const rnd = criarAleatorio(4242);
  const ocupados: Ponto[] = [
    ...OBJETOS,
    ...INIMIGOS,
    ...ARBUSTOS,
    INICIO,
    ...CAMINHOS.flat(),
    ...LAGOS,
  ];
  // amostras extras ao longo dos caminhos
  for (const c of CAMINHOS) {
    for (let i = 0; i < c.length - 1; i++) {
      for (let t = 0; t <= 1; t += 0.2)
        ocupados.push({
          x: c[i].x + (c[i + 1].x - c[i].x) * t,
          z: c[i].z + (c[i + 1].z - c[i].z) * t,
        });
    }
  }
  const lista: Arvore[] = [];
  const zonas: {
    regiao: IdRegiao;
    x: number;
    z: number;
    r: number;
    n: number;
    tipo: Arvore['tipo'];
  }[] = [
    { regiao: 'jardim', x: 0, z: 0, r: 18, n: 26, tipo: 'redonda' },
    { regiao: 'jardim', x: 17, z: 9, r: 10, n: 8, tipo: 'redonda' },
    { regiao: 'jardim', x: -14, z: 12, r: 8, n: 6, tipo: 'redonda' },
    { regiao: 'oficina', x: 40, z: -42, r: 16, n: 12, tipo: 'pinheiro' },
    { regiao: 'vale', x: 42, z: -88, r: 19, n: 20, tipo: 'torta' },
    { regiao: 'vale', x: 56, z: -100, r: 9, n: 6, tipo: 'torta' },
    { regiao: 'farol', x: -2, z: -96, r: 14, n: 11, tipo: 'pinheiro' },
  ];
  for (const z of zonas) {
    let tentativas = 0;
    let feitas = 0;
    while (feitas < z.n && tentativas < 400) {
      tentativas++;
      const ang = rnd() * Math.PI * 2;
      const dist = z.r * (0.35 + 0.6 * Math.sqrt(rnd()));
      const x = z.x + Math.cos(ang) * dist;
      const zz = z.z + Math.sin(ang) * dist;
      if (!sobreIlha(x, zz, 1.4)) continue;
      if (perto(x, zz, ocupados, 3.2)) continue;
      if (perto(x, zz, lista, 3.4)) continue;
      if (
        SOLIDOS_FIXOS.some(
          (s) =>
            s.tipo !== 'ilha' &&
            s.forma === 'caixa' &&
            Math.abs(x - s.x) < (s.w ?? 0) / 2 + 2 &&
            Math.abs(zz - s.z) < (s.d ?? 0) / 2 + 2
        )
      )
        continue;
      if (
        SOLIDOS_FIXOS.some(
          (s) =>
            s.tipo !== 'ilha' &&
            s.forma === 'cilindro' &&
            Math.hypot(x - s.x, zz - s.z) < (s.r ?? 0) + 2
        )
      )
        continue;
      lista.push({ x, z: zz, escala: 0.8 + rnd() * 0.55, tipo: z.tipo, regiao: z.regiao });
      feitas++;
    }
  }
  return lista;
})();

/** Rochas decorativas com colisão. */
export const ROCHAS: { x: number; z: number; r: number; h: number }[] = [
  { x: -16, z: -8, r: 1.1, h: 0.9 },
  { x: 7, z: -9, r: 0.8, h: 0.6 },
  { x: 22, z: 10, r: 1, h: 0.8 },
  { x: 45, z: -33, r: 0.9, h: 0.7 },
  { x: 34, z: -78, r: 1.3, h: 1.2 },
  { x: 52, z: -88, r: 1.1, h: 1 },
  { x: 59, z: -100, r: 0.9, h: 0.8 },
  { x: 8, z: -96, r: 1, h: 0.8 },
];

/** Todos os sólidos: terreno + troncos + rochas + plataformas ocultas. */
export function montarSolidos(): Solido[] {
  const lista = [...SOLIDOS_FIXOS];
  for (const a of ARVORES) {
    lista.push({
      forma: 'cilindro',
      tipo: 'arvore',
      regiao: a.regiao,
      x: a.x,
      z: a.z,
      r: 0.42 * a.escala,
      base: -0.5,
      topo: 5 * a.escala,
    });
  }
  for (const r of ROCHAS)
    lista.push({ forma: 'cilindro', tipo: 'rocha', x: r.x, z: r.z, r: r.r, base: -0.5, topo: r.h });
  for (const o of OBJETOS) {
    if (o.tipo === 'oculta') {
      lista.push({
        forma: 'caixa',
        tipo: 'plataforma',
        id: o.id,
        x: o.x,
        z: o.z,
        w: o.w,
        d: o.d,
        base: (o.topo ?? 0) - 0.6,
        topo: o.topo ?? 0,
        seFlag: `revelado_${o.id}`,
        visual: 'oculta',
      });
    }
    if (o.tipo === 'pedraMemoria')
      lista.push({
        forma: 'cilindro',
        tipo: 'rocha',
        x: o.x,
        z: o.z - 0.1,
        r: 0.55,
        base: -0.5,
        topo: 1.6,
      });
    if (o.tipo === 'placa')
      lista.push({
        forma: 'cilindro',
        tipo: 'cerca',
        x: o.x,
        z: o.z,
        r: 0.18,
        base: -0.5,
        topo: 1.4,
      });
  }
  return lista;
}

export function regiaoEm(x: number, z: number): IdRegiao {
  let melhor: Regiao = REGIOES[0];
  let menor = Infinity;
  for (const r of REGIOES) {
    const d = Math.hypot(x - r.centro.x, z - r.centro.z) / r.raio;
    if (d < menor) {
      menor = d;
      melhor = r;
    }
  }
  return melhor.id;
}

export function dadosRegiao(id: IdRegiao): Regiao {
  return REGIOES.find((r) => r.id === id) ?? REGIOES[0];
}
