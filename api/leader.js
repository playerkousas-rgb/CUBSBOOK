/* ==========================================================================
   Vercel Serverless Function — GET / POST /api/leader
   --------------------------------------------------------------------------
   領袖密碼只在伺服器比對，絕不出現在前端 bundle（對齊 ROVERBOOK v16）：
   在 Vercel → Project → Settings → Environment Variables 設定 `LEADER_CODE`（唔要 VITE_ 前綴）。

   GET  /api/leader  → { enabled: true|false }   是否已啟用領袖密碼
   POST /api/leader  → { ok: true } 或 4xx { error: 'wrong' | 'unset' | 'empty' }
   ========================================================================== */

import crypto from 'node:crypto';

const readExpected = () => String(process.env.LEADER_CODE || '').trim();

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  const expected = readExpected();

  if (req.method === 'GET') {
    res.status(200).json({ enabled: expected.length > 0 });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method' });
    return;
  }

  if (!expected) {
    res.status(503).json({ error: 'unset' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const given = String(body?.code ?? '').trim();
  if (!given) {
    res.status(400).json({ error: 'empty' });
    return;
  }

  const sameLength = given.length === expected.length;
  const a = Buffer.from(sameLength ? given : '');
  const b = Buffer.from(expected);
  const ok = sameLength && a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({ error: 'wrong' });
    return;
  }

  res.status(200).json({ ok: true });
}
