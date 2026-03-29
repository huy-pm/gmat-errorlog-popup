import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    publicDir: 'public',
    build: {
        // Disable module preload polyfill - not needed in extension context
        modulePreload: false,
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/index.html'),
                'side-panel': resolve(__dirname, 'src/side-panel/index.html'),
                background: resolve(__dirname, 'src/background/index.ts'),
                content: resolve(__dirname, 'src/content/index.ts')
            },
            output: {
                entryFileNames: 'src/[name]/index.js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]'
            }
        },
        outDir: 'dist',
        emptyOutDir: true,
        copyPublicDir: true
    },
    resolve: {
        alias: {
            '@gmat-extraction/core': resolve(__dirname, '../core/src/index.ts'),
            '@gmat-hero-autoscraping/utils': resolve(__dirname, '../../../gmat-hero-autoscraping/gmat-hero-utils.js'),
            '@gmat-hero-autoscraping/extractors': resolve(__dirname, '../../../gmat-hero-autoscraping/extractors')
        }
    }
});
