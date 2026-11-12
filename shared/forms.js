// ==========================================================================
// CUBBOOK — 幼童軍官方申請／紀錄表格自動帶入
// 官方表格：PT/67（金紫荊獎章開展通知書 4/2019）、PT/68（金紫荊獎章及證書申請表 06/2024）
// 2026 新制：官方表格編號尚未在總會表格目錄公布，因此只提供「非官方資料核對清單」，
//          不虛構 PT/XX 編號、不模擬官方簽署欄（對齊 cubbadge 的表格政策）。
// ==========================================================================

import {
  ITEM_INDEX,
  GOLD_AWARD,
  OTHER_BADGES,
  INTEREST_DOMAINS,
  ageFromDob,
  ageInMonths,
  sanitizeHkidPrefix,
  splitLevelRef,
  toBookId,
} from './book.js';
import {
  OFFICIAL_GROUPS,
  PAPER_SECTIONS,
  formatPageList,
  pageRefOfSections,
  pagesOfSections,
} from './officialPages.js';
import { levelsOf, levelSummary } from './badgeLevels.js';
import { DEMO_NOTICE, isDemoBook } from './demo.js';

export { DEMO_NOTICE, isDemoBook };

export const FORM_META = {
  pt67: {
    id: 'pt67',
    code: 'FORM PT/67 (4/2019)',
    short: 'PT/67',
    shortEn: 'PT/67',
    title: '金紫荊獎章開展通知書',
    en: 'Application for Assessment of the Golden Bauhinia Award',
    when: '年滿九歲半並完成「幼童軍歷奇章」後、正式開始金紫荊獎章考驗前，連同紀錄冊副本交所屬童軍區。',
    whenEn: 'After reaching 9 years 6 months and completing the Cub Scout Adventure Award, before starting the Golden Bauhinia Award assessment. Hand it to your Scout District with copies of the record book pages.',
    pages: 1,
    official: true,
    note: '官方表格；遞交前請以總會表格目錄的最新版本核對一次。',
    noteEn: 'Official form. Confirm you are using the latest version in the Association forms catalogue before submission.',
  },
  pt68: {
    id: 'pt68',
    code: 'FORM PT/68 (06/2024)',
    short: 'PT/68',
    shortEn: 'PT/68',
    title: '金紫荊獎章及證書申請表',
    en: 'Application Form for the Golden Bauhinia Award and Certificate',
    when: '完成全部金紫荊獎章考驗項目，並獲團長／旅長提名後遞交；每年 8 月 31 日或以前交抵地域辦事處方可於同年大會操獲嘉許。',
    whenEn: 'After completing every Golden Bauhinia Award item and being nominated by the C.S.L. / G.S.L. Applications reaching the Regional Office by 31 August are recognised at the same year’s Rally.',
    pages: 2,
    official: true,
    note: '官方表格；第 1–2 頁按總會要求列印。',
    noteEn: 'Official form. Print pages 1–2 as required by the Association.',
  },
  gbac: {
    id: 'gbac',
    code: '非官方資料核對清單（PT/XX 待官方公布）',
    short: '核對',
    shortEn: 'Checklist',
    title: '2026 新制金紫荊獎章資料核對清單',
    en: '2026 Scheme Golden Bauhinia Award — Unofficial Data Checklist',
    when: '完成 2026 新制金紫荊獎章所有細項後，用作與領袖核對紀錄冊資料；不是官方申請表。',
    whenEn: 'After completing every item of the 2026 scheme Golden Bauhinia Award, for checking your record book with your leader. It is not an official application form.',
    pages: 1,
    official: false,
    note: '本清單不是官方表格，不設模擬簽署欄；官方表格編號請向所屬童軍區確認。',
    noteEn: 'This checklist is not an official form and has no mock signature fields. Ask your Scout District for the current official form number.',
  },
};

export const FORM_ORDER = ['pt67', 'pt68', 'gbac'];

/**
 * 表格附件所指的紀錄冊章節。頁碼一律由 `shared/officialPages.js` 推導，
 * 以本專案 2026 年版《幼童軍紀錄冊》（封面＋第 1–32 頁）為準，電子頁碼與紙本逐頁相同。
 */
export const PT67_ATTACH_SECTIONS = ['personal', 'scouting', 'renewal', 'L1', 'L2'];
export const PT68_ATTACH_SECTIONS = ['personal', 'scouting', 'renewal', 'L1', 'L2', 'L3', 'L4', 'OT-GB'];

