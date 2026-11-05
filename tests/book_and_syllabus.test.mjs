import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  APP_VERSION,
  PAGE_TOTAL,
  PRINT_PAGES,
  SECTIONS,
  ALL_AWARDS,
  BADGE_SYLLABUS,
  GOLD_AWARD,
  ITEM_INDEX,
  OTHER_BADGES,
  SYLLABUS_ITEMS,
  SYLLABUS_META,
  toBookId,
  toBadgeId,
  newBook,
  demoBook,
  scoutId,
  normalizeScoutId,
  sameScoutId,
  syncIdentity,
  sanitizeHkidPrefix,
  ageFromDob,
  ageInMonths,
  interestProgress,
  badgeStats,
  allStats,
  membershipStatus,
  goldenBauhiniaEligibility,
  exportForBadge,
  collectPendingForBadge,
  importFromBadge,
  SYNC_SCHEMA,
  STORE_KEY,
} from '../shared/book.js';
import { BOOK_TO_BADGE_ID, BADGE_ID_TO_BOOK, isKnownItem, awardOfItem } from '../shared/syllabus.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/cubbadge-ids.json', import.meta.url), 'utf8'));

test('《幼童軍紀錄冊》19 頁逐頁映射完整、無缺漏與重覆，數位附錄不列印', () => {
  assert.equal(APP_VERSION, 'v1.0.0');
  assert.equal(PAGE_TOTAL, 19);
  assert.equal(PRINT_PAGES.length, 19);
  assert.deepEqual(
    PRINT_PAGES.map((s) => Number(s.page)),
    Array.from({ length: 19 }, (_, i) => i + 1),
  );
  assert.equal(SECTIONS.length, 20);
  const appendix = SECTIONS.find((s) => s.id === 'appendix');
  assert.ok(appendix);
  assert.equal(PRINT_PAGES.some((s) => s.id === 'appendix'), false);
  assert.equal(new Set(SECTIONS.map((s) => s.id)).size, SECTIONS.length);
  assert.equal(STORE_KEY, 'cubbook.book.v1');
});

test('項目 ID 單一真相：shared/syllabus.js 與 cubbadge data/items.json 逐個相同', () => {
  assert.equal(SYLLABUS_META.itemCount, 72);
  assert.equal(SYLLABUS_META.otherBadgeCount, 49);
  assert.equal(SYLLABUS_META.badgeSourceSha256, fixture.meta.sha256);

  // 72 個進度細項：BOOK 鍵與 cubbadge 官方 badgeId 一對一，次序不可錯位
  const officialProgress = SYLLABUS_ITEMS.map((i) => i.badgeId);
  assert.equal(officialProgress.length, fixture.progressIds.length);
  assert.deepEqual([...officialProgress].sort(), [...fixture.progressIds].sort());

  // 49 個活動／專科徽章
  const officialOther = OTHER_BADGES.map((b) => b.badgeId);
  assert.equal(officialOther.length, fixture.otherBadgeIds.length);
  assert.deepEqual([...officialOther].sort(), [...fixture.otherBadgeIds].sort());

  // 雙向對照表必須完全可逆，且 BOOK 內部鍵不得重覆
  assert.equal(new Set(SYLLABUS_ITEMS.map((i) => i.id)).size, 72);
  for (const item of SYLLABUS_ITEMS) {
    assert.equal(BOOK_TO_BADGE_ID[item.id], item.badgeId);
    assert.equal(BADGE_ID_TO_BOOK[item.badgeId], item.id);
    assert.equal(toBookId(item.badgeId), item.id);
    assert.equal(toBadgeId(item.id), item.badgeId);
    assert.equal(isKnownItem(item.id), true);
    assert.equal(item.en.length > 0, true);
    assert.equal(item.name.length > 0, true);
  }
  for (const badge of OTHER_BADGES) {
    assert.equal(toBadgeId(badge.id), badge.badgeId);
    assert.equal(isKnownItem(badge.id), true);
  }
});

