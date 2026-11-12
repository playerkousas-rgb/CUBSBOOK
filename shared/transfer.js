/**
 * CUBBOOK 純離線二維碼傳輸協定（CB1）
 * 成員端挑選要出示的組別 → gzip + Base64URL 編碼為單一二維碼字串（或 /#v=CB1... 純前端片段連結）。
 * 領袖端（領袖模式 · 只讀）掃描查閱 → 一次簽名 + 勾選項目 → 產生 CB1S. 核簽回傳碼 → 成員掃回寫入紀錄冊。
 * 全程零伺服器、零雲端上傳。
 */

import {
  normalizeScoutId,
  sameScoutId,
  ITEM_INDEX,
  OTHER_BADGES,
  toBookId,
  isLevelKey,
  isLeveledRef,
  levelsOf,
  splitLevelRef,
  toBookRef,
  withLevel,
  DEMO_SYNC_BLOCKED,
  assertNotDemo,
  isDemoBook,
  isDemoScoutId,
} from './book.js';

export const TRANSFER_PREFIX = 'CB1';
export const TRANSFER_VERSION = 1;
export const KIND_MEMBER = 'cubbook/member';
export const KIND_SIGNOFF = 'cubbook/signoff';

/** QR version 40-L 上限 2,953 bytes，預留鏡頭容錯餘裕定為 2,400 字元。 */
export const QR_LIMIT = 2400;

/** 成員每次出示均須主動剔選；預設全不選以保護私隱（私隱自決）。 */
export const TRANSFER_OPTIONS = [
  {
    key: 'particulars',
    label: '個人及旅團資料',
    en: 'Personal & Pack Particulars',
    hint: '姓名、SCOUT ID、所屬地域／區／旅／團、入團日期',
  },
  {
    key: 'contact',
    label: '聯絡及家長／緊急聯絡人',
    en: 'Contact & Guardian',
    hint: '電話、電郵、地址、家長／監護人及緊急聯絡人電話',
    sensitive: true,
  },
  {
    key: 'progress',
    label: '進度性獎章進度',
    en: 'Badge Progress',
    hint: '會員章、體驗章、歷奇章、高級歷奇章及金紫荊獎章細項日期',
  },
  {
    key: 'otherBadges',
    label: '活動徽章',
    en: 'Activity Badges',
    hint: '活動徽章取得日期及證書編號',
  },
  {
    key: 'renewals',
    label: '會員資格續期',
    en: 'Membership Renewal',
    hint: '按年續期日期、有效期及團長簽署',
  },
  {
    key: 'investiture',
    label: '宣誓及頒發紀錄',
    en: 'Investiture & Awards',
    hint: '宣誓日期、會員章及各進度性獎章頒發日期及證書編號',
  },
  {
    key: 'signatures',
    label: '領袖及主考簽名墨跡',
    en: 'Leader Signatures',
    hint: '各項旁邊的簽名圖片（較佔容量）',
    heavy: true,
  },
  {
    key: 'holderSignature',
    label: '持有人簽名',
    en: 'Holder Signature',
    hint: '第 1 頁持有人簽名墨跡',
    heavy: true,
  },
  {
    key: 'photo',
    label: '個人近照',
    en: 'Recent Photo',
    hint: '第 1 頁近照（最佔容量，容易超出單張 QR 上限）',
    heavy: true,
  },
];

const AWARD_PAGES = ['L1', 'L2', 'L3', 'L4', 'OT-GB'];

const clean = (v) => (typeof v === 'string' ? v.trim() : '');
const pick = (obj, keys) => {
  const out = {};
  keys.forEach((k) => {
    const v = clean(obj?.[k]);
    if (v) out[k] = v;
  });
  return out;
};

