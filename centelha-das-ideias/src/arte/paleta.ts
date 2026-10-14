/**
 * Paleta oficial (direção de arte em docs/arte.md). Cores fora daqui só com justificativa.
 * Estilo: ilustração geométrica plana; topo das formas mais claro (luz do alto à esquerda),
 * frentes médias, laterais à direita mais escuras; contornos coloridos (nunca preto puro).
 */
export const PALETA = {
  // Claude
  claude: '#D97757',
  claudeClaro: '#EC9A77',
  claudeTopo: '#F0A988',
  claudeEscuro: '#B85A3C',
  claudeContorno: '#7C3A25',
  olho: '#231B1A',
  olhoBrilho: '#FFF4E6',

  // Neutros quentes
  marfim: '#F6F1E7',
  creme: '#EDE3D1',
  areia: '#DCC9A6',
  ardosia: '#2B2530',
  ardosiaClara: '#463E4D',
  sombra: 'rgba(43, 30, 40, 0.26)',

  // Jardim
  grama: '#8FB86A',
  gramaClara: '#AACB82',
  gramaEscura: '#6F9A52',
  gramaSombra: '#557D43',
  florLilas: '#B79BD9',
  florAmarela: '#F2CF63',
  florRosa: '#EE9AA8',
  trilha: '#D9BC8E',
  trilhaEscura: '#BF9C6C',
  terra: '#9C7350',
  terraEscura: '#755338',

  // Água
  agua: '#6DB3C8',
  aguaClara: '#9ED6E2',
  aguaFunda: '#3D7E98',
  espuma: '#E9F7F8',

  // Oficina
  madeira: '#B98157',
  madeiraClara: '#D49C6C',
  madeiraEscura: '#8A5A3A',
  cobre: '#C9814A',
  cobreClaro: '#E7A974',
  cobreEscuro: '#8E522B',
  petroleo: '#2F5D62',
  vazioNoite: '#231F33',
  vazioNoiteClaro: '#38304F',
  estrela: '#F8EBCB',

  // Vale / Ruído
  ruido: '#7F7894',
  ruidoClaro: '#B4ADC8',
  ruidoEscuro: '#575069',
  glitchMagenta: '#D45FA3',
  glitchCiano: '#5CCFC6',
  pastoCinza: '#9EA58F',
  rochaVioleta: '#8C7FA0',

  // Farol
  pedra: '#B9B1A5',
  pedraClara: '#D7D0C4',
  pedraEscura: '#8F877C',
  mar: '#3F6E9A',
  marClaro: '#6E9CC4',
  ceuEntardecer: '#F2B57A',

  // Ideias / energia
  luz: '#FFD27A',
  luzClara: '#FFE9B0',
  luzNucleo: '#FFF8E1',
  fio: '#FFC864',
  energiaDesligada: '#8C8577',

  // Construção (fronteira em desenvolvimento)
  rascunho: '#9FB7D9',
  rascunhoClaro: '#D3E2F5',
  andaime: '#E8C47A',

  // Sinais
  perigo: '#E5534B',
  perigoClaro: '#FF8F7E',
  aviso: '#FFA552',
  sucesso: '#7CCB8B',
  dica: '#7FB7E0',
} as const;

export type CorPaleta = keyof typeof PALETA;

/** Escurece/clareia uma cor hexadecimal (-1..1). */
export function ajustarCor(hex: string, quanto: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (quanto >= 0) {
    r += (255 - r) * quanto;
    g += (255 - g) * quanto;
    b += (255 - b) * quanto;
  } else {
    r *= 1 + quanto;
    g *= 1 + quanto;
    b *= 1 + quanto;
  }
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Mistura duas cores hexadecimais (t = 0 -> a, 1 -> b). */
export function misturarCor(a: string, b: string, t: number): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const ch = (n: number, s: number) => (n >> s) & 255;
  const m = (s: number) => Math.round(ch(na, s) + (ch(nb, s) - ch(na, s)) * t);
  const h = (v: number) => v.toString(16).padStart(2, '0');
  return `#${h(m(16))}${h(m(8))}${h(m(0))}`;
}

/** Converte hex + alpha em rgba(). */
export function comAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Dessatura (para regiões tomadas pelo Ruído). */
export function dessaturar(hex: string, quanto: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const cinza = r * 0.3 + g * 0.59 + b * 0.11;
  const tinta = { r: 127, g: 120, b: 148 }; // leve violeta do Ruído
  const m = (c: number, t: number) => c + (cinza * 0.75 + t * 0.25 - c) * quanto;
  const h = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, '0');
  return `#${h(m(r, tinta.r))}${h(m(g, tinta.g))}${h(m(b, tinta.b))}`;
}
