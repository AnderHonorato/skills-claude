#!/usr/bin/env node
/**
 * Teste de ponta a ponta do multijogador: dois "aparelhos" (duas abas isoladas do
 * Chromium) conectam por WebRTC trocando os códigos, começam uma partida e jogam.
 *
 * Uso: node ferramentas/testar-multijogador.mjs [--url URL] [--saida pasta] [--segundos 20]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (n, p) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : p;
};
const url = arg('url', 'http://127.0.0.1:5173/');
const saida = arg('saida', 'testes/e2e/saida');
const segundos = Number(arg('segundos', '12'));
mkdirSync(saida, { recursive: true });

const navegador = await chromium.launch({
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    // no contêiner não há mDNS; nos aparelhos reais o navegador resolve sozinho
    '--disable-features=WebRtcHideLocalIpsWithMdns',
  ],
});
const erros = [];
async function aba(nome, w, h) {
  const ctx = await navegador.newContext({ viewport: { width: w, height: h } });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => erros.push(`[${nome}] ${e.message}`));
  pg.on('console', (m) => m.type() === 'error' && erros.push(`[${nome}] ${m.text()}`));
  await pg.goto(url);
  try {
    await pg.waitForFunction(() => window.__sobrevivencia, null, { timeout: 60000 });
  } catch (e) {
    console.log(`[${nome}] não carregou:`, erros.join('\n'));
    throw e;
  }
  return pg;
}
const ok = (cond, msg) => {
  console.log(`${cond ? 'OK  ' : 'FALHOU'} ${msg}`);
  if (!cond) process.exitCode = 1;
};

const A = await aba('anfitrião', 960, 600);
const B = await aba('convidado', 960, 600);
await A.evaluate(() => window.__sobrevivencia.personagem('claude'));
await B.evaluate(() => window.__sobrevivencia.personagem('gemini'));

await A.evaluate(() => window.__sobrevivencia.mpCriarSala());
const convite = await A.evaluate(() => window.__sobrevivencia.mpConvite());
ok(convite.startsWith('C'), `código de convite gerado (${convite.length} caracteres)`);
const resposta = await B.evaluate((c) => window.__sobrevivencia.mpEntrar(c), convite);
ok(resposta.startsWith('C'), `código de resposta gerado (${resposta.length} caracteres)`);
await A.evaluate((r) => window.__sobrevivencia.mpAceitar(r), resposta);
await B.waitForFunction(() => window.__sobrevivencia.mpSala()?.meuIndice === 1, null, {
  timeout: 15000,
});
await A.waitForFunction(() => window.__sobrevivencia.mpSala()?.membros.length === 2);
await B.waitForTimeout(500);
const salaA = await A.evaluate(() => window.__sobrevivencia.mpSala());
ok(
  salaA.membros.some((m) => m.indice === 1 && m.personagem === 'gemini'),
  'anfitrião vê o convidado com o personagem que ele escolheu'
);
await A.screenshot({ path: join(saida, 'mp-sala.png') });

await A.evaluate(() => window.__sobrevivencia.mpIniciar());
await B.waitForFunction(() => window.__sobrevivencia.estado().estado === 'jogando', null, {
  timeout: 10000,
});
ok(true, 'a partida começou nos dois aparelhos');
await A.evaluate(() => window.__sobrevivencia.invencivel(9999));

// cada um anda para um lado
await A.keyboard.down('KeyD');
await B.keyboard.down('KeyA');
await A.waitForTimeout(2500);
await A.keyboard.up('KeyD');
await B.keyboard.up('KeyA');
await A.waitForTimeout(800);
const jA = await A.evaluate(() => window.__sobrevivencia.mpJogadores());
const jB = await B.evaluate(() => window.__sobrevivencia.mpJogadores());
console.log('anfitrião vê:', JSON.stringify(jA));
console.log('convidado vê:', JSON.stringify(jB));
const convidadoEmA = jA.find((j) => j.indice === 1);
const convidadoEmB = jB.find((j) => j.indice === 1);
ok(
  Math.abs(convidadoEmA.x - convidadoEmB.x) < 1.5 && convidadoEmB.x < -1,
  'o anfitrião vê o convidado andando para a esquerda'
);
const anfEmA = jA.find((j) => j.indice === 0);
const anfEmB = jB.find((j) => j.indice === 0);
ok(
  Math.abs(anfEmA.x - anfEmB.x) < 1.5 && anfEmA.x > 1,
  'o convidado vê o anfitrião andando para a direita'
);

// os inimigos chegam ao convidado (SwiftShader com duas abas é lento: espera o relógio do jogo)
await A.waitForFunction((t) => window.__sobrevivencia.estado().tempo >= t, segundos, {
  timeout: 240000,
  polling: 500,
});
await A.waitForTimeout(400);
const eA = await A.evaluate(() => window.__sobrevivencia.estado());
const eB = await B.evaluate(() => window.__sobrevivencia.estado());
console.log(
  `inimigos: anfitrião ${eA.inimigos}, convidado ${eB.inimigos}; tempo ${eA.tempo.toFixed(1)} / ${eB.tempo.toFixed(1)}`
);
ok(
  eA.inimigos > 0 && Math.abs(eA.inimigos - eB.inimigos) <= Math.max(4, eA.inimigos * 0.25),
  'inimigos sincronizados'
);
ok(Math.abs(eA.tempo - eB.tempo) < 1, 'relógio da partida sincronizado');
await A.screenshot({ path: join(saida, 'mp-anfitriao.png') });
await B.screenshot({ path: join(saida, 'mp-convidado.png') });

// subir de nível em grupo: cada um escolhe a sua carta
await A.evaluate(() => window.__sobrevivencia.xp(12));
await B.waitForFunction(() => window.__sobrevivencia.estado().estado === 'nivel', null, {
  timeout: 5000,
});
ok(true, 'o nível abriu para os dois');
const ofB = await B.evaluate(() => window.__sobrevivencia.estado().ofertas);
ok(ofB.length >= 3, `o convidado recebeu as próprias cartas (${ofB.map((o) => o.id).join(', ')})`);
await B.screenshot({ path: join(saida, 'mp-nivel-convidado.png') });
await B.evaluate(() => window.__sobrevivencia.mpEscolher(0));
await A.waitForTimeout(500);
ok(
  (await A.evaluate(() => window.__sobrevivencia.estado().estado)) === 'nivel',
  'o jogo espera o anfitrião escolher'
);
await A.screenshot({ path: join(saida, 'mp-nivel-anfitriao.png') });
await A.evaluate(() => window.__sobrevivencia.mpEscolher(0));
await B.waitForFunction(() => window.__sobrevivencia.estado().estado === 'jogando', null, {
  timeout: 5000,
});
const depois = await A.evaluate(() => window.__sobrevivencia.mpJogadores());
ok(
  depois.every(
    (j) => j.ativas.length + j.passivas.length >= 2 || j.ativas.some((a) => a.endsWith(':2'))
  ),
  `builds atualizadas: ${depois.map((j) => [...j.ativas, ...j.passivas].join('+')).join(' | ')}`
);
const depoisB = await B.evaluate(() => window.__sobrevivencia.mpJogadores());
ok(
  JSON.stringify(depois.map((j) => j.ativas)) === JSON.stringify(depoisB.map((j) => j.ativas)),
  'as duas telas concordam com as builds'
);

// convidado cai e é levantado pelo anfitrião
await A.evaluate(() => window.__sobrevivencia.invencivel(0));
await A.waitForTimeout(2000);
await A.screenshot({ path: join(saida, 'mp-final-anfitriao.png') });
await B.screenshot({ path: join(saida, 'mp-final-convidado.png') });

console.log(
  erros.length ? '--- erros:\n' + erros.slice(0, 20).join('\n') : 'console limpo nos dois aparelhos'
);
await navegador.close();
