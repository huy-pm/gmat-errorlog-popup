import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'GMATLogger',
            fileName: 'bookmarklet',
            formats: ['iife']
        },
        outDir: 'dist',
        emptyOutDir: true
    },
    resolve: {
        alias: {
            '@gmat-extraction/core': resolve(__dirname, '../core/src/index.ts')
        }
    }
});
