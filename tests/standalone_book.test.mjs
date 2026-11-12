import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleBook } from './fixtures/sampleBook.mjs';
import { readFileSync } from 'node:fs';
import {
  ALL_AWARDS,
  OTHER_BADGES,
  PRINT_PAGES,
  allStats,
  badgeStats,
  newBook,
  toBadgeId,
} from '../shared/book.js';
import { FORM_META, buildFormValues, formReadiness } from '../shared/forms.js';
import { applySignoff, decodePayload, decodeTransfer, encodeSignoff, encodeTransfer } from '../shared/transfer.js';
import { probeCubBadgeBridge } from '../web/src/cubadgeBridge.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

const jsonRes = (body, { ok = true, status = 200, type = 'application/json; charset=utf-8' } = {}) => ({
  ok,
  status,
  headers: { get: (k) => (k.toLowerCase() === 'content-type' ? type : null) },
  json: async () => body,
});

test('BOOK 核心功能完全不需要 BADGE：無網絡亦能建立、填寫、統計、出表、簽名、備份', async () => {
  // 1. 建立完全空白的紀錄冊（第 1 頁也是空白）
  const book = newBook();
  assert.equal(book.member.nameZh, '');
  assert.equal(book.member.scoutId, '');

  // 2. 只靠本機輸入，逐項記錄進度（模擬使用者自行填寫 + 領袖當面簽名）
  book.member = { ...book.member, nameZh: '陳小狼', nameEn: 'CHAN Siu-long', dob: '2016-04-12', scoutId: '0012345678' };
  book.progress['L1-A'] = { date: '2026-09-05', assessor: '陳團長' };
  book.progress['L1-B'] = { date: '2026-09-12', assessor: '陳團長' };
  book.progress['L2-SKILLS-01'] = { date: '2026-10-03', assessor: '陳團長' };
  book.otherBadges['OT-A22'] = { date: '2026-10-10', cert: 'ACT/2026/0102' };
  book.pages.award_L1 = { date: '2026-09-19', certNo: 'MB/2026/0111', presentedBy: '陳團長' };

  // 3. 統計即時反映，不依賴任何雲端
  const stats = allStats(book);
  assert.equal(stats.done, 3);
  assert.equal(stats.activityBadges, 1);
  assert.equal(stats.earned, 1);
  assert.equal(badgeStats(book, 'L1').percent, Math.round((2 / 9) * 100));
  assert.equal(stats.awards.find((a) => a.award.id === 'L4').percent, 0);

  // 4. 官方表格自動帶入（PT/67、PT/68）
  const v67 = buildFormValues(book, 'pt67', new Date('2026-11-05'));
  assert.equal(v67.nameZh, '陳小狼');
  assert.equal(v67.ageMonths, '126');
  const r68 = formReadiness(book, 'pt68');
  assert.ok(r68.missing.includes('性別'), '未填性別時應如實回報缺漏，而不是假裝齊備');
  book.member.gender = 'M';
  book.member.group = '沙田第 12 旅';
  book.member.district = '沙田北區';
  book.member.region = '新界東地域';
  assert.equal(formReadiness(book, 'pt68').ready, true);
  assert.equal(Object.values(FORM_META).every((m) => m.official === false || m.pages > 0), true);

  // 5. 二維碼出示／領袖核簽回傳，全程離線
  const code = await encodeTransfer(book, ['particulars', 'progress']);
  assert.match(code.value, /^CB1/);
  const decoded = await decodeTransfer(code.value);
  assert.equal(decoded.member.nameZh, '陳小狼');
  assert.equal(decoded.progress['L1-A'].date, '2026-09-05');

  const signoff = await encodeSignoff({
    member: book.member,
    leader: { name: '陳團長', title: '幼童軍團長 CSL' },
    items: [{ id: '1.2.1', date: '2026-10-17' }],
    otherBadges: [],
  });
  assert.match(signoff.value, /^CB1S\./);
  const applied = applySignoff(book, await decodePayload(signoff.value));
  assert.equal(applied.book.progress['L2-CARING-01'].date, '2026-10-17');
  assert.equal(applied.book.progress['L2-CARING-01'].assessor, '陳團長');
  // 本地簽名不等於 cubbadge 已核實，這個欄位永遠不會被離線流程寫成 true
  assert.equal(applied.book.progress['L2-CARING-01'].confirmedByBadge ?? false, false);

  // 6. 整本列印：封面 + 官方 32 頁，附錄不列印
  assert.equal(PRINT_PAGES.length, 33);
  assert.deepEqual(PRINT_PAGES.map((p) => p.id).slice(0, 3), ['cover', 'p01', 'p02']);

  // 7. 備份／還原（純 JSON，經 localStorage 或檔案）
  const backup = JSON.parse(JSON.stringify(book));
  assert.equal(backup.progress['L2-SKILLS-01'].date, '2026-10-03');
  assert.equal(backup.otherBadges['OT-A22'].cert, 'ACT/2026/0102');
});

