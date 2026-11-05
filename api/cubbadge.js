/* ==========================================================================
   Vercel Serverless Function — GET / POST /api/cubbadge
   --------------------------------------------------------------------------
   個人電子紀錄冊（CUBBOOK）與旅團進度系統（cubbadge）純進度互通橋接：
   1. 零個人資料：只處理 SCOUT ID／YMIS、項目代號及日期。伺服器端硬性剝除姓名、電話、
      地址、家長／監護人資料、相片及任何其他成員的紀錄。
   2. BADGE → BOOK（action = 'load'）：只回傳該成員在 cubbadge 內「領袖已核實」的
      `progress` / `flatProgress` / `otherBadges`；`pendingRequests` 只列出作識別，未核實
      項目絕不混入已核實進度。
   3. BOOK → BADGE（action = 'submitPending'）：硬性封鎖 `save` / `saveOtherBadge`（HTTP 403），
      一律只轉發 `requestComplete`，在 cubbadge 內寫入「待批完成 status: pending」；
      必須由團長在 cubbadge 按 CONFIRM 方為完成。
   4. 零金鑰：旅團下拉選單由 `CUBBADGE_ORIGIN` 的 `GET /api/troops` 自動讀取，業務請求
      經 `POST /api/proxy` 轉發；BOOK 不存放任何 Google Sheet URL 或 API Key。
   ========================================================================== */

import { toBadgeId, ITEM_INDEX, toBookId } from '../shared/syllabus.js';

const DEFAULT_BADGE_ORIGIN = 'https://cubbadge.vercel.app';
const EXEC_URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{10,}\/exec\/?$/i;
const TEST_LOCAL_RE = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/[A-Za-z0-9._~\-/?=&%]*)?$/;
const ALLOWED_ACTIONS = new Set(['login', 'logout', 'load', 'submitPending']);
const FORBIDDEN_ACTIONS = new Set(['save', 'saveOtherBadge', 'reviewRequest', 'approveRequest', 'rejectRequest']);
const MAX_BODY_BYTES = 512 * 1024;
const TIMEOUT_MS = 30000;
const MAX_ITEMS = 200;

export function resolveBadgeOrigin() {
  const raw = String(process.env.CUBBADGE_ORIGIN || DEFAULT_BADGE_ORIGIN).trim();
  try {
    const u = new URL(raw);
    if (u.username || u.password) return DEFAULT_BADGE_ORIGIN;
    if (u.protocol === 'https:') return u.origin;
    if (
      process.env.CUBBOOK_PROXY_TEST === '1' &&
      process.env.VERCEL !== '1' &&
      (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
    ) {
      return u.origin;
    }
  } catch {
    /* fallback below */
  }
  return DEFAULT_BADGE_ORIGIN;
}

function normalizeGasUrl(url) {
  const raw = String(url ?? '').trim();
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (
      u.protocol !== 'https:' ||
      u.hostname !== 'script.google.com' ||
      u.search ||
      u.hash ||
      u.username ||
      u.password ||
      u.port
    ) {
      return raw;
    }
    const m = u.pathname.match(/^\/a\/[^/]+\/macros\/s\/([A-Za-z0-9_-]+)\/exec\/?$/);
    return m ? `https://script.google.com/macros/s/${m[1]}/exec` : raw;
  } catch {
    return raw;
  }
}

function isTrustedGasUrl(url) {
  if (typeof url !== 'string' || url.length > 300) return false;
  if (EXEC_URL_RE.test(normalizeGasUrl(url))) return true;
  if (process.env.CUBBOOK_PROXY_TEST === '1' && process.env.VERCEL !== '1' && TEST_LOCAL_RE.test(url.trim())) {
    return true;
  }
  return false;
}

