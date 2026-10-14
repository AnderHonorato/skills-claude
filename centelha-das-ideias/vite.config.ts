import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Compilação em arquivo único: o jogo inteiro (código, estilos e fonte) fica dentro de
// dist/index.html, abrindo inclusive direto do disco e sem depender de rede após carregar.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4000,
  },
  server: { strictPort: true },
});
