#!/usr/bin/env node
/**
 * Rota completa automatizada: joga a história do início à fronteira usando a API de teste
 * (lógica acelerada, sem esperar o desenho). Não substitui uma partida humana: valida que
 * missões, escolhas, habilidades, portas, pontes e a fronteira funcionam em sequência.
 *
 * Uso: node testes/e2e/rota.mjs [URL]
 */
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://127.0.0.1:5173/';
const nav = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const pag = await nav.newPage({ viewport: { width: 960, height: 540 } });
const erros = [];
pag.on('pageerror', (e) => erros.push(e.message));
pag.on('console', (m) => m.type() === 'error' && erros.push(m.text()));
await pag.goto(url);
await pag.waitForFunction(() => window.__centelha);

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
  if (!cond) falhas++;
};
const run = (fn, arg) => pag.evaluate(fn, arg);
const est = () => run(() => window.__centelha.estado());
const avancar = (s) => run((s) => window.__centelha.avancar(s), s);
/** Passa por um diálogo escolhendo as opções na ordem dada (null = avançar). */
const dialogo = async (escolhas) => {
  for (const e of escolhas) {
    await run((e) => window.__centelha.escolher(e), e);
    await avancar(0.05);
  }
};
const fim = async () => {
  for (let i = 0; i < 12; i++) {
    const s = await est();
    if (s.estado !== 'dialogo') return;
    await run(() => window.__centelha.escolher(null));
    await run(() => window.__centelha.escolher(0));
    await avancar(0.05);
  }
};
/** Luta de verdade: fica ao lado do inimigo e aperta atacar até ele cair. */
const lutar = async (id) =>
  run(async (id) => {
    const c = window.__centelha;
    const jogo = c.jogo;
    const ini = jogo.inimigos.find((i) => i.id === id);
    for (let k = 0; k < 120 && ini.vivo; k++) {
      const a = Math.random() * Math.PI * 2;
      c.ir(ini.x + Math.cos(a) * 1.3, ini.z + Math.sin(a) * 1.3);
      jogo.jogador.angulo = Math.atan2(ini.x - jogo.jogador.x, ini.z - jogo.jogador.z);
      jogo.estado.vida = jogo.estado.vidaMaxima;
      c.comando('atacar', true);
      c.avancar(1 / 60);
      c.comando('atacar', false);
      c.avancar(0.35);
    }
    return !ini.vivo;
  }, id);

await pag.evaluate(() => localStorage.clear());
await run(() => window.__centelha.jogo.novoJogo());
await dialogo([null, null, null]);
let s = await est();
ok(s.estado === 'jogando', 'intro do narrador termina e o jogo começa');

// galho
await run(() => window.__centelha.ir(2.5, -0.6));
await avancar(0.3);
s = await est();
ok(s.arma === 'galho', 'pegar o galho equipa a arma mágica');

// Lumi: aceitar com coragem
await run(() => window.__centelha.falar('lumi'));
await dialogo([null, 0, null]);
await fim();
s = await est();
ok(s.missao?.startsWith('Derrote os Chiados'), 'missão das flores começa pela escolha');
ok(s.afinidade.lumi === 1, 'escolha corajosa aumenta a afinidade com Lumi');

for (const id of ['chiado-flor-1', 'chiado-flor-2', 'chiado-flor-3'])
  ok(await lutar(id), `derrota ${id} no combate`);
s = await est();
ok(s.missao === 'Volte e fale com Dona Lumi', 'etapa muda depois dos três Chiados');
ok(s.xp > 0, `arma ganhou experiência (${s.xp} xp, nível ${s.nivel})`);

await run(() => window.__centelha.ir(6, 5));
await run(() => window.__centelha.falar('lumi'));
await dialogo([null, null, 0, null]);
await fim();
s = await est();
const temColher = await run(() => !!window.__centelha.jogo.estado.armas.colher);
ok(
  s.flags.includes('flores_abertas') && temColher,
  'recompensa escolhida: Colher Gigante + Observar'
);

