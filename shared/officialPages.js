/**
 * 官方《幼童軍紀錄冊》頁面藍本（香港童軍總會，© 2026）
 *
 * 唯一依據：Drive → working → BOOK → 幼童軍紀錄冊2026Sep version.pdf
 * 全書 = 封面（不計頁碼）＋ 官方印刷頁 1–32。
 * 第 12 頁是「進度性獎章」章節扉頁（官方不印頁碼，但仍佔第 12 頁）。
 * CUBBOOK 不新增、不合併、不重排任何官方頁；數位延伸只放在附錄。
 */

export const OFFICIAL_GROUPS = [
  { id: 'details', zh: '個人及旅團紀錄', en: 'Personal Details & Pack Record', from: 1, to: 5 },
  { id: 'promise', zh: '誓詞、進度及年星', en: 'Promise, Progress & Service Stars', from: 6, to: 9 },
  { id: 'membership', zh: '會員章', en: 'Membership Badge', from: 10, to: 11 },
  { id: 'awards', zh: '進度性獎章', en: 'Progressive Badges', from: 12, to: 19 },
  { id: 'link', zh: '童軍先修章', en: 'Scout Link Badge', from: 20, to: 20 },
  { id: 'activity', zh: '活動徽章紀錄', en: 'Activity Badges Record', from: 21, to: 27 },
  { id: 'log', zh: '活動及服務紀錄', en: 'Activities & Services Record', from: 28, to: 31 },
  { id: 'closing', zh: '幼童軍團呼', en: 'The Grand Howl', from: 32, to: 32 },
];

const page = (no, zh, en, group, kind, extra = {}) => ({
  id: `p${String(no).padStart(2, '0')}`,
  no,
  page: String(no),
  zh,
  en,
  group,
  kind,
  ...extra,
});

export const OFFICIAL_PAGES = [
  page(1, '個人摘要（一）', 'Personal Details', 'details', 'personal-1'),
  page(2, '個人摘要（二）', 'Personal Details', 'details', 'personal-2', { bannerZh: '個人摘要' }),
  page(3, '童軍紀錄', 'Scouting Record', 'details', 'scouting'),
  page(4, '會員資格', 'Renewal of Membership', 'details', 'renewal'),
  page(5, '轉旅 及 遷移地址', 'Transfer of Group / Change of Address', 'details', 'transfer'),
  page(6, '幼童軍誓詞、規律及銘言', 'Cub Scout Promise, Law and Motto', 'promise', 'static'),
  page(7, '進度性獎章', 'Progressive Badges', 'promise', 'static'),
  page(8, '個人進度紀錄', 'Personal Progress Record', 'promise', 'progress-record'),
  page(9, '服務年星', 'Service Star', 'promise', 'service-star'),
  page(10, '會員章', 'Membership Badge', 'membership', 'membership-a', { badge: 'L1' }),
  page(11, '會員章', 'Membership Badge', 'membership', 'membership-b', { badge: 'L1' }),
  page(12, '進度性獎章', 'Progressive Badges', 'awards', 'divider'),
  page(13, '幼童軍體驗章', 'C.S. Experience Badge', 'awards', 'core', { award: 'L2', coreOnly: true }),
  page(14, '幼童軍歷奇章', 'C.S. Adventure Award', 'awards', 'core', { award: 'L3', level: '初級' }),
  page(15, '幼童軍歷奇章', 'C.S. Adventure Award', 'awards', 'interest', { award: 'L3' }),
  page(16, '幼童軍高級歷奇章', 'C.S. Adventure Crest Award', 'awards', 'core', { award: 'L4', level: '中級' }),
  page(17, '幼童軍高級歷奇章', 'C.S. Adventure Crest Award', 'awards', 'interest', { award: 'L4' }),
  page(18, '金紫荊獎章', 'Golden Bauhinia Award', 'awards', 'core', { award: 'OT-GB', level: '高級' }),
  page(19, '金紫荊獎章', 'Golden Bauhinia Award', 'awards', 'interest', { award: 'OT-GB' }),
  page(20, '童軍先修章', 'Scout Link Badge', 'link', 'scout-link'),
  page(21, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 21 }),
  page(22, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 22 }),
  page(23, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 23 }),
  page(24, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 24 }),
  page(25, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 25 }),
  page(26, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 26 }),
  page(27, '活動徽章紀錄', 'Activity Badges Record', 'activity', 'activity', { plan: 27 }),
  page(28, '活動及服務紀錄', 'Activities & Services Record', 'log', 'activity-log', { from: 0 }),
  page(29, '活動及服務紀錄', 'Activities & Services Record', 'log', 'activity-log', { from: 12 }),
  page(30, '活動及服務紀錄', 'Activities & Services Record', 'log', 'activity-log', { from: 24 }),
  page(31, '活動及服務紀錄', 'Activities & Services Record', 'log', 'activity-log', { from: 36 }),
  page(32, '幼童軍團呼', 'The Grand Howl', 'closing', 'static'),
];

