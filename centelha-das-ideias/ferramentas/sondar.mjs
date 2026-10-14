#!/usr/bin/env node
/**
 * Sonda do jogo com Playwright (Chromium headless): executa passos e tira capturas.
 *
 * Uso:
 *   node ferramentas/sondar.mjs [--url URL] [--tamanho 1280x720] [--toque] [--saida pasta] \
 *     --passos "novo; esperar 500; segurar KeyD 800; foto direita.png; estado"
 *
 * Passos (separados por ';'):
 *   novo | continuar           clica no botão da tela de título (se existir) ou chama a API
 *   esperar MS                 espera em milissegundos
 *   tecla CODIGO               aperta e solta (ex.: Space, KeyE)
 *   segurar CODIGO MS          segura por MS (ex.: segurar KeyD 600)
 *   segurar2 C1 C2 MS          segura duas teclas juntas
 *   clicar X Y                 clique do mouse em coordenadas de tela
 *   mouse X Y                  move o mouse
 *   tocar X Y                  toque (touchscreen)
 *   foto ARQUIVO.png           captura de tela
 *   estado                     imprime window.__centelha.estado()
 *   js CODIGO                  avalia JavaScript na página e imprime o resultado
 *   bloco REGIAO TX TY         teleporta para bloco local da região
 *   ir ID                      teleporta para perto da entidade
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
function arg(nome, padrao) {
  const i = args.indexOf(`--${nome}`);
  return i >= 0 ? args[i + 1] : padrao;
}
const url = arg('url', 'http://127.0.0.1:5173/');
const [largura, altura] = arg('tamanho', '1280x720').split('x').map(Number);
const toque = args.includes('--toque');
const saida = arg('saida', 'testes/e2e/saida');
const passos = (arg('passos', 'novo; esperar 1000; foto inicio.png; estado') || '')
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

mkdirSync(saida, { recursive: true });
const navegador = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const contexto = await navegador.newContext({
  viewport: { width: largura, height: altura },
  deviceScaleFactor: 1,
  hasTouch: toque,
  isMobile: toque,
});
const pagina = await contexto.newPage();
const erros = [];
pagina.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') erros.push(`[${m.type()}] ${m.text()}`);
});
pagina.on('pageerror', (e) => erros.push(`[pageerror] ${e.message}`));
await pagina.goto(url, { waitUntil: 'load' });
await pagina.waitForFunction(() => window.__centelha !== undefined, null, { timeout: 15000 });
await pagina.waitForTimeout(300);

for (const passo of passos) {
  const [cmd, ...p] = passo.split(/\s+/);
  switch (cmd) {
    case 'novo':
    case 'continuar': {
      const ok = await pagina.evaluate((c) => {
        const botoes = [...document.querySelectorAll('button')];
        const alvo = botoes.find((b) =>
          (b.textContent || '').toLowerCase().includes(c === 'novo' ? 'novo' : 'continuar')
        );
        if (alvo) {
          alvo.click();
          return true;
        }
        return false;
      }, cmd);
      if (!ok)
        await pagina.evaluate(
          (c) =>
            c === 'novo' ? window.__centelha.jogo.novoJogo() : window.__centelha.jogo.continuar(),
          cmd
        );
      break;
    }
    case 'esperar':
      await pagina.waitForTimeout(Number(p[0] || 500));
      break;
    case 'tecla':
      await pagina.keyboard.press(p[0]);
      await pagina.waitForTimeout(60);
      break;
    case 'segurar':
      await pagina.keyboard.down(p[0]);
      await pagina.waitForTimeout(Number(p[1] || 300));
      await pagina.keyboard.up(p[0]);
      break;
    case 'segurar2':
      await pagina.keyboard.down(p[0]);
      await pagina.keyboard.down(p[1]);
      await pagina.waitForTimeout(Number(p[2] || 300));
      await pagina.keyboard.up(p[1]);
      await pagina.keyboard.up(p[0]);
      break;
    case 'clicar':
      await pagina.mouse.click(Number(p[0]), Number(p[1]));
      break;
    case 'mouse':
      await pagina.mouse.move(Number(p[0]), Number(p[1]));
      break;
    case 'tocar':
      await pagina.touchscreen.tap(Number(p[0]), Number(p[1]));
      break;
    case 'foto':
      await pagina.screenshot({ path: join(saida, p[0] || 'foto.png') });
      console.log(`foto: ${join(saida, p[0] || 'foto.png')}`);
      break;
    case 'estado':
      console.log(JSON.stringify(await pagina.evaluate(() => window.__centelha.estado())));
      break;
    case 'js':
      // Ferramenta local de teste: avalia de propósito o código passado na linha de comando.
      console.log(JSON.stringify(await pagina.evaluate((codigo) => eval(codigo), p.join(' '))));
      break;
    case 'bloco':
      await pagina.evaluate(
        ([r, x, y]) => window.__centelha.teleportarBloco(r, Number(x), Number(y)),
        p
      );
      break;
    case 'ir':
      await pagina.evaluate((id) => window.__centelha.irPara(id), p[0]);
      break;
    default:
      console.log(`passo desconhecido: ${passo}`);
  }
}

if (erros.length) {
  console.log('--- erros/avisos do console ---');
  for (const e of erros.slice(0, 40)) console.log(e);
} else {
  console.log('console limpo');
}
await navegador.close();