// ponte escondida
await run(() => window.__centelha.ir(20.5, -14));
await run(() => window.__centelha.habilidadeUsar('observar'));
s = await est();
ok(
  s.flags.includes('revelado_oculta-1') && s.flags.includes('revelado_oculta-4'),
  'Observar revela as plataformas ocultas'
);
// atravessa pulando
const atravessou = await run(() => {
  const c = window.__centelha;
  c.joystick(1, 0);
  for (let i = 0; i < 40; i++) {
    c.comando('pular', true);
    c.avancar(0.1);
    c.comando('pular', false);
    c.avancar(0.25);
    if (c.jogo.jogador.x > 29.5) break;
  }
  c.joystick(0, 0);
  return { x: c.jogo.jogador.x, y: c.jogo.jogador.y };
});
ok(
  atravessou.x > 29 && atravessou.y >= -0.01,
  `atravessa a ponte pulando nas plataformas (x=${atravessou.x.toFixed(1)})`
);

// pipa do Pipo (escolha de empinar junto)
await run(() => window.__centelha.ir(-8, 6));
await run(() => window.__centelha.falar('pipo'));
await dialogo([0, null, 0, null]);
await fim();
await run(() => window.__centelha.ir(-30.5, -8));
await run(() => window.__centelha.usar());
await run(() => window.__centelha.ir(-8, 6));
await run(() => window.__centelha.falar('pipo'));
await dialogo([1, null]);
await fim();
s = await est();
ok(
  s.flags.includes('pipo_amigo') && (await run(() => !!window.__centelha.jogo.estado.armas.espada)),
  'pipa devolvida: Pipo vira amigo e dá a espada'
);

// bater num NPC tem consequência
await run(() => {
  const c = window.__centelha;
  const n = c.jogo.npcs.find((x) => x.def.id === 'pipo');
  n.receberGolpe({ dano: 1, dx: 1, dz: 0, empurrao: 2, origem: 'jogador' });
});
s = await est();
ok(s.flags.includes('bravo_pipo') || s.afinidade.pipo < 3, 'bater no Pipo reduz afinidade');

// Oficina: Bento e circuito
await run(() => window.__centelha.ir(40, -42));
await avancar(0.6);
await run(() => window.__centelha.falar('bento'));
await dialogo([null, 0, null, null, 0, null]);
await fim();
s = await est();
ok(s.flags.includes('visitou_oficina'), 'chegou à Oficina');
const conectar = (x, z) =>
  run(
    ([x, z]) => {
      const c = window.__centelha;
      c.ir(x, z);
      c.jogo.jogador.inspiracao = 100;
      c.habilidadeUsar('conectar');
    },
    [x, z]
  );
await conectar(33.5, -35.2);
await conectar(40.5, -54.2); // ligação errada: gerador → portão
s = await est();
ok(
  !s.flags.some((f) => f.startsWith('ligado:no-gerador|no-porta')),
  'ligação errada não conta (faz fumaça)'
);
await conectar(33.5, -35.2);
await conectar(46, -33.8);
await conectar(46, -33.8);
await conectar(35.8, -50.6);
await conectar(35.8, -50.6);
await conectar(40.5, -54.2);
s = await est();
ok(s.flags.includes('porta_oficina_aberta'), 'circuito certo abre o portão');
await run(() => window.__centelha.ir(42, -44));
await run(() => window.__centelha.falar('bento'));
await dialogo([null, 1, null]);
await fim();
ok(
  await run(() => !!window.__centelha.jogo.estado.armas.escudo),
  'escolha na bancada: Escudo de Tampa'
);
await run(() => window.__centelha.ir(43, -55.5));
const passouPortao = await run(() => {
  const c = window.__centelha;
  c.joystick(0, -1);
  c.avancar(2.5);
  c.joystick(0, 0);
  return c.jogo.jogador.z;
});
ok(passouPortao < -60, `passa pelo portão aberto (z=${passouPortao.toFixed(1)})`);

// Vale: Eco e rota furtiva
await run(() => window.__centelha.ir(52, -94));
await avancar(0.5);
await run(() => window.__centelha.falar('eco'));
await dialogo([null, 1, null, null]);
await fim();
s = await est();
const dormindo = await run(
  () => window.__centelha.jogo.inimigos.filter((i) => i.estado === 'dormindo').length
);
ok(
  s.flags.includes('vale_furtivo') && dormindo >= 5,
  `rota furtiva: Ruídos do Vale dormindo (${dormindo})`
);
ok(await run(() => !!window.__centelha.jogo.estado.armas.cajado), 'Eco entrega o Cajado de Ideias');
await run(() => window.__centelha.ir(36, -110.3));
await avancar(0.2);
console.log(
  '  chefe:',
  await run(() => {
    const b = window.__centelha.jogo.inimigos.find((i) => i.ehChefe);
    return `${b.estado} vivo=${b.vivo} pos=${b.x.toFixed(1)},${b.z.toFixed(1)}`;
  })
);
const usouSantuario = await run(() => window.__centelha.usar());
s = await est();
ok(
  s.flags.includes('viu_santuario') &&
    (await run(() => window.__centelha.jogo.estado.habilidades.has('criar'))),
  `santuário ensina Criar (${usouSantuario})`
);

