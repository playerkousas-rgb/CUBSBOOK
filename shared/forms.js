// ==========================================================================
// CUBBOOK — 幼童軍官方申請／紀錄表格自動帶入
// 官方表格：PT/67（金紫荊獎章開展通知書 4/2019）、PT/68（金紫荊獎章及證書申請表 06/2024）
// 2026 新制：官方表格編號尚未在總會表格目錄公布，因此只提供「非官方資料核對清單」，
//          不虛構 PT/XX 編號、不模擬官方簽署欄（對齊 cubbadge 的表格政策）。
// ==========================================================================

import { ITEM_INDEX, GOLD_AWARD, OTHER_BADGES, ageFromDob, ageInMonths, sanitizeHkidPrefix } from './book.js';

export const FORM_META = {
  pt67: {
    id: 'pt67',
    code: 'FORM PT/67 (4/2019)',
    short: 'PT/67',
    title: '金紫荊獎章開展通知書',
    en: 'Application for Assessment of the Golden Bauhinia Award',
    when: '年滿九歲半並完成「幼童軍歷奇章」後、正式開始金紫荊獎章考驗前，連同紀錄冊副本交所屬童軍區。',
    pages: 1,
    official: true,
    note: '官方表格；遞交前請以總會表格目錄的最新版本核對一次。',
  },
  pt68: {
    id: 'pt68',
    code: 'FORM PT/68 (06/2024)',
    short: 'PT/68',
    title: '金紫荊獎章及證書申請表',
    en: 'Application Form for the Golden Bauhinia Award and Certificate',
    when: '完成全部金紫荊獎章考驗項目，並獲團長／旅長提名後遞交；每年 8 月 31 日或以前交抵地域辦事處方可於同年大會操獲嘉許。',
    pages: 2,
    official: true,
    note: '官方表格；第 1–2 頁按總會要求列印。',
  },
  gbac: {
    id: 'gbac',
    code: '非官方資料核對清單（PT/XX 待官方公布）',
    short: '核對',
    title: '2026 新制金紫荊獎章資料核對清單',
    en: '2026 Scheme Golden Bauhinia Award — Unofficial Data Checklist',
    when: '完成 2026 新制金紫荊獎章所有細項後，用作與領袖核對紀錄冊資料；不是官方申請表。',
    pages: 1,
    official: false,
    note: '本清單不是官方表格，不設模擬簽署欄；官方表格編號請向所屬童軍區確認。',
  },
};

export const FORM_ORDER = ['pt67', 'pt68', 'gbac'];

export const PT67_CHECKLIST = [
  '幼童軍紀錄冊內個人摘要、童軍記錄、會員資格、會員章、幼童軍獎章（銅箭章）及幼童軍歷奇章（銀箭章）之副本。',
  '按紙本頁序：第 1 至 3、5、10 至 13 頁（本電子紀錄冊第 1–7、9–10 頁對應章節）。',
  '已完成並由領袖簽署的會員章、銅箭章及銀箭章考驗紀錄。',
  '如超過十二歲：學校證明文件（只適用於金紫荊獎章考驗的延長安排）。',
];

export const PT68_CHECKLIST = [
  '金紫荊獎章考驗紀錄冊（官方 24 頁紀錄冊，由領袖及考驗員填寫）。',
  '幼童軍紀錄冊內個人摘要、童軍記錄、會員資格、會員章、銅箭章、銀箭章、金箭章及金紫荊獎章考驗項目之副本（紙本第 1 至 3、5、12 至 15 頁）。',
  '各項有關證書之副本。',
  '已批核的「金紫荊獎章開展通知書」（PT/67）之副本。',
  '團長／旅長提名已在表內簽署；區總監推薦及地域總監批核欄留待區／地域填寫及蓋印。',
];

/** A4 列印檢查清單：紙本章節 ↔ 電子頁碼、列印設定。 */
export const PRINT_CHECKLIST = [
  {
    title: '個人摘要及童軍記錄',
    paper: '紙本第 1–3、5 頁',
    digital: '第 1–4 頁',
    items: ['個人資料（含近照及持有人簽署）', '聯絡及家長／監護人', '旅團資料', '童軍紀錄'],
  },
  {
    title: '會員資格及服務',
    paper: '紙本第 6–9 頁',
    digital: '第 6–7 頁',
    items: ['會員資格續期', '服務及獎勵紀錄'],
  },
  {
    title: '會員章及三個箭章',
    paper: '紙本第 10–13 頁',
    digital: '第 8–11 頁',
    items: ['會員章 9 項', '銅箭章（體驗章）12 項', '銀箭章（歷奇章）16 項', '金箭章（高級歷奇章）18 項'],
  },
  {
    title: '金紫荊獎章及活動徽章',
    paper: '紙本第 12–15 頁',
    digital: '第 12–14 頁',
    items: ['金紫荊獎章 17 項', '活動徽章 49 個紀錄類型', '宣誓及頒發紀錄'],
  },
  {
    title: '列印設定',
    paper: 'A4 · 邊界 8mm',
    digital: '任一頁面 → 列印',
    items: [
      '紙張選 A4、縱向；邊界選「預設」或「無」。',
      '勾選「背景圖形」，取消「頁首及頁尾」。',
      '空白欄的小圓點（.write__dot）不會列印，列印時回復紙本橫線。',
      '手機請用系統列印或「另存為 PDF」，避免瀏覽器縮放。',
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
    };
  });
}

/** 由紀錄冊自動推導各表格欄位；個別格可由 book.forms[formId] 覆寫。 */
export function buildFormValues(book, formId, refDate = new Date()) {
  const m = book?.member || {};
  const p = book?.pages || {};
  const ov = book?.forms?.[formId] || {};
  const goldAward = p.award_OT_GB || {};

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
    l4Date: p.award_L4?.date || '',
    l4CertNo: p.award_L4?.certNo || '',
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

  const base = { ...common, ...(ov || {}) , goldRows, interestRows };
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

export function formReadiness(book, formId) {
  const v = buildFormValues(book, formId);
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
  const missing = required.filter((k) => !String(v[k] || '').trim()).map((k) => labels[k] || k);
  const award = formId === 'gbac' ? !book?.pages?.award_OT_GB?.date : true;
  return {
    ready: missing.length === 0,
    missing,
    awardPending: !award,
    values: v,
  };
}
