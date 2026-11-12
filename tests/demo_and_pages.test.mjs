import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sampleBook } from './fixtures/sampleBook.mjs';
import {
  ALL_AWARDS,
  APP_VERSION,
  GOLD_AWARD,
  ITEM_INDEX,
  OTHER_BADGES,
  PRINT_PAGES,
  allStats,
  ageInMonths,
  collectPendingForBadge,
  demoBook,
  exportForBadge,
  goldenBauhiniaEligibility,
  importFromBadge,
  interestProgress,
  membershipStatus,
  newBook,
} from '../shared/book.js';
import {
  DEMO_NOTICE,
  DEMO_SCOUT_ID,
  DEMO_SYNC_BLOCKED,
  assertNotDemo,
  isDemoBook,
  isDemoScoutId,
} from '../shared/demo.js';
import {
  OFFICIAL_PAGES,
  OFFICIAL_PAGE_COUNT,
  PAPER_SECTIONS,
  formatPageList,
  pageRefOfSections,
  pagesOfSections,
} from '../shared/officialPages.js';
import {
  FORM_META,
  FORM_ORDER,
  PRINT_CHECKLIST,
  PT67_ATTACH_SECTIONS,
  PT67_CHECKLIST,
  PT67_CHECKLIST_EN,
  PT68_ATTACH_SECTIONS,
  PT68_CHECKLIST,
  PT68_CHECKLIST_EN,
  awardPage,
  buildFormValues,
  chosenInterestRows,
  formReadiness,
} from '../shared/forms.js';
import {
  KIND_SIGNOFF,
  applySignoff,
  buildPayload,
  encodeSignoff,
  isDemoPayload,
} from '../shared/transfer.js';
import handler from '../api/cubbadge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const walk = (dir, out = []) => {
  for (const ent of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

/* ================================================================== */
/* 一、紙本頁碼：一律由 officialPages.js 推導                           */
/* ================================================================== */

test('PAPER_SECTIONS 每個章節的頁碼都與官方 32 頁的頁種一致', () => {
  assert.equal(OFFICIAL_PAGE_COUNT, 32);
  const kindsOf = (key) => PAPER_SECTIONS[key].pages.map((no) => OFFICIAL_PAGES[no - 1].kind);

  assert.deepEqual(kindsOf('personal'), ['personal-1', 'personal-2']);
  assert.deepEqual(kindsOf('scouting'), ['scouting']);
  assert.deepEqual(kindsOf('renewal'), ['renewal']);
  assert.deepEqual(kindsOf('transfer'), ['transfer']);
  assert.deepEqual(kindsOf('progressRecord'), ['progress-record']);
  assert.deepEqual(kindsOf('serviceStar'), ['service-star']);
  assert.deepEqual(kindsOf('L1'), ['membership-a', 'membership-b']);
  assert.deepEqual(kindsOf('scoutLink'), ['scout-link']);
  assert.ok(kindsOf('activity').every((k) => k === 'activity'));
  assert.equal(PAPER_SECTIONS.activity.pages.length, 7);
  assert.ok(kindsOf('log').every((k) => k === 'activity-log'));
  assert.equal(PAPER_SECTIONS.log.pages.length, 4);

  // 進度性獎章：每個獎章的頁碼必須正是 OFFICIAL_PAGES 內標示該獎章的頁
  for (const awardId of ['L2', 'L3', 'L4', 'OT-GB']) {
    const expected = OFFICIAL_PAGES.filter((p) => p.award === awardId).map((p) => p.no);
    assert.deepEqual(PAPER_SECTIONS[awardId].pages, expected, `${awardId} 頁碼與官方頁不符`);
    assert.equal(PAPER_SECTIONS[awardId].zh, OFFICIAL_PAGES[expected[0] - 1].zh);
  }
  // 章節標題與官方頁標題一致（不可憑空另起名稱）
  for (const key of ['scouting', 'renewal', 'L1', 'scoutLink', 'activity', 'log']) {
    assert.equal(PAPER_SECTIONS[key].zh, OFFICIAL_PAGES[PAPER_SECTIONS[key].pages[0] - 1].zh);
  }
});

test('頁碼格式化：連續頁合併為範圍，中英文分隔符各自獨立', () => {
  assert.equal(formatPageList([1, 2, 3, 4, 10, 11, 13]), '1–4、10–11、13');
  assert.equal(formatPageList([1, 2, 3, 4, 10, 11, 13], 'en'), '1–4, 10–11, 13');
  assert.equal(formatPageList([13, 1, 2, 2]), '1–2、13');
  assert.deepEqual(pagesOfSections(['L1', 'personal']), [1, 2, 10, 11]);
  assert.equal(pageRefOfSections(PT67_ATTACH_SECTIONS), '1–4、10–11、13');
  assert.equal(pageRefOfSections(PT68_ATTACH_SECTIONS), '1–4、10–11、13–19');
});

test('PT/67・PT/68 附件清單的頁碼由章節推導，與官方頁逐一對應，中英文各自完整', () => {
  const ref67 = pageRefOfSections(PT67_ATTACH_SECTIONS);
  const ref68 = pageRefOfSections(PT68_ATTACH_SECTIONS);
  assert.ok(PT67_CHECKLIST.some((l) => l.includes(`第 ${ref67} 頁`)));
  assert.ok(PT68_CHECKLIST.some((l) => l.includes(`第 ${ref68} 頁`)));
  assert.ok(PT67_CHECKLIST_EN.some((l) => l.includes(`pp. ${pageRefOfSections(PT67_ATTACH_SECTIONS, 'en')}`)));
  assert.ok(PT68_CHECKLIST_EN.some((l) => l.includes(`pp. ${pageRefOfSections(PT68_ATTACH_SECTIONS, 'en')}`)));
  assert.equal(PT67_CHECKLIST_EN.length, PT67_CHECKLIST.length);
  assert.equal(PT68_CHECKLIST_EN.length, PT68_CHECKLIST.length);
  for (const line of [...PT67_CHECKLIST_EN, ...PT68_CHECKLIST_EN]) {
    assert.doesNotMatch(line, /[\u4e00-\u9fff]/, `英文清單不得夾雜中文：${line}`);
  }

  // PT/68 須附全部進度性獎章頁（第 13–19 頁）；PT/67 於開展前遞交，不含金紫荊頁
  for (const no of [13, 14, 15, 16, 17, 18, 19]) assert.ok(pagesOfSections(PT68_ATTACH_SECTIONS).includes(no));
  assert.equal(pagesOfSections(PT67_ATTACH_SECTIONS).includes(18), false);
  // 清單內提及的每個頁碼都必須是實際存在的官方頁
  for (const line of [...PT67_CHECKLIST, ...PT68_CHECKLIST]) {
    // 只檢查「第 … 頁」或章節名稱後的頁碼；年份（2026 年版）及表格編號（PT/67）不屬頁碼
    const pageText = line.replace(/2026 年版/g, '').replace(/PT\/\d+/g, '');
    for (const m of pageText.matchAll(/(\d+)(?:–(\d+))?/g)) {
      for (const n of [Number(m[1]), Number(m[2] || m[1])]) {
        assert.ok(n >= 1 && n <= OFFICIAL_PAGE_COUNT, `清單頁碼 ${n} 超出官方頁範圍：${line}`);
      }
    }
  }
});

test('列印檢查清單：四組頁碼不重不漏覆蓋第 1–32 頁，全冊 33 張、表格 4 張', () => {
  assert.equal(PRINT_CHECKLIST.length, 5);
  const covered = PRINT_CHECKLIST.flatMap((g) => g.pages);
  assert.deepEqual(covered, Array.from({ length: OFFICIAL_PAGE_COUNT }, (_, i) => i + 1));
  for (const g of PRINT_CHECKLIST) {
    assert.ok(g.title && g.titleEn && g.ref && g.refEn, '每組必須有中英文標題及頁碼對照');
    assert.equal(g.items.length, g.itemsEn.length, `${g.title} 中英文項目數不一致`);
    for (const line of g.itemsEn) assert.doesNotMatch(line, /[\u4e00-\u9fff]/);
    assert.doesNotMatch(g.refEn, /[\u4e00-\u9fff]/);
  }
  assert.equal(PRINT_PAGES.length, OFFICIAL_PAGE_COUNT + 1, '整本列印＝封面＋官方 32 頁');
  assert.equal(PRINT_PAGES[0].id, 'cover');
  const sheets = FORM_ORDER.reduce((n, id) => n + FORM_META[id].pages, 0);
  assert.equal(sheets, 4);
  assert.ok(PRINT_CHECKLIST[4].ref.includes('共 33 張') && PRINT_CHECKLIST[4].ref.includes('共 4 張'));

  // Forms.jsx 實際輸出的 A4 張數必須與 FORM_META 宣告一致
  const forms = read('web/src/pages/Forms.jsx');
  assert.equal((forms.match(/<article className="a4sheet/g) || []).length, sheets);
});

test('介面與文件不得殘留舊冊頁碼文案（19 頁、24 頁、第 1–3、5、10–15 頁等）', () => {
  const files = [
    ...walk('web/src').filter((f) => /\.(jsx?|css)$/.test(f)),
    ...walk('shared').filter((f) => f.endsWith('.js') && !f.endsWith('syllabus.js')),
    'web/index.html',
    'web/public/manifest.webmanifest',
    'api/cubbadge.js',
    'README.md',
  ];
  const stale = [
    /第 1–19 頁/,
    /19 pages/,
    /整本 19 頁/,
    /共 19 頁/,
    /24 頁/,
    /1 至 3、5、10 至 13/,
    /第 1–3、5、10–15 頁/,
    /All 3'/,
    /全部三張/,
    /VENTURE SCOUT/,
    /award_OT_GB\?/,
    /pages\.p15/,
  ];
  for (const rel of files) {
    const txt = read(rel);
    for (const re of stale) assert.doesNotMatch(txt, re, `${rel} 殘留舊文案 ${re}`);
  }
});

test('金紫荊「完成日期」鍵統一為 award_OT-GB：封面獎章及表格都讀得到', () => {
  const book = newBook();
  book.pages['award_OT-GB'] = { date: '2026-10-17', certNo: 'GB/1' };
  assert.equal(awardPage(book, 'OT-GB').date, '2026-10-17');
  assert.equal(buildFormValues(book, 'pt68').goldenDate, '2026-10-17');
  assert.equal(buildFormValues(book, 'pt68').goldenCertNo, 'GB/1');
  assert.equal(formReadiness(book, 'gbac').awardPending, false);
  assert.equal(formReadiness(newBook(), 'gbac').awardPending, true);
  // 舊備份的底線寫法仍可讀取
  const legacy = newBook();
  legacy.pages.award_OT_GB = { date: '2026-01-01' };
  assert.equal(awardPage(legacy, 'OT-GB').date, '2026-01-01');
  assert.ok(read('web/src/pages/CoverPage.jsx').includes("['award_OT-GB']"));
});

/* ================================================================== */
/* 二、示範紀錄冊：完整的金紫荊獎章申請樣本                             */
/* ================================================================== */

test('示範紀錄冊是完整申請樣本：72 項全數完成、五個獎章齊備、興趣範疇合規', () => {
  const demo = demoBook();
  const stats = allStats(demo);
  assert.equal(stats.total, 72);
  assert.equal(stats.done, 72);
  assert.equal(stats.percent, 100);
  assert.equal(stats.earned, 5);
  for (const a of stats.awards) {
    assert.equal(a.complete, true, `${a.award.id} 未完成`);
    assert.match(a.awardedDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  for (const id of Object.keys(ITEM_INDEX)) {
    assert.match(demo.progress[id]?.date || '', /^\d{4}-\d{2}-\d{2}$/, `${id} 缺日期`);
    assert.ok(demo.progress[id].assessor, `${id} 缺考驗員姓名`);
  }
  // 興趣範疇：歷奇章、高級歷奇章、金紫荊各選兩個不同類別，徽章不重複
  const used = [];
  for (const awardId of ['L3', 'L4', 'OT-GB']) {
    const segment = ALL_AWARDS.find((a) => a.id === awardId).segments.find((seg) => seg.activityRequirement);
    const ip = interestProgress(demo, segment);
    assert.equal(ip.satisfied, true, `${awardId} 興趣範疇未達標`);
    assert.ok(ip.categories.length >= 2);
    const picks = Object.values(demo.interest[awardId].badges).map((b) => b.badgeId);
    assert.equal(picks.length, 2);
    assert.equal(new Set(demo.interest[awardId].chosen).size, 2);
    used.push(...picks);
    for (const id of picks) assert.ok(demo.otherBadges[id]?.date, `${id} 未在活動徽章紀錄頁登記`);
  }
  assert.equal(new Set(used).size, used.length, '較低階獎章用過的活動徽章不可重複使用');
  for (const id of Object.keys(demo.otherBadges)) {
    assert.ok(OTHER_BADGES.some((b) => b.id === id), `${id} 不是有效活動徽章`);
  }
  // 各頁齊備：續期、年星、進度紀錄、先修章、活動紀錄（跨兩頁）
  assert.equal(demo.renewals.length, 4);
  assert.equal(membershipStatus(demo, new Date('2026-11-12')).active, true);
  assert.ok(demo.serviceStars.y1 && demo.serviceStars.y2 && demo.serviceStars.y3);
  assert.ok(demo.personalProgress.goldenBauhinia && demo.personalProgress.scoutLink);
  assert.ok(demo.domains['SL-1'].date && demo.domains['SL-2'].date && demo.domains['SL-3'].date);
  assert.ok(demo.activities.length > 12, '活動紀錄須多於一頁（每頁 12 行）以測試分頁');
  // 分級活動徽章：示範逐級紀錄
  assert.deepEqual(Object.keys(demo.otherBadges['OT-A39'].levels), ['E', 'I', 'A']);
});

test('示範紀錄冊時間線合理：年齡門檻、獎章先後、選修徽章不遲於所屬項目', () => {
  const demo = demoBook();
  const dob = demo.member.dob;
  const lastOf = (award) => award.segments.flatMap((s) => s.items).map((i) => demo.progress[i.id].date).sort().at(-1);
  const firstOf = (award) => award.segments.flatMap((s) => s.items).map((i) => demo.progress[i.id].date).sort()[0];

  let prevAwarded = '';
  for (const award of ALL_AWARDS) {
    const awarded = demo.pages[`award_${award.id}`].date;
    assert.ok(firstOf(award) > prevAwarded, `${award.id} 應在上一個獎章頒發後才開始`);
    assert.ok(lastOf(award) <= awarded, `${award.id} 頒發日期不可早於最後一項`);
    prevAwarded = awarded;
  }
  // 金紫荊：最後一項於年滿十歲半（126 個月）或以後完成，且未滿十二歲
  const goldLast = lastOf(GOLD_AWARD);
  assert.ok(ageInMonths(dob, new Date(goldLast)) >= 126);
  assert.ok(ageInMonths(dob, new Date(goldLast)) < 144);
  assert.equal(goldenBauhiniaEligibility(demo, new Date(goldLast)).halfPastTen, true);
  // PT/67：年滿九歲半後、開展考驗前遞交並獲批
  const f67 = demo.forms.pt67;
  assert.ok(ageInMonths(dob, new Date(f67.applicantDate)) >= 114);
  assert.ok(f67.applicantDate <= f67.dcDate && f67.dcDate <= f67.planStartDate);
  assert.equal(f67.planStartDate, firstOf(GOLD_AWARD));
  assert.ok(demo.pages.award_L3.date <= f67.applicantDate, '遞交 PT/67 前須已完成歷奇章');
  // PT/68：申請 → 提名 → 推薦 → 批核 → 發證，依次不倒序
  const f68 = demo.forms.pt68;
  const chain = [goldLast, f68.applicantDate, f68.nominationDate, f68.recommendationDate, f68.approvalDate, f68.certIssueDate];
  assert.deepEqual([...chain].sort(), chain);
  // 以活動徽章替代的核心項目：徽章日期不遲於該項目
  for (const [id, entry] of Object.entries(demo.progress)) {
    const badge = demo.otherBadges[entry.elective];
    if (badge) assert.ok(badge.date <= entry.date, `${id} 引用的 ${entry.elective} 日期較項目遲`);
  }
  for (const picks of Object.values(demo.interest)) {
    for (const row of Object.values(picks.badges)) {
      assert.equal(demo.otherBadges[row.badgeId].date, row.date);
    }
  }
  // 入團年齡七歲半以上，日期全部為有效日曆日
  assert.ok(ageInMonths(dob, new Date(demo.member.dateJoined)) >= 84);
  const allDates = JSON.stringify(demo).match(/\d{4}-\d{2}-\d{2}/g);
  for (const d of allDates) assert.equal(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10), d);
});

test('示範紀錄冊可直接出表：PT/67・PT/68・核對清單全部齊備，每一格都有內容', () => {
  const demo = demoBook();
  const ref = new Date('2026-11-12');
  for (const id of FORM_ORDER) {
    const r = formReadiness(demo, id, ref);
    assert.equal(r.ready, true, `${id} 未齊備：${r.missing.join('、')}`);
    assert.deepEqual(r.missingEn, []);
    assert.equal(r.demo, true);
    assert.equal(r.awardPending, false);
  }
  const v67 = buildFormValues(demo, 'pt67', ref);
  for (const k of ['nameZh', 'nameEn', 'dob', 'age', 'primaryLevel', 'gender', 'scoutId', 'group', 'district', 'region', 'phone', 'email', 'planStartDate', 'planFinishDate', 'plannedItems', 'applicantDate', 'csl', 'cslDate', 'dcName', 'dcDate']) {
    assert.ok(String(v67[k] || '').trim(), `PT/67 欄位 ${k} 空白`);
  }
  assert.equal(v67.age, '9', 'PT/67 的年齡須為遞交當時的年齡');
  const v68 = buildFormValues(demo, 'pt68', ref);
  for (const k of ['nameZh', 'nameEn', 'dob', 'age', 'primaryLevel', 'gender', 'hkidPrefix', 'scoutId', 'group', 'district', 'region', 'addressZh', 'addressEn', 'parentName', 'parentPhone', 'l4Date', 'l4CertNo', 'campDates', 'serviceDates', 'leadershipDates', 'applicantDate', 'nominationName', 'nominationDate', 'recommendationName', 'recommendationDate', 'approvalName', 'approvalDate', 'receivedDate', 'goldenCertNo', 'certIssueDate', 'awardDate', 'remarks']) {
    assert.ok(String(v68[k] || '').trim(), `PT/68 欄位 ${k} 空白`);
  }
  assert.equal(v68.hkidPrefix.length, 4);
  assert.equal(v68.goldRows.length, 17);
  assert.ok(v68.goldRows.every((r) => r.date && r.assessor));
  assert.equal(v68.l4Date, demo.pages.award_L4.date);
  assert.equal(v68.goldenDate, demo.pages['award_OT-GB'].date);

  // 表格的「興趣範疇」只列第 19 頁選定的兩枚，不會把其他活動徽章一併列出
  const chosen = chosenInterestRows(demo);
  assert.equal(chosen.length, 2);
  assert.equal(new Set(chosen.map((r) => r.domain)).size, 2);
  assert.ok(chosen.every((r) => r.date && r.cert && r.domainZh && r.domainEn));
  assert.deepEqual(v68.chosenInterestRows.map((r) => r.id), chosen.map((r) => r.id));
  assert.deepEqual(chosenInterestRows(newBook()), []);
  assert.equal(chosenInterestRows(sampleBook()).length, 0, '未在第 19 頁選定時不得列出其他獎章的徽章');
});

test('示範紀錄冊全部虛構：有示範標記、保留全零 SCOUT ID、零簽名圖片、零近照、零「已核實」', () => {
  const demo = demoBook();
  assert.equal(demo.meta.demo, true);
  assert.equal(demo.member.scoutId, DEMO_SCOUT_ID);
  assert.equal(DEMO_SCOUT_ID, '0000000000');
  assert.equal(isDemoBook(demo), true);

  const json = JSON.stringify(demo);
  assert.equal(json.includes('data:image'), false, '示範資料不得含任何圖片（簽名／近照／墨跡）');
  assert.equal(json.includes('"png"'), false);
  assert.equal(json.includes('confirmedByBadge'), false, '示範資料從未經領袖核實');
  assert.equal(json.includes('"verified"'), false);
  assert.equal(demo.member.photo ?? null, null);
  assert.equal(demo.holderSignature ?? null, null);
  const signatureKeys = [];
  const scan = (node, trail) => {
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) {
      if (/signature/i.test(k) && v) signatureKeys.push(`${trail}.${k}`);
      scan(v, `${trail}.${k}`);
    }
  };
  scan(demo, 'book');
  assert.deepEqual(signatureKeys, []);

  // 領袖、區、地域及聯絡資料一律帶「示範」字樣或保留網域，不會被誤認為真人真事
  for (const k of ['region', 'district', 'group', 'pack', 'gsl', 'csl', 'school', 'groupAddress', 'addressZh']) {
    assert.match(demo.member[k], /示範/, `member.${k} 應標明示範`);
  }
  assert.match(demo.member.email, /\.invalid$/);
  for (const k of ['phone', 'parentPhone', 'emergencyPhone', 'cslPhone']) assert.match(demo.member[k], /^0000 /);
  for (const k of ['dcName']) assert.match(demo.forms.pt67[k], /示範/);
  for (const k of ['nominationName', 'recommendationName', 'approvalName', 'remarks']) assert.match(demo.forms.pt68[k], /示範/);
  for (const a of ALL_AWARDS) assert.match(demo.pages[`award_${a.id}`].certNo, /^DEMO-/);
  for (const [id, e] of Object.entries(demo.otherBadges)) assert.match(e.cert, /^DEMO-/, `${id} 證書編號應為 DEMO-`);

  // 備份還原後標記仍在；即使標記被手動刪去，全零編號仍被識別為示範
  const restored = newBook(JSON.parse(json));
  assert.equal(restored.meta.demo, true);
  assert.equal(isDemoBook(restored), true);
  const stripped = JSON.parse(json);
  delete stripped.meta.demo;
  assert.equal(isDemoBook(newBook(stripped)), true);

  // 真實紀錄冊不會被誤判
  assert.equal(isDemoBook(newBook()), false);
  assert.equal(isDemoBook(sampleBook()), false);
  assert.equal(isDemoBook(null), false);
  assert.equal(isDemoScoutId('0000000000'), true);
  assert.equal(isDemoScoutId(' 0000 0000 00 '), true);
  assert.equal(isDemoScoutId('0012345678'), false);
  assert.equal(isDemoScoutId(''), false);
  assert.equal(isDemoScoutId(undefined), false);
});

test('示範標示文案固定，並印在每一張 A4 表格及紀錄冊每一頁（螢幕及列印）', () => {
  assert.equal(DEMO_NOTICE.zh, '示範樣本，只供測試，不可遞交');
  assert.equal(DEMO_NOTICE.en, 'SAMPLE ONLY — FOR TESTING — NOT FOR SUBMISSION');
  assert.equal(DEMO_NOTICE.signZh, '示範簽署');
  assert.equal(DEMO_NOTICE.signEn, 'SAMPLE SIGNATURE');

  // 每一張 A4 表格（PT/67、PT/68 兩張、核對清單）頂部各有一個標示
  const forms = read('web/src/pages/Forms.jsx');
  const sheets = forms.split('<article className="a4sheet').slice(1);
  assert.equal(sheets.length, 4);
  for (const chunk of sheets) {
    assert.match(chunk, /^[^>]*>\s*<DemoNotice \/>/, '每張 A4 表格的第一個元素必須是示範標示');
  }
  // 表格簽署欄：示範時只印「示範簽署」，不輸出任何簽名圖片
  assert.match(forms, /demo \? <DemoSignMark \/> : sig\?\.png/);
  assert.ok((forms.match(/<EndorseSign \/>/g) || []).length >= 5, '團長／區總監／地域總監簽署位置都要有示範簽署');

  // 紀錄冊每一頁（封面及第 1–32 頁，包括整本列印）由 Sheet 統一加上標示
  const paper = read('web/src/components/Paper.jsx');
  assert.ok(paper.includes('<DemoSheetTag />'));
  assert.ok(paper.indexOf('<DemoSheetTag />') < paper.indexOf('</article>'));

  const notice = read('web/src/components/DemoNotice.jsx');
  assert.ok(notice.includes('DEMO_NOTICE.zh') && notice.includes('DEMO_NOTICE.en'), '標示文字必須取自 shared/demo.js');
  const printable = notice.slice(notice.indexOf('export function DemoNotice'), notice.indexOf('export function DemoRibbon'));
  assert.equal(printable.includes('no-print'), false, '表格及內頁的示範標示必須可列印');
  assert.equal(/Legal(Line|Note)/.test(notice), false, '示範標示不是版權聲明，不得重複版權文字');

  // 官方頁簽署位置（團長簽署、續期、活動徽章、持有人簽署）及簽署視窗
  const official = read('web/src/pages/Official.jsx');
  assert.ok(official.includes('<DemoSignMark className="demo-sign--line" />'));
  assert.ok(official.includes('<DemoSignMark className="demo-sign--mini" />'));
  const ink = read('web/src/components/Ink.jsx');
  assert.ok(ink.includes('demoLocked') && ink.includes('data-demo-sign-locked'), '示範紀錄冊不可開啟簽署板');
  assert.ok(ink.includes('sigblock--demo'));

  // 樣式：金黃底深墨字，列印時保留顏色；不可被列印規則隱藏
  const css = read('web/src/styles.css');
  const block = css.slice(css.indexOf('示範紀錄冊標示'));
  assert.ok(block.includes('.demo-notice {') && block.includes('.sheet__demo {') && block.includes('.demo-sign {'));
  assert.ok(block.includes('background: #ead040') && block.includes('color: #2b1a04'));
  assert.equal(/color:\s*#fff/i.test(block), false, '金黃底上不可用白字');
  assert.ok(block.includes('print-color-adjust: exact'));
  const printRules = block.slice(block.indexOf('@media print'));
  assert.equal(/\.demo-notice[^{]*\{[^}]*display:\s*none/.test(printRules), false);
  assert.equal(/\.sheet__demo[^{]*\{[^}]*display:\s*none/.test(printRules), false);
  assert.match(printRules, /\.demo-ribbon \{ display: none !important; \}/);

  // 載入入口必須講明虛構、不可遞交、不可同步
  for (const rel of ['web/src/pages/Welcome.jsx', 'web/src/components/MenuDialog.jsx', 'web/src/pages/Appendix.jsx']) {
    const txt = read(rel);
    assert.ok(txt.includes('虛構'), `${rel} 須說明示範資料屬虛構`);
    assert.ok(txt.includes('不可遞交'), `${rel} 須說明不可遞交`);
    assert.ok(txt.includes('demoLoadedToast'), `${rel} 載入後提示須使用統一文案`);
  }
  assert.ok(notice.includes('不可同步至 CUBSBADGE') && notice.includes('cannot be synced to CUBSBADGE'));
  assert.ok(read('web/src/App.jsx').includes('<DemoRibbon />'));
});

/* ================================================================== */
/* 三、示範資料不可進入正式同步流程（共用邏輯、介面、伺服器三重封鎖）    */
/* ================================================================== */

test('共用邏輯：示範紀錄冊零待送交項目，匯出／匯入／核簽一律拒絕', async () => {
  const demo = demoBook();
  assert.deepEqual(collectPendingForBadge(demo), []);
  assert.deepEqual(collectPendingForBadge(demo, {}, []), []);
  assert.throws(() => exportForBadge(demo, 'T12'), (e) => e.code === 'DEMO_BLOCKED' && /示範資料/.test(e.message));
  assert.throws(() => assertNotDemo(demo), (e) => e.code === DEMO_SYNC_BLOCKED.code);
  assert.doesNotThrow(() => assertNotDemo(sampleBook()));

  // 真實帳戶的已核實進度不可倒灌入示範紀錄冊
  const real = sampleBook();
  const confirmed = {
    schema: 'cubbadge-progress/1',
    scoutId: DEMO_SCOUT_ID,
    progress: { '1.1.1': { date: '2026-01-01', status: 'confirmed' } },
  };
  assert.throws(() => importFromBadge(confirmed, demo), (e) => e.code === 'DEMO_BLOCKED');

  // 把示範冊改成其他編號但保留示範標記，仍然封鎖
  const renamed = demoBook();
  renamed.member.scoutId = '0012345678';
  renamed.member.memberNo = '0012345678';
  assert.equal(isDemoBook(renamed), true);
  assert.deepEqual(collectPendingForBadge(renamed), []);
  assert.throws(() => exportForBadge(renamed, 'T12'), (e) => e.code === 'DEMO_BLOCKED');

  // 一般成員不受影響
  assert.ok(collectPendingForBadge(real).length > 0);
  assert.equal(exportForBadge(real, 'T12').pendingRequests.length, 2);

  // 二維碼出示：帶示範標記；領袖不可為示範成員簽發核簽回傳碼
  const payload = buildPayload(demo, ['particulars', 'progress']);
  assert.equal(payload.demo, true);
  assert.equal(isDemoPayload(payload), true);
  assert.equal(buildPayload(real, ['particulars', 'progress']).demo, undefined);
  assert.equal(isDemoPayload(buildPayload(real, ['particulars', 'progress'])), false);
  await assert.rejects(
    encodeSignoff({ member: payload.member, leader: { name: '陳團長' }, items: [{ id: 'L1-A', date: '2026-01-01' }] }),
    (e) => e.code === 'DEMO_BLOCKED',
  );
  assert.throws(
    () => applySignoff(demo, { t: KIND_SIGNOFF, member: {}, leader: { name: '陳團長' }, items: [] }),
    (e) => e.code === 'DEMO_BLOCKED',
  );
});

async function callApi(body) {
  let statusCode = 200;
  let payload = null;
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(obj) {
      payload = obj;
      return this;
    },
  };
  await handler({ method: 'POST', body }, res);
  return { status: statusCode, body: payload };
}

test('伺服器橋接：示範 SCOUT ID 或示範標記的請求一律 403，絕不轉發到 cubbadge', async () => {
  const prevFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return { ok: true, json: async () => ({ success: true, token: 't', progress: {} }) };
  };
  try {
    const attempts = [
      { action: 'login', troopId: 'T12', data: { login_id: DEMO_SCOUT_ID, password: 'x' } },
      { action: 'login', troopId: 'T12', data: { login_id: '0000 0000 00', password: 'x' } },
      { action: 'load', troopId: 'T12', data: { ymis: DEMO_SCOUT_ID, token: 't' } },
      { action: 'submitPending', troopId: 'T12', data: { ymis: DEMO_SCOUT_ID, token: 't', items: [{ item_id: '1.1.1', date: '2026-01-01' }] } },
      { action: 'submitPending', troopId: 'T12', demo: true, data: { ymis: '0012345678', token: 't', items: [] } },
      { action: 'load', troopId: 'T12', data: { ymis: '0012345678', token: 't', demo: true } },
    ];
    for (const body of attempts) {
      const r = await callApi(body);
      assert.equal(r.status, 403, `${body.action} 應被拒絕`);
      assert.equal(r.body.success, false);
      assert.equal(r.body.code, 'DEMO_BLOCKED');
      assert.match(r.body.error, /示範資料/);
    }
    assert.deepEqual(calls, [], '示範請求不得觸及 cubbadge 後端');
  } finally {
    globalThis.fetch = prevFetch;
  }
});

test('介面：示範紀錄冊的同步卡不渲染任何連線、送交或匯出入口', () => {
  const card = read('web/src/components/CubBadgeSyncCard.jsx');
  const entry = card.slice(card.indexOf('export default function CubBadgeSyncCard'), card.indexOf('function CubBadgeSyncLive'));
  assert.match(entry, /if \(isDemoBook\(book\)\) return <DemoSyncLocked \/>;/);
  assert.ok(entry.indexOf('isDemoBook(book)') < entry.indexOf('<CubBadgeSyncLive'));
  const locked = card.slice(card.indexOf('function DemoSyncLocked'), card.indexOf('export default function CubBadgeSyncCard'));
  for (const banned of ['fetch(', '<form', '<input', 'submitBookProgressAsPending', 'exportForBadge', 'handleLogin', 'onClick']) {
    assert.equal(locked.includes(banned), false, `示範鎖定卡不得包含 ${banned}`);
  }
  assert.ok(locked.includes('data-demo-sync="blocked"'));
  assert.ok(locked.includes('DEMO_SYNC_BLOCKED.zh') && locked.includes('DEMO_SYNC_BLOCKED.en'));

  // 領袖掃描到示範成員：核簽面板鎖定
  const signoff = read('web/src/components/SignoffPanel.jsx');
  assert.ok(signoff.includes('if (isDemoPayload(payload))') && signoff.includes('signpanel--demo'));

  // shared/demo.js 為零依賴單一來源，前端與伺服器共用
  const demoSrc = read('shared/demo.js');
  assert.equal(/^import /m.test(demoSrc), false, 'shared/demo.js 必須零依賴');
  assert.ok(read('api/cubbadge.js').includes("from '../shared/demo.js'"));
  assert.ok(read('shared/book.js').includes("from './demo.js'"));
});

test('申請表列印版面：A4 可用闊度落入手機斷點時仍維持四欄，三款表格共 4 張 A4', () => {
  const css = read('web/src/styles.css');
  const start = css.indexOf('A4 申請表列印版面');
  assert.ok(start > 0, 'styles.css 必須保留「A4 申請表列印版面」區塊');
  const block = css.slice(start);
  assert.ok(/@media print\s*\{/.test(block));
  // 手機斷點（≤740px）把 .ptgrid 改成兩欄、簽署欄改成單欄；列印必須以 !important 還原
  assert.ok(/\.ptgrid\s*\{\s*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\) !important;/.test(block));
  assert.ok(/\.ptsignrow, \.ptendorse, \.ptreturn__cols\s*\{\s*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\) !important;/.test(block));
  for (const span of [2, 3, 4]) {
    assert.ok(block.includes(`.ptcell--s${span} { grid-column: span ${span} !important; }`));
  }
  assert.ok(/\.a4sheet\s*\{[^}]*break-inside:\s*avoid;/.test(block), '每張表格不得被分頁切開');
  // 簽署線及印章位是手簽／蓋印用的實體尺寸，不可隨字級縮細
  assert.ok(/\.ptblank\s*\{\s*height:\s*34px;/.test(block));
  assert.ok(/\.ptendorse__stamp\s*\{\s*width:\s*76px;\s*height:\s*76px;/.test(block));
  // 版面張數與清單文案一致：PT/67 一張、PT/68 兩張、核對清單一張
  const sheets = Object.values(FORM_META).reduce((n, m) => n + (m.pages || 1), 0);
  assert.equal(sheets, 4);
});

test('版本一致：v1.3.0、Service Worker 快取同步換版', () => {
  assert.equal(APP_VERSION, 'v1.3.0');
  assert.equal(JSON.parse(read('package.json')).version, '1.3.0');
  const html = read('web/index.html');
  assert.equal((html.match(/v1\.3\.0/g) || []).length, 5);
  assert.ok(read('web/public/sw.js').includes("const CACHE_NAME = 'cubbook-cache-v9'"));
  assert.ok(read('CHANGELOG.md').includes('## [v1.3.0]'));
  assert.ok(read('README.md').includes('`v1.3.0`'));
});
