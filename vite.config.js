import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cubbadgeHandler from './api/cubbadge.js';

const root = path.dirname(fileURLToPath(import.meta.url));

/** 本機開發／預覽提供與 Vercel `api/leader.js` 及 `api/cubbadge.js` 相同的伺服器端接口 */
function leaderDevPlugin() {
  const attach = (middlewares) => {
    middlewares.use('/api/cubbadge', (req, res) => {
      cubbadgeHandler(req, res);
    });
    middlewares.use('/api/leader', (req, res) => {
      // 與 api/leader.js 一致：未設定 LEADER_CODE 即視為未啟用（本機開發可容許 1234 方便測試）
      const expected = String(process.env.LEADER_CODE || (process.env.VERCEL ? '' : '1234')).trim();
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');

      if (req.method === 'GET') {
        res.statusCode = 200;
        res.end(JSON.stringify({ enabled: expected.length > 0 }));
        return;
      }

      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'method' }));
        return;
      }

      if (!expected) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'unset' }));
        return;
      }

      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        let body = {};
        try {
          body = JSON.parse(raw || '{}');
        } catch {
          body = {};
        }
        const given = String(body?.code ?? '').trim();
        if (!given) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'empty' }));
          return;
        }
        const sameLength = given.length === expected.length;
        const a = Buffer.from(sameLength ? given : '');
        const b = Buffer.from(expected);
        const ok = sameLength && a.length === b.length && crypto.timingSafeEqual(a, b);
        res.statusCode = ok ? 200 : 401;
        res.end(JSON.stringify(ok ? { ok: true } : { error: 'wrong' }));
      });
    });
  };

  return {
    name: 'cubbook-api',
    configureServer(server) {
      attach(server.middlewares);
    },
    configurePreviewServer(server) {
      attach(server.middlewares);
    },
  };
}

export default defineConfig({
  root: path.join(root, 'web'),
  plugins: [react(), leaderDevPlugin()],
  resolve: {
    alias: { '@shared': path.join(root, 'shared') },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    fs: { allow: [root] },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    outDir: path.join(root, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react')) return 'vendor-react';
          if (id.includes('node_modules/qrcode') || id.includes('node_modules/jsqr') || id.includes('node_modules/dijkstrajs')) {
            return 'vendor-qr';
          }
          return undefined;
        },
      },
    },
  },
});