test('probeCubBadgeBridge：純靜態部署／404／HTML fallback／壞 payload／逾時 一律安全降級', async () => {
  // 正常伺服器
  const ok = await probeCubBadgeBridge({
    fetchImpl: async () => jsonRes({ success: true, origin: 'https://cubsbadge.vercel.app', upstreamOk: true, troops: { T12: { name: '沙田第 12 旅' } } }),
  });
  assert.equal(ok.available, true);
  assert.equal(ok.origin, 'https://cubsbadge.vercel.app');
  assert.equal(ok.upstreamOk, true);
  assert.equal(ok.troops.T12.name, '沙田第 12 旅');

  // 上游清單失敗但橋接本身存在
  const emptyUp = await probeCubBadgeBridge({
    fetchImpl: async () => jsonRes({ success: true, upstreamOk: false, troops: {} }),
  });
  assert.equal(emptyUp.available, true);
  assert.equal(emptyUp.origin, 'https://cubsbadge.vercel.app');
  assert.equal(emptyUp.upstreamOk, false);

  // 靜態主機：SPA rewrite 回 200 text/html
  const html = await probeCubBadgeBridge({ fetchImpl: async () => jsonRes(null, { type: 'text/html; charset=utf-8' }) });
  assert.deepEqual(html, { available: false, reason: 'not-json' });

  // 404（例如只部署 dist、沒有 serverless function）
  const missing = await probeCubBadgeBridge({ fetchImpl: async () => jsonRes(null, { ok: false, status: 404 }) });
  assert.equal(missing.available, false);
  assert.equal(missing.reason, 'http-404');

  // 有 JSON 但不是橋接介面
  const wrong = await probeCubBadgeBridge({ fetchImpl: async () => jsonRes({ error: 'nope' }) });
  assert.deepEqual(wrong, { available: false, reason: 'bad-payload' });

  // 離線／DNS 失敗
  const offline = await probeCubBadgeBridge({
    fetchImpl: async () => {
      throw new TypeError('Failed to fetch');
    },
  });
  assert.deepEqual(offline, { available: false, reason: 'network' });

  // 沒有 fetch（極端環境）
  assert.deepEqual(await probeCubBadgeBridge({ fetchImpl: null }), { available: false, reason: 'no-fetch' });

  // 逾時：AbortController 生效
  const slow = await probeCubBadgeBridge({
    timeoutMs: 20,
    fetchImpl: (url, init) =>
      new Promise((resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }),
  });
  assert.deepEqual(slow, { available: false, reason: 'timeout' });
});

