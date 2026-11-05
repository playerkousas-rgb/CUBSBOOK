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
