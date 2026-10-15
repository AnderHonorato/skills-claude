/**
 * Missões guiadas por flags. A etapa atual é a primeira ainda não cumprida.
 * Missões sem fim definido mantêm o mundo aberto: não há final definitivo.
 */
import type { Condicao, IdNpc, Ponto } from '../nucleo/tipos';

export interface EtapaMissao {
  texto: string;
  feita: Condicao;
  /** Onde fica o objetivo: ponto fixo, NPC ou objeto do mundo. */
  alvo?: Ponto | { npc: IdNpc } | { objeto: string };
  /** Contador exibido como (n/total). */
  progresso?: [string, number];
}

export interface Missao {
  id: string;
  titulo: string;
  principal: boolean;
  etapas: EtapaMissao[];
  /** Conclui sozinha quando todas as etapas valem. */
  autoConcluir?: boolean;
}

export const MISSOES: Record<string, Missao> = {
  flores: {
    id: 'flores',
    titulo: 'Perguntas Murchas',
    principal: true,
    etapas: [
      {
        texto: 'Derrote os Chiados que roem as flores',
        feita: { contador: ['derrotados_flores', 3] },
        alvo: { x: 16, z: 10 },
        progresso: ['derrotados_flores', 3],
      },
      {
        texto: 'Volte e fale com Dona Lumi',
        feita: { missaoConcluida: 'flores' },
        alvo: { npc: 'lumi' },
      },
    ],
  },
  pipa: {
    id: 'pipa',
    titulo: 'A Pipa do Pipo',
    principal: false,
    etapas: [
      {
        texto: 'Encontre a pipa depois das pedrinhas a oeste',
        feita: { flag: 'pipa_pega' },
        alvo: { objeto: 'pipa' },
      },
      {
        texto: 'Devolva a pipa ao Pipo',
        feita: { missaoConcluida: 'pipa' },
        alvo: { npc: 'pipo' },
      },
    ],
  },
  ponte: {
    id: 'ponte',
    titulo: 'A Ponte Escondida',
    principal: true,
    autoConcluir: true,
    etapas: [
      {
        texto: 'Use Observar (Q) no vão da ponte a leste',
        feita: { flag: 'revelado_oculta-1' },
        alvo: { x: 20.5, z: -14 },
      },
      {
        texto: 'Atravesse até a Oficina das Conexões',
        feita: { flag: 'visitou_oficina' },
        alvo: { x: 34, z: -34 },
      },
    ],
  },
  circuito: {
    id: 'circuito',
    titulo: 'Faíscas na Oficina',
    principal: true,
    etapas: [
      {
        texto: 'Ligue o Gerador ao Relé do Leste (R)',
        feita: { flag: 'ligado:no-gerador|no-rele-a' },
        alvo: { objeto: 'no-gerador' },
      },
      {
        texto: 'Ligue o Relé do Leste ao Relé do Sul',
        feita: { flag: 'ligado:no-rele-a|no-rele-b' },
        alvo: { objeto: 'no-rele-a' },
      },
      {
        texto: 'Ligue o Relé do Sul ao Portão',
        feita: { flag: 'ligado:no-porta|no-rele-b' },
        alvo: { objeto: 'no-rele-b' },
      },
      {
        texto: 'Fale com Mestre Bento',
        feita: { missaoConcluida: 'circuito' },
        alvo: { npc: 'bento' },
      },
    ],
  },
  vale: {
    id: 'vale',
    titulo: 'Silêncio no Vale',
    principal: true,
    etapas: [
      {
        texto: 'Chegue ao santuário no sul do Vale',
        feita: { flag: 'viu_santuario' },
        alvo: { x: 37, z: -104 },
      },
      {
        texto: 'Toque a Pedra das Ideias',
        feita: { missaoConcluida: 'vale' },
        alvo: { objeto: 'santuario' },
      },
    ],
  },
  farol: {
    id: 'farol',
    titulo: 'Acender o Farol',
    principal: true,
    etapas: [
      {
        texto: 'Crie a ponte de luz a oeste do Vale (F)',
        feita: { flag: 'ponte_luz' },
        alvo: { objeto: 'soquete-ponte' },
      },
      {
        texto: 'Fale com a faroleira Vela',
        feita: { flag: 'vela_explicou' },
        alvo: { npc: 'vela' },
      },
      {
        texto: 'Observe o mecanismo do farol (Q)',
        feita: { flag: 'farol_observado' },
        alvo: { objeto: 'mecanismo-farol' },
      },
      {
        texto: 'Conecte os espelhos do farol (R)',
        feita: { flag: 'farol_conectado' },
        alvo: { objeto: 'mecanismo-farol' },
      },
      {
        texto: 'Crie a chama do farol (F)',
        feita: { flag: 'farol_aceso' },
        alvo: { objeto: 'mecanismo-farol' },
      },
      { texto: 'Fale com Vela', feita: { missaoConcluida: 'farol' }, alvo: { npc: 'vela' } },
    ],
  },
  sonhos: {
    id: 'sonhos',
    titulo: 'O Que Vem Depois',
    principal: true,
    etapas: [
      {
        texto: 'Siga a ponte iluminada ao norte do Farol',
        feita: { flag: 'viu_fronteira' },
        alvo: { x: -2, z: -117 },
      },
      {
        texto: 'A aventura continua nas próximas atualizações. Explore, treine e colete faíscas!',
        feita: { flag: 'conteudo_futuro' },
      },
    ],
  },
};

/** Circuito da Oficina: pares de nós que precisam ser ligados (ids em ordem alfabética). */
export const CIRCUITO_OFICINA = [
  'no-gerador|no-rele-a',
  'no-rele-a|no-rele-b',
  'no-porta|no-rele-b',
];

export function chaveLigacao(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export const TOTAL_FAISCAS = 22;