test('數位附錄把 CUBSBADGE 標示為「可選」，未連接前鎖定進度檔匯出匯入，找不到旅團可跳轉開戶', () => {
  const card = read('web/src/components/CubBadgeSyncCard.jsx');
  assert.ok(card.includes('probeCubBadgeBridge'));
  assert.ok(card.includes('獨立模式') && card.includes('standalone mode'));
  assert.ok(card.includes('不連接亦可用完整紀錄冊'));
  assert.ok(card.includes('exportForBadge') && card.includes('importFromBadge'), '已連接時保留 JSON 交換');
  assert.ok(card.includes("push(isEn ? 'Signed out of cubbadge'"), '登出只影響雲端連線，不影響本機資料');

  // 未登入 CUBSBADGE 前必須鎖定 CUBSBADGE 進度檔匯出／匯入，並保留本機完整備份說明
  assert.match(card, /if \(!session\?\.token \|\| !session\?\.ymis\)[\s\S]*onExportFile|onExportFile[\s\S]*if \(!session\?\.token \|\| !session\?\.ymis\)/);
  assert.ok(card.includes('{session ? (') && card.includes('cubsync__locked'), '未連接 CUBSBADGE 前不可顯示進度匯出／匯入按鈕');
  assert.ok(card.includes('__NOT_FOUND__') && card.includes('前往 CUBSBADGE 開戶'), '必須提供找不到旅團時跳轉 CUBSBADGE 開戶');

  const welcome = read('web/src/pages/Welcome.jsx');
  assert.equal(welcome.includes('importFromBadge'), false, '歡迎頁未連接 CUBSBADGE 前不得直接匯入 CUBSBADGE 進度檔');

  const connect = read('web/src/pages/ParentConnect.jsx');
  assert.ok(connect.includes('__NOT_FOUND__') && connect.includes('前往 CUBSBADGE 開戶'), '家長連線頁找不到旅團時須提供跳轉 CUBSBADGE 開戶');

  const bridge = read('web/src/cubadgeBridge.js');
  assert.ok(bridge.includes('https://cubsbadge.vercel.app'));
  assert.ok(bridge.includes("cache: 'no-store'"));
  assert.ok(bridge.includes('not-json'), '必須識破 SPA fallback 的 HTML 回應');

  // 只有可選同步卡會呼叫 /api；其餘紀錄冊功能不得依賴後端
  const webFiles = ['web/src/App.jsx', 'web/src/pages/Official.jsx', 'web/src/pages/Appendix.jsx', 'web/src/pages/Forms.jsx', 'web/src/components/AwardBlock.jsx', 'web/src/components/Write.jsx', 'web/src/components/Ink.jsx', 'shared/book.js', 'shared/forms.js', 'shared/transfer.js'];
  for (const rel of webFiles) {
    const src = read(rel);
    assert.equal(/fetch\(\s*['"`]\/api/.test(src), false, `${rel} 不得直接依賴後端 API`);
  }
});

test('官方 32 頁齊備、頁序與標題照官方，內頁不出現自創「銅／銀／金箭章」', async () => {
  const { OFFICIAL_PAGES } = await import('../shared/officialPages.js');
  assert.equal(OFFICIAL_PAGES.length, 32);
  assert.deepEqual(OFFICIAL_PAGES.map((p) => p.no), Array.from({ length: 32 }, (_, i) => i + 1));
  assert.deepEqual(OFFICIAL_PAGES.map((p) => p.id), Array.from({ length: 32 }, (_, i) => `p${String(i + 1).padStart(2, '0')}`));
  assert.equal(OFFICIAL_PAGES[0].zh, '個人摘要（一）');
  assert.equal(OFFICIAL_PAGES[1].zh, '個人摘要（二）');
  assert.equal(OFFICIAL_PAGES[11].zh, '進度性獎章');
  assert.equal(OFFICIAL_PAGES[11].kind, 'divider');
  assert.equal(OFFICIAL_PAGES[19].zh, '童軍先修章');
  assert.equal(OFFICIAL_PAGES[30].zh, '活動及服務紀錄');
  assert.equal(OFFICIAL_PAGES[31].zh, '幼童軍團呼');
  assert.equal(OFFICIAL_PAGES.some((p) => p.zh === '封底'), false);

  const official = read('web/src/pages/Official.jsx');
  for (const bad of ['銅箭章', '銀箭章', '金箭章']) {
    assert.equal(official.includes(bad), false, `官方頁不應出現自創名稱「${bad}」`);
  }
  // 官方獎章名稱必須存在
  for (const good of ['幼童軍體驗章', '幼童軍歷奇章', '幼童軍高級歷奇章', '金紫荊獎章', '童軍先修章']) {
    assert.ok(official.includes(good), `缺少官方名稱「${good}」`);
  }
  // 官方頁不得再出現逐項勾選表（AssessTable 只用於會員章 a–i）
  assert.equal((official.match(/<AssessTable/g) || []).length, 2);
});

test('一般成員樣本及綱要總數：進度不帶任何簽名圖片', () => {
  const demo = sampleBook();
  assert.ok(Object.keys(demo.progress).length >= 10);
  assert.equal(ALL_AWARDS.length, 5);
  assert.equal(OTHER_BADGES.length, 49);
  for (const [id, entry] of Object.entries(demo.progress)) {
    assert.equal(entry.signature ?? null, null, `${id} 不應有假冒簽名`);
  }
  assert.equal(toBadgeId('OT-A22'), 'A22');
});
