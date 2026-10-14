#!/usr/bin/env node
/**
 * Converte dist/index.html (arquivo único) no formato de página publicada como Artefato:
 * sem <!doctype>, <html>, <head> e <body> (a hospedagem envolve a página), com <title>
 * no início e o meta de margens laterais seguras.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const entrada = readFileSync('dist/index.html', 'utf8');
const cabeca = entrada.match(/<head>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const corpo = entrada.match(/<body>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const titulo = cabeca.match(/<title>[\s\S]*?<\/title>/i)?.[0] ?? '<title>Centelha das Ideias</title>';
const semMetasRepetidas = cabeca
  .replace(/<meta charset[^>]*>/i, '')
  .replace(/<meta\s+name="viewport"[\s\S]*?\/>/i, '')
  .replace(/<title>[\s\S]*?<\/title>/i, '');
const saida = [
  titulo,
  '<meta name="claude:viewport-fit-sides" content="cover" />',
  semMetasRepetidas.trim(),
  corpo.trim(),
].join('\n');
writeFileSync('dist/artefato.html', saida);
console.log(`dist/artefato.html: ${(saida.length / 1024).toFixed(1)} KB`);