test('五個獎章階級齊備：會員章 → 銅箭章 → 銀箭章 → 金箭章 → 金紫荊獎章', () => {
  assert.deepEqual(
    ALL_AWARDS.map((a) => a.id),
    ['L1', 'L2', 'L3', 'L4', 'OT-GB'],
  );
  assert.deepEqual(
    BADGE_SYLLABUS.map((b) => b.name),
    ['會員章', '幼童軍體驗章', '幼童軍歷奇章', '幼童軍高級歷奇章'],
  );
  assert.equal(GOLD_AWARD.id, 'OT-GB');
  assert.equal(GOLD_AWARD.name, '金紫荊獎章');
  assert.deepEqual(
    ALL_AWARDS.map((a) => a.segments.reduce((n, s) => n + s.items.length, 0)),
    [9, 12, 16, 18, 17],
  );
  assert.equal(
    ALL_AWARDS.reduce((n, a) => n + a.segments.reduce((m, s) => m + s.items.length, 0), 0),
    72,
  );

  // 官方名稱與常用箭章名稱並存，方便對照紙本舊稱及旅團溝通
  assert.deepEqual(
    ALL_AWARDS.slice(1).map((a) => [a.name, a.legacyZh]),
    [
      ['幼童軍體驗章', '銅箭章'],
      ['幼童軍歷奇章', '銀箭章'],
      ['幼童軍高級歷奇章', '金箭章'],
      ['金紫荊獎章', '金紫荊獎章'],
    ],
  );

  // 每個細項都能追溯所屬獎章，供紀錄冊頁面與 PT/67・PT/68 自動填表使用
  assert.equal(awardOfItem('L1-A')?.id, 'L1');
  assert.equal(awardOfItem('L4-COUNTRY-06')?.id, 'L4');
  assert.equal(awardOfItem('OT-GB-CARING-03')?.id, 'OT-GB');
  assert.equal(awardOfItem('OT-A01')?.id, 'OT-A01');
  assert.equal(awardOfItem('NOT-A-REAL-ID'), null);
});

test('興趣範疇要求：兩個不同類別、每類一個指定活動徽章（L3／L4／金紫荊）', () => {
  for (const award of ALL_AWARDS.slice(2)) {
    const seg = award.segments.find((s) => s.activityRequirement);
    assert.ok(seg, `${award.id} 缺少興趣範疇要求`);
    assert.equal(seg.activityRequirement.distinctCategories, 2);
    assert.equal(seg.activityRequirement.badgesPerCategory, 1);
    assert.deepEqual(seg.activityRequirement.categories, ['CREATIVE', 'SCIENCE', 'SPORTS']);
    assert.ok(seg.activityRequirement.allowedBadgeIds.length >= 13);
    for (const id of seg.activityRequirement.allowedBadgeIds) {
      assert.ok(OTHER_BADGES.some((b) => b.id === id), `${id} 不在活動徽章目錄`);
    }
  }

  const l3 = ALL_AWARDS[2].segments.find((s) => s.activityRequirement);
  const book = newBook();
  assert.equal(interestProgress(book, l3).satisfied, false);
  // 兩個徽章同屬一個類別：仍未達標
  book.otherBadges['OT-A12'] = { date: '2025-02-01' };
  book.otherBadges['OT-A13'] = { date: '2025-03-01' };
  assert.equal(interestProgress(book, l3).satisfied, false);
  // 第二個類別補上一個：達標
  book.otherBadges['OT-A22'] = { date: '2025-04-01' };
  const ok = interestProgress(book, l3);
  assert.equal(ok.satisfied, true);
  assert.deepEqual(ok.categories.sort(), ['CREATIVE', 'SCIENCE']);
});

test('SCOUT ID 單一識別碼：容忍前導零，且同步後不保留任何其他身分欄位', () => {
  assert.equal(normalizeScoutId(' 0012345678 '), '0012345678');
  assert.equal(normalizeScoutId('12345678'), '12345678');
  assert.equal(sameScoutId('12345678', '0012345678'), true);
  assert.equal(sameScoutId('12345678', '0012345679'), false);
  assert.equal(sameScoutId('', ''), false);

  const m = syncIdentity({ ymis: '0012345678', nameZh: '陳小狼', phone: '91234567' });
  assert.equal(m.scoutId, '0012345678');
  assert.equal(m.memberNo, '0012345678');
  assert.equal('ymis' in m, false);
  assert.equal(scoutId({ member: m }), '0012345678');

  // 身份證只保留首四位（字母 + 三個數字），杜絕完整號碼外洩
  assert.equal(sanitizeHkidPrefix('y418923(7)'), 'Y418');
  assert.equal(newBook({ member: { hkidPrefix: 'a1234567' } }).member.hkidPrefix, 'A123');
});

