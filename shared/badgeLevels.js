/**
 * 活動徽章的「初級／中級／高級」單一真相。
 *
 * 官方《幼童軍紀錄冊》第 21–27 頁有 7 枚活動徽章分初、中、高三行
 * （`shared/officialActivityBadges.js` 的 `LEVELED`）。BOOK 內以
 *
 *   otherBadges['OT-A26'] = { levels: { E:{date}, I:{date} }, date:'<最新一級日期>' }
 *
 * 儲存；但同一個「日期」欄位在舊資料、QR、cubbadge 匯出檔中可能以三種形式出現：
 *
 *   1. `levels` 物件（BOOK 原生）
 *   2. `level` 欄位（`{ id:'A26', level:'E', date }`，cubbadge 建議寫法）
 *   3. 後綴編號（`A26-E`，為免 cubbadge 的 items.json 出現未登記編號，只作輸入兼容）
 *
 * 本模組集中處理這三種寫法，令同步、QR 及家長鏡像不必各自再寫一次拆解邏輯。
 */

import { LEVELED, LEVEL_LABEL } from './officialActivityBadges.js';
import { OTHER_BADGES, toBadgeId, toBookId } from './syllabus.js';

/** 官方級別次序：初 → 中 → 高。 */
export const LEVEL_KEYS = ['E', 'I', 'A'];

const LEVEL_RANK = { E: 0, I: 1, A: 2 };

const LEVELED_BOOK_IDS = new Set(Object.keys(LEVELED));
const LEVELED_BADGE_IDS = new Set(Object.keys(LEVELED).map((id) => id.replace(/^OT-/, '')));

/** 是否為官方「分三級」的徽章（接受 BOOK 鍵 `OT-A26` 或 cubbadge 編號 `A26`）。 */
export function isLeveledRef(id) {
  const key = String(id || '').trim().toUpperCase();
  return LEVELED_BOOK_IDS.has(key) || LEVELED_BADGE_IDS.has(key);
}

export function isLevelKey(value) {
  return LEVEL_KEYS.includes(String(value || '').trim().toUpperCase());
}

/** `E` → `初級／Elementary`。 */
export function levelText(level, lang = 'zh') {
  const key = String(level || '').trim().toUpperCase();
  const label = LEVEL_LABEL[key];
  if (!label) return '';
  return lang === 'en' ? label.en : label.zh;
}

/** `A26-E` → `{ id: 'A26', level: 'E' }`；`A26` / `A09-CHILD-PROTECTION` → level 為空。 */
export function splitLevelRef(raw) {
  const text = String(raw ?? '').trim();
  const match = /^(.+)[-_.]([EeIiAa])$/.exec(text);
  // `A25-NATURE` 亦以 E 結尾，所以只有「本身是分級徽章」才可拆出級別。
  if (!match || !isLeveledRef(match[1])) return { id: text, level: '' };
  return { id: match[1], level: match[2].toUpperCase() };
}

/** 讀取一個徽章項目的級別資料（只回傳有日期的級別）。 */
export function levelsOf(entry) {
  const levels = entry && typeof entry === 'object' ? entry.levels : null;
  if (!levels || typeof levels !== 'object') return {};
  const out = {};
  for (const level of LEVEL_KEYS) {
    const row = levels[level];
    if (!row) continue;
    const date = String(typeof row === 'string' ? row : row.date || '').slice(0, 10);
    const next = typeof row === 'object' ? { ...row } : {};
    if (date) next.date = date;
    if (next.date || Object.keys(next).length) out[level] = next;
  }
  return out;
}

/** 一組級別日期中最新的一個（BOOK 的 `entry.date` 供舊介面／列印使用）。 */
export function latestLevelDate(levels) {
  const dates = Object.values(levels || {})
    .map((row) => String(typeof row === 'string' ? row : row?.date || '').slice(0, 10))
    .filter(Boolean)
    .sort();
  return dates[dates.length - 1] || '';
}

/** 依官方次序排列級別（用於顯示與測試）。 */
export function sortLevels(levels) {
  return Object.keys(levels || {}).sort((a, b) => (LEVEL_RANK[a] ?? 9) - (LEVEL_RANK[b] ?? 9));
}