const sectionPageList = (keys) =>
  keys.map((k) => `${PAPER_SECTIONS[k].zh} ${formatPageList(PAPER_SECTIONS[k].pages)}`).join('、');

const FORM_PAGE_CAVEAT =
  '官方表格印行於 2026 年版紀錄冊之前；表上如印有其他頁碼，請以上述章節名稱為準，並向所屬童軍區確認。';

export const PT67_CHECKLIST = [
  '幼童軍紀錄冊內個人摘要、童軍紀錄、會員資格、會員章及幼童軍體驗章之副本。',
  `按 2026 年版紀錄冊頁序：第 ${pageRefOfSections(PT67_ATTACH_SECTIONS)} 頁（${sectionPageList(PT67_ATTACH_SECTIONS)}）；本電子紀錄冊頁碼與紙本相同。`,
  FORM_PAGE_CAVEAT,
  '已完成並由領袖簽署的會員章及幼童軍體驗章考驗紀錄。',
  '如超過十二歲：學校證明文件（只適用於金紫荊獎章考驗的延長安排）。',
];

export const PT68_CHECKLIST = [
  '金紫荊獎章考驗紀錄冊（由領袖及考驗員填寫；與本《幼童軍紀錄冊》並非同一本，版本以所屬童軍區現行要求為準）。',
  `幼童軍紀錄冊內個人摘要、童軍紀錄、會員資格、會員章、體驗章、歷奇章、高級歷奇章及金紫荊獎章考驗項目之副本（2026 年版第 ${pageRefOfSections(PT68_ATTACH_SECTIONS)} 頁）。`,
  FORM_PAGE_CAVEAT,
  '各項有關證書之副本。',
  '已批核的「金紫荊獎章開展通知書」（PT/67）之副本。',
  '團長／旅長提名已在表內簽署；區總監推薦及地域總監批核欄留待區／地域填寫及蓋印。',
];

const sectionPageListEn = (keys) =>
  keys.map((k) => `${PAPER_SECTIONS[k].en} ${formatPageList(PAPER_SECTIONS[k].pages, 'en')}`).join('; ');

const FORM_PAGE_CAVEAT_EN =
  'The official forms were printed before the 2026 edition of the record book. If a form quotes other page numbers, follow the section names above and confirm with your Scout District.';

export const PT67_CHECKLIST_EN = [
  'Copies of these Cub Scout Record Book sections: Personal Details, Scouting Record, Membership, Membership Badge and Cub Scout Experience Badge.',
  `In the 2026 edition these are pp. ${formatPageList(pagesOfSections(PT67_ATTACH_SECTIONS), 'en')} (${sectionPageListEn(PT67_ATTACH_SECTIONS)}); this digital book uses the same page numbers as the paper book.`,
  FORM_PAGE_CAVEAT_EN,
  'Membership Badge and Cub Scout Experience Badge records, completed and signed by the leader.',
  'If over 12 years old: documentary proof from the school (extension arrangement for the Golden Bauhinia Award only).',
];

export const PT68_CHECKLIST_EN = [
  'The Golden Bauhinia Award assessment record booklet (completed by leaders and examiners; it is not this Cub Scout Record Book — follow the version your Scout District currently requires).',
  `Copies of these Cub Scout Record Book sections: Personal Details, Scouting Record, Membership, Membership Badge, Experience Badge, Adventure Award, Adventure Crest Award and Golden Bauhinia Award (2026 edition pp. ${formatPageList(pagesOfSections(PT68_ATTACH_SECTIONS), 'en')}).`,
  FORM_PAGE_CAVEAT_EN,
  'Copies of all relevant certificates.',
  'A copy of the approved Application for Assessment (PT/67).',
  'The C.S.L. / G.S.L. nomination is signed on the form; the District Commissioner and Regional Commissioner boxes are left for the District / Region to complete and stamp.',
];

const checklistGroup = (title, titleEn, [from, to], items, itemsEn) => {
  const pages = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const zh = formatPageList(pages);
  const en = formatPageList(pages, 'en');
  return {
    title,
    titleEn,
    pages,
    paper: `紙本第 ${zh} 頁`,
    digital: `第 ${zh} 頁`,
    ref: `紙本第 ${zh} 頁 ＝ 電子頁第 ${zh} 頁`,
    refEn: `Paper pp. ${en} = digital pp. ${en}`,
    items,
    itemsEn,
  };
};

