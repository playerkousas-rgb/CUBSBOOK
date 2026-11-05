/**
 * 官方《幼童軍紀錄冊》頁面藍本（香港童軍總會，© 2026）
 *
 * 唯一依據：Drive → working → BOOK → 幼童軍紀錄冊2026Sep version.pdf
 * 全書 32 頁，頁碼、頁序、中英標題均照官方排列；CUBBOOK 不新增、不合併、
 * 不重排任何官方頁。數位延伸（72 項進度、制服、使用說明）只放在附錄。
 */

export const OFFICIAL_GROUPS = [
  { id: 'details', zh: '個人資料及旅團紀錄', en: 'Personal Details & Pack Record', from: 1, to: 5 },
  { id: 'promise', zh: '誓詞、進度及年星', en: 'Promise, Progress & Service Stars', from: 6, to: 9 },
  { id: 'membership', zh: '會員章', en: 'Membership Badge', from: 10, to: 11 },
  { id: 'awards', zh: '進度性獎章', en: 'Progressive Badges', from: 12, to: 19 },
  { id: 'link', zh: '童軍先修章', en: 'Scout Link Badge', from: 20, to: 20 },
  { id: 'activity', zh: '活動徽章', en: 'Activity Badges', from: 21, to: 26 },
  { id: 'log', zh: '活動及服務紀錄', en: 'Activities & Services Record', from: 27, to: 30 },
  { id: 'closing', zh: '團呼及封底', en: 'The Grand Howl & Back Cover', from: 31, to: 32 },
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
  page(1, '封面', 'Cover', 'details', 'cover'),
  page(2, '個人摘要', 'Personal Details', 'details', 'details'),
  page(3, '童軍紀錄', 'Scouting Record', 'details', 'scouting'),
  page(4, '會員資格續期', 'Renewal of Membership', 'details', 'renewal'),
  page(5, '轉旅及遷移地址', 'Transfer of Group & Change of Address', 'details', 'transfer'),
  page(6, '幼童軍誓詞、規律及銘言', 'Cub Scout Promise, Law and Motto', 'promise', 'static'),
  page(7, '進度性獎章', 'Progressive Badges', 'promise', 'static'),
  page(8, '個人進度紀錄', 'Personal Progress Record', 'promise', 'progress-record'),
  page(9, '服務年星', 'Service Star', 'promise', 'service-star'),
  page(10, '會員章（一）', 'Membership Badge (a)–(c)', 'membership', 'membership', { badge: 'L1' }),
  page(11, '會員章（二）', 'Membership Badge (d)–(i)', 'membership', 'membership', { badge: 'L1' }),
  page(12, '幼童軍體驗章', 'C.S. Experience Badge', 'awards', 'award-intro', { badge: 'L2' }),
  page(13, '體驗章 — 核心範疇', 'Core Domains', 'awards', 'core-domains', { badge: 'L2', award: 'L2' }),
  page(14, '歷奇章 — 核心範疇（初級）', 'Core Domains (Elementary Level)', 'awards', 'core-domains', { badge: 'L3', award: 'L3' }),
  page(15, '歷奇章 — 興趣範疇', 'Interest Domains', 'awards', 'interest-domains', { badge: 'L3', award: 'L3' }),
  page(16, '高級歷奇章 — 核心範疇（中級）', 'Core Domains (Intermediate Level)', 'awards', 'core-domains', { badge: 'L4', award: 'L4' }),
  page(17, '高級歷奇章 — 興趣範疇', 'Interest Domains', 'awards', 'interest-domains', { badge: 'L4', award: 'L4' }),
  page(18, '金紫荊獎章 — 核心範疇（高級）', 'Core Domains (Advanced Level)', 'awards', 'core-domains', { badge: 'OT-GB', award: 'OT-GB' }),
  page(19, '金紫荊獎章 — 興趣範疇', 'Interest Domains', 'awards', 'interest-domains', { badge: 'OT-GB', award: 'OT-GB' }),
  page(20, '童軍先修章', 'Scout Link Badge', 'link', 'scout-link', { badge: 'OT-SL' }),
  page(21, '活動徽章 — 童軍技能', 'Activity Badges — Scoutcraft', 'activity', 'badges', { category: 'SCOUT_SKILLS' }),
  page(22, '活動徽章 — 關己愛人', 'Activity Badges — Caring for Self and Others', 'activity', 'badges', { category: 'CARING' }),
  page(23, '活動徽章 — 國家與社區', 'Activity Badges — Country and Community', 'activity', 'badges', { category: 'COUNTRY' }),
  page(24, '活動徽章 — 多元創藝', 'Activity Badges — Diverse Creativity', 'activity', 'badges', { category: 'CREATIVE' }),
  page(25, '活動徽章 — 科學與大自然', 'Activity Badges — Science and Nature', 'activity', 'badges', { category: 'NATURE' }),
  page(26, '活動徽章 — 運動與愛好／其他徽章', 'Activity Badges — Sports and Hobbies / Other Badges', 'activity', 'badges', { category: 'SPORTS', otherBadges: true }),
  page(27, '活動及服務紀錄（一）', 'Activities & Services Record', 'log', 'activity-log', { from: 0 }),
  page(28, '活動及服務紀錄（二）', 'Activities & Services Record', 'log', 'activity-log', { from: 10 }),
  page(29, '活動及服務紀錄（三）', 'Activities & Services Record', 'log', 'activity-log', { from: 20 }),
  page(30, '活動及服務紀錄（四）', 'Activities & Services Record', 'log', 'activity-log', { from: 30 }),
  page(31, '幼童軍團呼', 'The Grand Howl', 'closing', 'static'),
  page(32, '封底', 'Back Cover', 'closing', 'back-cover'),
];

export const OFFICIAL_PAGE_COUNT = OFFICIAL_PAGES.length;

export const groupOf = (no) => OFFICIAL_GROUPS.find((g) => no >= g.from && no <= g.to);

/** 官方頁 → 現行資料鍵（用於附錄及同步說明） */
export const AWARD_PAGE_OF = {
  L1: ['p10', 'p11'],
  L2: ['p12', 'p13'],
  L3: ['p14', 'p15'],
  L4: ['p16', 'p17'],
  'OT-GB': ['p18', 'p19'],
};
