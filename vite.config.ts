import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function downloadOfflinePlugin(): Plugin {
  return {
    name: 'download-offline-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const validUrls = ['/download', '/download-offline-html', '/download-offline.html', '/hexnode-idp-domain-offline.html', '/offline.html'];
        if (validUrls.includes(req.url || '')) {
          const filePath = path.resolve(__dirname, 'hexnode-idp-domain-offline.html');
          if (fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="hexnode-idp-domain-offline.html"');
            const content = fs.readFileSync(filePath);
            return res.end(content);
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), downloadOfflinePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