const groupRange = (...ids) => {
  const groups = OFFICIAL_GROUPS.filter((g) => ids.includes(g.id));
  return [Math.min(...groups.map((g) => g.from)), Math.max(...groups.map((g) => g.to))];
};

const withPages = (key, lang = 'zh') =>
  lang === 'en'
    ? `${PAPER_SECTIONS[key].en} (${PAPER_SECTIONS[key].pages.length > 1 ? 'pp.' : 'p.'} ${formatPageList(PAPER_SECTIONS[key].pages, 'en')})`
    : `${PAPER_SECTIONS[key].zh}（第 ${formatPageList(PAPER_SECTIONS[key].pages)} 頁）`;

/**
 * A4 列印檢查清單：紙本章節 ↔ 電子頁碼（逐頁相同）及列印設定。
 * 全冊列印＝封面（不計頁碼）＋官方第 1–32 頁，共 33 張 A4。
 */
export const PRINT_CHECKLIST = [
  checklistGroup(
    '個人摘要及童軍紀錄',
    'Personal Details & Scouting Record',
    groupRange('details'),
    [
      `${withPages('personal')}：近照、持有人簽署、緊急聯絡人、家長／監護人`,
      `${withPages('scouting')}：小隊、旅、區、地域及團長`,
      `${withPages('renewal')}：按年續期、領袖簽署及旅印`,
      withPages('transfer'),
    ],
    [
      `${withPages('personal', 'en')}: photo, holder signature, emergency contact, parent / guardian`,
      `${withPages('scouting', 'en')}: Six, Group, District, Region and C.S.L.`,
      `${withPages('renewal', 'en')}: yearly renewal, leader signature and Group chop`,
      withPages('transfer', 'en'),
    ],
  ),
  checklistGroup(
    '誓詞、進度及服務年星',
    'Promise, Progress & Service Stars',
    groupRange('promise'),
    [
      `${withPages('promise')}及進度性獎章說明（第 7 頁）：官方印刷內容，毋須填寫`,
      `${withPages('progressRecord')}：各獎章獲取日期`,
      `${withPages('serviceStar')}：一至六年星及晉升童軍團日期`,
    ],
    [
      `${withPages('promise', 'en')} and Progressive Badges (p. 7): printed content, nothing to fill in`,
      `${withPages('progressRecord', 'en')}: date each badge was gained`,
      `${withPages('serviceStar', 'en')}: 1st–6th year stars and transfer to Scout Troop`,
    ],
  ),
  checklistGroup(
    '會員章及進度性獎章',
    'Membership Badge & Progressive Badges',
    groupRange('membership', 'awards'),
    [
      `${withPages('L1')}：a–i 共 9 項`,
      `${withPages('L2')}：核心範疇`,
      `${withPages('L3')}：核心範疇＋興趣範疇`,
      `${withPages('L4')}：核心範疇＋興趣範疇`,
      `${withPages('OT-GB')}：核心範疇＋興趣範疇`,
    ],
    [
      `${withPages('L1', 'en')}: 9 items a–i`,
      `${withPages('L2', 'en')}: core domains`,
      `${withPages('L3', 'en')}: core + interest domains`,
      `${withPages('L4', 'en')}: core + interest domains`,
      `${withPages('OT-GB', 'en')}: core + interest domains`,
    ],
  ),
  checklistGroup(
    '童軍先修章、活動徽章及活動紀錄',
    'Scout Link Badge, Activity Badges & Activity Log',
    groupRange('link', 'activity', 'log', 'closing'),
    [
      withPages('scoutLink'),
      `${withPages('activity')}：日期及團長簽署`,
      `${withPages('log')}：每頁 12 行`,
      '幼童軍團呼（第 32 頁）：官方印刷內容，毋須填寫',
    ],
    [
      withPages('scoutLink', 'en'),
      `${withPages('activity', 'en')}: date and C.S.L. signature`,
      `${withPages('log', 'en')}: 12 rows per page`,
      'The Grand Howl (p. 32): printed content, nothing to fill in',
    ],
  ),
  {
    title: '列印設定',
    titleEn: 'Print Settings',
    pages: [],
    paper: 'A4 縱向 · 邊界 10mm',
    digital: '任一頁面 → 列印',
    ref: 'A4 縱向 · 邊界 10mm · 全冊＝封面＋第 1–32 頁（共 33 張）· 三款表格共 4 張',
    refEn: 'A4 portrait · 10 mm margins · full book = cover + pp. 1–32 (33 sheets) · three forms = 4 sheets',
    items: [
      '紙張選 A4、縱向；邊界選「預設」。',
      '勾選「背景圖形」，取消「頁首及頁尾」。',
      '空白欄的小圓點不會列印，列印時回復紙本橫線。',
      '手機請用系統列印或「另存為 PDF」，避免瀏覽器縮放。',
    ],
    itemsEn: [
      'Choose A4, portrait; margins “Default”.',
      'Tick “Background graphics”; untick “Headers and footers”.',
      'The small dots in empty fields do not print; ruled lines return on paper.',
      'On phones use the system print dialog or “Save as PDF” to avoid browser scaling.',
    ],
  },
];