// ponte de luz
await run(() => {
  const c = window.__centelha;
  c.ir(25.5, -92);
  c.jogo.jogador.inspiracao = 100;
  c.habilidadeUsar('criar');
});
s = await est();
ok(s.flags.includes('ponte_luz'), 'Criar forma a ponte de luz');
const cruzou = await run(() => {
  const c = window.__centelha;
  c.joystick(-1, 0);
  c.avancar(3);
  c.joystick(0, 0);
  return c.jogo.jogador.x;
});
ok(cruzou < 9, `atravessa a ponte de luz até o Farol (x=${cruzou.toFixed(1)})`);

// Farol
await run(() => window.__centelha.ir(-1, -99));
await run(() => window.__centelha.falar('vela'));
await dialogo([null, 2, null, null]);
await fim();
s = await est();
ok(s.flags.includes('vela_explicou'), 'Vela explica o mecanismo');
await run(() => {
  const c = window.__centelha;
  c.ir(-4, -100.3);
  for (const h of ['observar', 'conectar', 'criar']) {
    c.jogo.jogador.inspiracao = 100;
    c.habilidadeUsar(h);
  }
});
s = await est();
ok(
  s.flags.includes('farol_aceso') && s.estado === 'cena',
  'Observar → Conectar → Criar acende o farol (cena)'
);
await avancar(6.5);
s = await est();
ok(s.estado === 'jogando', 'cena do farol termina e o jogo continua');
await run(() => window.__centelha.ir(-1, -99));
await run(() => window.__centelha.falar('vela'));
await dialogo([null, null, 0, null]);
await fim();
s = await est();
ok(
  s.flags.includes('promessa_voltar') && s.missao?.includes('ponte iluminada'),
  'missão "O Que Vem Depois" aponta para o norte'
);

// Fronteira: andar, correr, esquivar e pular contra a parede
await run(() => window.__centelha.ir(-2, -116));
const fronteira = await run(() => {
  const c = window.__centelha;
  c.joystick(0, -1);
  c.comando('correr', true);
  c.avancar(1.5);
  c.comando('esquivar', true);
  c.avancar(0.05);
  c.comando('esquivar', false);
  c.avancar(0.5);
  c.comando('pular', true);
  c.avancar(0.6);
  c.comando('pular', false);
  c.avancar(1);
  c.comando('correr', false);
  c.joystick(0, 0);
  c.jogo.jogador.inspiracao = 100;
  c.habilidadeUsar('criar');
  return { z: c.jogo.jogador.z, aviso: document.querySelector('.aviso-fronteira')?.textContent };
});
ok(
  fronteira.z > -121.4,
  `fronteira segura andar, correr, esquivar e pular (z=${fronteira.z.toFixed(2)})`
);
ok(
  fronteira.aviso ===
    'Esta região está em desenvolvimento. A aventura continua nas próximas atualizações.',
  'mensagem exata da fronteira aparece'
);
s = await est();
ok(
  s.flags.includes('viu_fronteira'),
  'missão registra que a fronteira foi vista (sem final definitivo)'
);

// salvar e carregar
await run(() => window.__centelha.jogo.salvar());
await pag.reload();
await pag.waitForFunction(() => window.__centelha);
await run(() => window.__centelha.jogo.continuar());
s = await est();
ok(
  s.flags.includes('farol_aceso') && s.flags.includes('ponte_luz') && s.z > -121.4,
  'salvamento restaura progresso e posição segura'
);
const cont = await run(() => window.__centelha.jogo.estado.contadores.derrotados_flores);
ok(cont === 3, 'contadores de missão persistem');

console.log(erros.length ? `--- erros da página ---\n${erros.join('\n')}` : 'página sem erros');
console.log(falhas ? `${falhas} falha(s)` : 'ROTA COMPLETA OK');
await nav.close();
process.exit(falhas ? 1 : 0);
