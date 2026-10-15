/**
 * Objetos interativos e as três habilidades:
 * - Observar (Q): onda que revela plataformas ocultas, engrenagens e quem se esconde.
 * - Conectar (R): liga nós de energia com um raio; ligações certas abrem caminhos.
 * - Criar (F): cria pontes de luz nos soquetes e blocos de luz temporários em qualquer lugar.
 * A fronteira bloqueia tudo isso: nada é criado ou conectado através dela.
 */
import * as THREE from 'three';
import { ARMAS } from '../dados/armas';
import { alemDaFronteira, FRONTEIRA, OBJETOS } from '../dados/mundo';
import { CIRCUITO_OFICINA, chaveLigacao } from '../dados/missoes';
import type { ObjetoMundo, Solido } from '../nucleo/tipos';
import {
  criarBau,
  criarFaisca,
  criarFlorPergunta,
  criarModeloArma,
  criarNo,
  criarPedraMemoria,
  criarPipa,
  criarPlaca,
  criarSantuario,
  criarSoquete,
} from '../render/modelos';
import type { Contexto } from './contexto';

export interface Interacao {
  texto: string;
  x: number;
  y: number;
  z: number;
  executar(): void;
}

export interface Ganchos {
  salvar(motivo: string): void;
  checkpoint(id: string): void;
  renascerInimigos(): void;
  farolAceso(): void;
  removido(id: string): boolean;
  remover(id: string): void;
  chefeVivoAcordado(): boolean;
  claudeSente(h: import('../nucleo/tipos').Humor, d?: number): void;
  conjurar(): void;
}

interface Inst {
  o: ObjetoMundo;
  grupo: THREE.Group;
  y: number;
  fase: number;
  aberto?: number;
}

interface BlocoCriado {
  solido: Solido;
  malha: THREE.Mesh;
  vida: number;
}

export class ObjetosMundo {
  private lista: Inst[] = [];
  private raios = new Map<string, THREE.Mesh>();
  private origemConexao: Inst | null = null;
  private raioTemporario: THREE.Mesh;
  private ondaObservar: THREE.Mesh;
  private ondaT = -1;
  private blocos: BlocoCriado[] = [];
  private checkpointAtual = '';
  private dropsCoracao: { grupo: THREE.Group; x: number; y: number; z: number; vida: number }[] =
    [];

  constructor(
    private ctx: Contexto,
    private g: Ganchos
  ) {
    for (const o of OBJETOS) {
      if (o.tipo === 'oculta') continue;
      const grupo = this.modelo(o);
      const y = o.y ?? Math.max(0, ctx.fisica.alturaChao(o.x, o.z, 10));
      grupo.position.set(o.x, y, o.z);
      ctx.cena.add(grupo);
      this.lista.push({ o, grupo, y, fase: Math.random() * 6 });
    }
    this.raioTemporario = this.criarRaio('#9df0ff');
    this.raioTemporario.visible = false;
    ctx.cena.add(this.raioTemporario);
    this.ondaObservar = new THREE.Mesh(
      new THREE.RingGeometry(0.92, 1, 64),
      new THREE.MeshBasicMaterial({
        color: '#9df0ff',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.ondaObservar.rotation.x = -Math.PI / 2;
    this.ondaObservar.renderOrder = 6;
    ctx.cena.add(this.ondaObservar);
  }

  private modelo(o: ObjetoMundo): THREE.Group {
    switch (o.tipo) {
      case 'faisca':
        return criarFaisca();
      case 'bau':
        return criarBau();
      case 'pedraMemoria':
        return criarPedraMemoria();
      case 'no':
        return criarNo();
      case 'soquete':
        return criarSoquete();
      case 'placa':
        return criarPlaca();
      case 'flor':
        return criarFlorPergunta();
      case 'pipa': {
        const g = criarPipa();
        g.children.forEach((c) => (c.position.y += 2.2));
        return g;
      }
      case 'santuario':
        return criarSantuario();
      case 'armaChao': {
        const g = new THREE.Group();
        const m = criarModeloArma(o.arma ?? 'galho');
        m.grupo.rotation.z = 0.5;
        m.grupo.position.set(0.3, 0.1, 0);
        m.grupo.scale.setScalar(1.5);
        const giro = new THREE.Group();
        giro.add(m.grupo);
        giro.name = 'arma';
        g.add(giro);
        const anel = new THREE.Mesh(
          new THREE.RingGeometry(0.7, 0.9, 32),
          new THREE.MeshBasicMaterial({
            color: '#b8f28a',
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false,
          })
        );
        anel.rotation.x = -Math.PI / 2;
        anel.position.y = 0.05;
        anel.name = 'anel';
        const coluna = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.7, 4, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: '#e8ffd0',
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
        );
        coluna.position.y = 2;
        g.add(anel, coluna);
        return g;
      }
      case 'mecanismoFarol': {
        const g = new THREE.Group();
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.7, 0.9, 10),
          new THREE.MeshToonMaterial({ color: '#5b6878' })
        );
        base.position.y = 0.45;
        const eng = new THREE.Mesh(
          new THREE.TorusGeometry(0.4, 0.1, 6, 10),
          new THREE.MeshToonMaterial({ color: '#ffb347' })
        );
        eng.position.y = 1.2;
        eng.name = 'engrenagem';
        eng.visible = false;
        const espelho = new THREE.Mesh(
          new THREE.CircleGeometry(0.35, 16),
          new THREE.MeshBasicMaterial({ color: '#cfefff', side: THREE.DoubleSide })
        );
        espelho.position.y = 1.2;
        espelho.name = 'espelho';
        espelho.visible = false;
        g.add(base, eng, espelho);
        return g;
      }
      default:
        return new THREE.Group();
    }
  }

