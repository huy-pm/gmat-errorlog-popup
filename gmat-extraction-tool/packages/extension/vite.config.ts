import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    publicDir: 'public',
    build: {
        rollupOptions: {
            input: {
                popup: resolve(__dirname, 'src/popup/index.html'),
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
            '@gmat-extraction/core': resolve(__dirname, '../core/src/index.ts')
        }
    }
});