export const COVER = {
  id: 'cover',
  page: '—',
  zh: '封面',
  en: 'Cover',
  group: 'details',
  kind: 'cover',
};

export const OFFICIAL_PAGE_COUNT = OFFICIAL_PAGES.length;

export const groupOf = (no) => OFFICIAL_GROUPS.find((g) => no >= g.from && no <= g.to);

/**
 * 紙本章節 → 官方頁碼（單一真相）。
 * 所有介面文案、表格附件清單及列印對照一律由這裡推導，不得另行手寫頁碼，
 * 以免殘留其他支部 BOOK 或舊版排版的頁數。
 */
const noOf = (pred) => OFFICIAL_PAGES.filter(pred).map((p) => p.no);

export const PAPER_SECTIONS = {
  personal: { zh: '個人摘要', en: 'Personal Details', pages: noOf((p) => p.kind.startsWith('personal-')) },
  scouting: { zh: '童軍紀錄', en: 'Scouting Record', pages: noOf((p) => p.kind === 'scouting') },
  renewal: { zh: '會員資格', en: 'Renewal of Membership', pages: noOf((p) => p.kind === 'renewal') },
  transfer: { zh: '轉旅及遷移地址', en: 'Transfer of Group / Change of Address', pages: noOf((p) => p.kind === 'transfer') },
  promise: { zh: '誓詞、規律及銘言', en: 'Promise, Law and Motto', pages: [6] },
  progressRecord: { zh: '個人進度紀錄', en: 'Personal Progress Record', pages: noOf((p) => p.kind === 'progress-record') },
  serviceStar: { zh: '服務年星', en: 'Service Star', pages: noOf((p) => p.kind === 'service-star') },
  L1: { zh: '會員章', en: 'Membership Badge', pages: noOf((p) => p.group === 'membership') },
  L2: { zh: '幼童軍體驗章', en: 'C.S. Experience Badge', pages: noOf((p) => p.award === 'L2') },
  L3: { zh: '幼童軍歷奇章', en: 'C.S. Adventure Award', pages: noOf((p) => p.award === 'L3') },
  L4: { zh: '幼童軍高級歷奇章', en: 'C.S. Adventure Crest Award', pages: noOf((p) => p.award === 'L4') },
  'OT-GB': { zh: '金紫荊獎章', en: 'Golden Bauhinia Award', pages: noOf((p) => p.award === 'OT-GB') },
  scoutLink: { zh: '童軍先修章', en: 'Scout Link Badge', pages: noOf((p) => p.kind === 'scout-link') },
  activity: { zh: '活動徽章紀錄', en: 'Activity Badges Record', pages: noOf((p) => p.kind === 'activity') },
  log: { zh: '活動及服務紀錄', en: 'Activities & Services Record', pages: noOf((p) => p.kind === 'activity-log') },
};

/** `[1,2,3,4,10,11,13]` → `1–4、10–11、13`（英文以 `, ` 分隔）。 */
export function formatPageList(numbers, lang = 'zh') {
  const sorted = [...new Set((numbers || []).map(Number).filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  const runs = [];
  for (const n of sorted) {
    const last = runs[runs.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else runs.push([n, n]);
  }
  return runs.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`)).join(lang === 'en' ? ', ' : '、');
}

/** 多個章節鍵 → 合併後的頁碼陣列（順序去重）。 */
export function pagesOfSections(keys) {
  return [...new Set((keys || []).flatMap((k) => PAPER_SECTIONS[k]?.pages || []))].sort((a, b) => a - b);
}

/** `['personal','scouting']` → `1–3`。 */
export function pageRefOfSections(keys, lang = 'zh') {
  return formatPageList(pagesOfSections(keys), lang);
}
