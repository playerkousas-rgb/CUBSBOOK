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
  DEMO_NOTICE,
  DEMO_SCOUT_ID,
  DEMO_SYNC_BLOCKED,
  assertNotDemo,
  isDemoBook,
  isDemoScoutId,
} from './demo.js';
import {
  LEVEL_KEYS,
  LEVEL_LABEL,
  isLevelKey,
  levelSummary,
  otherBadgeRows,
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
  LEVEL_LABEL,
  isLevelKey,
  isLeveledRef,
  levelSummary,
  otherBadgeRows,
  levelText,
  levelsOf,
  latestLevelDate,
  splitLevelRef,
  withLevel,
};

export { DEMO_NOTICE, DEMO_SCOUT_ID, DEMO_SYNC_BLOCKED, assertNotDemo, isDemoBook, isDemoScoutId };

export const APP_VERSION = 'v1.3.0';
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
// 紙本《幼童軍紀錄冊》2026 年版：封面（不計頁碼）＋官方第 1–32 頁；CUBBOOK 頁碼與紙本逐頁相同，
// 另加不列印的數位附錄。PT/67、PT/68 須附的紀錄冊副本頁碼由 `shared/forms.js` 依
// `shared/officialPages.js` 推導，不在此手寫。
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
      pack: '',
      group: '',
      district: '',
      region: '',
      groupAddress: '',
      gsl: '',
      csl: '',
      cslPhone: '',
      dateJoined: '',
      ageOnJoining: '',
      dateInvestiture: '',
      ...(partialMember || {}),
    },
    /** 官方第 5 頁：轉旅（3 行）及遷移地址（5 行） */
    transfers: [],
    addressChanges: [],
    /** 官方第 4 頁：會員資格按年續期（8 行） */
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
    /** 官方第 13、14、16、18、20 頁：核心範疇／童軍先修章的主考人及日期（鍵＝範疇代碼） */
    domains: {},
    /** 官方第 15、17、19 頁：興趣範疇（三選二） */
    interest: {},
    /** 官方第 13、14、16 頁：遲加入者只完成核心範疇的 ☐ */
    lateJoin: {},
    /** 官方第 28–31 頁：活動及服務紀錄（每頁 12 行，共 48 行） */
    activities: [],
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

// ------------------------------------------------------------------ 選修／興趣範疇選項（對齊 BADGE 及 2026《幼童軍訓練綱要》）
export const INTEREST_DOMAINS = [
  { code: 'CREATIVE', no: '5', zh: '多元創藝', en: 'Diverse Creativity', category: 'CREATIVE' },
  { code: 'NATURE', no: '6', zh: '科學與大自然', en: 'Science and Nature', category: 'SCIENCE' },
  { code: 'SPORTS', no: '7', zh: '運動與愛好', en: 'Sports and Hobbies', category: 'SPORTS' },
];

/** 將活動徽章識別碼（含 `OT-A18-E` 三級制後綴）轉為可讀名稱。 */
export function formatInterestBadgeLabel(ref, lang = 'zh') {
  if (!ref) return '';
  const { id, level } = splitLevelRef(String(ref).trim());
  const bookId = toBookId(id);
  const meta = OTHER_BADGES.find((b) => b.id === bookId);
  if (!meta) return String(ref);
  const base = lang === 'en' ? meta.en : meta.name;
  if (level && LEVEL_LABEL[level]) {
    return lang === 'en'
      ? `${base} (${LEVEL_LABEL[level].en})`
      : `${base}（${LEVEL_LABEL[level].zh}）`;
  }
  return base;
}

/**
 * 依進度性獎章階段（`L3` 歷奇章、`L4` 高級歷奇章、`OT-GB` 金紫荊獎章）及範疇，
 * 回傳《幼童軍訓練綱要》乙部「興趣範疇」及 BADGE `allowedBadgeIds` 指定之可選活動徽章清單。
 * 三級制度章同時提供基本章與初／中／高級選項，方便記錄進階級別。
 */