export const syllabusItem = (id) => ITEM_INDEX[id] || null;

export function itemRowsForAward(book, award) {
  const rows = [];
  award.segments.forEach((segment) => {
    segment.items.forEach((item) => {
      const entry = book?.progress?.[item.id] || {};
      rows.push({
        id: item.id,
        badgeId: item.badgeId,
        segment: segment.name,
        name: item.name,
        en: item.en,
        date: entry.date || '',
        assessor: entry.assessor || '',
        cert: entry.cert || '',
      });
    });
  });
  return rows;
}

export function activityBadgeRows(book, category = '') {
  return OTHER_BADGES.filter((b) => !category || b.category === category).map((b) => {
    const entry = book?.otherBadges?.[b.id] || {};
    return {
      id: b.id,
      badgeId: b.badgeId,
      name: b.name,
      en: b.en,
      category: b.category,
      categoryName: b.categoryName,
      categoryNameEn: b.categoryNameEn,
      catalogueNo: b.catalogueNo,
      date: entry.date || '',
      cert: entry.cert || '',
      levels: levelsOf(entry),
      levelSummary: levelSummary(entry),
    };
  });
}

/**
 * 官方頁「頒發／完成日期」的儲存鍵為 `pages['award_' + awardId]`（例：`award_OT-GB`）。
 * 舊版曾以底線寫法 `award_OT_GB` 讀取金紫荊紀錄，這裡一併相容，避免表格讀不到日期。
 */
export function awardPage(book, awardId) {
  const pages = book?.pages || {};
  return pages[`award_${awardId}`] || pages[`award_${String(awardId).replace(/-/g, '_')}`] || {};
}

/**
 * 金紫荊獎章興趣範疇實際選用的活動徽章（官方第 19 頁：三選二，每類一枚）。
 * 只列成員在該頁選定的徽章，不會把較低階獎章已用的徽章一併列出。
 */
export function chosenInterestRows(book, awardId = GOLD_AWARD.id) {
  const state = book?.interest?.[awardId];
  if (!state?.badges || typeof state.badges !== 'object') return [];
  const chosen = Array.isArray(state.chosen) && state.chosen.length ? state.chosen : Object.keys(state.badges);
  const rows = [];
  for (const domain of INTEREST_DOMAINS) {
    if (!chosen.includes(domain.code)) continue;
    const row = state.badges[domain.code];
    if (!row?.badgeId) continue;
    const { id, level } = splitLevelRef(row.badgeId);
    const badge = OTHER_BADGES.find((b) => b.id === toBookId(id));
    if (!badge) continue;
    const entry = book?.otherBadges?.[badge.id] || {};
    const levelRow = level ? levelsOf(entry)[level] || {} : {};
    rows.push({
      ...badge,
      level: level || '',
      domain: domain.code,
      domainZh: domain.zh,
      domainEn: domain.en,
      examiner: row.examiner || '',
      date: row.date || levelRow.date || entry.date || '',
      cert: levelRow.cert || entry.cert || '',
    });
  }
  return rows;
}

