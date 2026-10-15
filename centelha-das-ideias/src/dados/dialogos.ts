/**
 * Diálogos com escolhas. O jogador escolhe o que o Claude diz; as escolhas mudam
 * afinidade, recompensas, rotas de missão e o comportamento dos NPCs.
 */
import type { Condicao, Efeito, Falante, Humor, IdNpc } from '../nucleo/tipos';

export interface OpcaoDialogo {
  texto: string;
  quando?: Condicao;
  efeitos?: Efeito[];
  /** Emoção do Claude ao dizer a frase. */
  humor?: Humor;
  proximo?: string;
}

export interface NoDialogo {
  fala: string;
  quem?: Falante;
  humor?: Humor;
  efeitos?: Efeito[];
  opcoes?: OpcaoDialogo[];
  proximo?: string;
}

const desculpas = (
  npc: IdNpc,
  perdoa: string,
  curioso: string,
  magoado: string
): OpcaoDialogo[] => [
  {
    texto: 'Desculpa. Foi sem querer, e eu não vou fazer de novo.',
    humor: 'envergonhado',
    efeitos: [
      { tipo: 'afinidade', npc, delta: 2 },
      { tipo: 'flag', flag: `bravo_${npc}`, valor: false },
      { tipo: 'humorNpc', npc, humor: 'carinho' },
    ],
    proximo: perdoa,
  },
  {
    texto: 'Eu estava treinando com a arma e não olhei direito.',
    humor: 'envergonhado',
    efeitos: [
      { tipo: 'afinidade', npc, delta: 1 },
      { tipo: 'flag', flag: `bravo_${npc}`, valor: false },
    ],
    proximo: curioso,
  },
  {
    texto: 'Você estava no meu caminho.',
    humor: 'raiva',
    efeitos: [
      { tipo: 'afinidade', npc, delta: -1 },
      { tipo: 'humorNpc', npc, humor: 'triste', duracao: 6 },
    ],
    proximo: magoado,
  },
];

