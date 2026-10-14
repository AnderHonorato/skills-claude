import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['testes/unidade/**/*.teste.ts'],
    environment: 'node',
  },
});
