/**
 * Personagens: rotina (objetivo do dia a dia), conversas e reações.
 * A primeira conversa cuja condição vale é a usada.
 */
import type { DefinicaoNpc, IdNpc } from '../nucleo/tipos';

export const NPCS: DefinicaoNpc[] = [
  {
    id: 'lumi',
    nome: 'Dona Lumi',
    descricao: 'Jardineira das flores-pergunta.',
    x: 6,
    z: 4,
    regiao: 'jardim',
    objetivo: 'Regar as flores-pergunta, uma por uma.',
    rotina: [
      { x: 9, z: 2.6, espera: 3.2, acao: 'regar' },
      { x: 14, z: 6.4, espera: 3.2, acao: 'regar' },
      { x: 19, z: 10.8, espera: 3.2, acao: 'regar' },
      { x: 6, z: 9.6, espera: 3.2, acao: 'regar' },
      { x: 4, z: 4, espera: 2.5, acao: 'olhar' },
    ],
    conversas: [
      { quando: { flag: 'bravo_lumi' }, inicio: 'lumi_bravo' },
      {
        quando: { missaoAtiva: 'flores', contador: ['derrotados_flores', 3] },
        inicio: 'lumi_flores_salvas',
      },
      { quando: { missaoAtiva: 'flores' }, inicio: 'lumi_durante' },
      { quando: { missaoConcluida: 'flores' }, inicio: 'lumi_depois' },
      { inicio: 'lumi_inicio' },
    ],
    latidos: [
      'Bom dia, florzinhas...',
      'Hmm, essa aqui precisa de mais água.',
      'Será que vai chover pergunta hoje?',
      'Cresçam, cresçam!',
    ],
    aoApanhar: [
      'Ai! Minhas costas!',
      'Ei! Eu sou uma jardineira, não um Chiado!',
      'Por que fez isso?',
    ],
  },
  {
    id: 'pipo',
    nome: 'Pipo',
    descricao: 'Faísca-criança, rápido e curioso.',
    x: -8,
    z: 6,
    regiao: 'jardim',
    objetivo: 'Correr atrás das borboletas-ideia (e reencontrar a pipa).',
    rotina: [
      { x: -12, z: 10, espera: 1.2, acao: 'pular' },
      { x: -5, z: 13, espera: 0.8, acao: 'pular' },
      { x: -16, z: 6, espera: 1.4, acao: 'olhar' },
      { x: -9, z: 2, espera: 0.9, acao: 'pular' },
    ],
    conversas: [
      { quando: { flag: 'bravo_pipo' }, inicio: 'pipo_bravo' },
      { quando: { missaoAtiva: 'pipa', flag: 'pipa_pega' }, inicio: 'pipo_devolver' },
      { quando: { missaoAtiva: 'pipa' }, inicio: 'pipo_durante' },
      { quando: { missaoConcluida: 'pipa' }, inicio: 'pipo_depois' },
      { inicio: 'pipo_inicio' },
    ],
    latidos: ['Borboleta! Volta aqui!', 'Eu sou o mais rápido!', 'Zuuum!', 'Minha pipa...'],
    aoApanhar: ['AI! Doeu!', 'Isso não é brincadeira!', 'Para com isso!'],
  },
  {
    id: 'bento',
    nome: 'Mestre Bento',
    descricao: 'Inventor rabugento da Oficina.',
    x: 42,
    z: -44,
    regiao: 'oficina',
    objetivo: 'Consertar as máquinas que a tempestade quebrou.',
    rotina: [
      { x: 33.5, z: -40.5, espera: 3, acao: 'martelar' },
      { x: 43, z: -44.5, espera: 2.5, acao: 'olhar' },
      { x: 46, z: -45, espera: 3, acao: 'martelar' },
      { x: 39, z: -52.5, espera: 2.2, acao: 'olhar' },
    ],
    conversas: [
      { quando: { flag: 'bravo_bento' }, inicio: 'bento_bravo' },
      {
        quando: { missaoAtiva: 'circuito', flag: 'porta_oficina_aberta' },
        inicio: 'bento_concluido',
      },
      { quando: { missaoAtiva: 'circuito' }, inicio: 'bento_durante' },
      { quando: { missaoConcluida: 'circuito' }, inicio: 'bento_depois' },
      { inicio: 'bento_inicio' },
    ],
    latidos: [
      'Engrenagem sete... onde está a engrenagem sete?',
      'Hmpf.',
      'Isso aqui não estava fazendo esse barulho ontem.',
      'Quem mexeu na minha chave?',
    ],
    aoApanhar: ['Ei! Isso amassa!', 'Cuidado com o chassi!', 'Eu tenho uma chave inglesa, sabia?'],
  },
  {
    id: 'eco',
    nome: 'Eco',
    descricao: 'Batedor que escuta o Vale.',
    x: 52,
    z: -95,
    regiao: 'vale',
    objetivo: 'Vigiar o Vale escondido nas moitas.',
    rotina: [
      { x: 50, z: -96, espera: 4, acao: 'esconder' },
      { x: 53, z: -91, espera: 2.5, acao: 'olhar' },
      { x: 58, z: -104, espera: 4, acao: 'esconder' },
      { x: 55, z: -99, espera: 2, acao: 'olhar' },
    ],
    conversas: [
      { quando: { flag: 'bravo_eco' }, inicio: 'eco_bravo' },
      { quando: { missaoConcluida: 'vale' }, inicio: 'eco_concluido' },
      { quando: { missaoAtiva: 'vale' }, inicio: 'eco_durante' },
      { inicio: 'eco_inicio' },
    ],
    latidos: ['Shhh...', '...ouviu isso?', 'Chiado ao norte.', 'Escuto passos.'],
    aoApanhar: ['Ai! Silêncio, por favor!', 'Por quê?!', 'Você vai acordar o Vale!'],
  },
  {
    id: 'vela',
    nome: 'Vela',
    descricao: 'Faroleira do Farol das Ideias.',
    x: -1,
    z: -100,
    regiao: 'farol',
    objetivo: 'Polir as lentes do farol, esperando a luz voltar.',
    rotina: [
      { x: -1, z: -102.6, espera: 3, acao: 'polir' },
      { x: -7, z: -103, espera: 3, acao: 'polir' },
      { x: -4, z: -98.8, espera: 2.5, acao: 'olhar' },
    ],
    conversas: [
      { quando: { flag: 'bravo_vela' }, inicio: 'vela_bravo' },
      { quando: { missaoAtiva: 'farol', flag: 'farol_aceso' }, inicio: 'vela_aceso' },
      { quando: { flag: 'vela_explicou', semFlag: 'farol_aceso' }, inicio: 'vela_durante' },
      { quando: { missaoConcluida: 'farol' }, inicio: 'vela_depois' },
      { inicio: 'vela_inicio' },
    ],
    latidos: ['Mais um pouco de brilho...', 'O mar de nuvens está agitado hoje.', 'Volte, luz...'],
    aoApanhar: ['Cuidado com o vidro!', 'Ai! Eu trinco fácil!', 'Isso não ilumina ninguém!'],
  },
];

export function npcPorId(id: IdNpc): (typeof NPCS)[number] {
  return NPCS.find((n) => n.id === id)!;
}