function getLocalTroopRegistry() {
  const ids = new Set();
  for (const key of Object.keys(process.env)) {
    const m = key.match(/^TROOP_([0-9A-Za-z_-]{1,32})_(NAME|EN|BACKEND|APIKEY)$/);
    if (m) ids.add(m[1]);
  }
  const out = Object.create(null);
  for (const id of ids) {
    const name = String(process.env[`TROOP_${id}_NAME`] || '').trim();
    const en = String(process.env[`TROOP_${id}_EN`] || '').trim();
    const backend = normalizeGasUrl(process.env[`TROOP_${id}_BACKEND`] || '');
    const apikey = String(process.env[`TROOP_${id}_APIKEY`] || '').trim();
    if (name && apikey && backend && isTrustedGasUrl(backend)) {
      out[id] = { id, name, en, backend: backend.replace(/\/$/, ''), apikey };
    }
  }
  return out;
}

function sameId(a, b) {
  const x = String(a ?? '').trim();
  const y = String(b ?? '').trim();
  if (!x || !y) return false;
  if (x.toLowerCase() === y.toLowerCase()) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return x.padStart(10, '0') === y.padStart(10, '0');
  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_BODY_BYTES) return null;
    chunks.push(buf);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function sendJson(res, status, obj) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    res.status(status).json(obj);
  } else {
    res.statusCode = status;
    res.end(JSON.stringify(obj));
  }
}

/**
 * 只抽取該名成員自己的「領袖已核實進度」及「待領袖核實清單」。
 * 輸出不含姓名、電話、地址、家長資料、相片或任何其他成員的紀錄。
 */
export function filterPersonalConfirmedLoad(raw, targetYmis) {
  if (!raw || typeof raw !== 'object') return { success: false, error: '無效回應' };
  if (!raw.success) return { success: false, error: String(raw.error || '讀取進度失敗') };

  const cleanTarget = String(targetYmis || '').trim();
  if (!cleanTarget) return { success: false, error: '缺少童軍成員編號（SCOUT ID）' };

  const confirmedItems = {};
  const collectFrom = (source) => {
    if (!source || typeof source !== 'object') return;
    for (const [ymis, items] of Object.entries(source)) {
      if (!sameId(ymis, cleanTarget) || !items || typeof items !== 'object') continue;
      for (const [itemId, val] of Object.entries(items)) {
        const date = typeof val === 'string' ? val : val?.date || '';
        const confirmer = typeof val === 'object' ? String(val?.confirmer || '').trim() : '';
        if (!date) continue;
        confirmedItems[itemId] = {
          date: String(date).slice(0, 10),
          ...(confirmer ? { confirmer: confirmer.slice(0, 60) } : {}),
        };
      }
    }
  };
  collectFrom(raw.flatProgress);
  collectFrom(raw.progress);

  const confirmedOther = {};
  if (raw.otherBadges && typeof raw.otherBadges === 'object') {
    for (const [ymis, map] of Object.entries(raw.otherBadges)) {
      if (!sameId(ymis, cleanTarget) || !map || typeof map !== 'object') continue;
      for (const [badgeId, val] of Object.entries(map)) {
        const date = typeof val === 'string' ? val : val?.date || '';
        const cert = typeof val === 'object' ? String(val?.cert || '').trim() : '';
        if (!date) continue;
        confirmedOther[badgeId] = {
          date: String(date).slice(0, 10),
          ...(cert ? { cert: cert.slice(0, 60) } : {}),
        };
      }
    }
  }

  const pendingRequests = [];
  if (Array.isArray(raw.pendingRequests)) {
    for (const req of raw.pendingRequests) {
      if (!req || typeof req !== 'object') continue;
      if (!sameId(req.ymis, cleanTarget)) continue;
      if (String(req.status || 'pending').toLowerCase() === 'approved') continue;
      pendingRequests.push({
        ymis: cleanTarget,
        item_id: String(req.item_id || req.itemId || '').trim(),
        requested_date: String(req.requested_date || '').slice(0, 10),
        status: 'pending',
      });
    }
  }

  return {
    success: true,
    privacy: 'progress-only',
    scoutId: cleanTarget,
    progress: { [cleanTarget]: confirmedItems },
    otherBadges: { [cleanTarget]: confirmedOther },
    pendingRequests,
  };
}