/** `初級 2024-03-01・中級 2025-05-01`（供列印表格與摘要用；沒有級別時回傳空字串）。 */
export function levelSummary(entry, lang = 'zh') {
  const levels = levelsOf(entry);
  const parts = LEVEL_KEYS.filter((level) => levels[level]?.date).map(
    (level) => `${levelText(level, lang)} ${levels[level].date}`,
  );
  return parts.join('・');
}

/**
 * 寫入某一級：回傳新的級別表與更新後的 `entry`（`date` 自動取最新一級）。
 * `patch` 為 `{ date, cert, signature, ... }`。
 */
export function withLevel(entry, level, patch = {}) {
  const key = String(level || '').trim().toUpperCase();
  if (!isLevelKey(key)) return { entry, levels: levelsOf(entry) };
  const current = entry && typeof entry === 'object' ? entry : {};
  const levels = { ...levelsOf(current), [key]: { ...(levelsOf(current)[key] || {}), ...patch } };
  const date = latestLevelDate(levels);
  return { entry: { ...current, levels, ...(date ? { date } : {}) }, levels };
}


/**
 * 把「活動徽章」的各種來源寫法（`A26`／`A26-E`／`{level}`／`{levels}`）攤平成逐級一行，
 * 供領袖核簽、掃碼回顧等介面共用。
 *
 * 回傳：`{ key, bookId, badgeId, level, levelLabel, name, nameZh, nameEn, date, cert }`
 * `key` 以 `bookId#level` 組成，可直接當 React key 及勾選狀態的識別。
 */
export function otherBadgeRows(source, { lang = 'zh' } = {}) {
  if (!source || typeof source !== 'object') return [];
  const rows = [];
  const push = (meta, bookId, level, row) => {
    const date = String(typeof row === 'string' ? row : row?.date || '').slice(0, 10);
    if (!date) return;
    const levelLabel = level ? levelText(level, lang) : '';
    rows.push({
      key: `${bookId}#${level || ''}`,
      bookId,
      badgeId: meta.badgeId,
      level: level || '',
      levelLabel,
      nameZh: levelLabel ? `${meta.name}（${levelLabel}）` : meta.name,
      nameEn: levelLabel ? `${meta.en} (${LEVEL_LABEL[level].en})` : meta.en,
      name: levelLabel && lang === 'zh' ? `${meta.name}（${levelLabel}）` : levelLabel ? `${meta.en} (${LEVEL_LABEL[level].en})` : lang === 'en' ? meta.en : meta.name,
      date,
      cert: (typeof row === 'object' && row?.cert) || '',
      order: OTHER_BADGES.findIndex((b) => b.id === bookId),
    });
  };

  for (const [rawId, val] of Object.entries(source)) {
    if (!val) continue;
    const split = splitLevelRef(rawId);
    const bookId = toBookId(split.id);
    const meta = OTHER_BADGES.find((b) => b.id === bookId);
    if (!meta) continue;

    const ownLevel = String(val.level || split.level || '').trim().toUpperCase();
    if (isLevelKey(ownLevel) && isLeveledRef(bookId)) {
      push(meta, bookId, ownLevel, val);
      continue;
    }
    const nested = levelsOf(val);
    if (Object.keys(nested).length && isLeveledRef(bookId)) {
      for (const level of LEVEL_KEYS) if (nested[level]) push(meta, bookId, level, nested[level]);
      continue;
    }
    push(meta, bookId, '', val);
  }
  // 依官方目錄次序排列，同一枚徽章內按初 → 中 → 高
  return rows.sort(
    (a, b) =>
      a.order - b.order ||
      (a.level ? LEVEL_RANK[a.level] ?? 9 : -1) - (b.level ? LEVEL_RANK[b.level] ?? 9 : -1),
  );
}

/** 由 `book.otherBadges` 直接產生逐級行（供本機預覽／列印用）。 */
export function bookOtherBadgeRows(book, options) {
  return otherBadgeRows(book?.otherBadges, options);
}