export function interestDomainOptions(awardId, domainOrCategory) {
  const category = domainOrCategory === 'NATURE' ? 'SCIENCE' : domainOrCategory;
  const award = ALL_AWARDS.find((a) => a.id === awardId);
  const seg = award?.segments?.find((s) => s.activityRequirement);
  const allowedIds = seg?.activityRequirement?.allowedBadgeIds || [];
  const baseBadges = allowedIds.length
    ? allowedIds
        .map((id) => OTHER_BADGES.find((b) => b.id === id))
        .filter((b) => b && (!category || b.category === category))
    : OTHER_BADGES.filter((b) => !category || b.category === category);

  const out = [];
  for (const b of baseBadges) {
    out.push({
      id: b.id,
      badgeId: b.badgeId,
      baseId: b.id,
      level: '',
      zh: b.name,
      name: b.name,
      en: b.en,
      category: b.category,
    });
    if (isLeveledRef(b.id)) {
      for (const lv of LEVEL_KEYS) {
        out.push({
          id: `${b.id}-${lv}`,
          badgeId: `${b.badgeId}-${lv}`,
          baseId: b.id,
          level: lv,
          zh: `${b.name}（${LEVEL_LABEL[lv].zh}）`,
          name: `${b.name}（${LEVEL_LABEL[lv].zh}）`,
          en: `${b.en} (${LEVEL_LABEL[lv].en})`,
          category: b.category,
        });
      }
    }
  }
  return out;
}

const CORE_ELECTIVE_MAP = {
  'L3-CARING-04': [
    { id: 'OT-A06', badgeId: 'OT-A06', zh: '完成「家務章」', en: 'Complete Home Help Badge' },
    { id: 'CONTENT', zh: '完成 a–d 日行一善考驗內容', en: 'Complete Good Turn items a–d' },
  ],
  'L4-SKILLS-04': [
    { id: 'HOLIDAY_CAMP', zh: '度假營（不少於兩日一夜）', en: 'Holiday camp (at least 2 days 1 night)' },
    { id: 'CAMPING', zh: '露營（不少於兩日一夜）', en: 'Camping (at least 2 days 1 night)' },
    { id: 'BOTH', zh: '露營及度假營兩項均參與', en: 'Both camping and holiday camp' },
  ],
  'L4-CARING-04': [
    { id: 'OT-A09-CHILD-PROTECTION', badgeId: 'OT-A09-CHILD-PROTECTION', zh: '完成「保護兒童章」', en: 'Complete Child Protection Badge' },
  ],
  'L4-CARING-05': [
    { id: 'OT-A08', badgeId: 'OT-A08', zh: 'i. 水上安全章', en: 'i. Water Safety Badge' },
    { id: 'OT-A07', badgeId: 'OT-A07', zh: 'ii. 道路安全章', en: 'ii. Road Safety Badge' },
  ],
  'OT-GB-SKILLS-02': [
    { id: 'i+ii', zh: 'i. 旗杆架 ＋ ii. 衣鞋架', en: 'i. Flagpole stand + ii. Clothes/shoe rack' },
    { id: 'i+iii', zh: 'i. 旗杆架 ＋ iii. 戰車架', en: 'i. Flagpole stand + iii. Chariot frame' },
    { id: 'i+iv', zh: 'i. 旗杆架 ＋ iv. 羅馬炮架', en: 'i. Flagpole stand + iv. Roman catapult' },
    { id: 'ii+iii', zh: 'ii. 衣鞋架 ＋ iii. 戰車架', en: 'ii. Clothes/shoe rack + iii. Chariot frame' },
    { id: 'ii+iv', zh: 'ii. 衣鞋架 ＋ iv. 羅馬炮架', en: 'ii. Clothes/shoe rack + iv. Roman catapult' },
    { id: 'iii+iv', zh: 'iii. 戰車架 ＋ iv. 羅馬炮架', en: 'iii. Chariot frame + iv. Roman catapult' },
  ],
  'OT-GB-SKILLS-03': [
    { id: 'OT-A01', badgeId: 'OT-A01', zh: '完成「露營章」', en: 'Complete Camper Badge' },
    { id: 'CONTENT', zh: '完成 a 項（i–vi）露營考驗內容', en: 'Complete camping items a (i–vi)' },
  ],
  'OT-GB-SKILLS-04': [
    { id: 'OT-A02', badgeId: 'OT-A02', zh: '完成「探險章」', en: 'Complete Explorer Badge' },
    { id: 'CONTENT', zh: '完成 a–c 地圖及指南針考驗內容', en: 'Complete map & compass items a–c' },
  ],
  'OT-GB-SKILLS-05': [
    { id: 'OT-A02', badgeId: 'OT-A02', zh: '完成「探險章」', en: 'Complete Explorer Badge' },
    { id: 'CONTENT', zh: '完成 a–b 遠足考驗內容', en: 'Complete expedition items a–b' },
  ],
  'OT-GB-CARING-01': [
    { id: 'OT-A05', badgeId: 'OT-A05', zh: '完成「急救章」', en: 'Complete First Aid Badge' },
  ],
  'OT-GB-CARING-05': [
    { id: 'OT-A04', badgeId: 'OT-A04', zh: 'i. 共融章', en: 'i. Disability Awareness Badge' },
    { id: 'OT-A03', badgeId: 'OT-A03', zh: 'ii. 愛護動物章', en: 'ii. Animal Care Badge' },
  ],
  'OT-GB-COUNTRY-04': [
    { id: 'OT-A10', badgeId: 'OT-A10', zh: '完成「香港歷史章」', en: 'Complete Hong Kong Historian Badge' },
    { id: 'CONTENT', zh: '完成 a 項香港古蹟與文物考驗內容', en: 'Complete Hong Kong heritage item a' },
  ],
  'OT-GB-FAMILY-01': [
    { id: 'CONTENT', zh: '完成 a–d 全部考驗內容', en: 'Complete all items a–d' },
    { id: 'OT-A42', badgeId: 'OT-A42', zh: '已完成「童軍先修章」（豁免 d 部分）', en: 'Completed Scout Link Badge (exempt part d)' },
  ],
};