/**
 * 清洗成員送交 cubbadge「待領袖核實」的申報項目：只保留項目代號及日期，
 * 任何姓名、電話、地址、家長資料或相片欄位一律丟棄；BOOK 內部編號亦在此轉為
 * cubbadge 官方編號，確保 BADGE 毋須認識 BOOK 的命名。
 */
function isIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function sanitizePendingSubmissions(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const rawId = String(it.itemId || it.item_id || it.id || '').trim().slice(0, 64);
    const itemId = toBadgeId(rawId);
    const date = String(it.date || it.requested_date || '').trim().slice(0, 10);
    if (!itemId || !isIsoDate(date)) continue;
    const key = `${itemId}@${date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const official = ITEM_INDEX[toBookId(itemId)];
    out.push({
      itemId,
      itemName:
        String(it.itemName || it.item_name || official?.name || itemId)
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120),
      requested_date: date,
      evidence: String(it.evidence || '由 CUBBOOK 個人電子紀錄冊申報（待領袖核實）')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

async function callBadgeAction({ origin, directTroop, troopId, action, data }) {
  if (directTroop) {
    let up;
    if (action === 'load') {
      const qs = new URLSearchParams({ action: 'load', apikey: directTroop.apikey, token: data.token });
      up = await fetch(`${directTroop.backend}?${qs.toString()}`, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } else {
      up = await fetch(directTroop.backend, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...data, action, apikey: directTroop.apikey }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    }
    return up.json().catch(() => null);
  }

  // cubbadge 的同源 /api/proxy 契約：扁平 payload（action 與資料同一層），由 proxy 注入 apikey。
  const up = await fetch(`${origin}/api/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' },
    body: JSON.stringify({ troopId, action, ...data }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return up.json().catch(() => null);
}

export default async function handler(req, res) {
  const origin = resolveBadgeOrigin();
  const localRegistry = getLocalTroopRegistry();

  if (req.method === 'GET') {
    const troops = Object.create(null);
    for (const [id, t] of Object.entries(localRegistry)) {
      troops[id] = { name: t.name, ...(t.en ? { en: t.en } : {}) };
    }
    try {
      const up = await fetch(`${origin}/api/troops`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (up.ok) {
        const json = await up.json().catch(() => null);
        if (json?.troops && typeof json.troops === 'object') {
          for (const [id, info] of Object.entries(json.troops)) {
            if (!troops[id] && info && typeof info === 'object' && info.name) {
              troops[id] = { name: String(info.name), ...(info.en ? { en: String(info.en) } : {}) };
            }
          }
        }
      }
    } catch {
      /* 離線時仍回傳本機設定 */
    }
    return sendJson(res, 200, {
      success: true,
      origin,
      privacy: 'progress-only',
      troops,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { success: false, error: '只支援 GET 或 POST' });
  }

  const body = await readBody(req);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return sendJson(res, 400, { success: false, error: '請求格式錯誤' });
  }

  const action = String(body.action || '').trim();
  const troopId = String(body.troopId || '').trim();
  const rawData = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};

  if (FORBIDDEN_ACTIONS.has(action)) {
    return sendJson(res, 403, {
      success: false,
      code: 'FORBIDDEN_WRITE',
      error:
        'CUBBOOK 絕不直接寫入已核實進度或個人資料；所有由紀錄冊送出的進度一律經 requestComplete 變成「待領袖核實（pending）」，由團長在 cubbadge 按 CONFIRM。',
    });
  }
  if (!ALLOWED_ACTIONS.has(action)) {
    return sendJson(res, 403, {
      success: false,
      error: 'CUBBOOK 不允許此操作；只准 login、logout、load 及 submitPending（轉發 requestComplete）。',
    });
  }
  if (!/^[0-9A-Za-z_-]{1,32}$/.test(troopId)) {
    return sendJson(res, 400, { success: false, error: '請選擇有效的旅團編號' });
  }

  const directTroop = localRegistry[troopId];

  try {
    if (action === 'login') {
      const login_id = String(rawData.login_id || '').trim().slice(0, 120);
      const password = String(rawData.password || '');
      if (!login_id || !password) {
        return sendJson(res, 400, { success: false, error: '請輸入童軍成員編號（SCOUT ID）及 cubbadge 密碼' });
      }
      const rawJson = await callBadgeAction({
        origin,
        directTroop,
        troopId,
        action: 'login',
        data: { login_id, password },
      });
      if (!rawJson || typeof rawJson !== 'object') {
        return sendJson(res, 502, { success: false, error: 'cubbadge 回應異常，請稍後重試' });
      }
      if (!rawJson.success) {
        return sendJson(res, 200, { success: false, error: String(rawJson.error || '登入失敗') });
      }
      // 不傳回姓名、電郵或角色，只保留 ymis 編號與 token。
      return sendJson(res, 200, {
        success: true,
        token: rawJson.token,
        ymis: String(rawJson.user?.ymis || login_id).trim(),
      });
    }

    const token = String(rawData.token || '').trim();
    if (token.length < 4 || token.length > 4096) {
      return sendJson(res, 401, { success: false, error: '尚未登入 cubbadge 或登入已過期' });
    }

    if (action === 'logout') {
      const rawJson = await callBadgeAction({ origin, directTroop, troopId, action: 'logout', data: { token } });
      return sendJson(res, 200, rawJson || { success: true });
    }

    if (action === 'load') {
      const ymis = String(rawData.ymis || '').trim().slice(0, 32);
      if (!ymis) return sendJson(res, 400, { success: false, error: '缺少童軍成員編號（SCOUT ID）' });
      const rawJson = await callBadgeAction({ origin, directTroop, troopId, action: 'load', data: { token } });
      if (!rawJson || typeof rawJson !== 'object') {
        return sendJson(res, 502, { success: false, error: 'cubbadge 後端回應異常' });
      }
      return sendJson(res, 200, filterPersonalConfirmedLoad(rawJson, ymis));
    }

    if (action === 'submitPending') {
      const ymis = String(rawData.ymis || '').trim().slice(0, 32);
      const items = sanitizePendingSubmissions(rawData.items);
      if (!ymis) return sendJson(res, 400, { success: false, error: '缺少童軍成員編號（SCOUT ID）' });
      if (!items.length) return sendJson(res, 400, { success: false, error: '沒有需要送交待核實的新進度項目' });

      let submitted = 0;
      const failed = [];
      for (const item of items) {
        // 強制只呼叫 requestComplete：cubbadge 內寫入「待批完成（status: pending）」。
        const resJson = await callBadgeAction({
          origin,
          directTroop,
          troopId,
          action: 'requestComplete',
          data: {
            token,
            ymis,
            itemId: item.itemId,
            itemName: item.itemName,
            requested_date: item.requested_date,
            evidence: item.evidence,
          },
        });
        if (resJson?.success) submitted += 1;
        else failed.push({ itemId: item.itemId, error: String(resJson?.error || '提交失敗') });
      }

      return sendJson(res, 200, {
        success: submitted > 0 || failed.length === 0,
        status: 'pending',
        confirmed: false,
        submitted,
        failed,
        ...(failed.length && submitted === 0 ? { error: failed[0].error } : {}),
      });
    }

    return sendJson(res, 400, { success: false, error: '不支援的操作' });
  } catch (e) {
    const timeout = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    return sendJson(res, timeout ? 504 : 502, {
      success: false,
      error: timeout ? '連接 cubbadge 逾時，請稍後重試' : '暫時無法連接 cubbadge 後端，請稍後重試',
    });
  }
}