export function buildPayload(book, selection = []) {
  const chosen = new Set(selection);
  const payload = {
    t: KIND_MEMBER,
    v: TRANSFER_VERSION,
    at: new Date().toISOString(),
    sel: TRANSFER_OPTIONS.filter((o) => chosen.has(o.key)).map((o) => o.key),
  };
  const m = book?.member || {};
  // 示範紀錄冊的二維碼帶有示範標記：接收一方會顯示「示範樣本」，且不可據此簽發核簽回傳碼。
  if (isDemoBook(book)) payload.demo = true;

  if (chosen.has('particulars')) {
    payload.member = pick(m, [
      'nameZh',
      'nameEn',
      'scoutId',
      'memberNo',
      'pack',
      'group',
      'district',
      'region',
      'dateJoined',
      'dateInvestiture',
      'dob',
      'primaryLevel',
      'school',
    ]);
  }
  if (chosen.has('contact')) {
    payload.contact = pick(m, [
      'phone',
      'email',
      'addressZh',
      'addressEn',
      'parentName',
      'parentRelation',
      'parentPhone',
      'emergencyName',
      'emergencyPhone',
    ]);
  }
  if (chosen.has('progress')) {
    const sid = clean(m.scoutId || m.memberNo);
    if (sid) payload.scoutId = sid;
    const progress = {};
    Object.entries(book?.progress || {}).forEach(([id, entry]) => {
      if (!entry) return;
      const row = pick(entry, ['date', 'assessor', 'cert']);
      if (Object.keys(row).length) progress[id] = row;
    });
    payload.progress = progress;
  }
  if (chosen.has('otherBadges')) {
    const other = {};
    Object.entries(book?.otherBadges || {}).forEach(([id, entry]) => {
      if (!entry) return;
      const row = pick(entry, ['date', 'cert', 'note']);
      // 分級徽章：逐級保留日期，否則家長／領袖只會見到「最高一級」
      const levels = levelsOf(entry);
      if (Object.keys(levels).length) {
        const picked = {};
        for (const [level, val] of Object.entries(levels)) {
          const line = pick(val, ['date', 'cert', 'note']);
          if (Object.keys(line).length) picked[level] = line;
        }
        if (Object.keys(picked).length) row.levels = picked;
      }
      if (Object.keys(row).length) other[id] = row;
    });
    payload.otherBadges = other;
  }
  if (chosen.has('renewals')) {
    const renewals = (book?.renewals || [])
      .map((r) => pick(r, ['from', 'date', 'validUntil', 'note', 'leaderName']))
      .filter((r) => Object.keys(r).length > 0);
    if (renewals.length) payload.renewals = renewals;
  }
  if (chosen.has('investiture')) {
    const awards = {};
    AWARD_PAGES.forEach((id) => {
      const row = pick(book?.pages?.[`award_${id}`] || {}, ['date', 'certNo', 'presentedBy']);
      if (Object.keys(row).length) awards[id] = row;
    });
    if (Object.keys(awards).length) payload.awards = awards;
    // 宣誓日期在官方第 10–11 頁（會員章）填寫，儲存於 member.dateInvestiture。
    const investitureDate = clean(m.dateInvestiture);
    if (investitureDate) payload.investiture = { investitureDate };
  }
  if (chosen.has('signatures')) {
    const signatures = {};
    Object.entries(book?.progress || {}).forEach(([id, entry]) => {
      if (entry?.signature?.png) signatures[id] = entry.signature;
    });
    payload.signatures = signatures;
  }
  if (chosen.has('holderSignature') && book?.holderSignature?.png) {
    payload.holderSignature = book.holderSignature;
  }
  if (chosen.has('photo') && m.photo) payload.photo = m.photo;

  payload.sums = {
    done: Object.keys(payload.progress || {}).length,
    badges: Object.keys(payload.otherBadges || {}).length,
  };
  return payload;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function toBase64Url(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    if (b1 === undefined) break;
    out += B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    if (b2 === undefined) break;
    out += B64[b2 & 63];
  }
  return out;
}

function fromBase64Url(str) {
  const cleanStr = str.replace(/=+$/, '');
  const bytes = [];
  for (let i = 0; i < cleanStr.length; i += 4) {
    const c0 = B64.indexOf(cleanStr[i]);
    const c1 = B64.indexOf(cleanStr[i + 1]);
    const c2 = B64.indexOf(cleanStr[i + 2]);
    const c3 = B64.indexOf(cleanStr[i + 3]);
    if (c0 < 0 || c1 < 0) throw new Error('二維碼內容格式有誤');
    bytes.push((c0 << 2) | (c1 >> 4));
    if (c2 >= 0) bytes.push(((c1 & 15) << 4) | (c2 >> 2));
    if (c3 >= 0) bytes.push(((c2 & 3) << 6) | c3);
  }
  return new Uint8Array(bytes);
}