export const DIALOGOS: Record<string, NoDialogo> = {
  // ------------------------------------------------------------------ abertura
  intro_1: {
    quem: 'narrador',
    fala: 'Depois da Tempestade de Ruído, o mundo das ideias se partiu em ilhas que flutuam no céu.',
    proximo: 'intro_2',
  },
  intro_2: {
    quem: 'narrador',
    fala: 'Perguntas murcharam. Conexões queimaram. E o Farol das Ideias se apagou.',
    proximo: 'intro_3',
  },
  intro_3: {
    quem: 'narrador',
    fala: 'Mas, no meio do Jardim das Perguntas, uma pequena centelha acabou de acordar...',
    efeitos: [{ tipo: 'humorClaude', humor: 'surpreso', duracao: 2 }],
  },

  // ------------------------------------------------------------------ Lumi
  lumi_inicio: {
    humor: 'surpreso',
    fala: 'Oh! Uma centelha acordada, bem no meu jardim? Faz tempo que eu não via uma luz tão curiosa.',
    proximo: 'lumi_inicio2',
  },
  lumi_inicio2: {
    humor: 'triste',
    fala: 'Eu sou Lumi e cuido das flores-pergunta. Mas a tempestade passou por aqui... e agora uns Chiados estão roendo as perguntas antes que elas abram.',
    opcoes: [
      {
        texto: 'Deixa comigo. Eu espanto esses Chiados!',
        humor: 'determinado',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'flores' },
          { tipo: 'afinidade', npc: 'lumi', delta: 1 },
        ],
        proximo: 'lumi_aceitou_corajoso',
      },
      {
        texto: 'Flores-pergunta? O que elas perguntam?',
        humor: 'curioso',
        proximo: 'lumi_explica',
      },
      { texto: 'Eu acabei de acordar... nem sei lutar.', humor: 'medo', proximo: 'lumi_encoraja' },
    ],
  },
  lumi_explica: {
    humor: 'carinho',
    fala: 'Cada flor guarda uma pergunta que alguém ainda não teve coragem de fazer. Quando ela abre, a pergunta voa até quem precisa dela. Sem perguntas, ninguém aprende nada novo, não é?',
    opcoes: [
      {
        texto: 'Então perguntas são sementes de ideias.',
        humor: 'feliz',
        efeitos: [{ tipo: 'afinidade', npc: 'lumi', delta: 1 }],
        proximo: 'lumi_sementes',
      },
      {
        texto: 'Certo. Vou salvar suas flores.',
        efeitos: [{ tipo: 'iniciarMissao', id: 'flores' }],
        proximo: 'lumi_aceitou',
      },
    ],
  },
  lumi_sementes: {
    humor: 'feliz',
    fala: 'Exatamente! Você entende rápido. Então... vai me ajudar com os Chiados?',
    opcoes: [
      {
        texto: 'Vou sim. Onde eles estão?',
        humor: 'determinado',
        efeitos: [{ tipo: 'iniciarMissao', id: 'flores' }],
        proximo: 'lumi_aceitou',
      },
      {
        texto: 'Antes eu preciso de algo para me defender.',
        quando: { semArma: 'galho' },
        efeitos: [{ tipo: 'iniciarMissao', id: 'flores' }],
        proximo: 'lumi_galho',
      },
    ],
  },
  lumi_encoraja: {
    humor: 'carinho',
    fala: 'Ninguém nasce sabendo, pequena centelha. Está vendo aquele galho caído perto de você? Ele começou a brilhar quando você chegou. Acho que ele quer ser seu.',
    efeitos: [
      { tipo: 'iniciarMissao', id: 'flores' },
      { tipo: 'flag', flag: 'lumi_encorajou' },
    ],
    opcoes: [
      { texto: 'Um galho mágico? Vou experimentar!', humor: 'curioso', proximo: 'lumi_aceitou' },
      {
        texto: 'Obrigado por acreditar em mim.',
        humor: 'carinho',
        efeitos: [{ tipo: 'afinidade', npc: 'lumi', delta: 1 }],
        proximo: 'lumi_aceitou',
      },
    ],
  },
  lumi_galho: {
    fala: 'Aquele galho brilhando ali perto! Pegue-o: ele flutua ao seu lado e cresce quando você golpeia. As coisas deste mundo gostam de ajudar quem pergunta.',
    proximo: 'lumi_aceitou',
  },
  lumi_aceitou_corajoso: {
    humor: 'feliz',
    fala: 'Que coragem! Eles estão no canteiro a leste, perto das flores grandes. Quando um Chiado treme e o chão fica vermelho, é porque vai pular. Saia da frente e revide!',
  },
  lumi_aceitou: {
    fala: 'Eles estão no canteiro a leste, perto das flores grandes. Quando um Chiado treme e o chão fica vermelho, é porque vai pular. Esquive e revide!',
  },
  lumi_durante: {
    humor: 'medo',
    fala: 'Ainda escuto chiados no canteiro... tenha cuidado, sim?',
    opcoes: [
      { texto: 'Já estou indo!', humor: 'determinado' },
      { texto: 'Como eu desvio dos pulos deles?', humor: 'curioso', proximo: 'lumi_dica' },
    ],
  },
  lumi_dica: {
    fala: 'Esquive (C, K ou o botão Esquivar) quando o chão ficar vermelho. Você pode até atacar pulando! E se doer muito, as Pedras de Memória curam e guardam seu progresso.',
  },
  lumi_flores_salvas: {
    humor: 'feliz',
    fala: 'Ouviu isso? As flores estão abrindo! Uma delas acabou de perguntar: "por que o céu tem ilhas?". Que pergunta maravilhosa!',
    efeitos: [
      { tipo: 'concluirMissao', id: 'flores' },
      { tipo: 'flag', flag: 'flores_abertas' },
    ],
    proximo: 'lumi_recompensa',
  },
  lumi_recompensa: {
    humor: 'carinho',
    fala: 'Você me devolveu as perguntas. Vou te ensinar a OBSERVAR: olhar com calma até o escondido aparecer. E quero te dar mais uma coisa...',
    efeitos: [
      { tipo: 'habilidade', id: 'observar' },
      { tipo: 'iniciarMissao', id: 'ponte' },
    ],
    opcoes: [
      {
        texto: 'Aquela colher gigante encostada no regador... é de lutar?',
        humor: 'curioso',
        efeitos: [
          { tipo: 'arma', id: 'colher' },
          { tipo: 'afinidade', npc: 'lumi', delta: 1 },
        ],
        proximo: 'lumi_colher',
      },
      {
        texto: 'Prefiro algo que me deixe mais forte por dentro.',
        humor: 'determinado',
        efeitos: [{ tipo: 'vidaMaxima', delta: 1 }],
        proximo: 'lumi_semente',
      },
      {
        texto: 'Não precisa me dar nada. Ver as flores abrindo já valeu.',
        humor: 'carinho',
        efeitos: [
          { tipo: 'afinidade', npc: 'lumi', delta: 2 },
          { tipo: 'flag', flag: 'lumi_gratidao' },
        ],
        proximo: 'lumi_gentil',
      },
    ],
  },
  lumi_colher: {
    humor: 'feliz',
    fala: 'Minha colher de cavar! Ela é teimosa, mas joga Chiados para o alto que é uma beleza. Cuide bem dela.',
    proximo: 'lumi_observar_dica',
  },
  lumi_semente: {
    fala: 'Então leve esta Semente de Coragem. Ela cresce dentro de você: mais um coração para aguentar o caminho.',
    proximo: 'lumi_observar_dica',
  },
  lumi_gentil: {
    humor: 'carinho',
    fala: 'Ah, centelha... gente assim faz as flores crescerem mais rápido. Leve a Semente de Coragem mesmo assim. E a colher também: ela gostou de você.',
    efeitos: [
      { tipo: 'vidaMaxima', delta: 1 },
      { tipo: 'arma', id: 'colher' },
    ],
    proximo: 'lumi_observar_dica',
  },
  lumi_observar_dica: {
    fala: 'Agora vá até a ponte quebrada a leste e aperte Q (ou o botão Observar). Quem observa, atravessa. Do outro lado fica a Oficina do Mestre Bento.',
  },
  lumi_depois: {
    humor: 'feliz',
    fala: 'As perguntas estão voando de novo. Você trouxe vida ao meu jardim.',
    opcoes: [
      { texto: 'Alguma pergunta nova hoje?', humor: 'curioso', proximo: 'lumi_pergunta' },
      { texto: 'Até mais, Lumi!', humor: 'feliz' },
    ],
  },
  lumi_pergunta: {
    humor: 'curioso',
    fala: 'Uma flor perguntou: "o que existe depois do farol?". Ninguém sabe ainda... talvez você descubra.',
  },
  lumi_bravo: {
    humor: 'triste',
    fala: 'Por que você me bateu? Eu só estava regando as flores...',
    opcoes: desculpas('lumi', 'lumi_perdoa', 'lumi_perdoa_curiosa', 'lumi_magoada'),
  },
  lumi_perdoa: {
    humor: 'carinho',
    fala: 'Tudo bem. Todo mundo erra. O importante é perceber, não é?',
  },
  lumi_perdoa_curiosa: {
    fala: 'Treinar é bom... mas olhe antes de golpear, combinado? Flores e pessoas não são alvos.',
  },
  lumi_magoada: {
    humor: 'triste',
    fala: 'Então siga seu caminho. Volte quando quiser conversar de verdade.',
  },

  // ------------------------------------------------------------------ Pipo
  pipo_inicio: {
    humor: 'triste',
    fala: 'Ei, ei, ei! Você também é uma faísca? Eu sou o Pipo! Eu corro atrás das borboletas-ideia... mas hoje nem isso tem graça.',
    opcoes: [
      { texto: 'O que aconteceu, Pipo?', humor: 'curioso', proximo: 'pipo_conta' },
      {
        texto: 'Aposto que eu pego uma borboleta antes de você!',
        humor: 'feliz',
        proximo: 'pipo_aposta',
      },
      { texto: 'Agora não, estou ocupado.', proximo: 'pipo_ignora' },
    ],
  },
  pipo_conta: {
    humor: 'triste',
    fala: 'A tempestade levou minha pipa! Ela voou para o oeste, para as pedrinhas flutuantes, e eu não consigo pular tão longe. Minhas pernas são curtinhas.',
    opcoes: [
      {
        texto: 'Eu busco a pipa para você.',
        humor: 'determinado',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'pipa' },
          { tipo: 'afinidade', npc: 'pipo', delta: 1 },
        ],
        proximo: 'pipo_obrigado',
      },
      {
        texto: 'Por que você não pede ajuda para um adulto?',
        humor: 'curioso',
        proximo: 'pipo_adulto',
      },
    ],
  },
  pipo_adulto: {
    fala: 'A Dona Lumi está ocupada com as flores... e você é quase do meu tamanho! Me ajuda?',
    opcoes: [
      {
        texto: 'Tá bom, eu ajudo.',
        efeitos: [{ tipo: 'iniciarMissao', id: 'pipa' }],
        proximo: 'pipo_obrigado',
      },
      { texto: 'Talvez depois.', proximo: 'pipo_ignora' },
    ],
  },
  pipo_aposta: {
    humor: 'feliz',
    fala: 'Ha! Ninguém é mais rápido que o Pipo! ...mas hoje eu estou triste demais para correr. A tempestade levou minha pipa lá para o oeste.',
    efeitos: [{ tipo: 'afinidade', npc: 'pipo', delta: 1 }],
    opcoes: [
      {
        texto: 'Então eu busco sua pipa, e depois a gente aposta corrida.',
        humor: 'feliz',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'pipa' },
          { tipo: 'flag', flag: 'pipo_corrida' },
        ],
        proximo: 'pipo_obrigado',
      },
      { texto: 'Que pena. Boa sorte.', proximo: 'pipo_ignora' },
    ],
  },
  pipo_ignora: {
    humor: 'triste',
    fala: 'Ah... tá bom.',
    efeitos: [{ tipo: 'afinidade', npc: 'pipo', delta: -1 }],
  },
  pipo_obrigado: {
    humor: 'feliz',
    fala: 'Sério?! Ela é vermelha com rabo amarelo! Fica depois das pedrinhas flutuantes a oeste. Pule de uma para a outra (Espaço) e cuidado para não cair no céu!',
  },
  pipo_durante: {
    fala: 'Achou? Achou? Ela está lá no oeste, depois das pedrinhas!',
  },
  pipo_devolver: {
    humor: 'surpreso',
    fala: 'É A MINHA PIPA! Você achou mesmo!',
    opcoes: [
      {
        texto: 'Aqui está. Cuide bem dela!',
        humor: 'feliz',
        efeitos: [
          { tipo: 'concluirMissao', id: 'pipa' },
          { tipo: 'afinidade', npc: 'pipo', delta: 1 },
          { tipo: 'arma', id: 'espada' },
        ],
        proximo: 'pipo_espada',
      },
      {
        texto: 'Posso empinar um pouquinho antes de devolver?',
        humor: 'feliz',
        efeitos: [
          { tipo: 'concluirMissao', id: 'pipa' },
          { tipo: 'afinidade', npc: 'pipo', delta: 2 },
          { tipo: 'flag', flag: 'pipo_amigo' },
          { tipo: 'arma', id: 'espada' },
        ],
        proximo: 'pipo_juntos',
      },
      {
        texto: 'Só devolvo se você me der alguma coisa em troca.',
        efeitos: [
          { tipo: 'concluirMissao', id: 'pipa' },
          { tipo: 'afinidade', npc: 'pipo', delta: -1 },
          { tipo: 'flag', flag: 'pipo_desconfiado' },
          { tipo: 'arma', id: 'espada' },
        ],
        proximo: 'pipo_troca',
      },
    ],
  },
  pipo_espada: {
    humor: 'feliz',
    fala: 'Toma! Minha espada de madeira, eu que fiz! Ela flutua do seu lado igual ao galho e fica grandona na hora do golpe. Aperte 1 a 6 para trocar de arma.',
  },
  pipo_juntos: {
    humor: 'carinho',
    fala: 'Só se a gente empinar junto! ...Pronto, agora você é meu melhor amigo. Toma minha espada de madeira, eu que fiz! Aperte 1 a 6 para trocar de arma.',
  },
  pipo_troca: {
    humor: 'triste',
    fala: 'Hmpf... tá. Toma minha espada de madeira. Mas não precisava ser assim, né?',
  },
  pipo_depois: {
    humor: 'feliz',
    fala: 'Minha pipa está voando alto! Valeu, Claude!',
    opcoes: [
      {
        texto: 'E aquela corrida?',
        quando: { flag: 'pipo_corrida' },
        humor: 'feliz',
        proximo: 'pipo_corrida',
      },
      {
        texto: 'Desculpa pelo jeito que eu falei antes.',
        quando: { flag: 'pipo_desconfiado' },
        humor: 'envergonhado',
        efeitos: [
          { tipo: 'afinidade', npc: 'pipo', delta: 2 },
          { tipo: 'flag', flag: 'pipo_desconfiado', valor: false },
        ],
        proximo: 'pipo_desculpa',
      },
      { texto: 'Até mais, Pipo!' },
    ],
  },
  pipo_corrida: {
    humor: 'feliz',
    fala: 'Hoje não, estou cuidando da pipa! Mas a gente aposta quando a ponte dos sonhos ficar pronta. Combinado!',
  },
  pipo_desculpa: { humor: 'carinho', fala: 'Tá desculpado! Amigos às vezes falam bobagem.' },
  pipo_bravo: {
    humor: 'raiva',
    fala: 'Ai! Por que você me bateu?! Eu vou contar para a Dona Lumi!',
    opcoes: desculpas('pipo', 'pipo_perdoa', 'pipo_perdoa_treino', 'pipo_magoado'),
  },
  pipo_perdoa: {
    humor: 'feliz',
    fala: 'Tá bom... mas da próxima vez bate num Chiado, não em mim!',
  },
  pipo_perdoa_treino: { fala: 'Treina na pedra! Pedra não chora.' },
  pipo_magoado: { humor: 'triste', fala: 'Você é chato. Não quero brincar com você.' },

  // ------------------------------------------------------------------ Bento
  bento_inicio: {
    fala: 'Hmm? Uma centelha na minha oficina. Cuidado onde pisa: metade dessas peças morde.',
    proximo: 'bento_inicio2',
  },
  bento_inicio2: {
    humor: 'triste',
    fala: 'Sou Bento. A tempestade queimou os fios do portão norte, e o Vale do Ruído fica do outro lado. Sem energia, ninguém passa.',
    opcoes: [
      { texto: 'Eu posso ajudar a consertar!', humor: 'determinado', proximo: 'bento_maos' },
      { texto: 'E se eu bater no portão até ele abrir?', humor: 'curioso', proximo: 'bento_bater' },
      { texto: 'O que eu ganho com isso?', proximo: 'bento_pragmatico' },
    ],
  },
  bento_maos: {
    humor: 'feliz',
    fala: 'Você tem mãos? ...Pequenas, mas firmes. Gosto disso.',
    efeitos: [{ tipo: 'afinidade', npc: 'bento', delta: 1 }],
    proximo: 'bento_ensina',
  },
  bento_bater: {
    humor: 'feliz',
    fala: 'Isso às vezes funciona. Hoje não. O portão é teimoso, e eu também.',
    proximo: 'bento_ensina',
  },
  bento_pragmatico: {
    fala: 'Pragmático! Respeito. Ajude e eu deixo você escolher uma ferramenta da minha bancada.',
    efeitos: [{ tipo: 'flag', flag: 'bento_negocio' }],
    proximo: 'bento_ensina',
  },
  bento_ensina: {
    fala: 'Vou te ensinar a CONECTAR. Fique perto de um nó e aperte R. Depois vá até outro nó e aperte R de novo. A energia segue o caminho que você desenhar.',
    efeitos: [
      { tipo: 'habilidade', id: 'conectar' },
      { tipo: 'iniciarMissao', id: 'circuito' },
    ],
    proximo: 'bento_circuito',
  },
  bento_circuito: {
    fala: 'O caminho certo é: Gerador, Relé do Leste, Relé do Sul e Portão. Se ligar errado, a energia volta e faz fumaça. Eu odeio fumaça.',
    opcoes: [
      { texto: 'Entendi. Mãos à obra!', humor: 'determinado' },
      { texto: 'E esses bichos zumbindo por aqui?', humor: 'medo', proximo: 'bento_zumbidos' },
    ],
  },
  bento_zumbidos: {
    fala: 'Zumbidos. Quando a antena deles acende, aparece uma linha vermelha no chão e eles atiram eco nela. Saia da linha. Ou devolva o tiro com um escudo, se tiver um.',
  },
  bento_durante: {
    fala: 'A energia ainda não chegou ao portão. Gerador, Relé do Leste, Relé do Sul, Portão. Nessa ordem.',
  },
  bento_concluido: {
    humor: 'feliz',
    fala: 'O portão abriu! Você tem jeito para a coisa, centelha.',
    efeitos: [{ tipo: 'concluirMissao', id: 'circuito' }],
    proximo: 'bento_escolha',
  },
  bento_escolha: {
    fala: 'Como prometido: escolha uma ferramenta. O Martelo de Borracha quica nos inimigos e treme o chão. O Escudo de Tampa defende e devolve os ataques.',
    opcoes: [
      {
        texto: 'Quero o Martelo de Borracha!',
        humor: 'feliz',
        efeitos: [
          { tipo: 'arma', id: 'martelo' },
          { tipo: 'flag', flag: 'escolheu_martelo' },
        ],
        proximo: 'bento_fim',
      },
      {
        texto: 'Quero o Escudo de Tampa.',
        humor: 'determinado',
        efeitos: [
          { tipo: 'arma', id: 'escudo' },
          { tipo: 'flag', flag: 'escolheu_escudo' },
        ],
        proximo: 'bento_fim',
      },
      {
        texto: 'Posso ficar com os dois?',
        humor: 'curioso',
        quando: { afinidadeMin: ['bento', 2] },
        efeitos: [
          { tipo: 'arma', id: 'martelo' },
          { tipo: 'arma', id: 'escudo' },
          { tipo: 'flag', flag: 'bento_deu_outra' },
        ],
        proximo: 'bento_dois',
      },
      {
        texto: 'Posso ficar com os dois?',
        humor: 'curioso',
        quando: { afinidadeMax: ['bento', 1] },
        proximo: 'bento_nao_dois',
      },
    ],
  },
  bento_nao_dois: {
    humor: 'raiva',
    fala: 'Ha! Ganancioso. Uma só. Escolha.',
    opcoes: [
      {
        texto: 'O Martelo, então.',
        efeitos: [
          { tipo: 'arma', id: 'martelo' },
          { tipo: 'flag', flag: 'escolheu_martelo' },
        ],
        proximo: 'bento_fim',
      },
      {
        texto: 'O Escudo, então.',
        efeitos: [
          { tipo: 'arma', id: 'escudo' },
          { tipo: 'flag', flag: 'escolheu_escudo' },
        ],
        proximo: 'bento_fim',
      },
    ],
  },
  bento_dois: {
    humor: 'carinho',
    fala: 'Hmpf. Você trabalhou direitinho e foi educado. Leve os dois. E não conte para ninguém.',
    proximo: 'bento_fim',
  },
  bento_fim: {
    fala: 'O Vale do Ruído fica depois do portão. Lá o barulho é tanto que as ideias se perdem. Procure o Eco, um batedor que se esconde no mato. Ele conhece o caminho.',
  },
  bento_depois: {
    fala: 'Arma que é usada sobe de nível. Ferramenta parada enferruja. Lembre disso.',
    opcoes: [
      {
        texto: 'Será que eu poderia levar a outra ferramenta também?',
        humor: 'curioso',
        quando: {
          afinidadeMin: ['bento', 2],
          semFlag: 'bento_deu_outra',
          algum: [{ flag: 'escolheu_martelo' }, { flag: 'escolheu_escudo' }],
        },
        efeitos: [
          { tipo: 'arma', id: 'martelo' },
          { tipo: 'arma', id: 'escudo' },
          { tipo: 'flag', flag: 'bento_deu_outra' },
        ],
        proximo: 'bento_outra',
      },
      { texto: 'Pode deixar, mestre.', humor: 'feliz' },
    ],
  },
  bento_outra: {
    humor: 'carinho',
    fala: 'Você me ajudou e nunca me tratou como sucata. Leve. Ferramenta boa é ferramenta usada.',
  },
  bento_bravo: {
    humor: 'raiva',
    fala: 'Ei! Eu sou de metal, mas tenho sentimentos. E uma chave inglesa.',
    opcoes: desculpas('bento', 'bento_perdoa', 'bento_perdoa_treino', 'bento_magoado'),
  },
  bento_perdoa: { fala: 'Hmpf. Desculpas aceitas. Agora não amasse nada.' },
  bento_perdoa_treino: {
    humor: 'feliz',
    fala: 'Treinando em mim? Pelo menos tem bom gosto para alvo resistente.',
  },
  bento_magoado: { humor: 'raiva', fala: 'Fora da minha bancada até aprender modos.' },

  // ------------------------------------------------------------------ Eco
  eco_inicio: {
    humor: 'medo',
    fala: 'Shhh! Abaixe-se. Aqui no Vale, quem faz barulho chama o Ruído.',
    proximo: 'eco_inicio2',
  },
  eco_inicio2: {
    fala: 'Eu sou Eco. Repito o que ouço... e ultimamente só ouço chiado. A Estática Grande guarda o santuário ao sul. Lá está a Pedra das Ideias.',
    opcoes: [
      {
        texto: 'Vamos enfrentar a Estática juntos!',
        humor: 'determinado',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'vale' },
          { tipo: 'flag', flag: 'vale_luta' },
          { tipo: 'afinidade', npc: 'eco', delta: 1 },
        ],
        proximo: 'eco_luta',
      },
      {
        texto: 'Dá para passar escondido pelo mato?',
        humor: 'curioso',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'vale' },
          { tipo: 'flag', flag: 'vale_furtivo' },
          { tipo: 'afinidade', npc: 'eco', delta: 1 },
        ],
        proximo: 'eco_furtivo',
      },
      { texto: 'Por que o Ruído existe?', humor: 'curioso', proximo: 'eco_lore' },
    ],
  },
  eco_lore: {
    fala: 'O Ruído é o que sobra quando as ideias brigam sem ouvir umas às outras. Ele não é mau... só é alto demais. Quando alguém escuta de verdade, ele baixa.',
    opcoes: [
      {
        texto: 'Então vamos baixar esse volume na marra!',
        humor: 'determinado',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'vale' },
          { tipo: 'flag', flag: 'vale_luta' },
        ],
        proximo: 'eco_luta',
      },
      {
        texto: 'Então eu passo em silêncio, escutando.',
        humor: 'carinho',
        efeitos: [
          { tipo: 'iniciarMissao', id: 'vale' },
          { tipo: 'flag', flag: 'vale_furtivo' },
          { tipo: 'afinidade', npc: 'eco', delta: 2 },
        ],
        proximo: 'eco_furtivo',
      },
    ],
  },
  eco_luta: {
    fala: 'Corajoso... Então leve isto: meu Cajado de Ideias. Ele dispara pensamentos que acertam de longe. Mire na Estática quando ela parar de tremer.',
    efeitos: [{ tipo: 'arma', id: 'cajado' }],
  },
  eco_furtivo: {
    fala: 'Esperto. Dentro do mato alto, ninguém te vê. Vá de moita em moita. Os Ruídos estão cochilando: não chegue correndo perto deles.',
    proximo: 'eco_furtivo2',
  },
  eco_furtivo2: {
    humor: 'carinho',
    fala: 'E leve meu Cajado de Ideias, só por garantia. Ele é silencioso como um pensamento.',
    efeitos: [{ tipo: 'arma', id: 'cajado' }],
  },
  eco_durante: { fala: 'O santuário fica ao sul. Moita em moita, centelha.' },
  eco_concluido: {
    humor: 'feliz',
    fala: 'Você tocou a Pedra das Ideias! Agora pode CRIAR. Use no soquete de luz a oeste do Vale e faça uma ponte até o Farol.',
    opcoes: [
      { texto: 'Vem comigo, Eco?', humor: 'carinho', proximo: 'eco_fica' },
      { texto: 'Obrigado por me guiar.', efeitos: [{ tipo: 'afinidade', npc: 'eco', delta: 1 }] },
    ],
  },
  eco_fica: {
    humor: 'carinho',
    fala: 'Eu fico. Alguém precisa escutar o Vale enquanto ele se acalma. Mas vou repetir seu nome por aqui, para ninguém esquecer.',
  },
  eco_bravo: {
    humor: 'medo',
    fala: 'Ai! Até você faz barulho comigo?',
    opcoes: desculpas('eco', 'eco_perdoa', 'eco_perdoa_treino', 'eco_magoado'),
  },
  eco_perdoa: { fala: 'Desculpas aceitas. Fale baixo, só isso.' },
  eco_perdoa_treino: { fala: 'Treine nos Ruídos. Eles não sentem nada. Eu sinto.' },
  eco_magoado: { humor: 'triste', fala: '...você está ficando parecido com o Ruído.' },

  // ------------------------------------------------------------------ Vela
  vela_inicio: {
    humor: 'surpreso',
    fala: 'Uma luz atravessando a ponte que ninguém conseguia criar... Você deve ser a centelha de quem as flores falavam.',
    proximo: 'vela_inicio2',
  },
  vela_inicio2: {
    fala: 'Sou Vela, a faroleira. O Farol das Ideias guia os pensamentos perdidos. Desde a tempestade ele está apagado, e sem ele o Ruído não vai embora.',
    opcoes: [
      { texto: 'Como eu acendo o farol?', humor: 'determinado', proximo: 'vela_como' },
      { texto: 'Por que você não acendeu sozinha?', humor: 'curioso', proximo: 'vela_sozinha' },
      {
        texto: 'Um farol para ideias? Que lindo.',
        humor: 'carinho',
        efeitos: [{ tipo: 'afinidade', npc: 'vela', delta: 1 }],
        proximo: 'vela_lindo',
      },
    ],
  },
  vela_sozinha: {
    humor: 'triste',
    fala: 'Porque esse farol não se acende com uma coisa só. Precisa de alguém que observe, que conecte e que crie. Eu só sei polir.',
    proximo: 'vela_como',
  },
  vela_lindo: {
    humor: 'carinho',
    fala: 'É sim. Cada facho de luz é uma ideia que alguém lembrou de ter.',
    proximo: 'vela_como',
  },
  vela_como: {
    fala: 'Vá até o mecanismo na porta do farol. OBSERVE as engrenagens escondidas, CONECTE os espelhos e CRIE a chama. Nessa ordem.',
    efeitos: [{ tipo: 'flag', flag: 'vela_explicou' }],
  },
  vela_durante: {
    fala: 'Observar, conectar, criar. O mecanismo fica na porta do farol, no alto da colina.',
  },
  vela_aceso: {
    humor: 'feliz',
    fala: 'Olhe só... o céu está mudando de cor. O Ruído está se dissolvendo!',
    efeitos: [
      { tipo: 'concluirMissao', id: 'farol' },
      { tipo: 'iniciarMissao', id: 'sonhos' },
    ],
    proximo: 'vela_aceso2',
  },
  vela_aceso2: {
    humor: 'surpreso',
    fala: 'E veja ao norte: o facho iluminou uma ponte que eu nunca tinha visto. Lá adiante fica o Arquipélago dos Sonhos... mas ele ainda está sendo sonhado.',
    opcoes: [
      {
        texto: 'Então eu volto quando ele estiver pronto.',
        humor: 'determinado',
        efeitos: [{ tipo: 'flag', flag: 'promessa_voltar' }],
        proximo: 'vela_fim',
      },
      { texto: 'Mal posso esperar!', humor: 'feliz', proximo: 'vela_fim' },
      { texto: 'Quem está sonhando esse lugar?', humor: 'curioso', proximo: 'vela_quem' },
    ],
  },
  vela_quem: {
    humor: 'carinho',
    fala: 'Talvez todos nós. Cada ideia que alguém tem acrescenta uma pedra naquela ilha.',
    proximo: 'vela_fim',
  },
  vela_fim: {
    fala: 'Enquanto isso, o mundo ainda precisa de você: há faíscas perdidas, armas para treinar e Ruídos para acalmar. A aventura não acaba. Ela continua.',
  },
  vela_depois: {
    humor: 'feliz',
    fala: 'O farol brilha forte. Volte sempre que precisar de uma luz.',
    opcoes: [
      { texto: 'Como está o Arquipélago dos Sonhos?', humor: 'curioso', proximo: 'vela_sonhos' },
      { texto: 'Até logo, Vela.' },
    ],
  },
  vela_sonhos: {
    fala: 'Ainda em construção. Dá para ver os andaimes de luz daqui. Cada dia aparece uma pedra nova.',
  },
  vela_bravo: {
    humor: 'raiva',
    fala: 'Cuidado! Uma faroleira trincada não ilumina ninguém.',
    opcoes: desculpas('vela', 'vela_perdoa', 'vela_perdoa_treino', 'vela_magoada'),
  },
  vela_perdoa: { humor: 'carinho', fala: 'Está perdoado. Toda luz tropeça às vezes.' },
  vela_perdoa_treino: { fala: 'Treine longe do vidro, por favor.' },
  vela_magoada: { humor: 'triste', fala: 'Então ilumine seu próprio caminho.' },
};
