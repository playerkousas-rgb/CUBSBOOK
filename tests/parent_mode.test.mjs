import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/* ------------------------------------------------------------------ */
/* 家長模式 = 第二部手機的只讀鏡像（一個後端、兩部前端）                  */
/* ------------------------------------------------------------------ */

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
  key: (i) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};

const parent = await import('../web/src/parent.js');
const { newBook } = await import('../shared/book.js');

test('家長旗標與鏡像獨立儲存，退出時清走孩子的資料', () => {
  assert.equal(parent.isParent(), false);
  parent.enterParentMode();
  assert.equal(parent.isParent(), true);
  assert.equal(mem.get(parent.PARENT_FLAG_KEY), '1');

  const mirror = newBook({ member: { scoutId: '25081420' } });
  mirror.progress['L1-A'] = { date: '2025-01-01' };
  parent.saveParentBook(mirror);
  assert.ok(mem.get(parent.PARENT_BOOK_KEY), '鏡像寫入獨立 key');
  assert.equal(mem.get('cubbook.book.v1'), undefined, '不得覆蓋本機成員紀錄冊');

  const loaded = parent.loadParentBook();
  assert.equal(loaded.member.scoutId, '25081420');
  assert.equal(loaded.progress['L1-A'].date, '2025-01-01');

  parent.exitParentMode();
  assert.equal(parent.isParent(), false);
  assert.equal(mem.get(parent.PARENT_BOOK_KEY), undefined, '退出家長模式即清除鏡像');
});

