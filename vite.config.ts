import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'node:url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'firebase/app',
        'firebase/firestore',
        'firebase/auth',
        'html2canvas',
        'jspdf',
        'jszip',
        'motion'
      ]
    },
    build: {
      chunkSizeWarningLimit: 1200,
      // PATCH 017H : aucun asset CSS eclate ; les styles sont embarques en JS.
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas') || id.includes('node_modules/jszip')) {
              return 'vendor-export-tools';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
              return 'vendor-charts';
            }
            if (id.includes('node_modules/@techstark/opencv-js') || id.includes('opencv.js')) {
              return 'vendor-opencv';
            }
            if (id.includes('node_modules/tesseract.js')) {
              return 'vendor-tesseract';
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      },
    },
    server: {
      allowedHosts: Array.from(
        new Set([
          'localhost',
          '127.0.0.1',
          'ais-dev-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app',
          'ais-pre-6etwlfzn4irzgw5ljyhzsh-76486687314.europe-west2.run.app',
          ...(process.env.NG_ALLOWED_HOSTS
            ? process.env.NG_ALLOWED_HOSTS.split(',').map((h) => h.trim()).filter(Boolean)
            : []),
          ...(process.env.APP_URL
            ? (() => {
                try {
                  return [new URL(process.env.APP_URL).hostname];
                } catch {
                  return [];
                }
              })()
            : []),
        ])
      ),
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