const gzipAvailable = () =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

function byteStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function gzip(bytes) {
  const stream = byteStream(bytes).pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(bytes) {
  const stream = byteStream(bytes).pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function encodePayload(payload, { signoff = false } = {}) {
  const json = JSON.stringify(payload);
  const raw = new TextEncoder().encode(json);
  const lead = signoff ? `${TRANSFER_PREFIX}S` : TRANSFER_PREFIX;
  let bytes = raw;
  let prefix = `${lead}P.`;
  if (gzipAvailable()) {
    try {
      const packed = await gzip(raw);
      if (packed.length < raw.length * 0.96) {
        bytes = packed;
        prefix = `${lead}.`;
      }
    } catch {
      /* fallback uncompressed */
    }
  }
  const value = prefix + toBase64Url(bytes);
  return {
    value,
    payload,
    chars: value.length,
    rawBytes: raw.length,
    bytes: bytes.length,
    compressed: prefix === `${lead}.`,
    signoff,
    tooBig: value.length > QR_LIMIT,
  };
}

export async function encodeTransfer(book, selection) {
  return encodePayload(buildPayload(book, selection));
}

/** 示範成員（虛構資料）的出示碼不可簽發核簽回傳碼。 */
export const isDemoPayload = (payload) =>
  payload?.demo === true ||
  isDemoScoutId(payload?.member?.scoutId || payload?.member?.memberNo || payload?.scoutId);

export async function encodeSignoff({ member, leader, items, otherBadges, note, demo = false }) {
  if (demo === true || isDemoScoutId(member?.scoutId || member?.memberNo)) {
    const err = new Error('示範資料屬虛構內容，領袖不可為示範紀錄冊簽發核簽回傳碼。');
    err.code = DEMO_SYNC_BLOCKED.code;
    throw err;
  }
  const who = typeof leader === 'string' ? { name: leader } : leader || {};
  const payload = {
    t: KIND_SIGNOFF,
    v: TRANSFER_VERSION,
    at: new Date().toISOString(),
    seq: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    member: {
      nameZh: member?.nameZh || '',
      scoutId: member?.scoutId || member?.memberNo || '',
    },
    leader: {
      name: String(who.name || '').slice(0, 60),
      title: String(who.title || '幼童軍團長 CSL').slice(0, 60),
      at: who.at || new Date().toISOString().slice(0, 10),
      png: who.png || null,
    },
    items: (items || []).map((it) => ({
      id: it.id,
      date: it.date || new Date().toISOString().slice(0, 10),
      assessor: it.assessor || who.name || '',
      verified: true,
    })),
    otherBadges: (otherBadges || []).map((it) => {
      const level = String(it.level || '').trim().toUpperCase();
      return {
        id: it.id,
        ...(isLevelKey(level) ? { level } : {}),
        date: it.date || new Date().toISOString().slice(0, 10),
        cert: it.cert || '',
        verified: true,
      };
    }),
    note: note || '',
  };
  return encodePayload(payload, { signoff: true });
}

/** 抽取純 CB1 字串（同時支援直接掃描 CB1... 或貼上含 #v=CB1... 的完整網址）。 */
export function extractToken(rawInput) {
  const s = String(rawInput || '').trim();
  const hashIdx = s.indexOf('#v=');
  if (hashIdx >= 0) return decodeURIComponent(s.slice(hashIdx + 3).split('&')[0].trim());
  return s;
}

export async function decodePayload(rawInput) {
  const input = extractToken(rawInput);
  const match = /^CB1S?(P?)\.([A-Za-z0-9_-]+)$/.exec(input);
  if (!match) throw new Error('這不是 CUBBOOK 的二維碼（應以 CB1. 或 CB1S. 開頭）');
  let bytes = fromBase64Url(match[2]);
  if (!match[1]) {
    if (!gzipAvailable()) throw new Error('此二維碼需要支援壓縮流的現代瀏覽器讀取');
    bytes = await gunzip(bytes);
  }
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('二維碼內容損壞，請對方重新產生');
  }
  if (payload?.v !== TRANSFER_VERSION || (payload.t !== KIND_MEMBER && payload.t !== KIND_SIGNOFF)) {
    throw new Error('二維碼版本不相容，請更新 CUBBOOK');
  }
  return payload;
}

export async function decodeTransfer(rawInput) {
  const payload = await decodePayload(rawInput);
  if (payload.t !== KIND_MEMBER) throw new Error('這個二維碼是核簽單，不是成員紀錄冊');
  return payload;
}

export function applySignoff(book, payload) {
  if (!payload || payload.t !== KIND_SIGNOFF) throw new Error('這不是有效的領袖核簽單');
  // 示範紀錄冊不接受任何真實領袖簽署（示範資料不含簽名圖片，亦不可被核實）。
  assertNotDemo(book);
  if (payload?.member?.scoutId) {
    const myId = normalizeScoutId(book?.member?.scoutId || book?.member?.memberNo);
    if (myId && !sameScoutId(payload.member.scoutId, myId)) {
      throw new Error(`此核簽單屬於 SCOUT ID ${payload.member.scoutId}，與本機（${myId}）不符`);
    }
  }

  const next = structuredClone(book);
  const changes = [];
  next.progress = next.progress || {};
  next.otherBadges = next.otherBadges || {};
  next.pages = next.pages || {};

  (payload.items || []).forEach((item) => {
    if (!item?.id || !item.verified) return;
    const bookId = toBookId(item.id);
    if (!ITEM_INDEX[bookId]) return;
    const current = next.progress[bookId] || {};
    const before = { date: current.date || '', assessor: current.assessor || '' };
    const finalDate = item.date || current.date || new Date().toISOString().slice(0, 10);
    next.progress[bookId] = {
      ...current,
      date: finalDate,
      assessor: item.assessor || payload.leader?.name || current.assessor || '',
      signedAt: payload.at,
      ...(payload.leader?.png
        ? {
            signature: {
              png: payload.leader.png,
              name: payload.leader.name,
              title: payload.leader.title,
              at: payload.leader.at,
            },
          }
        : {}),
    };
    changes.push({
      id: bookId,
      before,
      after: { date: next.progress[bookId].date, assessor: next.progress[bookId].assessor },
      stamped: Boolean(payload.leader?.png),
    });
  });

  (payload.otherBadges || []).forEach((item) => {
    if (!item?.id || !item.verified) return;
    // 分級徽章：`item.level`（或後綴 `A26-E`）指明核簽哪一級
    const split = splitLevelRef(item.id);
    const bookId = toBookId(split.id);
    if (!OTHER_BADGES.some((b) => b.id === bookId)) return;
    const level = String(item.level || split.level || '').trim().toUpperCase();
    const stamp = payload.leader?.png
      ? {
          signature: {
            png: payload.leader.png,
            name: payload.leader.name,
            title: payload.leader.title,
            at: payload.leader.at,
          },
        }
      : {};
    const current = next.otherBadges[bookId] || {};
    const finalDate = item.date || current.date || new Date().toISOString().slice(0, 10);
    const row = {
      date: finalDate,
      ...(item.cert ? { cert: String(item.cert).slice(0, 60) } : {}),
      signedAt: payload.at,
      ...stamp,
    };

    if (level && isLevelKey(level) && isLeveledRef(bookId)) {
      const before = { date: current.levels?.[level]?.date || '', cert: current.levels?.[level]?.cert || '' };
      next.otherBadges[bookId] = withLevel(current, level, row).entry;
      changes.push({
        id: bookId,
        level,
        before,
        after: { date: next.otherBadges[bookId].levels?.[level]?.date || finalDate, cert: item.cert || '' },
        stamped: Boolean(payload.leader?.png),
      });
      return;
    }

    const before = { date: current.date || '', cert: current.cert || '' };
    next.otherBadges[bookId] = { ...current, ...row };
    changes.push({
      id: bookId,
      before,
      after: { date: next.otherBadges[bookId].date, cert: next.otherBadges[bookId].cert || '' },
      stamped: Boolean(payload.leader?.png),
    });
  });

  next.meta = { ...(next.meta || {}), updatedAt: new Date().toISOString() };
  return { book: next, changes };
}

export function describeSelection(selection = []) {
  const chosen = TRANSFER_OPTIONS.filter((o) => selection.includes(o.key));
  return chosen.length ? chosen.map((o) => o.label).join('、') : '（未剔選任何組別）';
}