test('由孩子二維碼建立只讀鏡像：只抄已分享的進度／獎章／續期', () => {
  const res = parent.mirrorFromTransfer({
    t: 'cubbook/member',
    v: 1,
    at: '2026-03-01T10:00:00.000Z',
    member: { nameZh: '陳小狼', scoutId: '25081420' },
    progress: { 'L1-A': { date: '2025-01-01', assessor: '團長' }, 'L2-SKILLS-01': { date: '2025-02-02' } },
    otherBadges: { 'OT-A01': { date: '2025-03-03', cert: 'C1' } },
    renewals: [{ date: '2025-01-01', validUntil: '2026-08-31' }],
    awards: { L1: { date: '2025-04-04' } },
  });
  assert.equal(res.imported, 3);
  assert.equal(res.book.member.nameZh, '陳小狼');
  assert.equal(res.book.progress['L1-A'].date, '2025-01-01');
  assert.equal(res.book.otherBadges['OT-A01'].cert, 'C1');
  assert.equal(res.book.renewals[0].validUntil, '2026-08-31');
  assert.equal(res.book.pages.award_L1.date, '2025-04-04');
  assert.equal(res.book.meta.parent.source, 'qr');
  assert.match(res.book.meta.parent.syncedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('由 cubbadge 匯出建立鏡像：只收領袖已核實進度，pending 不會錄入', () => {
  const res = parent.mirrorFromBadge(
    {
      progress: {
        'L1-A': { date: '2025-01-01', confirmed: true },
        'L1-B': { date: '2025-02-02', status: 'pending' },
      },
      otherBadges: { 'OT-A01': { date: '2025-03-03', confirmed: true } },
      pendingRequests: [{ item_id: 'L2-A', status: 'pending' }],
    },
    { troopId: 'T12', troopName: '沙田第 12 旅', ymis: '25081420', token: 'x' },
  );
  assert.equal(res.imported, 2, '只有 confirmed 的項目會匯出');
  assert.ok(res.skippedPending >= 1);
  assert.equal(res.book.progress['L1-A'].date, '2025-01-01');
  assert.equal(res.book.meta.parent.source, 'badge');
  assert.equal(res.book.meta.parent.ymis, '25081420');
  assert.equal(res.book.member.scoutId, '25081420');
});

test('家長模式只下載、不上載：parent.js 零 fetch，家中介面無提交動作', () => {
  const lib = read('web/src/parent.js');
  assert.equal(/fetch\(/.test(lib), false, '家長模組不得直接呼叫網絡');
  assert.equal(/requestComplete|saveOtherBadge|action:\s*'save'/.test(lib), false);
  assert.match(lib, /PARENT_NOTICE/);
  assert.match(lib, /永不向 cubbadge 匯入/);

  const connect = read('web/src/pages/ParentConnect.jsx');
  assert.match(connect, /action: 'login'/);
  assert.match(connect, /action: 'load'/);
  assert.equal(/action:\s*'save'|requestComplete|pending/.test(connect), false, '家長連線頁不得向 BADGE 提交');
  assert.match(connect, /家長模式需要 \/api\/cubbadge/);
  assert.match(connect, /開啟掃描器/);
});

test('App 以獨立鏡像運作：載入／儲存走 parent store，主紀錄冊不受影響', () => {
  const app = read('web/src/App.jsx');
  assert.match(app, /isParent\(\) \? loadParentBook\(\) : loadBook\(\)/);
  assert.match(app, /if \(isParent\(\)\) saveParentBook\(next\)/);
  assert.match(app, /if \(!book \|\| parent\) return;/, '家長模式不寫入主 localStorage');
  assert.match(app, /readOnly: leader \|\| parent/);
  assert.match(app, /if \(isLeader\(\) \|\| isParent\(\)\) return;/);
  assert.match(app, /parentConnectRoute/);
  assert.match(app, /<ParentConnect/);
  assert.match(app, /<ScanView parentMode=\{parent && !leader\} \/>/);
  assert.match(app, /<Scan hasBook parentMode=\{parent && !leader\} \/>/);

  const scan = read('web/src/pages/Scan.jsx');
  assert.match(scan, /withSignoff=\{!parentMode\}/, '家長掃描不可核簽');
  assert.match(scan, /存為家長只讀副本/);
  assert.match(scan, /PARENT MODE · READ-ONLY/);
});

test('家長模式沒有輸入個人資料的欄位；退出與更新入口齊備', () => {
  const view = read('web/src/pages/ParentView.jsx');
  assert.equal(/<(input|textarea|select)\b/.test(view), false, '家長檢視不得有輸入欄位');
  assert.equal(/useField|setField|contentEditable/.test(view), false);
  assert.match(view, /由 cubbadge／QR 更新/);
  assert.match(view, /來源：/);
  assert.match(view, /read-only/i);

  const menu = read('web/src/components/MenuDialog.jsx');
  assert.match(menu, /enterParentMode/);
  assert.match(menu, /navigate\('\/parent\/connect'\)/);
  assert.match(menu, /退回家長模式/);
  assert.match(menu, /\{!leader && !parent && \(/, '家長模式不得匯入備份／載入示範／清除資料');
});

/* ------------------------------------------------------------------ */
/* 幼童軍黃是主色；綠色留給未來的 SCOUTBOOK                              */
/* ------------------------------------------------------------------ */

const lum = (hex) => {
  const h = hex.replace('#', '');
  const v = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

test('圖示與 favicon 用總會紀錄冊的幼童軍黃 #ead040，不再用森林綠（綠色留給 SCOUTBOOK）', () => {
  const script = read('scripts/generate_icons.mjs');
  assert.match(script, /234, 208, 64/, '主要封面黃 #ead040（取自官方 PDF 封面）');
  assert.equal(script.includes('[28, 82, 54, 255]'), false, '16px 調色盤不得再用深綠');
  assert.equal(/mix\(8, 42, glow\)/.test(script), false, '背景不得再用森林綠漸層');

  const svg = read('web/public/favicon.svg');
  assert.match(svg, /#ead040/);
  assert.equal(svg.includes('#143b28'), false, 'favicon 不再用深綠');

  const css = read('web/src/styles.css');
  assert.ok(css.includes('--cub-yellow: #dcc02c'));
  assert.ok(css.includes('--cub-yellow-bright: #ead040'));
  assert.ok(css.includes('linear-gradient(155deg, #f0d85e 0%, #dcc02c 46%, #c0a21c 100%)'));
  assert.ok(ratio('#241605', '#ead040') >= 6.8, '深墨燙印於官方黃 >= 6.8:1');
  assert.ok(ratio('#1a1206', '#ead040') >= 8.0);
  assert.ok(ratio('#ffffff', '#ead040') < 3.0, '白字配黃仍然禁止');
});
