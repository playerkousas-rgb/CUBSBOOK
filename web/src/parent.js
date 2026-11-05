/* ==========================================================================
   家長模式（Parent Mode · 第二部手機只讀鏡像）
   --------------------------------------------------------------------------
   設計：一個後端（cubbadge）＋ 兩部前端手機（BOOK）。孩子一部負責填寫，
   家長另一部只讀查看同一成員的進度。目的是讓用戶明白同一後端可同時接
   兩部手機，而不是「一本簿 = 一部手機」。

   兩條取得資料的路徑，兩者都只會「由 BADGE／孩子 單向落到 BOOK」：
     A. 掃描孩子出示的 `CB1` 二維碼（離線、免登入、免 BADGE）
     B. 用孩子的 cubbadge 帳戶連接（旅團＋SCOUT ID＋密碼），
        一次過匯出 BADGE 內所有已核實進度

   家長模式鐵律：
     - 只讀：不改欄位、不簽名、不剔選
     - 只「由 BADGE 匯出到 BOOK」，永不向 BADGE 匯入（不送 pending）
     - 鏡像獨立儲存，不覆蓋這部手機上其他紀錄冊
   ========================================================================== */

// 相對路徑匯入：讓 Node 測試可直接載入本模組，毋須額外 alias。
import { newBook, toBookId, ITEM_INDEX, OTHER_BADGES, importFromBadge } from '../../shared/book.js';
import { KIND_MEMBER } from '../../shared/transfer.js';

export const PARENT_FLAG_KEY = 'cubbook.parent.v1';
export const PARENT_BOOK_KEY = 'cubbook.parent.book.v1';
export const PARENT_SESSION_KEY = 'cubbook.parent.session.v1';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

const readRaw = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRaw = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* 無痕模式：只維持本次記憶體狀態 */
  }
};

export function isParent() {
  return readRaw(PARENT_FLAG_KEY) === '1';
}

export function enterParentMode() {
  writeRaw(PARENT_FLAG_KEY, '1');
  emit();
}

/** 退出家長模式：預設同時清走鏡像與 token，避免留下孩子的資料。 */
export function exitParentMode({ keepMirror = false } = {}) {
  writeRaw(PARENT_FLAG_KEY, null);
  writeRaw(PARENT_SESSION_KEY, null);
  if (!keepMirror) writeRaw(PARENT_BOOK_KEY, null);
  emit();
}

export function onParentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* ---------------------------------------------------------------- 鏡像 */

export function loadParentBook() {
  const raw = readRaw(PARENT_BOOK_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.member || !parsed.pages) return null;
    return newBook(parsed);
  } catch {
    return null;
  }
}

export function saveParentBook(book) {
  if (!book) {
    writeRaw(PARENT_BOOK_KEY, null);
    return;
  }
  writeRaw(PARENT_BOOK_KEY, JSON.stringify(book));
  emit();
}

export function clearParentBook() {
  writeRaw(PARENT_BOOK_KEY, null);
  emit();
}

/* ------------------------------------------------------- 家長 BADGE session */

export function loadParentSession() {
  const raw = readRaw(PARENT_SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s && s.troopId && s.ymis ? s : null;
  } catch {
    return null;
  }
}

export function saveParentSession(session) {
  writeRaw(PARENT_SESSION_KEY, session ? JSON.stringify(session) : null);
}

export function clearParentSession() {
  writeRaw(PARENT_SESSION_KEY, null);
}

/* --------------------------------------------------- 由 BADGE 建立只讀鏡像 */

export function mirrorFromBadge(json, session) {
  if (!json || typeof json !== 'object') throw new Error('cubbadge 回應格式不正確');
  const ymis = String(session?.ymis || '').trim();
  if (!ymis) throw new Error('缺少 SCOUT ID，無法對齊 cubbadge 進度');

  const base = newBook({ member: { scoutId: ymis, memberNo: ymis } });
  const res = importFromBadge(json, base, { expectedScoutId: ymis });
  const next = res.book;
  next.meta = {
    ...(next.meta || {}),
    parent: {
      source: 'badge',
      troopId: session?.troopId || '',
      troopName: session?.troopName || '',
      ymis,
      syncedAt: new Date().toISOString(),
      imported: res.imported,
      skippedPending: res.skippedPending || 0,
    },
  };
  return { book: next, imported: res.imported, skippedPending: res.skippedPending || 0 };
}

/* ---------------------------------------------- 由孩子 QR 建立只讀鏡像 */

export function mirrorFromTransfer(payload) {
  if (!payload || payload.t !== KIND_MEMBER) {
    throw new Error('這個二維碼不是成員分享的紀錄冊');
  }
  const book = newBook({ member: payload.member || {} });
  if (!book.member.scoutId && payload.scoutId) book.member.scoutId = payload.scoutId;

  let imported = 0;
  Object.entries(payload.progress || {}).forEach(([rawId, entry]) => {
    const id = toBookId(rawId);
    if (!ITEM_INDEX[id] || !entry?.date) return;
    book.progress[id] = {
      ...book.progress[id],
      date: entry.date,
      assessor: entry.assessor || '',
      cert: entry.cert || '',
      verified: true,
    };
    imported += 1;
  });

  Object.entries(payload.otherBadges || {}).forEach(([rawId, entry]) => {
    const id = toBookId(rawId);
    if (!OTHER_BADGES.some((b) => b.id === id) || !entry?.date) return;
    book.otherBadges[id] = {
      ...book.otherBadges[id],
      date: entry.date,
      cert: entry.cert || '',
      verified: true,
    };
    imported += 1;
  });

  if (Array.isArray(payload.renewals)) book.renewals = payload.renewals;
  Object.entries(payload.awards || {}).forEach(([awardId, row]) => {
    book.pages[`award_${awardId}`] = { ...(book.pages[`award_${awardId}`] || {}), ...row };
  });
  if (payload.investiture) book.pages.p15 = { ...(book.pages.p15 || {}), ...payload.investiture };

  book.meta = {
    ...(book.meta || {}),
    parent: {
      source: 'qr',
      ymis: book.member?.scoutId || payload.scoutId || '',
      syncedAt: payload.at || new Date().toISOString(),
      imported,
      skippedPending: 0,
    },
  };
  return { book, imported };
}

/** 家長模式的固定宣示字串（測試與介面共用，避免文案漂移）。 */
export const PARENT_NOTICE = {
  zh: '家長模式：只讀。只可從 cubbadge／孩子的二維碼匯出到這部手機，永不向 cubbadge 匯入或提交。',
  en: 'Parent mode: read-only. Data can only be exported from cubbadge / your child’s QR into this phone; nothing is ever imported into cubbadge.',
};