  private criarRaio(cor: string): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true);
    geo.translate(0, 0.5, 0);
    geo.rotateX(Math.PI / 2);
    return new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: cor,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
  }

  private esticarRaio(m: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3): void {
    m.position.copy(a);
    m.lookAt(b);
    m.scale.set(1, 1, a.distanceTo(b));
  }

  private ativo(i: Inst): boolean {
    const e = this.ctx.estado;
    if (this.g.removido(i.o.id)) return false;
    if (i.o.seFlag && !e.temFlag(i.o.seFlag)) return false;
    if (i.o.semFlag && e.temFlag(i.o.semFlag)) return false;
    return true;
  }

  /** Restaura visuais após carregar um salvamento. */
  sincronizar(): void {
    const e = this.ctx.estado;
    for (const k of CIRCUITO_OFICINA) if (e.temFlag(`ligado:${k}`)) this.desenharLigacao(k);
    for (const i of this.lista) {
      if (i.o.tipo === 'bau' && this.g.removido(i.o.id)) i.aberto = 1;
    }
  }

  private posNo(id: string): THREE.Vector3 {
    const i = this.lista.find((x) => x.o.id === id)!;
    return new THREE.Vector3(i.o.x, i.y + 1.45, i.o.z);
  }

  private desenharLigacao(chave: string): void {
    if (this.raios.has(chave)) return;
    const [a, b] = chave.split('|');
    const m = this.criarRaio('#ffe27a');
    this.esticarRaio(m, this.posNo(a), this.posNo(b));
    this.ctx.cena.add(m);
    this.raios.set(chave, m);
  }

  definirCheckpoint(id: string): void {
    this.checkpointAtual = id;
  }

  /** Coração que cai de inimigos. */
  soltarCoracao(x: number, y: number, z: number): void {
    const g = new THREE.Group();
    const forma = new THREE.Shape();
    forma.moveTo(0, -0.25);
    forma.bezierCurveTo(-0.45, 0.05, -0.2, 0.4, 0, 0.18);
    forma.bezierCurveTo(0.2, 0.4, 0.45, 0.05, 0, -0.25);
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(forma, { depth: 0.1, bevelEnabled: false }),
      new THREE.MeshBasicMaterial({ color: '#ff5f7e' })
    );
    g.add(m);
    g.position.set(x, y, z);
    this.ctx.cena.add(g);
    this.dropsCoracao.push({
      grupo: g,
      x,
      y: Math.max(0, this.ctx.fisica.alturaChao(x, z, y + 1)),
      z,
      vida: 14,
    });
  }

  /** Interação mais próxima para o botão Usar. */
  interacaoProxima(x: number, y: number, z: number): Interacao | null {
    let melhor: Inst | null = null;
    let menor = 2.4;
    for (const i of this.lista) {
      if (!this.ativo(i)) continue;
      if (['faisca', 'armaChao', 'flor'].includes(i.o.tipo)) continue;
      if (i.o.tipo === 'bau' && i.aberto) continue;
      const d = Math.hypot(i.o.x - x, i.o.z - z);
      if (d < menor && Math.abs(i.y - y) < 2.2) {
        menor = d;
        melhor = i;
      }
    }
    if (!melhor) return null;
    const i = melhor;
    const textos: Record<string, string> = {
      bau: 'Abrir baú',
      pedraMemoria: 'Descansar (cura e salva)',
      no: `Nó: ${i.o.texto ?? ''}`,
      soquete: 'Soquete de luz',
      placa: 'Ler placa',
      pipa: 'Pegar a pipa',
      santuario: 'Tocar a Pedra das Ideias',
      mecanismoFarol: 'Mecanismo do farol',
    };
    return {
      texto: textos[i.o.tipo] ?? 'Usar',
      x: i.o.x,
      y: i.y + 1.6,
      z: i.o.z,
      executar: () => this.usar(i),
    };
  }

  private usar(i: Inst): void {
    const ctx = this.ctx;
    const e = ctx.estado;
    switch (i.o.tipo) {
      case 'bau':
        i.aberto = 0.01;
        ctx.audio.tocar('bauAbrir', { x: i.o.x, y: i.o.z });
        e.aplicar(i.o.conteudo);
        this.g.remover(i.o.id);
        this.g.claudeSente('feliz', 2);
        ctx.brilhos.explosao(i.o.x, i.y + 0.8, i.o.z, 30, {
          cor: '#ffd27a',
          tamanho: 0.25,
          vida: 0.9,
          velocidade: 4,
          gravidade: -1,
        });
        this.g.salvar('baú');
        break;
      case 'pedraMemoria':
        e.vida = e.vidaMaxima;
        ctx.audio.tocar('checkpoint', { x: i.o.x, y: i.o.z });
        ctx.brilhos.explosao(i.o.x, i.y + 1.2, i.o.z, 30, {
          cor: '#9df0ff',
          tamanho: 0.25,
          vida: 1,
          velocidade: 3,
          gravidade: -2,
        });
        this.g.checkpoint(i.o.id);
        this.g.renascerInimigos();
        this.g.salvar('Pedra de Memória');
        this.g.claudeSente('carinho', 1.5);
        ctx.mensagem('Vida restaurada. Progresso salvo na Pedra de Memória.');
        break;
      case 'no':
        ctx.mensagem(
          e.habilidades.has('conectar')
            ? `${i.o.texto}: aperte Conectar (R) aqui e depois em outro nó.`
            : `${i.o.texto}: um nó de energia apagado. Alguém na Oficina sabe ligar isso.`
        );
        break;
      case 'soquete':
        ctx.mensagem(
          e.habilidades.has('criar')
            ? 'Use Criar (F) aqui para formar a ponte de luz.'
            : 'Um soquete vazio. Parece esperar uma ideia nova...'
        );
        break;
      case 'placa':
        ctx.balao({ x: i.o.x, y: i.y + 1.2, z: i.o.z }, i.o.texto ?? '', 4.5);
        break;
      case 'pipa':
        e.ligar('pipa_pega');
        ctx.audio.tocar('itemObtido');
        ctx.mensagem('Você pegou a pipa do Pipo! Leve-a de volta.');
        this.g.claudeSente('feliz', 2.5);
        this.g.salvar('pipa');
        break;
      case 'santuario':
        if (e.missoesConcluidas.has('vale')) {
          ctx.mensagem('A Pedra das Ideias brilha em paz.');
          break;
        }
        if (this.g.chefeVivoAcordado()) {
          ctx.mensagem('A Estática Grande está acordada! Derrote-a ou volte escondido.');
          this.g.claudeSente('medo', 1.5);
          break;
        }
        e.aplicar([
          { tipo: 'habilidade', id: 'criar' },
          { tipo: 'flag', flag: 'viu_santuario' },
          { tipo: 'concluirMissao', id: 'vale' },
          { tipo: 'iniciarMissao', id: 'farol' },
        ]);
        ctx.audio.tocar('restauracao');
        ctx.brilhos.explosao(i.o.x, i.y + 1.5, i.o.z, 60, {
          cor: '#ffd27a',
          tamanho: 0.3,
          vida: 1.2,
          velocidade: 5,
          gravidade: -1,
        });
        this.g.claudeSente('surpreso', 1);
        setTimeout(() => this.g.claudeSente('determinado', 2.5), 1000);
        ctx.mensagem('Você aprendeu CRIAR (F)! Use no soquete de luz a oeste do Vale.');
        this.g.salvar('santuário');
        break;
      case 'mecanismoFarol':
        ctx.mensagem(
          !e.temFlag('farol_observado')
            ? 'Um mecanismo parado. Talvez algo escondido ajude a entendê-lo... (Observar)'
            : !e.temFlag('farol_conectado')
              ? 'Engrenagens à mostra! Os espelhos precisam de energia. (Conectar)'
              : !e.temFlag('farol_aceso')
                ? 'Tudo pronto. Falta a chama: uma ideia nova! (Criar)'
                : 'O farol brilha forte.'
        );
        break;
    }
  }

  // ---------------------------------------------------------------- habilidades

  observar(x: number, y: number, z: number): void {
    const ctx = this.ctx;
    this.ondaT = 0;
    this.ondaObservar.position.set(x, y + 0.15, z);
    ctx.audio.tocar('observar', { x, y: z });
    this.g.conjurar();
    let achou = false;
    for (const o of OBJETOS) {
      if (o.tipo !== 'oculta') continue;
      if (Math.hypot(o.x - x, o.z - z) < 11 && !ctx.estado.temFlag(`revelado_${o.id}`)) {
        ctx.estado.ligar(`revelado_${o.id}`);
        ctx.brilhos.explosao(o.x, (o.topo ?? 0) + 0.3, o.z, 20, {
          cor: '#9df0ff',
          tamanho: 0.25,
          vida: 0.9,
          velocidade: 2,
          gravidade: -1,
        });
        achou = true;
      }
    }
    const mec = this.lista.find((i) => i.o.tipo === 'mecanismoFarol');
    if (mec && Math.hypot(mec.o.x - x, mec.o.z - z) < 6 && !ctx.estado.temFlag('farol_observado')) {
      ctx.estado.ligar('farol_observado');
      ctx.mensagem('Engrenagens de luz escondidas apareceram no mecanismo!');
      achou = true;
    }
    for (const i of this.lista) {
      if (i.o.tipo === 'faisca' && this.ativo(i) && Math.hypot(i.o.x - x, i.o.z - z) < 18) {
        for (let k = 0; k < 6; k++)
          ctx.brilhos.emitir({
            x: i.o.x,
            y: i.y + 0.5 + k * 0.5,
            z: i.o.z,
            vy: 2,
            vida: 1.2,
            tamanho: 0.3,
            cor: '#ffd27a',
          });
      }
    }
    if (achou) {
      ctx.audio.tocar('revelar');
      this.g.claudeSente('surpreso', 1.5);
      this.g.salvar('revelação');
    } else this.g.claudeSente('curioso', 1.5);
  }

  conectar(x: number, y: number, z: number): void {
    const ctx = this.ctx;
    const e = ctx.estado;
    const perto = this.lista.find((i) => i.o.tipo === 'no' && Math.hypot(i.o.x - x, i.o.z - z) < 3);
    const mec = this.lista.find(
      (i) => i.o.tipo === 'mecanismoFarol' && Math.hypot(i.o.x - x, i.o.z - z) < 4
    );
    if (mec && !perto) {
      if (!e.temFlag('farol_observado')) {
        ctx.mensagem('Você não sabe o que conectar ainda. Observe o mecanismo primeiro (Q).');
        ctx.audio.tocar('conectarFalha');
        return;
      }
      if (!e.temFlag('farol_conectado')) {
        e.ligar('farol_conectado');
        ctx.audio.tocar('conectarOk');
        this.g.conjurar();
        ctx.mensagem('Os espelhos do farol estão conectados!');
        this.g.claudeSente('feliz', 1.5);
        this.g.salvar('espelhos');
      }
      return;
    }
    if (!perto) {
      ctx.mensagem('Conectar funciona perto de um nó de energia (ou de um mecanismo).');
      ctx.audio.tocar('conectarFalha', { volume: 0.5 });
      this.origemConexao = null;
      this.raioTemporario.visible = false;
      return;
    }
    if (!this.origemConexao || this.origemConexao === perto) {
      this.origemConexao = perto;
      ctx.audio.tocar('conectarInicio', { x, y: z });
      this.g.conjurar();
      ctx.mensagem(`${perto.o.texto}: energia na mão! Vá até outro nó e aperte Conectar.`);
      return;
    }
    const a = this.origemConexao;
    const b = perto;
    this.origemConexao = null;
    this.raioTemporario.visible = false;
    const chave = chaveLigacao(a.o.id, b.o.id);
    const pa = this.posNo(a.o.id);
    const pb = this.posNo(b.o.id);
    if (!ctx.fisica.linhaLivre(pa.x, pa.z, pb.x, pb.z, 1.4)) {
      ctx.mensagem('Algo está no caminho do raio.');
      ctx.audio.tocar('conectarFalha');
      return;
    }
    if (CIRCUITO_OFICINA.includes(chave)) {
      if (e.temFlag(`ligado:${chave}`)) {
        ctx.mensagem('Esses dois já estão ligados.');
        return;
      }
      e.ligar(`ligado:${chave}`);
      this.desenharLigacao(chave);
      ctx.audio.tocar('conectarOk');
      this.g.conjurar();
      this.g.claudeSente('feliz', 1.5);
      const total = CIRCUITO_OFICINA.filter((k) => e.temFlag(`ligado:${k}`)).length;
      if (total === CIRCUITO_OFICINA.length) {
        e.ligar('porta_oficina_aberta');
        ctx.audio.tocar('portaAbrir');
        ctx.tremer(0.3);
        ctx.mensagem('O portão norte se abriu! Fale com o Mestre Bento.');
        this.g.claudeSente('surpreso', 1);
      } else ctx.mensagem(`Ligação feita! (${total}/${CIRCUITO_OFICINA.length})`);
      this.g.salvar('circuito');
    } else {
      ctx.audio.tocar('conectarFalha');
      ctx.poeira.explosao((pa.x + pb.x) / 2, 1.6, (pa.z + pb.z) / 2, 20, {
        cor: '#8c8c8c',
        tamanho: 0.5,
        crescer: 2,
        vida: 1.2,
        velocidade: 2,
        gravidade: -1,
      });
      ctx.mensagem(
        'Fumaça! A energia voltou. Siga a ordem: Gerador, Relé do Leste, Relé do Sul, Portão.'
      );
      this.g.claudeSente('envergonhado', 1.5);
    }
  }

  criar(x: number, y: number, z: number, angulo: number): boolean {
    const ctx = this.ctx;
    const e = ctx.estado;
    const soquete = this.lista.find(
      (i) => i.o.tipo === 'soquete' && this.ativo(i) && Math.hypot(i.o.x - x, i.o.z - z) < 3.5
    );
    if (soquete) {
      e.ligar('ponte_luz');
      ctx.audio.tocar('criarPonte');
      this.g.conjurar();
      ctx.brilhos.explosao(soquete.o.x, 0.8, soquete.o.z, 40, {
        cor: '#ffe9a8',
        tamanho: 0.3,
        vida: 1,
        velocidade: 4,
      });
      ctx.mensagem('Uma ponte de luz se formou até a ilha do Farol!');
      this.g.claudeSente('feliz', 2);
      this.g.salvar('ponte de luz');
      return true;
    }
    const mec = this.lista.find(
      (i) => i.o.tipo === 'mecanismoFarol' && Math.hypot(i.o.x - x, i.o.z - z) < 4
    );
    if (mec) {
      if (!e.temFlag('farol_conectado')) {
        ctx.mensagem('Ainda não. O farol precisa ser observado e conectado antes da chama.');
        ctx.audio.tocar('conectarFalha');
        return false;
      }
      if (!e.temFlag('farol_aceso')) {
        e.ligar('farol_aceso');
        this.g.conjurar();
        this.g.farolAceso();
        return true;
      }
    }
    // bloco de luz temporário à frente
    const bx = x + Math.sin(angulo) * 1.6;
    const bz = z + Math.cos(angulo) * 1.6;
    if (
      alemDaFronteira({ x: bx, z: bz }, FRONTEIRA) ||
      ctx.fisica.bloqueado(bx, bz, y + 0.5, ['fronteira']) ||
      (Math.abs(bz - FRONTEIRA.z) < 1.8 && Math.abs(bx - FRONTEIRA.x) < FRONTEIRA.w / 2 + 1)
    ) {
      ctx.mensagem(FRONTEIRA.mensagem);
      ctx.audio.tocar('fronteira');
      return false;
    }
    if (ctx.fisica.bloqueado(bx, bz, y + 0.3)) {
      ctx.mensagem('Não há espaço para criar aqui.');
      return false;
    }
    const temChao = ctx.fisica.alturaChao(bx, bz, y + 0.2) > y - 0.6;
    const topo = temChao ? y + 1.1 : y;
    const solido: Solido = {
      forma: 'caixa',
      tipo: 'plataforma',
      x: bx,
      z: bz,
      w: 1.8,
      d: 1.8,
      base: topo - 0.5,
      topo,
      id: `criado-${Date.now()}`,
    };
    ctx.fisica.solidos.push(solido);
    const malha = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.5, 1.8),
      new THREE.MeshToonMaterial({
        color: '#ffe9a8',
        transparent: true,
        opacity: 0.85,
        emissive: '#7a5a10',
      })
    );
    malha.position.set(bx, topo - 0.25, bz);
    malha.scale.setScalar(0.01);
    ctx.cena.add(malha);
    this.blocos.push({ solido, malha, vida: 8 });
    ctx.audio.tocar('criarAliado', { x: bx, y: bz });
    this.g.conjurar();
    ctx.brilhos.explosao(bx, topo, bz, 20, {
      cor: '#ffe9a8',
      tamanho: 0.25,
      vida: 0.6,
      velocidade: 3,
    });
    this.g.claudeSente('determinado', 1);
    return true;
  }

  atualizar(dt: number, jx: number, jy: number, jz: number): void {
    const ctx = this.ctx;
    const e = ctx.estado;
    const t = ctx.tempo;
    for (const i of this.lista) {
      const ativo = this.ativo(i);
      if (i.o.tipo === 'bau') {
        i.grupo.visible = true;
        const tampa = i.grupo.getObjectByName('tampa');
        if (tampa && i.aberto !== undefined) {
          i.aberto = Math.min(1, i.aberto + dt * 3);
          tampa.rotation.x = -1.9 * i.aberto;
        }
        continue;
      }
      if (i.o.tipo === 'flor') {
        const aberta = e.temFlag('flores_abertas') || e.contador('derrotados_flores') >= 3;
        const botao = i.grupo.getObjectByName('botao');
        if (botao) {
          const alvo = aberta ? 1.3 : 0.55;
          botao.scale.setScalar(botao.scale.x + (alvo - botao.scale.x) * Math.min(1, dt * 2));
          botao.rotation.y += dt * (aberta ? 0.6 : 0.1);
          i.grupo.rotation.z = Math.sin(t * 1.3 + i.fase) * 0.06 - (aberta ? 0 : 0.35);
        }
        continue;
      }
      i.grupo.visible = ativo;
      if (!ativo) continue;
      const d = Math.hypot(i.o.x - jx, i.o.z - jz);
      switch (i.o.tipo) {
        case 'faisca':
          i.grupo.position.y = i.y + 0.7 + Math.sin(t * 2.5 + i.fase) * 0.15;
          i.grupo.rotation.y = t * 2;
          if (Math.random() < dt * 3)
            ctx.brilhos.emitir({
              x: i.o.x,
              y: i.grupo.position.y,
              z: i.o.z,
              vy: 0.8,
              vida: 0.7,
              tamanho: 0.15,
              cor: '#ffd27a',
            });
          if (d < 1.1 && Math.abs(jy - i.y) < 1.6) {
            this.g.remover(i.o.id);
            e.contadores.faiscas = (e.contadores.faiscas ?? 0) + 1;
            e.ganharXp(6);
            ctx.audio.tocar('faiscaObtida', { x: i.o.x, y: i.o.z });
            ctx.brilhos.explosao(i.o.x, i.grupo.position.y, i.o.z, 16, {
              cor: '#ffd27a',
              tamanho: 0.2,
              vida: 0.5,
              velocidade: 3,
            });
            this.g.claudeSente('feliz', 1);
          }
          break;
        case 'armaChao': {
          const arma = i.grupo.getObjectByName('arma');
          if (arma) {
            arma.position.y = 0.4 + Math.sin(t * 2) * 0.15;
            arma.rotation.y = t * 1.2;
          }
          const anel = i.grupo.getObjectByName('anel');
          if (anel) anel.scale.setScalar(1 + Math.sin(t * 3) * 0.15);
          if (Math.random() < dt * 5)
            ctx.brilhos.emitir({
              x: i.o.x + (Math.random() - 0.5) * 0.8,
              y: i.y + 0.3,
              z: i.o.z + (Math.random() - 0.5) * 0.8,
              vy: 1.2,
              vida: 0.8,
              tamanho: 0.15,
              cor: ARMAS[i.o.arma ?? 'galho'].brilho,
            });
          if (d < 1.3) {
            e.darArma(i.o.arma ?? 'galho');
            e.ligar('tem_galho');
            this.g.remover(i.o.id);
            this.g.claudeSente('surpreso', 0.8);
            setTimeout(() => this.g.claudeSente('feliz', 2.5), 800);
            this.g.salvar('arma');
          }
          break;
        }
        case 'pedraMemoria': {
          const runa = i.grupo.getObjectByName('runa');
          if (runa) {
            runa.rotation.z = t;
            const ativa = this.checkpointAtual === i.o.id;
            ((runa as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(
              ativa ? '#ffd27a' : '#9df0ff'
            );
          }
          if (d < 2.4 && this.checkpointAtual !== i.o.id) {
            this.g.checkpoint(i.o.id);
            ctx.audio.tocar('checkpoint', { x: i.o.x, y: i.o.z, volume: 0.6 });
            ctx.mensagem('Pedra de Memória: ponto de retorno marcado.', 2);
            this.g.salvar('checkpoint');
          }
          break;
        }
        case 'no': {
          const luz = i.grupo.getObjectByName('luz') as THREE.Mesh | undefined;
          const ligado = CIRCUITO_OFICINA.some(
            (k) => k.includes(i.o.id) && e.temFlag(`ligado:${k}`)
          );
          if (luz)
            (luz.material as THREE.MeshBasicMaterial).color.set(
              this.origemConexao === i ? '#ffffff' : ligado ? '#ffe27a' : '#557a88'
            );
          break;
        }
        case 'soquete': {
          const c = i.grupo.getObjectByName('cristal');
          if (c) {
            c.rotation.y = t * 1.5;
            c.position.y = 0.75 + Math.sin(t * 2) * 0.1;
          }
          break;
        }
        case 'santuario': {
          const p = i.grupo.getObjectByName('pedra');
          if (p) {
            p.rotation.y = t * 0.7;
            p.position.y = 1.4 + Math.sin(t * 1.5) * 0.12;
          }
          if (d < 9 && !e.temFlag('viu_santuario')) e.ligar('viu_santuario');
          break;
        }
        case 'pipa':
          i.grupo.rotation.z = Math.sin(t * 1.8) * 0.2;
          i.grupo.position.y = i.y + Math.sin(t * 1.2) * 0.15;
          break;
        case 'mecanismoFarol': {
          const eng = i.grupo.getObjectByName('engrenagem');
          const esp = i.grupo.getObjectByName('espelho');
          if (eng) {
            eng.visible = e.temFlag('farol_observado');
            eng.rotation.z = e.temFlag('farol_conectado') ? t * 3 : 0;
          }
          if (esp) {
            esp.visible = e.temFlag('farol_conectado');
            esp.rotation.y = t;
          }
          break;
        }
      }
    }
    // raio que acompanha o Claude durante a conexão
    if (this.origemConexao) {
      this.raioTemporario.visible = true;
      const a = this.posNo(this.origemConexao.o.id);
      this.esticarRaio(this.raioTemporario, a, new THREE.Vector3(jx, jy + 0.9, jz));
      if (Math.hypot(this.origemConexao.o.x - jx, this.origemConexao.o.z - jz) > 30) {
        this.origemConexao = null;
        this.raioTemporario.visible = false;
        ctx.mensagem('A energia escapou: longe demais do nó.');
      }
    }
    for (const [, m] of this.raios)
      (m.material as THREE.MeshBasicMaterial).opacity = 0.6 + Math.sin(t * 8) * 0.3;
    // onda do Observar
    const mat = this.ondaObservar.material as THREE.MeshBasicMaterial;
    if (this.ondaT >= 0) {
      this.ondaT += dt;
      const r = this.ondaT * 16;
      this.ondaObservar.scale.setScalar(Math.max(0.01, r));
      mat.opacity = Math.max(0, 0.9 - this.ondaT * 1.2);
      if (this.ondaT > 0.8) this.ondaT = -1;
    } else mat.opacity = 0;
    // blocos criados
    for (const b of this.blocos) {
      b.vida -= dt;
      const s = b.vida > 7.7 ? (8 - b.vida) / 0.3 : b.vida < 1 ? Math.max(0.01, b.vida) : 1;
      b.malha.scale.setScalar(Math.max(0.01, s));
      (b.malha.material as THREE.MeshToonMaterial).opacity =
        b.vida < 2 ? 0.4 + Math.abs(Math.sin(t * 10)) * 0.4 : 0.85;
      if (b.vida <= 0) {
        ctx.cena.remove(b.malha);
        const idx = ctx.fisica.solidos.indexOf(b.solido);
        if (idx >= 0) ctx.fisica.solidos.splice(idx, 1);
      }
    }
    this.blocos = this.blocos.filter((b) => b.vida > 0);
    // corações soltos
    for (const c of this.dropsCoracao) {
      c.vida -= dt;
      c.grupo.position.y = c.y + 0.5 + Math.sin(t * 3) * 0.12;
      c.grupo.rotation.y = t * 2;
      c.grupo.visible = c.vida > 3 || Math.floor(c.vida * 6) % 2 === 0;
      if (Math.hypot(c.x - jx, c.z - jz) < 1.1) {
        c.vida = 0;
        e.aplicar([{ tipo: 'curar', quantidade: 1 }]);
        ctx.audio.tocar('coracaoObtido');
      }
      if (c.vida <= 0) ctx.cena.remove(c.grupo);
    }
    this.dropsCoracao = this.dropsCoracao.filter((c) => c.vida > 0);
  }

  /** Posição de um objeto (para marcadores de missão). */
  posicao(id: string): { x: number; z: number } | null {
    const i = this.lista.find((x) => x.o.id === id);
    return i ? { x: i.o.x, z: i.o.z } : null;
  }

  /** Para o mapa: faíscas restantes. */
  faiscasRestantes(): { x: number; z: number }[] {
    return this.lista
      .filter((i) => i.o.tipo === 'faisca' && this.ativo(i))
      .map((i) => ({ x: i.o.x, z: i.o.z }));
  }
}
