/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

const alias = (name: string) => fileURLToPath(new URL(`./src/${name}`, import.meta.url));

export default defineConfig({
  // Relative base so the built site works from any sub-path (itch.io, Pages, local file server).
  base: './',
  resolve: {
    alias: {
      '@engine': alias('engine'),
      '@content': alias('content'),
      '@render': alias('render'),
      '@ui': alias('ui'),
      '@save': alias('save'),
      '@app': alias('app'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    // The rules engine is pure TypeScript: tests run in Node with no DOM.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