/** 由紀錄冊自動推導各表格欄位；個別格可由 book.forms[formId] 覆寫。 */
export function buildFormValues(book, formId, refDate = new Date()) {
  const m = book?.member || {};
  const p = book?.pages || {};
  const ov = book?.forms?.[formId] || {};
  const goldAward = awardPage(book, GOLD_AWARD.id);

  const common = {
    nameZh: m.nameZh || '',
    nameEn: (m.nameEn || '').toUpperCase(),
    nameOnCertificate: m.nameEn || m.nameZh || '',
    hkidPrefix: sanitizeHkidPrefix(m.hkidPrefix),
    dob: m.dob || '',
    age: String(ageFromDob(m.dob, refDate) ?? ''),
    ageMonths: String(ageInMonths(m.dob, refDate) ?? ''),
    gender: m.gender || '',
    primaryLevel: m.primaryLevel || '',
    school: m.school || '',
    scoutId: m.scoutId || m.memberNo || '',
    unit: m.pack || '',
    group: m.group || '',
    district: m.district || '',
    region: m.region || '',
    addressZh: m.addressZh || '',
    addressEn: m.addressEn || '',
    parentName: m.parentName || '',
    parentRelation: m.parentRelation || '',
    parentPhone: m.parentPhone || '',
    phone: m.phone || '',
    email: m.email || '',
    photo: m.photo || null,
    applicantName: m.nameZh || m.nameEn || '',
    csl: m.csl || '',
    gsl: m.gsl || '',
    holderSignature: book?.holderSignature || null,
    l4Date: awardPage(book, 'L4').date || '',
    l4CertNo: awardPage(book, 'L4').certNo || '',
    goldenDate: goldAward.date || '',
    goldenCertNo: goldAward.certNo || '',
  };

  const goldRows = itemRowsForAward(book, GOLD_AWARD);
  const interest = (GOLD_AWARD.segments.find((s) => s.activityRequirement) || {}).activityRequirement || null;
  const interestRows = (interest?.allowedBadgeIds || [])
    .map((id) => OTHER_BADGES.find((b) => b.id === id))
    .filter(Boolean)
    .map((b) => ({
      ...b,
      date: book?.otherBadges?.[b.id]?.date || '',
      cert: book?.otherBadges?.[b.id]?.cert || '',
    }));

  const chosenRows = chosenInterestRows(book, GOLD_AWARD.id);

  const base = { ...common, ...(ov || {}), goldRows, interestRows, chosenInterestRows: chosenRows };
  if (formId === 'pt67') {
    return {
      ...base,
      planStartDate: ov?.planStartDate || p.gbac?.planStartDate || '',
      planFinishDate: ov?.planFinishDate || p.gbac?.planFinishDate || '',
      plannedItems: ov?.plannedItems || p.gbac?.plannedItems || '',
      applicantDate: ov?.applicantDate || '',
      cslDate: ov?.cslDate || '',
      dcName: ov?.dcName || '',
      dcDate: ov?.dcDate || '',
    };
  }
  if (formId === 'pt68') {
    return {
      ...base,
      campDates: ov?.campDates || '',
      serviceDates: ov?.serviceDates || '',
      leadershipDates: ov?.leadershipDates || '',
      applicantDate: ov?.applicantDate || '',
      nominationName: ov?.nominationName || m.csl || '',
      nominationDate: ov?.nominationDate || '',
      recommendationName: ov?.recommendationName || '',
      recommendationDate: ov?.recommendationDate || '',
      approvalName: ov?.approvalName || '',
      approvalDate: ov?.approvalDate || '',
      receivedDate: ov?.receivedDate || '',
      certIssueDate: ov?.certIssueDate || '',
      awardDate: ov?.awardDate || '',
      remarks: ov?.remarks || '',
    };
  }
  return { ...base };
}

export function formReadiness(book, formId, refDate = new Date()) {
  const v = buildFormValues(book, formId, refDate);
  const required =
    formId === 'gbac'
      ? ['nameZh', 'scoutId', 'dob']
      : ['nameZh', 'nameEn', 'scoutId', 'dob', 'gender', 'group', 'district', 'region'];
  const labels = {
    nameZh: '中文姓名',
    nameEn: '英文姓名',
    scoutId: 'SCOUT ID',
    dob: '出生日期',
    gender: '性別',
    group: '旅',
    district: '區',
    region: '地域',
  };
  const labelsEn = {
    nameZh: 'Name (Chinese)',
    nameEn: 'Name (English)',
    scoutId: 'Scout ID',
    dob: 'Date of birth',
    gender: 'Gender',
    group: 'Group',
    district: 'District',
    region: 'Region',
  };
  const missingKeys = required.filter((k) => !String(v[k] || '').trim());
  const missing = missingKeys.map((k) => labels[k] || k);
  return {
    ready: missing.length === 0,
    missing,
    missingEn: missingKeys.map((k) => labelsEn[k] || k),
    demo: isDemoBook(book),
    awardPending: !awardPage(book, GOLD_AWARD.id).date,
    values: v,
  };
}
