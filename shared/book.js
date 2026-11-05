// ==========================================================================
// CUBBOOK — 幼童軍個人隨身電子紀錄冊資料模型
// 純本機儲存（localStorage），一次只服務「這一位」成員的紀錄冊。
// 全團名冊、批量簽核、多成員切換一律屬 cubbadge（旅團進度表）範疇，本倉庫不做。
// ==========================================================================

import {
  BADGE_SYLLABUS,
  OTHER_BADGES,
  GOLD_AWARD,
  ALL_AWARDS,
  SYLLABUS_ITEMS,
  ITEM_INDEX,
  SYLLABUS_META,
  toBadgeId,
  toBookId,
} from './syllabus.js';
import { COVER, OFFICIAL_PAGES } from './officialPages.js';
import {
  LEVEL_KEYS,
  isLevelKey,
  levelSummary,
  isLeveledRef,
  latestLevelDate,
  levelText,
  levelsOf,
  splitLevelRef,
  withLevel,
} from './badgeLevels.js';

export {
  BADGE_SYLLABUS,
  OTHER_BADGES,
  GOLD_AWARD,
  ALL_AWARDS,
  SYLLABUS_ITEMS,
  ITEM_INDEX,
  SYLLABUS_META,
  toBadgeId,
  toBookId,
};

export {
  LEVEL_KEYS,
  isLevelKey,
  isLeveledRef,
  levelSummary,
  levelText,
  levelsOf,
  latestLevelDate,
  splitLevelRef,
  withLevel,
};

export const APP_VERSION = 'v1.2.5';
export const STORE_KEY = 'cubbook.book.v1';
export const LEGACY_STORE_KEYS = [];

export const uid = (p = 'c') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(value) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
  const [y, m, d] = raw.split('-');
  return `${d}/${m}/${y}`;
}

// ------------------------------------------------------------------ 頁序
// 紙本《幼童軍紀錄冊》章節次序 → CUBBOOK 頁碼（逐一對應，另加數位附錄）。
// 紙本官方頁碼（PT/67、PT/68 要求附上第 1–3、5、10–15 頁）另在列印檢查清單列明。
/**
 * 官方 32 頁（香港童軍總會《幼童軍紀錄冊》2026 年版）
 * 頁碼、頁序、標題一律照官方；數位附錄不計入頁碼。
 */
export const SECTIONS = [
  { ...COVER, label: COVER.zh, digital: false, banner: false },
  ...OFFICIAL_PAGES.map((p) => ({
    id: p.id,
    page: p.page,
    label: p.zh,
    en: p.en,
    group: p.group,
    kind: p.kind,
    badge: p.badge,
    award: p.award,
    plan: p.plan,
    from: p.from,
    bannerZh: p.bannerZh,
    banner: p.no === 1 || p.kind === 'static' && p.no === 6 ? false : undefined,
  })),
  { id: 'appendix', page: '—', label: '數位附錄', en: 'Digital Appendix', digital: true, group: 'appendix', kind: 'appendix' },
];

export const PAGE_TOTAL = SECTIONS.filter((s) => s.page && s.page !== '—').length;

// ------------------------------------------------------------------ 身分
/** 紀錄冊編號 ＝ 童軍成員編號 SCOUT ID（與 cubbadge 完全統一）。 */
export function scoutId(bookOrMember) {
  const m = bookOrMember?.member || bookOrMember || {};
  return String(m.scoutId || m.memberNo || m.ymis || '').trim();
}

/** 正規化 SCOUT ID／YMIS（去除空白；純數字可與 cubbadge 10 位 YMIS 互相比對）。 */
export function normalizeScoutId(raw) {
  return String(raw ?? '').trim().replace(/\s+/g, '');
}

/** 比對兩個 SCOUT ID／YMIS 是否同一成員（相容純數字補零至 10 位）。 */
export function sameScoutId(a, b) {
  const x = normalizeScoutId(a);
  const y = normalizeScoutId(b);
  if (!x || !y) return false;
  if (x.toLowerCase() === y.toLowerCase()) return true;
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return x.padStart(10, '0') === y.padStart(10, '0');
  return false;
}