/** 回傳核心範疇選修／替代活動徽章或考驗選項清單（無選修項則回傳空陣列）。 */
export function itemElectiveOptions(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
  if (!id) return [];
  const item = ITEM_INDEX[id] || SYLLABUS_ITEMS.find((it) => it.id === id || it.legacyCode === id);
  const key = item?.id || id;
  if (CORE_ELECTIVE_MAP[key]) return CORE_ELECTIVE_MAP[key];
  if (item?.alternativeBadgeIds?.length) {
    return item.alternativeBadgeIds.map((bid) => {
      const meta = OTHER_BADGES.find((b) => b.id === bid);
      return {
        id: bid,
        badgeId: bid,
        zh: meta ? meta.name : bid,
        en: meta ? meta.en : bid,
      };
    });
  }
  if (item?.requiredBadgeId) {
    const meta = OTHER_BADGES.find((b) => b.id === item.requiredBadgeId);
    return [
      {
        id: item.requiredBadgeId,
        badgeId: item.requiredBadgeId,
        zh: meta ? `完成「${meta.name}」` : item.requiredBadgeId,
        en: meta ? `Complete ${meta.en} Badge` : item.requiredBadgeId,
      },
    ];
  }
  return [];
}

// ------------------------------------------------------------------ 進度判斷
const hasDate = (book, id) => Boolean(book?.progress?.[id]?.date);