test('年齡與金紫荊資格：年滿十歲半（126 個月）才可完成最後一項', () => {
  const ref = new Date('2026-11-05');
  assert.equal(ageFromDob('2016-04-12', ref), 10);
  assert.equal(ageInMonths('2016-04-12', ref), 126);

  const demo = demoBook();
  const elig = goldenBauhiniaEligibility(demo, ref);
  assert.equal(elig.months, 126);
  assert.equal(elig.halfPastTen, true);

  const young = newBook({ member: { dob: '2016-12-01' } });
  assert.equal(goldenBauhiniaEligibility(young, ref).halfPastTen, false);
});

test('示範紀錄冊只示範版面：統計與會員續期狀態準確', () => {
  const demo = demoBook();
  const stats = allStats(demo);
  assert.deepEqual(
    stats.awards.map((a) => ({ id: a.award.id, done: a.done, total: a.total, percent: a.percent })),
    [
      { id: 'L1', done: 9, total: 9, percent: 100 },
      { id: 'L2', done: 3, total: 12, percent: 25 },
      { id: 'L3', done: 2, total: 16, percent: 13 },
      { id: 'L4', done: 0, total: 18, percent: 0 },
      { id: 'OT-GB', done: 0, total: 17, percent: 0 },
    ],
  );
  assert.equal(stats.total, 72);
  assert.equal(stats.done, 14);
  assert.equal(stats.percent, 19);
  assert.equal(stats.earned, 1);
  assert.equal(stats.nextAward.award.id, 'L2');
  assert.equal(stats.activityBadges, 2);
  assert.equal(badgeStats(demo, 'L1').complete, true);
  assert.equal(badgeStats(demo, 'L1').awardedDate, '2023-11-25');

  const ms = membershipStatus(demo, new Date('2026-11-05'));
  assert.equal(ms.active, true);
  assert.equal(ms.validUntil, '2027-08-31');
  assert.equal(membershipStatus(newBook(), new Date('2026-11-05')).active, false);
  assert.equal(Object.keys(demo.pages).some((k) => k === 'award_OT_GB'), false);
});

test('BOOK → BADGE：匯出一律 pending、零個人資料，只保留 SCOUT ID 及項目／日期', () => {
  const demo = demoBook();
  const out = exportForBadge(demo, 'T12');

  assert.equal(out.schema, SYNC_SCHEMA);
  assert.equal(out.schema, 'cubbadge.pending.v1');
  assert.equal(out.status, 'pending');
  assert.equal(out.confirmed, false);
  assert.equal(out.privacy, 'progress-only');
  assert.equal(out.scoutId, '0012345678');
  assert.equal(out.ymis, '0012345678');
  assert.equal(out.troopId, 'T12');
  assert.equal('progress' in out, false);
  assert.equal('members' in out, false);
  assert.equal('member' in out, false);

  const json = JSON.stringify(out);
  for (const pii of ['陳小狼', 'CHAN Siu-long', '9166', '91234567', '沙田第一小學', 'address', 'parentName', 'photo']) {
    assert.equal(json.includes(pii), false, `匯出檔洩露個人資料：${pii}`);
  }

  // 已在 cubbadge 核實的項目不重複送交；自填而未有領袖核實的項目才需送交
  assert.equal(out.pendingRequests.length, 1);
  const req = out.pendingRequests[0];
  assert.equal(req.ymis, '0012345678');
  assert.equal(req.item_id, 'A22');
  assert.equal(req.status, 'pending');
  assert.equal(req.confirmed, false);
  assert.equal(req.requested_date, '2025-05-10');
  assert.equal('name' in req, false);

  // BOOK 內部鍵必須轉為 cubbadge 官方編號，BADGE 毋須認識 L1-* 命名
  const blank = newBook({ member: { scoutId: '9012345678' }, progress: { 'L2-CARING-02': { date: '2026-09-01' } } });
  const out2 = exportForBadge(blank, 'T12');
  assert.equal(out2.pendingRequests[0].item_id, '1.2.2');
  assert.equal(out2.pendingProgress['9012345678']['1.2.2'].status, 'pending');

  // 已在雲端 pending 的同一 (ymis, itemId) 不再重複申報
  const repeat = collectPendingForBadge(blank, {}, ['1.2.2']);
  assert.equal(repeat.length, 0);
});

