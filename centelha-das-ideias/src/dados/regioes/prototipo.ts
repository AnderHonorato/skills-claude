/**
 * Região provisória de validação do motor (será substituída pelas regiões reais).
 * Legenda dos blocos em src/mundo/tiles.ts.
 */
import type { DefinicaoRegiao } from '../../contratos/dados';

export const PROTOTIPO: DefinicaoRegiao = {
  id: 'jardim',
  nome: 'Jardim das Perguntas',
  tema: 'jardim',
  origem: { x: 0, y: 0 },
  descricao: 'Clareira de testes do motor.',
  musica: 'jardim',
  entrada: { x: 6, y: 14 },
  mapa: [
    '                                            ',
    '  TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT    ',
    '  T......,,.......#####.................T   ',
    '  T..,....,.......#...#....PPPP.........T   ',
    '  T...............#####....PPPP....QQ...T   ',
    '  T.......o..........:.....PPPP....QQ...T   ',
    '  T..,...............:..................T   ',
    '  T.......hhhh.......:.......,,,........T   ',
    '  T..................:..................T   ',
    '  T....~~~~~~~.......:........   .......T   ',
    '  T....~wwwww~.......:........   .......T   ',
    '  T....~wsssw~.......:........   .......T   ',
    '  T....~wwwww~.......:..................T   ',
    '  T....~~~~~~~.......::::::::::::::::::::FFF',
    '  T...,..............:..................TFFF',
    '  T....r.r.r.........:...,,.............T   ',
    '  T..................:..................T   ',
    '  TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT   ',
    '                                            ',
  ],
  entidades: [
    { tipo: 'arma', id: 'proto-espada', x: 9, y: 14, arma: 'espada' },
    { tipo: 'pedraMemoria', id: 'proto-pedra', x: 12, y: 3 },
    { tipo: 'npc', id: 'salvia', x: 16, y: 8 },
    { tipo: 'placa', id: 'proto-placa', x: 22, y: 12, texto: 'Teste de placa: leia com E.' },
    { tipo: 'coletavel', id: 'proto-centelha', x: 34, y: 6, item: 'centelha' },
    {
      tipo: 'bau',
      id: 'proto-bau',
      x: 35,
      y: 3,
      conteudo: { vidaMaxima: 1 },
      texto: 'Coração extra',
    },
    { tipo: 'decoracao', modelo: 'lampiao', x: 21, y: 9, solido: true },
  ],
};
