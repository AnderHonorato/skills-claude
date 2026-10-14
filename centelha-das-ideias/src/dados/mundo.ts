/**
 * Definição do mundo: regiões disponíveis e a FRONTEIRA em desenvolvimento.
 * (RESPONSÁVEL: agente de Narrativa e Conteúdo; fronteira só muda com o orquestrador.)
 *
 * Para expandir o mundo numa atualização:
 *  1. Cadastre a nova região em `regioes`.
 *  2. Copie a `fronteira` atual para `fronteirasAnteriores`.
 *  3. Mova `fronteira.area` para o novo limite e atualize `regiaoFutura`.
 *  4. Incremente `versaoConteudo`.
 */
import type { DefinicaoMundo } from '../contratos/dados';
import { PROTOTIPO } from './regioes/prototipo';

export const MENSAGEM_FRONTEIRA =
  'Esta região está em desenvolvimento. A aventura continua nas próximas atualizações.';

export const MUNDO: DefinicaoMundo = {
  versaoConteudo: 1,
  regiaoInicial: 'jardim',
  regioes: [PROTOTIPO],
  fronteira: {
    id: 'fronteira-1',
    regiaoFutura: 'arquipelago',
    nomeRegiaoFutura: 'Arquipélago dos Sonhos',
    area: { x: 41, y: 13, largura: 3, altura: 2 },
    mensagem: MENSAGEM_FRONTEIRA,
    raioAviso: 4,
  },
  fronteirasAnteriores: [],
};
