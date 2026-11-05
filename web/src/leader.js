/* ==========================================================================
   領袖模式（Leader Mode · 只讀檢視與掃描核簽）
   --------------------------------------------------------------------------
   - 普通模式（預設）：成員可填寫自己的紀錄冊並「出示二維碼」，**不能讀取**任何紀錄冊二維碼。
   - 領袖模式（只讀）：輸入伺服器端 `LEADER_CODE` 驗證通過後開啟（12 小時自動失效），
     開放「掃描／只讀查閱成員紀錄冊」及核簽功能；同時本機書頁鎖定為只讀模式，避免誤改。
   ========================================================================== */

const KEY = 'cubbook.leader.v1';
const TTL = 12 * 60 * 60 * 1000;

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function isLeader() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!at || Date.now() - at > TTL) {
      localStorage.removeItem(KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function leaderAvailable() {
  try {
    const res = await fetch('/api/leader', { headers: { accept: 'application/json' } });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.enabled);
  } catch {
    return false;
  }
}

export async function enterLeaderMode(code) {
  const given = String(code ?? '').trim();
  if (!given) return { ok: false, reason: 'wrong' };

  let res;
  try {
    res = await fetch('/api/leader', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ code: given }),
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (res.ok) {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    emit();
    return { ok: true };
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 503 || data.error === 'unset') return { ok: false, reason: 'unset' };
  return { ok: false, reason: 'wrong' };
}

export function exitLeaderMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  emit();
}

export function onLeaderChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