test('BADGE → BOOK：只錄入領袖已核實進度，pendingRequests 永不倒灌', () => {
  const blank = newBook({ member: { scoutId: '0012345678' } });

  const payload = {
    success: true,
    progress: {
      '0012345678': {
        a: { date: '2024-09-07', confirmer: '陳團長' },
        b: { date: '2024-09-14', confirmer: '陳團長' },
        '1.1.1': { date: '2025-02-01', confirmer: '陳團長' },
      },
      // 另一位成員的紀錄：必須完全忽略
      '0099999999': { c: { date: '2025-01-01', confirmer: '別人' } },
    },
    otherBadges: {
      '0012345678': { A01: { date: '2025-03-15', cert: 'ACT/2025/0181' } },
    },
    pendingRequests: [
      { ymis: '0012345678', item_id: 'P1-1.2', requested_date: '2026-10-01', status: 'pending' },
    ],
  };

  const res = importFromBadge(payload, blank);
  assert.equal(res.imported, 4);
  assert.equal(res.skippedPending, 1);
  assert.equal(res.matchedBy, 'SCOUT ID 0012345678');
  assert.equal(res.book.progress['L1-A'].date, '2024-09-07');
  assert.equal(res.book.progress['L1-A'].badgeConfirmer, '陳團長');
  assert.equal(res.book.progress['L1-A'].confirmedByBadge, true);
  assert.equal(res.book.progress['L3-CARING-01'], undefined);
  assert.equal(res.book.otherBadges['OT-A01'].date, '2025-03-15');
  assert.equal(res.book.otherBadges['OT-A01'].cert, 'ACT/2025/0181');
  // 未核實（pending）項目絕不錄入
  assert.equal(res.book.progress['L2-CARING-02'], undefined);

  // 空白紀錄冊（第 1 頁完全空白）亦可同步：只綁定 SCOUT ID
  const trulyBlank = newBook();
  const bound = importFromBadge(payload, trulyBlank, { expectedScoutId: '0012345678' });
  assert.equal(bound.book.member.scoutId, '0012345678');
  assert.equal(bound.book.member.nameZh, '');
  assert.equal(bound.book.member.phone, '');
  assert.equal(bound.imported, 4);

  // 他人 QR／他人編號不可寫入本冊：只有另一位成員的已核實進度時必須拒絕
  const otherOnly = {
    success: true,
    progress: { '0099999999': { a: { date: '2025-01-01', confirmer: '別人' } } },
  };
  assert.throws(
    () => importFromBadge(otherOnly, newBook(), { expectedScoutId: '0012345678' }),
    /SCOUT ID 不同/,
  );

  // 完全沒有核實日期的 pending 申報檔必須整份拒絕
  const pendingOnly = {
    schema: SYNC_SCHEMA,
    status: 'pending',
    confirmed: false,
    pendingProgress: { '0012345678': { a: { date: '2026-10-01' } } },
  };
  assert.throws(() => importFromBadge(pendingOnly, blank), /待領袖核實/);

  // 匯出後再倒灌自身的 pending 檔，同樣必須被拒
  const demo = demoBook();
  assert.throws(() => importFromBadge(exportForBadge(demo, 'T12'), demo), /待領袖核實/);
});

test('空白紀錄冊建立後即為完整可用結構，示範資料不會留下任何評估者簽名', () => {
  const book = newBook();
  assert.deepEqual(book.progress, {});
  assert.deepEqual(book.otherBadges, {});
  assert.deepEqual(book.forms, {});
  assert.equal(book.appVersion, APP_VERSION);
  assert.ok(ITEM_INDEX['L1-A']);

  const demo = demoBook();
  for (const [id, entry] of Object.entries(demo.progress)) {
    assert.ok(ITEM_INDEX[id], `${id} 不在綱要內`);
    assert.match(entry.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(entry.signature ?? null, null, '示範資料不可偽造簽名墨跡');
  }
  assert.equal(demo.otherBadges['OT-A22'].confirmedByBadge ?? false, false);
});
