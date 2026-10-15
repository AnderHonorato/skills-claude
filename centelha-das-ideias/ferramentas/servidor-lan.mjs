#!/usr/bin/env node
/**
 * Servidor de rede local para jogar junto no mesmo Wi-Fi sem trocar códigos.
 *
 * Uso (no computador ligado ao Wi-Fi):
 *   pnpm compilar && pnpm lan          # porta 8080 (ou PORTA=9000 pnpm lan)
 *
 * Ele mostra o endereço (ex.: http://192.168.0.12:8080). Todo mundo abre esse
 * endereço no celular ou no PC: uma pessoa toca em "Criar sala" e as outras em
 * "Entrar". O servidor só repassa mensagens; a partida roda no aparelho de quem criou.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const arquivo = join(raiz, 'dist', 'index.html');
const porta = Number(process.env.PORTA || 8080);

if (!existsSync(arquivo)) {
  console.error('Não achei dist/index.html. Rode antes: pnpm compilar');
  process.exit(1);
}

function enderecosLocais() {
  const r = [];
  for (const lista of Object.values(networkInterfaces()))
    for (const i of lista ?? []) if (i.family === 'IPv4' && !i.internal) r.push(i.address);
  return r;
}

const enderecos = enderecosLocais();
const principal = `http://${enderecos[0] ?? 'localhost'}:${porta}`;

const servidor = createServer((req, res) => {
  if (req.url === '/' || req.url?.startsWith('/?') || req.url?.startsWith('/index.html')) {
    const html = readFileSync(arquivo, 'utf8').replace(
      '<head>',
      `<head><meta name="centelha-lan" content="${principal}">`
    );
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
    return;
  }
  res.writeHead(404);
  res.end('não encontrado');
});

const wss = new WebSocketServer({ server: servidor, path: '/rede' });
let anfitriao = null;
let proximoId = 1;
const convidados = new Map();

function mandar(ws, obj) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
}

wss.on('connection', (ws) => {
  let papel = null;
  let id = 0;
  ws.on('message', (bruto) => {
    let d;
    try {
      d = JSON.parse(String(bruto));
    } catch {
      return;
    }
    if (!papel) {
      if (d.lan === 'anfitriao') {
        if (anfitriao) mandar(anfitriao, { lan: 'substituido' });
        anfitriao = ws;
        papel = 'anfitriao';
        console.log('Sala criada.');
        for (const [cid, c] of convidados) {
          // quem já estava esperando entra na nova sala
          mandar(anfitriao, { lan: 'entrou', id: cid });
          mandar(c, { lan: 'aceito' });
        }
      } else if (d.lan === 'convidado') {
        papel = 'convidado';
        id = proximoId++;
        convidados.set(id, ws);
        if (!anfitriao) mandar(ws, { lan: 'sem-anfitriao' });
        else {
          mandar(anfitriao, { lan: 'entrou', id });
          mandar(ws, { lan: 'aceito' });
          console.log(`Jogador ${id} entrou.`);
        }
      }
      return;
    }
    if (d.lan !== 'msg') return;
    if (papel === 'anfitriao') mandar(convidados.get(d.para), { lan: 'msg', m: d.m });
    else mandar(anfitriao, { lan: 'msg', id, m: d.m });
  });
  ws.on('close', () => {
    if (papel === 'anfitriao' && anfitriao === ws) {
      anfitriao = null;
      for (const c of convidados.values()) c.close();
      console.log('A sala foi fechada.');
    } else if (papel === 'convidado') {
      convidados.delete(id);
      mandar(anfitriao, { lan: 'saiu', id });
    }
  });
});

servidor.listen(porta, '0.0.0.0', () => {
  console.log('\nClaude — Sobrevivência · rede local');
  console.log('Abra em todos os aparelhos do mesmo Wi-Fi:');
  for (const e of enderecos) console.log(`  http://${e}:${porta}`);
  console.log('\nUma pessoa toca em "Criar sala"; as outras, em "Entrar".  (Ctrl+C para parar)\n');
});
