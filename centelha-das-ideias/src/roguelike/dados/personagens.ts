/**
 * Personagens jogáveis. Cada um tem visual próprio (sem logotipos), atributos,
 * habilidade inicial e voz (falas reais via síntese de voz do navegador).
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Aparencia } from '../../render/modelo-claude';
import type { Atributos } from '../nucleo/progresso';

export type IdPersonagem = 'claude' | 'gpt' | 'gemini' | 'llama' | 'mistral' | 'deepseek';

export interface Voz {
  /** Tom (0..2) e velocidade (0.5..2) da síntese de voz. */
  tom: number;
  ritmo: number;
  /** Perfil do bipe sintetizado usado quando não há voz no navegador. */
  bipe: string;
}

export interface DefPersonagem {
  id: IdPersonagem;
  nome: string;
  titulo: string;
  descricao: string;
  cor: string;
  habilidadeInicial: string;
  /** Modificadores sobre os atributos base. */
  atributos: Partial<Atributos>;
  aparencia: Aparencia;
  voz: Voz;
  falas: {
    inicio: string[];
    nivel: string[];
    dano: string[];
    chefe: string[];
    vitoria: string[];
    morte: string[];
    evolucao: string[];
  };
}

export const PERSONAGENS: DefPersonagem[] = [
  {
    id: 'claude',
    nome: 'Claude',
    titulo: 'A Centelha Curiosa',
    descricao: 'Equilibrado e gentil. Faíscas orbitam ao seu redor e cada nível aumenta a sorte.',
    cor: '#D97757',
    habilidadeInicial: 'centelhaOrbital',
    atributos: { sorte: 0.08, regeneracao: 0.15 },
    aparencia: { corCorpo: '#D97757', corEscura: '#B65A3E', corCentelha: '#ffd27a' },
    voz: { tom: 1.15, ritmo: 1.05, bipe: 'claude' },
    falas: {
      inicio: [
        'Vamos com calma e curiosidade.',
        'Um passo de cada vez. Eu consigo.',
        'Hora de organizar esse ruído.',
      ],
      nivel: [
        'Aprendi algo novo!',
        'Isso abre possibilidades.',
        'Interessante, muito interessante.',
      ],
      dano: ['Ai!', 'Essa doeu.', 'Preciso pensar melhor.'],
      chefe: [
        'Respira. Um problema grande é só vários pequenos.',
        'Esse é grande. Vamos por partes.',
      ],
      vitoria: ['Conseguimos!', 'Silêncio, finalmente.'],
      morte: ['Vou tentar de novo, com mais cuidado.'],
      evolucao: ['Evoluiu! Olha só isso!', 'Agora sim, versão melhorada.'],
    },
  },
  {
    id: 'gpt',
    nome: 'GPT',
    titulo: 'O Nó Preditivo',
    descricao: 'Rápido nas recargas. Começa com o Raio em Cadeia, que salta entre inimigos.',
    cor: '#19c39c',
    habilidadeInicial: 'raioCadeia',
    atributos: { recarga: 0.9, velocidadeProjetil: 1.1 },
    aparencia: {
      corCorpo: '#19c39c',
      corEscura: '#0e7d63',
      corCentelha: '#bfffee',
      corpo: () => new THREE.DodecahedronGeometry(0.52, 1),
      rostoZ: 0.47,
      enfeite: (n, mat) => {
        const anel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 32), mat('#bfffee'));
        anel.rotation.x = Math.PI / 2.6;
        anel.name = 'anelGiro';
        n.add(anel);
      },
    },
    voz: { tom: 0.95, ritmo: 1.15, bipe: 'gpt' },
    falas: {
      inicio: ['Iniciando. Probabilidade de vitória: promissora.', 'Vamos completar essa tarefa.'],
      nivel: ['Parâmetros atualizados.', 'Mais contexto, melhor resposta.', 'Otimizando.'],
      dano: ['Erro detectado.', 'Isso não estava previsto.'],
      chefe: ['Entidade de grande porte identificada.', 'Calculando a melhor rota.'],
      vitoria: ['Tarefa concluída.', 'Resultado excelente.'],
      morte: ['Reiniciando sessão.'],
      evolucao: ['Nova versão disponível!', 'Atualização aplicada.'],
    },
  },
  {
    id: 'gemini',
    nome: 'Gemini',
    titulo: 'As Estrelas Gêmeas',
    descricao: 'Mais projéteis em tudo. Começa com Estrelas Gêmeas que atiram sozinhas.',
    cor: '#7b8cff',
    habilidadeInicial: 'estrelasGemeas',
    atributos: { quantidade: 1, vidaMaxima: 90 },
    aparencia: {
      corCorpo: '#7b8cff',
      corEscura: '#5143c9',
      corCentelha: '#e2c9ff',
      corpo: () => {
        const g = new THREE.OctahedronGeometry(0.58, 2);
        g.scale(1, 0.95, 0.85);
        return g;
      },
      rostoZ: 0.44,
      enfeite: (n, mat) => {
        for (const lado of [-1, 1]) {
          const estrela = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.12, 0),
            mat(lado < 0 ? '#9ad0ff' : '#e2c9ff')
          );
          estrela.position.set(lado * 0.42, 0.62, 0);
          estrela.scale.set(0.6, 1.4, 0.6);
          estrela.name = 'estrelaGemea';
          n.add(estrela);
        }
      },
    },
    voz: { tom: 1.4, ritmo: 1.1, bipe: 'gemini' },
    falas: {
      inicio: ['Duas cabeças pensam melhor que uma!', 'Vamos brilhar em dobro.'],
      nivel: ['Dobro de ideias!', 'Multimodal e animada!', 'Mais estrelas no céu.'],
      dano: ['Ei!', 'Ui, essa pegou.'],
      chefe: ['Que coisa enorme! Vamos juntas.', 'Hora de mostrar o que duas estrelas fazem.'],
      vitoria: ['Brilhamos!', 'Constelação completa!'],
      morte: ['As estrelas voltam amanhã.'],
      evolucao: ['Fusão estelar!', 'Ficou ainda mais brilhante!'],
    },
  },
  {
    id: 'llama',
    nome: 'Llama',
    titulo: 'O Pastor Aberto',
    descricao: 'Muita vida e regeneração. Começa com a Cuspida Venenosa em arco.',
    cor: '#efe2c8',
    habilidadeInicial: 'cuspeToxico',
    atributos: { vidaMaxima: 140, regeneracao: 0.5, velocidade: 0.95 },
    aparencia: {
      corCorpo: '#efe2c8',
      corEscura: '#b9a27f',
      corCentelha: '#bfff8a',
      corpo: () => new THREE.SphereGeometry(0.5, 20, 16),
      rostoZ: 0.46,
      enfeite: (n, mat) => {
        for (let i = 0; i < 9; i++) {
          const tufo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), mat('#fff7e6'));
          const a = (i / 9) * Math.PI * 2;
          tufo.position.set(
            Math.cos(a) * 0.4,
            0.28 + Math.sin(i * 1.7) * 0.06,
            Math.sin(a) * 0.4 - 0.05
          );
          n.add(tufo);
        }
        for (const lado of [-1, 1]) {
          const orelha = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), mat('#b9a27f'));
          orelha.position.set(lado * 0.24, 0.55, 0);
          orelha.rotation.z = -lado * 0.25;
          n.add(orelha);
        }
      },
    },
    voz: { tom: 0.7, ritmo: 0.9, bipe: 'llama' },
    falas: {
      inicio: ['Bééé... quer dizer, vamos lá!', 'Aberto a qualquer desafio.'],
      nivel: ['Rebanho de ideias crescendo.', 'Mais lã, mais força!'],
      dano: ['Bééé!', 'Isso foi grosseiro.'],
      chefe: ['Quem é esse grandalhão? Vou cuspir nele.'],
      vitoria: ['Pasto limpo!'],
      morte: ['Volto mais felpudo.'],
      evolucao: ['Lã dourada!', 'Evolução aberta para todos!'],
    },
  },
  {
    id: 'mistral',
    nome: 'Mistral',
    titulo: 'O Vento do Sul',
    descricao: 'O mais veloz. Começa com a Lâmina de Vento, que vai e volta como bumerangue.',
    cor: '#ff9a3d',
    habilidadeInicial: 'laminaVento',
    atributos: { velocidade: 1.25, vidaMaxima: 85, area: 1.05 },
    aparencia: {
      corCorpo: '#ff9a3d',
      corEscura: '#d9541e',
      corCentelha: '#fff2a8',
      corpo: () => new RoundedBoxGeometry(0.8, 0.9, 0.7, 4, 0.3),
      enfeite: (n, mat) => {
        const espiral = new THREE.Mesh(
          new THREE.TorusGeometry(0.22, 0.05, 6, 20, Math.PI * 1.6),
          mat('#ffd27a')
        );
        espiral.position.set(0, 0.62, -0.05);
        espiral.name = 'anelGiro';
        n.add(espiral);
      },
    },
    voz: { tom: 1.05, ritmo: 1.3, bipe: 'mistral' },
    falas: {
      inicio: ['Allez! Rápido como o vento!', 'Ninguém me alcança.'],
      nivel: ['Mais rápido!', 'O vento muda a meu favor.'],
      dano: ['Ouch!', 'Me pegaram no vácuo.'],
      chefe: ['Grandão, mas lento. Vamos dançar.'],
      vitoria: ['Varrido pelo vento!'],
      morte: ['O vento sempre volta.'],
      evolucao: ['Tempestade perfeita!'],
    },
  },
  {
    id: 'deepseek',
    nome: 'DeepSeek',
    titulo: 'A Baleia das Profundezas',
    descricao: 'Muita área de efeito e dano. Começa com a Onda Profunda, que empurra tudo.',
    cor: '#4d6bfe',
    habilidadeInicial: 'ondaProfunda',
    atributos: { area: 1.2, dano: 1.1, velocidade: 0.92 },
    aparencia: {
      corCorpo: '#4d6bfe',
      corEscura: '#2b3fb8',
      corCentelha: '#9ff0ff',
      corpo: () => {
        const g = new THREE.SphereGeometry(0.52, 20, 16);
        g.scale(1.05, 0.85, 1.15);
        return g;
      },
      rostoZ: 0.5,
      enfeite: (n, mat) => {
        const cauda = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), mat('#2b3fb8'));
        cauda.position.set(0, 0.1, -0.62);
        cauda.rotation.x = -Math.PI / 2;
        cauda.scale.set(1.6, 1, 0.4);
        n.add(cauda);
        const barriga = new THREE.Mesh(new THREE.SphereGeometry(0.4, 14, 10), mat('#cfe0ff'));
        barriga.scale.set(1, 0.5, 1);
        barriga.position.set(0, -0.28, 0.1);
        n.add(barriga);
      },
    },
    voz: { tom: 0.6, ritmo: 0.85, bipe: 'deepseek' },
    falas: {
      inicio: ['Mergulhando fundo.', 'Pensamento profundo, ataque profundo.'],
      nivel: ['Mais fundo!', 'Raciocínio expandido.'],
      dano: ['Glub!', 'Turbulência.'],
      chefe: ['Uma presença enorme... vamos investigar.'],
      vitoria: ['Águas calmas.'],
      morte: ['Volto à superfície depois.'],
      evolucao: ['Do fundo do oceano!', 'Profundidade máxima!'],
    },
  },
];

export function personagem(id: string): DefPersonagem {
  return PERSONAGENS.find((p) => p.id === id) ?? PERSONAGENS[0];
}