/** 保持 scoutId 與 memberNo 同步，清除舊 ymis 欄位。 */
export function syncIdentity(member) {
  if (!member) return member;
  const id = scoutId(member);
  member.scoutId = id;
  member.memberNo = id;
  delete member.ymis;
  return member;
}

/** 香港身份證只保留首四位字元（如 A123），符合總會表格私隱規定。 */
export function sanitizeHkidPrefix(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

export function ageFromDob(dob, refDate = new Date()) {
  if (!dob) return '';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '';
  const ref = refDate instanceof Date ? refDate : new Date(refDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 120 ? age : '';
}

export function newBook(partial = {}) {
  const now = new Date().toISOString();
  const { member: partialMember, meta: partialMeta, ...rest } = partial;
  const book = {
    version: 1,
    appVersion: APP_VERSION,
    member: {
      nameZh: '',
      nameEn: '',
      scoutId: '',
      six: '',
      memberNo: '',
      hkidPrefix: '',
      gender: '',
      photo: null,
      dob: '',
      school: '',
      primaryLevel: '',
      religion: '',
      phone: '',
      email: '',
      addressZh: '',
      addressEn: '',
      pob: '',
      dateOfIssue: '',
      parentName: '',
      parentRelation: '',
      parentPhone: '',
      emergencyName: '',
      emergencyPhone: '',
      allergies: '',
      pack: '',
      group: '',
      district: '',
      region: '',
      sponsoringAuthority: '',
      groupAddress: '',
      gsl: '',
      gslPhone: '',
      csl: '',
      cslPhone: '',
      dateJoined: '',
      dateInvestiture: '',
      dateScoutMovement: '',
      ...(partialMember || {}),
    },
    scouting: {
      grasshopper: { from: '', to: '', unit: '', post: '', award: '' },
      cub: { from: '', to: '', unit: '', post: '', award: '' },
      scout: { from: '', to: '', unit: '', post: '', award: '' },
    },
    transfers: [],
    addressChanges: [],
    detailChanges: [],
    renewals: [],
    /** 官方第 8 頁：個人進度紀錄（各獎章獲取日期） */
    personalProgress: {
      membership: '',
      experience: '',
      adventure: '',
      crest: '',
      goldenBauhinia: '',
      scoutLink: '',
      second: '',
      sixer: '',
      transferToScout: '',
    },
    /** 官方第 9 頁：服務年星（一至六年） */
    serviceStars: { y1: '', y2: '', y3: '', y4: '', y5: '', y6: '' },
    /** 官方第 10–20 頁：核心／興趣範疇的主考人、日期、簽署（鍵＝範疇代碼） */
    domains: {},
    /** 官方第 15、17、19 頁：興趣範疇（三選二） */
    interest: {},
    /** 官方第 12–18 頁：遲加入者只完成核心範疇的 ☐ */
    lateJoin: {},
    /** 官方第 27–30 頁：活動及服務紀錄 */
    activities: [],
    service: [],
    awardsLog: [],
    progress: {},
    otherBadges: {},
    pages: {},
    forms: {},
    holderSignature: null,
    ...rest,
    meta: { createdAt: now, updatedAt: now, ...(partialMeta || {}) },
  };
  syncIdentity(book.member);
  if (book.member.hkidPrefix) book.member.hkidPrefix = sanitizeHkidPrefix(book.member.hkidPrefix);
  return book;
}

// ------------------------------------------------------------------ 進度判斷
const hasDate = (book, id) => Boolean(book?.progress?.[id]?.date);

/** 興趣範疇是否已達標：指定清單內、兩個不同類別、每類至少一個活動徽章。 */
export function interestProgress(book, segment) {
  const req = segment?.activityRequirement;
  if (!req) return { satisfied: false, count: 0, categories: [], needed: null };
  const allowed = new Set(req.allowedBadgeIds || []);
  const byCategory = new Map();
  for (const badge of OTHER_BADGES) {
    if (!allowed.has(badge.id)) continue;
    const entry = book?.otherBadges?.[badge.id];
    if (!entry?.date) continue;
    if (!byCategory.has(badge.category)) byCategory.set(badge.category, []);
    byCategory.get(badge.category).push(badge.id);
  }
  const categories = [...byCategory.keys()];
  const perCategoryOk = categories.filter(
    (cat) => (byCategory.get(cat) || []).length >= req.badgesPerCategory,
  );
  return {
    satisfied: perCategoryOk.length >= req.distinctCategories,
    count: categories.reduce((n, cat) => n + byCategory.get(cat).length, 0),
    categories: perCategoryOk,
    needed: `${req.distinctCategories} × ${req.badgesPerCategory}`,
    allowed: [...allowed],
  };
}

export function badgeStats(book, awardId) {
  const award = ALL_AWARDS.find((b) => b.id === awardId);
  if (!award) return { total: 0, done: 0, percent: 0, segments: [], award: null, complete: false };

  const segments = award.segments.map((segment) => {
    const itemIds = segment.items.map((i) => i.id);
    const done = itemIds.filter((id) => hasDate(book, id)).length;
    const interest = segment.activityRequirement ? interestProgress(book, segment) : null;
    return {
      code: segment.code,
      name: segment.name,
      total: itemIds.length,
      done,
      percent: itemIds.length ? Math.round((done / itemIds.length) * 100) : interest?.satisfied ? 100 : 0,
      interest,
    };
  });

  const total = segments.reduce((n, s) => n + s.total, 0);
  const done = segments.reduce((n, s) => n + s.done, 0);
  const itemsComplete = segments.every((s) => s.total === 0 || s.done === s.total);
  const interestComplete = segments.every((s) => !s.interest || s.interest.satisfied);
  const complete = itemsComplete && interestComplete;

  return {
    total,
    done,
    percent: complete ? 100 : total ? Math.round((done / total) * 100) : 0,
    segments,
    complete,
    awardedDate: book?.pages?.[`award_${awardId}`]?.date || '',
    award,
  };
}

export function allStats(book) {
  const awards = ALL_AWARDS.map((a) => ({ ...badgeStats(book, a.id), award: a }));
  const total = awards.reduce((n, a) => n + a.total, 0);
  const done = awards.reduce((n, a) => n + a.done, 0);
  // 「已獲獎章」= 全部細項完成，或已在第 15 頁／獎章頁記錄頒發日期（領袖頒發即算）。
  const earned = awards.filter(
    (a) => a.complete || Boolean(book?.pages?.[`award_${a.award.id}`]?.date),
  );
  return {
    awards,
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
    earned: earned.length,
    nextAward: awards.find((a) => !a.complete) || awards[awards.length - 1],
    activityBadges: Object.values(book?.otherBadges || {}).filter((b) => b?.date).length,
  };
}

export function latestRenewal(book) {
  return (
    [...(book?.renewals || [])]
      .filter((r) => r && (r.validUntil || r.date))
      .sort((a, b) =>
        String(b.validUntil || b.date).localeCompare(String(a.validUntil || a.date)),
      )[0] || null
  );
}

export function membershipStatus(book) {
  const last = latestRenewal(book);
  return {
    renewal: last,
    validUntil: last?.validUntil || null,
    active: Boolean(last?.validUntil && last.validUntil >= today()),
  };
}

/** 以月為單位計算年齡，用於「十歲半」這類半歲門檻。 */
export function ageInMonths(dob, refDate = new Date()) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const ref = refDate instanceof Date ? refDate : new Date(refDate);
  let months = (ref.getFullYear() - birth.getFullYear()) * 12 + (ref.getMonth() - birth.getMonth());
  if (ref.getDate() < birth.getDate()) months -= 1;
  return months >= 0 && months < 1200 ? months : null;
}

/** 金紫荊獎章年齡條件：完成最後一項時須年滿十歲半。 */
export function goldenBauhiniaEligibility(book, refDate = new Date()) {
  const months = ageInMonths(book?.member?.dob, refDate);
  const age = ageFromDob(book?.member?.dob, refDate);
  return {
    age,
    months,
    halfPastTen: months !== null && months >= 126,
    note: '完成最後一項課程內容時必須年滿十歲半；十二歲後仍就讀小學的延長安排以 P022/2026 及最新官方指引為準。',
  };
}

// ------------------------------------------------- cubbadge 純進度互通（BOOK ⇄ BADGE）
// 三大鐵律：
// 1. 零個人資料：只傳 SCOUT ID／YMIS、項目代號及日期，伺服器端硬性剝除姓名、電話、地址、
//    家長資料、相片及其他成員資料。
// 2. BADGE → BOOK：只錄入 cubbadge 已獲領袖核實的 progress／otherBadges；pending 絕不錄入。
// 3. BOOK → BADGE：一律轉為 requestComplete「待領袖核實（pending）」，硬性禁止 save／saveOtherBadge。
export const SYNC_SCHEMA = 'cubbadge.pending.v1';

const UNCONFIRMED_STATUSES = new Set([
  'pending',
  'local_draft',
  'draft',
  'rejected',
  'unverified',
  'unconfirmed',
]);

function isConfirmedEntry(val) {
  if (!val) return false;
  if (typeof val === 'string') return Boolean(val.trim());
  if (typeof val !== 'object') return false;
  if (val.confirmed === false || val.verified === false || val.pending === true) return false;
  const st = String(val.status || '').trim().toLowerCase();
  if (st && UNCONFIRMED_STATUSES.has(st)) return false;
  return Boolean(String(val.date || '').trim());
}

function itemLabel(bookId) {
  return ITEM_INDEX[bookId]?.name || OTHER_BADGES.find((b) => b.id === bookId)?.name || bookId;
}

/**
 * 把任何來源的項目鍵拆成 `{ bookId, level }`：
 * 同時接受 BOOK 鍵（`OT-A26`）、cubbadge 編號（`A26`）及後綴寫法（`A26-E`／`A26_E`）。
 */
export function toBookRef(rawKey) {
  const { id, level } = splitLevelRef(rawKey);
  const bookId = toBookId(id);
  return { bookId, level: level && isLeveledRef(bookId) ? level : '' };
}

/** 把一批遠端鍵整理成「整個徽章」與「某一級」兩組，方便逐級比對。 */
function refSets(keys) {
  const all = new Set();
  const levels = new Set();
  for (const key of keys || []) {
    const { bookId, level } = toBookRef(key);
    if (!bookId) continue;
    if (level) levels.add(`${bookId}#${level}`);
    else all.add(bookId);
  }
  return { all, levels };
}

/**
 * 收集本機已填寫、但 cubbadge 尚未核實／未在待批清單的項目。
 * 回傳一律使用 cubbadge 官方編號（badgeId），令 BADGE 毋須認識 BOOK 內部鍵。
 *
 * 分級徽章（官方 7 枚初／中／高）逐級送出，並附 `level` 欄位：
 * 同一枚 A26 的初級與中級是兩個獨立申報，日期與核實狀態互不覆蓋。
 */
export function collectPendingForBadge(book, remoteConfirmed = {}, remotePendingIds = []) {
  const confirmed = refSets(Object.keys(remoteConfirmed || {}));
  const pending = refSets(remotePendingIds || []);
  const skip = (bookId, level) =>
    confirmed.all.has(bookId) ||
    (level ? confirmed.levels.has(`${bookId}#${level}`) : false) ||
    pending.all.has(bookId) ||
    (level ? pending.levels.has(`${bookId}#${level}`) : false);
  const out = [];

  for (const [bookId, entry] of Object.entries(book?.progress || {})) {
    if (!ITEM_INDEX[bookId] || !entry?.date) continue;
    if (entry.confirmedByBadge) continue;
    if (skip(bookId, '')) continue;
    out.push({
      kind: 'item',
      itemId: toBadgeId(bookId),
      bookId,
      itemName: itemLabel(bookId),
      date: String(entry.date).slice(0, 10),
      evidence: entry.cert
        ? `CUBBOOK 紀錄冊申報（證書：${entry.cert}）`
        : '由 CUBBOOK 個人電子紀錄冊申報（待領袖核實）',
    });
  }

  for (const [bookId, entry] of Object.entries(book?.otherBadges || {})) {
    if (!entry) continue;
    const levels = levelsOf(entry);

    // 分級徽章：逐級各自申報，領袖可就每一級獨立核實
    if (Object.keys(levels).length) {
      for (const level of LEVEL_KEYS) {
        const row = levels[level];
        if (!row?.date) continue;
        if (row.confirmedByBadge) continue;
        if (skip(bookId, level)) continue;
        const levelzh = levelText(level);
        out.push({
          kind: 'other',
          itemId: toBadgeId(bookId),
          bookId,
          level,
          itemName: `${itemLabel(bookId)}（${levelzh}）`,
          date: String(row.date).slice(0, 10),
          evidence: row.cert
            ? `CUBBOOK 活動徽章申報（${levelzh}・證書：${row.cert}）`
            : `由 CUBBOOK 個人電子紀錄冊申報活動徽章（${levelzh}）（待領袖核實）`,
        });
      }
      continue;
    }

    if (!entry.date) continue;
    if (entry.confirmedByBadge) continue;
    if (skip(bookId, '')) continue;
    out.push({
      kind: 'other',
      itemId: toBadgeId(bookId),
      bookId,
      itemName: itemLabel(bookId),
      date: String(entry.date).slice(0, 10),
      evidence: entry.cert
        ? `CUBBOOK 活動徽章申報（證書：${entry.cert}）`
        : '由 CUBBOOK 個人電子紀錄冊申報活動徽章（待領袖核實）',
    });
  }

  return out;
}

/**
 * 匯出供 cubbadge 錄入的申報檔：只有身分編號、項目、日期（分級徽章另附 `level`）；
 * 全部 pending、confirmed:false。
 */
export function exportForBadge(book, troopId = '') {
  const sid = scoutId(book?.member);
  const items = collectPendingForBadge(book);
  const pendingProgress = {};
  const pendingRequests = items.map((it) => {
    // 分級徽章以 `A26-E` 作 pendingProgress 的鍵（同一徽章可同時有多級待批）；
    // pendingRequests 則保留官方 `A26` 並另附 `level`，方便 BADGE 決定寫入哪一格。
    const key = it.level ? `${it.itemId}-${it.level}` : it.itemId;
    pendingProgress[key] = {
      date: it.date,
      ...(it.level ? { level: it.level } : {}),
      status: 'pending',
      confirmed: false,
    };
    return {
      ymis: sid,
      item_id: it.itemId,
      ...(it.level ? { level: it.level } : {}),
      item_name: it.itemName,
      requested_date: it.date,
      evidence: it.evidence,
      status: 'pending',
      confirmed: false,
    };
  });

  return {
    info: 'CUBBOOK 成員進度申報檔 · 錄入 cubbadge 時一律為「待領袖核實」（不含個人資料）',
    privacy: 'progress-only',
    status: 'pending',
    confirmed: false,
    troopId: String(troopId || '').trim(),
    scoutId: sid,
    ymis: sid,
    exportedAt: new Date().toISOString(),
    pendingRequests,
    pendingProgress: sid ? { [sid]: pendingProgress } : {},
    source: 'CUBBOOK',
    schema: SYNC_SCHEMA,
  };
}

/**
 * 從 cubbadge 錄入已核實進度至個人 BOOK。
 * - 只認 progress／flatProgress／otherBadges 內領袖已核實的日期；
 * - pendingRequests 只作識別（skippedPending），永不寫入；
 * - 完全不改動 book.member 的姓名、電話、地址、家長、相片等個人資料；
 * - 空白簿（未填任何個人資料）只要帶同 SCOUT ID 亦即可綁定及拉齊進度。
 */
export function importFromBadge(json, srcBook, { expectedScoutId = '' } = {}) {
  if (!json || typeof json !== 'object') throw new Error('檔案格式不正確');
  if (
    json.schema === SYNC_SCHEMA ||
    json.status === 'pending' ||
    json.confirmed === false ||
    (json.pendingProgress && !json.progress && !json.flatProgress && !json.otherBadges)
  ) {
    throw new Error('此檔案屬於「待領袖核實」申報資料，未經領袖在 cubbadge 核實，不會錄入紀錄冊');
  }

  const next = structuredClone(srcBook);
  const targetId = normalizeScoutId(expectedScoutId) || scoutId(next.member);
  let matchedBy = '';
  let skippedPending = 0;
  let imported = 0;

  if (Array.isArray(json.pendingRequests)) {
    json.pendingRequests.forEach((req) => {
      if (!req || typeof req !== 'object') return;
      const reqId = normalizeScoutId(req.ymis || req.scoutId || '');
      const st = String(req.status || 'pending').trim().toLowerCase();
      if (st !== 'approved' && (!targetId || !reqId || sameScoutId(targetId, reqId))) {
        skippedPending += 1;
      }
    });
  }

  // 私隱自決：若載入檔只有其他成員的已核實進度，不可靜默綁定或寫入本冊。
  if (targetId) {
    const candidateIds = new Set();
    for (const container of [json.progress, json.flatProgress, json.otherBadges]) {
      if (!container || typeof container !== 'object') continue;
      for (const key of Object.keys(container)) {
        if (key === '說明') continue;
        const bookKey = toBookRef(key).bookId;
        if (ITEM_INDEX[bookKey] || OTHER_BADGES.some((b) => b.id === bookKey)) continue;
        if (/^[0-9A-Za-z_-]{4,32}$/.test(key)) candidateIds.add(key);
      }
    }
    if (candidateIds.size && ![...candidateIds].some((id) => sameScoutId(id, targetId))) {
      throw new Error('這份進度屬於另一位童軍成員（SCOUT ID 不同），不會寫入本冊');
    }
  }

  const extractMemberMap = (container) => {
    if (!container || typeof container !== 'object') return null;
    const keys = Object.keys(container).filter((k) => k !== '說明');
    if (!keys.length) return null;
    if (keys.some((k) => Boolean(ITEM_INDEX[toBookRef(k).bookId]) || OTHER_BADGES.some((b) => b.id === toBookRef(k).bookId))) {
      matchedBy = matchedBy || '直接已核實進度表';
      return container;
    }
    if (targetId) {
      const hit = keys.find((k) => sameScoutId(k, targetId));
      if (hit && container[hit] && typeof container[hit] === 'object') {
        matchedBy = matchedBy || `SCOUT ID ${targetId}`;
        return container[hit];
      }
      return {};
    }
    throw new Error('請先輸入你的童軍成員編號（SCOUT ID），以便對齊 cubbadge 內屬於你的已核實進度');
  };

  const writeItem = (rawId, val, confirmer) => {
    const bookId = toBookId(rawId);
    if (!ITEM_INDEX[bookId]) return;
    if (!isConfirmedEntry(val)) {
      skippedPending += 1;
      return;
    }
    const date = String(typeof val === 'string' ? val : val.date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    const prev = next.progress[bookId] || {};
    const who = String(
      confirmer || (typeof val === 'object' ? val.confirmer || val.confirmed_by || '' : '') || '',
    ).slice(0, 60);
    next.progress[bookId] = {
      ...prev,
      date,
      confirmedByBadge: true,
      confirmedAt: new Date().toISOString(),
      ...(who ? { badgeConfirmer: who } : {}),
      ...(prev.signature ? { signature: prev.signature } : {}),
    };
    imported += 1;
  };

  for (const src of [json.progress, json.flatProgress]) {
    if (!src || typeof src !== 'object') continue;
    const map = extractMemberMap(src);
    if (!map) continue;
    for (const [rawId, val] of Object.entries(map)) writeItem(rawId, val, val?.confirmer);
  }

  if (json.otherBadges && typeof json.otherBadges === 'object') {
    const map = extractMemberMap(json.otherBadges);
    if (map) {
      const writeBadge = (rawId, val) => {
        const { bookId, level } = toBookRef(rawId);
        if (!OTHER_BADGES.some((b) => b.id === bookId)) return;
        if (!isConfirmedEntry(val)) {
          skippedPending += 1;
          return;
        }
        const date = String(typeof val === 'string' ? val : val.date).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const prev = next.otherBadges[bookId] || {};
        const cert = typeof val === 'object' ? String(val.cert || '').slice(0, 60) : '';
        const confirmedAt = new Date().toISOString();

        // 分級徽章：只寫入有核實的那一級，其餘級別保留本機原有狀態
        if (level && isLeveledRef(bookId)) {
          const { entry } = withLevel(prev, level, {
            date,
            ...(cert ? { cert } : {}),
            confirmedByBadge: true,
            confirmedAt,
          });
          next.otherBadges[bookId] = entry;
          imported += 1;
          return;
        }

        next.otherBadges[bookId] = {
          ...prev,
          date,
          ...(cert ? { cert } : {}),
          confirmedByBadge: true,
          confirmedAt,
        };
        imported += 1;
      };

      for (const [rawId, val] of Object.entries(map)) {
        if (!val || typeof val !== 'object') {
          writeBadge(rawId, val);
          continue;
        }

        // 形式②：`{ date, cert, level }`
        const baseKey = splitLevelRef(rawId).id;
        const ownLevel = String(val.level || '').trim().toUpperCase();
        if (isLevelKey(ownLevel) && isLeveledRef(toBookRef(rawId).bookId)) {
          writeBadge(`${baseKey}-${ownLevel}`, { ...val, level: undefined });
          continue;
        }

        // 形式③：`{ levels: { E:{date}, I:{date} } }`
        const nested = levelsOf(val);
        if (Object.keys(nested).length && isLeveledRef(toBookRef(rawId).bookId)) {
          for (const [level, row] of Object.entries(nested)) {
            if (!row?.date) continue;
            writeBadge(`${baseKey}-${level}`, row);
          }
          continue;
        }

        // 形式①／舊資料：整個徽章一個日期
        writeBadge(rawId, val);
      }
    }
  }

  // 空白簿免填個人資料即可同步：只綁定編號，不寫入任何個人資料。
  if (!scoutId(next.member) && targetId) {
    next.member = { ...next.member, scoutId: targetId, memberNo: targetId };
    syncIdentity(next.member);
    matchedBy = matchedBy || `SCOUT ID ${targetId}`;
  }

  next.meta = {
    ...(next.meta || {}),
    lastBadgeSyncAt: new Date().toISOString(),
    lastBadgeSyncMatchedBy: matchedBy || '',
  };

  return { book: next, imported, skippedPending, matchedBy };
}

// ------------------------------------------------------------------ 列印及示範資料
/** 整本列印頁序（不包括數位附錄及目錄）。 */
export const PRINT_PAGES = SECTIONS.filter((s) => s.id !== 'appendix');

/** 示範紀錄冊：只示範版面，不假裝任何未經領袖核實的日期。 */
export function demoBook() {
  const book = newBook();
  book.member = {
    ...book.member,
    nameZh: '陳小狼',
    nameEn: 'CHAN Siu-long',
    scoutId: '0012345678',
    gender: 'M',
    dob: '2016-04-12',
    primaryLevel: '小四',
    school: '沙田第一小學',
    region: '新界東地域',
    district: '沙田北區',
    group: '沙田第 12 旅',
    pack: '沙田第 12 旅幼童軍團',
    csl: '陳團長',
    cslPhone: '9123 4567',
    six: '棕狼隊',
    pob: '香港',
    dateJoined: '2023-09-01',
    dateInvestiture: '2023-11-25',
    groupAddress: '沙田新城市中央廣場 1 座 12 樓',
    hkidPrefix: 'A123456',
    dateOfIssue: '2023-09-01',
    addressZh: '沙田禾輋邨康和樓 1203 室',
    parentName: '陳大文',
    parentPhone: '9876 5432',
    emergencyName: '陳大文（父）',
    emergencyPhone: '9876 5432',
  };
  const seed = [
    ['L1-A', '2023-09-16'],
    ['L1-B', '2023-09-23'],
    ['L1-C', '2023-09-30'],
    ['L1-D', '2023-10-07'],
    ['L1-E', '2023-10-14'],
    ['L1-F', '2023-10-21'],
    ['L1-G', '2023-10-28'],
    ['L1-H', '2023-11-04'],
    ['L1-I', '2023-11-11'],
    ['L2-SKILLS-01', '2024-01-13'],
    ['L2-SKILLS-02', '2024-01-20'],
    ['L2-CARING-01', '2024-02-03'],
    ['L3-SKILLS-01', '2025-01-11'],
    ['L3-SKILLS-02', '2025-01-18'],
  ];
  seed.forEach(([id, date]) => {
    book.progress[id] = { date, confirmedByBadge: true, confirmedAt: new Date().toISOString() };
  });
  book.otherBadges['OT-A01'] = { date: '2025-03-15', cert: 'ACT/2025/0181', confirmedByBadge: true };
  book.otherBadges['OT-A22'] = { date: '2025-05-10', cert: 'ACT/2025/0244' };
  book.otherBadges['OT-A26'] = { levels: { E: { date: '2025-03-15' } }, date: '2025-03-15' };
  book.pages.award_L1 = { date: '2023-11-25', certNo: 'MB/2023/0912', presentedBy: '陳團長' };
  book.personalProgress = {
    ...book.personalProgress,
    membership: '2023-11-25',
    experience: '2024-06-15',
  };
  book.serviceStars = { ...book.serviceStars, y1: '2024-09-01', y2: '2025-09-01' };
  book.domains = {
    'L2-SKILLS': { examiner: '陳團長', date: '2024-03-09' },
    'L2-CARING': { examiner: '陳團長', date: '2024-04-13' },
    'L2-COUNTRY': { examiner: '陳團長', date: '2024-05-11' },
    'L2-FAMILY': { examiner: '陳團長', date: '2024-06-08' },
    'L3-SKILLS': { examiner: '陳團長', date: '2025-01-11' },
    'SL-1': { examiner: '陳團長', date: '2025-06-14' },
  };
  book.interest = { L3: { chosen: ['CREATIVE', 'SPORTS'], badges: { CREATIVE: { badgeId: 'OT-A12', examiner: '陳團長', date: '2025-02-08' }, SPORTS: { badgeId: 'OT-A28', examiner: '陳團長', date: '2025-03-08' } } } };
  book.activities = [
    { date: '2025-10-04', text: '旅團大會操' },
    { date: '2025-11-15', text: '沙田區幼童軍大會操' },
    { date: '2025-12-20', text: '社區長者中心服務' },
  ];
  book.renewals = [
    { from: '2024-01-01', validUntil: '2024-12-31', leaderName: '陳團長' },
    { from: '2025-01-01', validUntil: '2025-12-31', leaderName: '陳團長' },
    { from: '2026-01-01', validUntil: '2027-12-31', leaderName: '陳團長' },
  ];
  book.transfers = [{ date: '2025-08-01', group: '沙田第 15 旅' }];
  book.addressChanges = [{ date: '2025-08-15', address: '沙田石門安群街 3 號' }];
  return book;
}