/** 興趣範疇是否已達標：指定清單內、兩個不同類別、每類至少一個活動徽章。 */
export function interestProgress(book, segment) {
  const req = segment?.activityRequirement;
  if (!req) return { satisfied: false, count: 0, categories: [], needed: null, completedBadges: [] };
  const allowed = new Set(req.allowedBadgeIds || []);
  const byCategory = new Map();
  const completedMap = new Map();
  const addCompleted = (badge, refId, date) => {
    if (!badge || !allowed.has(badge.id) || !date) return;
    if (!byCategory.has(badge.category)) byCategory.set(badge.category, []);
    const list = byCategory.get(badge.category);
    if (!list.includes(badge.id)) list.push(badge.id);
    if (!completedMap.has(badge.id)) {
      completedMap.set(badge.id, {
        id: refId || badge.id,
        baseId: badge.id,
        zh: formatInterestBadgeLabel(refId || badge.id, 'zh'),
        en: formatInterestBadgeLabel(refId || badge.id, 'en'),
        date,
      });
    }
  };

  for (const badge of OTHER_BADGES) {
    if (!allowed.has(badge.id)) continue;
    const entry = book?.otherBadges?.[badge.id];
    const date = entry?.date || latestLevelDate(levelsOf(entry));
    if (!date) continue;
    addCompleted(badge, badge.id, date);
  }

  const awardId = String(segment?.code || '').replace(/-INTEREST$/, '');
  const awardInterest = awardId ? book?.interest?.[awardId] : null;
  if (awardInterest?.badges && typeof awardInterest.badges === 'object') {
    for (const row of Object.values(awardInterest.badges)) {
      if (!row?.badgeId) continue;
      const { id, level } = splitLevelRef(row.badgeId);
      const baseId = toBookId(id);
      const badge = OTHER_BADGES.find((b) => b.id === baseId);
      if (!badge) continue;
      const otherEntry = book?.otherBadges?.[baseId];
      const fallbackDate = level
        ? levelsOf(otherEntry)?.[level]?.date || otherEntry?.date
        : otherEntry?.date || latestLevelDate(levelsOf(otherEntry));
      const date = row.date || fallbackDate || '';
      if (date) addCompleted(badge, row.badgeId, date);
    }
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
    completedBadges: [...completedMap.values()],
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
  // 「已獲獎章」= 全部細項完成，或已在該獎章的官方頁（第 10–19 頁）記錄頒發／完成日期。
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

export function membershipStatus(book, refDate = new Date()) {
  const last = latestRenewal(book);
  const ref = refDate instanceof Date ? refDate : new Date(refDate);
  const refIso = Number.isNaN(ref.getTime()) ? today() : ref.toISOString().slice(0, 10);
  return {
    renewal: last,
    validUntil: last?.validUntil || null,
    active: Boolean(last?.validUntil && last.validUntil >= refIso),
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
  // 示範資料全部虛構：永遠沒有任何項目可送交正式系統。
  if (isDemoBook(book) || isDemoScoutId(scoutId(book?.member))) return [];
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
  assertNotDemo(book);
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
  // 示範紀錄冊不可與真實帳戶的已核實進度混合，亦不可綁定真實 SCOUT ID。
  assertNotDemo(srcBook);
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

// 示範紀錄冊：完整的「金紫荊獎章申請」模擬樣本，供真機測試全冊及 PT/67・PT/68 列印。
// 全部內容虛構：`meta.demo` 標記、保留的全零 SCOUT ID、「示範」字樣的旅團及領袖稱謂；
// 不含任何簽名圖片，亦不帶 `confirmedByBadge`（示範資料從未經任何領袖核實）。
const DEMO_LEADER = '示範團長';
const DEMO_EXAMINER = '示範考驗員';

const addDays = (iso, days) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

/** 各獎章的示範時間線：首項日期、每項相隔日數、頒發／完成日期。 */
const DEMO_AWARD_PLAN = {
  L1: { start: '2023-09-16', step: 7, awarded: '2023-11-25', certNo: 'DEMO-L1-0001' },
  L2: { start: '2024-01-13', step: 14, awarded: '2024-06-22', certNo: 'DEMO-L2-0001' },
  L3: { start: '2024-09-07', step: 14, awarded: '2025-04-26', certNo: 'DEMO-L3-0001' },
  L4: { start: '2025-05-10', step: 14, awarded: '2026-01-17', certNo: 'DEMO-L4-0001' },
  // 最後一項 2026-10-17：示範成員（2016-04-12 出生）當日已滿十歲半（126 個月）。
  'OT-GB': { start: '2026-03-07', step: 14, awarded: '2026-10-17', certNo: 'DEMO-GB-0001' },
};

/** 核心範疇的選修／替代完成方式（附錄下拉選單）。 */
const DEMO_ELECTIVES = {
  'L3-CARING-04': 'OT-A06',
  'L4-SKILLS-04': 'CAMPING',
  'L4-CARING-04': 'OT-A09-CHILD-PROTECTION',
  'L4-CARING-05': 'OT-A08',
  'OT-GB-SKILLS-02': 'i+ii',
  'OT-GB-SKILLS-03': 'OT-A01',
  'OT-GB-SKILLS-04': 'CONTENT',
  'OT-GB-SKILLS-05': 'OT-A02',
  'OT-GB-CARING-01': 'OT-A05',
  'OT-GB-CARING-05': 'OT-A04',
  'OT-GB-COUNTRY-04': 'OT-A10',
  'OT-GB-FAMILY-01': 'OT-A42',
};

/** 興趣範疇：每個獎章選兩個不同類別，各一枚活動徽章，且不與較低階獎章重複。 */
const DEMO_INTEREST = {
  L3: { CREATIVE: ['OT-A12', '2025-02-08'], SPORTS: ['OT-A28', '2025-03-08'] },
  L4: { NATURE: ['OT-A22', '2025-08-16'], SPORTS: ['OT-A32', '2025-11-15'] },
  'OT-GB': { CREATIVE: ['OT-A19', '2026-06-13'], NATURE: ['OT-A24', '2026-08-15'] },
};

/** 核心項目所用的活動徽章及其他示範徽章（日期須不遲於引用它的項目）。 */
const DEMO_BADGES = {
  'OT-A06': '2024-10-19',
  'OT-A09-CHILD-PROTECTION': '2025-08-02',
  'OT-A08': '2025-08-23',
  'OT-A01': '2026-04-04',
  'OT-A02': '2026-05-02',
  'OT-A05': '2026-05-16',
  'OT-A04': '2026-07-11',
  'OT-A10': '2026-08-22',
  'OT-A42': '2026-10-03',
};

/** 分級活動徽章：逐級一行，用作檢查第 24–26 頁的初／中／高級列印。 */
const DEMO_LEVELED = {
  'OT-A26': { E: '2025-03-15', I: '2026-05-30' },
  'OT-A39': { E: '2024-07-20', I: '2025-07-19', A: '2026-07-18' },
};

const DEMO_ACTIVITIES = [
  ['2023-11-25', '宣誓儀式（示範）'],
  ['2024-03-16', '旅團大會操'],
  ['2024-07-13', '暑期日營'],
  ['2024-11-09', '區幼童軍大會操'],
  ['2025-01-25', '社區長者中心服務'],
  ['2025-04-26', '歷奇章頒發禮'],
  ['2025-07-12', '隊長／副隊長訓練班'],
  ['2025-10-18', '郊野公園遠足'],
  ['2025-12-20', '賣旗日服務'],
  ['2026-01-17', '高級歷奇章頒發禮'],
  ['2026-04-04', '兩日一夜露營'],
  ['2026-05-16', '社區清潔服務'],
  ['2026-06-20', '探訪護老院服務'],
  ['2026-07-11', '隊長訓練班（領導才能）'],
];

/** 示範紀錄冊：全部虛構，只供測試，不可遞交亦不可同步。 */
export function demoBook() {
  const book = newBook({ meta: { demo: true } });
  book.member = {
    ...book.member,
    nameZh: '陳小狼',
    nameEn: 'CHAN Siu-long',
    scoutId: DEMO_SCOUT_ID,
    memberNo: DEMO_SCOUT_ID,
    gender: '男',
    dob: '2016-04-12',
    pob: '香港',
    hkidPrefix: 'A123',
    primaryLevel: '小五',
    school: '示範小學',
    phone: '0000 0001',
    email: 'demo@example.invalid',
    addressZh: '新界示範邨示範樓 12 樓 3 室',
    addressEn: 'Flat 3, 12/F, Demo House, Demo Estate, N.T.',
    parentName: '陳大文',
    parentRelation: '父',
    parentPhone: '0000 0002',
    emergencyName: '陳大文（父）',
    emergencyPhone: '0000 0002',
    six: '棕狼隊',
    region: '示範地域',
    district: '示範區',
    group: '示範第 12 旅',
    pack: '示範第 12 旅幼童軍團',
    groupAddress: '新界示範道 1 號示範童軍中心',
    gsl: '示範旅長',
    csl: DEMO_LEADER,
    cslPhone: '0000 0003',
    dateJoined: '2023-09-02',
    ageOnJoining: '7',
    dateInvestiture: DEMO_AWARD_PLAN.L1.awarded,
    dateOfIssue: '2023-09-02',
  };

  // 72 個進度細項：逐項日期及考驗員姓名（純文字，不含簽名圖片、不標示已核實）。
  for (const award of ALL_AWARDS) {
    const plan = DEMO_AWARD_PLAN[award.id];
    let index = 0;
    for (const segment of award.segments) {
      let last = '';
      for (const item of segment.items) {
        last = addDays(plan.start, index * plan.step);
        book.progress[item.id] = {
          date: last,
          assessor: award.id === 'L1' ? DEMO_LEADER : DEMO_EXAMINER,
          ...(DEMO_ELECTIVES[item.id] ? { elective: DEMO_ELECTIVES[item.id] } : {}),
        };
        index += 1;
      }
      if (segment.items.length && award.id !== 'L1') {
        book.domains[segment.code] = { examiner: DEMO_EXAMINER, date: last };
      }
    }
    book.pages[`award_${award.id}`] = { date: plan.awarded, certNo: plan.certNo, presentedBy: DEMO_LEADER };
  }
  for (const [id, electiveId] of Object.entries(DEMO_ELECTIVES)) {
    if (DEMO_BADGES[electiveId]) book.progress[id].cert = `DEMO-${toBadgeId(electiveId)}`;
  }

  // 活動徽章（第 21–27 頁）及興趣範疇（第 15、17、19 頁）
  for (const [id, date] of Object.entries(DEMO_BADGES)) {
    book.otherBadges[id] = { date, cert: `DEMO-${toBadgeId(id)}` };
  }
  for (const [awardId, picks] of Object.entries(DEMO_INTEREST)) {
    const badges = {};
    for (const [domain, [badgeId, date]] of Object.entries(picks)) {
      badges[domain] = { badgeId, examiner: DEMO_EXAMINER, date };
      book.otherBadges[badgeId] = { date, cert: `DEMO-${toBadgeId(badgeId)}` };
    }
    book.interest[awardId] = { chosen: Object.keys(picks), badges };
  }
  for (const [id, levels] of Object.entries(DEMO_LEVELED)) {
    const rows = Object.fromEntries(Object.entries(levels).map(([level, date]) => [level, { date }]));
    book.otherBadges[id] = { levels: rows, date: latestLevelDate(rows), cert: `DEMO-${toBadgeId(id)}` };
  }

  // 童軍先修章（第 20 頁）
  book.domains['SL-1'] = { examiner: DEMO_EXAMINER, date: '2026-09-05' };
  book.domains['SL-2'] = { examiner: DEMO_EXAMINER, date: '2026-09-19' };
  book.domains['SL-3'] = { examiner: DEMO_EXAMINER, date: '2026-10-03' };
  book.pages['award_OT-SL'] = { date: '2026-10-03' };

  // 第 8–9 頁：個人進度紀錄及服務年星
  book.personalProgress = {
    ...book.personalProgress,
    membership: DEMO_AWARD_PLAN.L1.awarded,
    experience: DEMO_AWARD_PLAN.L2.awarded,
    adventure: DEMO_AWARD_PLAN.L3.awarded,
    crest: DEMO_AWARD_PLAN.L4.awarded,
    goldenBauhinia: '2026-11-07',
    scoutLink: '2026-10-03',
    second: '2025-09-06',
    sixer: '2026-04-11',
  };
  book.serviceStars = { ...book.serviceStars, y1: '2024-09-07', y2: '2025-09-06', y3: '2026-09-05' };

  // 第 4–5 頁：會員資格、轉旅及遷移地址
  book.renewals = [
    { from: '2023-09-02', validUntil: '2024-03-31', leaderName: DEMO_LEADER },
    { from: '2024-04-01', validUntil: '2025-03-31', leaderName: DEMO_LEADER },
    { from: '2025-04-01', validUntil: '2026-03-31', leaderName: DEMO_LEADER },
    { from: '2026-04-01', validUntil: '2027-03-31', leaderName: DEMO_LEADER },
  ];
  book.transfers = [];
  book.addressChanges = [{ date: '2025-08-16', address: '新界示範邨示範樓 12 樓 3 室' }];

  // 第 28–31 頁：活動及服務紀錄（首頁 12 行寫滿，次頁續 2 行）
  book.activities = DEMO_ACTIVITIES.map(([date, text]) => ({ date, text }));

  // 表格專用欄位：PT/67 於開展考驗前遞交，PT/68 於完成全部項目後遞交。
  const gold = DEMO_AWARD_PLAN['OT-GB'];
  book.forms.pt67 = {
    age: '9',
    primaryLevel: '小四',
    planStartDate: gold.start,
    planFinishDate: '2026-10-31',
    plannedItems:
      '甲、核心範疇：童軍技能章、關己愛人章、國家與社區章、童軍家庭章（4.1.1 至 4.4.2 共 17 項）。\n乙、興趣範疇：多元創藝（攝影章）、科學與大自然（氣象章）。\n（示範資料，只供列印測試）',
    applicantDate: '2026-01-24',
    cslDate: '2026-01-24',
    dcName: '示範區總監',
    dcDate: '2026-02-07',
  };
  book.forms.pt68 = {
    age: '10',
    campDates: '04/04/2026 至 05/04/2026',
    serviceDates: '16/05/2026、20/06/2026',
    leadershipDates: '11/07/2026 隊長訓練班（示範）',
    applicantDate: gold.awarded,
    nominationName: DEMO_LEADER,
    nominationDate: gold.awarded,
    recommendationName: '示範區總監',
    recommendationDate: '2026-10-24',
    approvalName: '示範地域總監',
    approvalDate: '2026-10-31',
    receivedDate: '2026-10-27',
    goldenCertNo: gold.certNo,
    certIssueDate: '2026-11-07',
    awardDate: '2026-11-07',
    remarks: '示範資料，只供列印測試。',
  };
  book.forms.gbac = { age: '10' };

  return book;
}
