/**
 * 分級活動徽章（官方 7 枚 × 初／中／高）的同步契約。
 *
 * 官方《幼童軍紀錄冊》第 21–27 頁把 7 枚活動徽章分初、中、高三行；
 * 本測試鎖定四條路徑都不會把「級別」丟掉或互相覆蓋：
 *   1. BOOK → cubbadge（requestComplete 逐級申報）
 *   2. cubbadge → BOOK（load 三種寫法：level 欄位、後綴鍵、levels 物件）
 *   3. BOOK ⇄ BOOK（CB1 二維碼及領袖核簽回傳碼）
 *   4. 家長模式只讀鏡像
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  newBook,
  collectPendingForBadge,
  exportForBadge,
  importFromBadge,
  splitLevelRef,
  levelsOf,
  withLevel,
} from '../shared/book.js';
import { buildPayload, applySignoff, KIND_MEMBER, KIND_SIGNOFF } from '../shared/transfer.js';
import { mirrorFromTransfer } from '../web/src/parent.js';
import { filterPersonalConfirmedLoad, sanitizePendingSubmissions } from '../api/cubbadge.js';

// parent.js 會觸及 localStorage；測試環境用最小記憶體實作。
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

const YMIS = '0012345678';

function makeBook() {
  const book = newBook();
  book.member = { ...book.member, nameZh: '測試員', scoutId: YMIS, memberNo: YMIS };
  return book;
}

test('splitLevelRef：只拆真正的分級徽章，不會誤拆 A25-NATURE / A09-CHILD-PROTECTION', () => {
  assert.deepEqual(splitLevelRef('A26-E'), { id: 'A26', level: 'E' });
  assert.deepEqual(splitLevelRef('OT-A27-A'), { id: 'OT-A27', level: 'A' });
  assert.deepEqual(splitLevelRef('A39_i'), { id: 'A39', level: 'I' });
  assert.deepEqual(splitLevelRef('A25-NATURE'), { id: 'A25-NATURE', level: '' });
  assert.deepEqual(splitLevelRef('A09-CHILD-PROTECTION'), { id: 'A09-CHILD-PROTECTION', level: '' });
  assert.deepEqual(splitLevelRef('A26'), { id: 'A26', level: '' });
  assert.deepEqual(splitLevelRef('1.2.3'), { id: '1.2.3', level: '' });
});

test('withLevel：逐級寫入，date 取最新一級', () => {
  let entry = {};
  entry = withLevel(entry, 'I', { date: '2025-05-01' }).entry;
  entry = withLevel(entry, 'E', { date: '2024-03-01' }).entry;
  assert.deepEqual(Object.keys(levelsOf(entry)).sort(), ['E', 'I']);
  assert.equal(entry.date, '2025-05-01');
  entry = withLevel(entry, 'I', { date: '2026-01-09' }).entry;
  assert.equal(entry.levels.I.date, '2026-01-09');
  assert.equal(entry.date, '2026-01-09');
});

test('BOOK → cubbadge：同一枚 A26 的初級與中級各自成為一項待批申報', () => {
  const book = makeBook();
  book.otherBadges['OT-A26'] = {
    levels: { E: { date: '2024-03-01' }, I: { date: '2025-05-01' } },
    date: '2025-05-01',
  };

  const items = collectPendingForBadge(book);
  const a26 = items.filter((it) => it.itemId === 'A26');
  assert.equal(a26.length, 2);
  assert.deepEqual(a26.map((it) => it.level).sort(), ['E', 'I']);
  assert.ok(a26.every((it) => it.itemName.includes('射箭章')));
  assert.ok(a26.some((it) => it.itemName.includes('初級')));
  assert.ok(a26.some((it) => it.itemName.includes('中級')));

  const exported = exportForBadge(book, 'T12');
  assert.equal(exported.pendingRequests.filter((r) => r.item_id === 'A26').length, 2);
  assert.ok(exported.pendingRequests.some((r) => r.item_id === 'A26' && r.level === 'E'));
  assert.ok(exported.pendingRequests.some((r) => r.item_id === 'A26' && r.level === 'I'));
  // pendingProgress 以級別分鍵，避免同徽章多級互相覆蓋
  assert.ok(exported.pendingProgress[YMIS]['A26-E']);
  assert.ok(exported.pendingProgress[YMIS]['A26-I']);
});

test('BOOK → cubbadge：已核實／已待批的一級不再重複送交，另一級照送', () => {
  const book = makeBook();
  book.otherBadges['OT-A26'] = {
    levels: { E: { date: '2024-03-01' }, I: { date: '2025-05-01' } },
    date: '2025-05-01',
  };

  // 初級已由領袖核實（BADGE 以 A26-E 回傳）
  let items = collectPendingForBadge(book, { 'A26-E': { date: '2024-03-01' } });
  assert.deepEqual(items.map((it) => it.level), ['I']);

  // 中級正在待批（BADGE 以 level 欄位回傳，BOOK 以 level 參數標記）
  items = collectPendingForBadge(book, {}, ['A26-I']);
  assert.deepEqual(items.map((it) => it.level), ['E']);

  // 整個徽章一次核實（舊資料沒有級別）→ 兩級都不再送
  items = collectPendingForBadge(book, { A26: { date: '2024-03-01' } });
  assert.deepEqual(items, []);
});

test('cubbadge → BOOK：level 欄位 / 後綴鍵 / levels 物件三種寫法都寫回正確一級', () => {
  const base = makeBook();
  base.otherBadges['OT-A26'] = { levels: { E: { date: '2024-03-01' } }, date: '2024-03-01' };

  const viaField = importFromBadge(
    { otherBadges: { [YMIS]: { A26: { date: '2025-05-01', level: 'I' } } } },
    base,
  ).book;
  assert.equal(viaField.otherBadges['OT-A26'].levels.E.date, '2024-03-01');
  assert.equal(viaField.otherBadges['OT-A26'].levels.I.date, '2025-05-01');
  assert.equal(viaField.otherBadges['OT-A26'].date, '2025-05-01');
  assert.equal(viaField.otherBadges['OT-A26'].levels.I.confirmedByBadge, true);

  const viaSuffix = importFromBadge(
    { otherBadges: { [YMIS]: { 'A27-A': { date: '2026-02-02' } } } },
    base,
  ).book;
  assert.equal(viaSuffix.otherBadges['OT-A27'].levels.A.date, '2026-02-02');

  const viaNested = importFromBadge(
    {
      otherBadges: {
        [YMIS]: { A39: { levels: { E: { date: '2024-01-01' }, A: { date: '2026-03-03' } } } },
      },
    },
    base,
  ).book;
  assert.equal(viaNested.otherBadges['OT-A39'].levels.E.date, '2024-01-01');
  assert.equal(viaNested.otherBadges['OT-A39'].levels.A.date, '2026-03-03');
  assert.equal(viaNested.otherBadges['OT-A39'].date, '2026-03-03');

  // 單一徽章不可被誤寫成 levels
  const plain = importFromBadge(
    { otherBadges: { [YMIS]: { 'A25-NATURE': { date: '2026-04-04' } } } },
    base,
  ).book;
  assert.equal(plain.otherBadges['OT-A25-NATURE'].date, '2026-04-04');
  assert.equal(plain.otherBadges['OT-A25-NATURE'].levels, undefined);
});

test('CB1 二維碼：家長鏡像保留各級日期，不會只剩最高一級', () => {
  const book = makeBook();
  book.otherBadges['OT-A26'] = {
    levels: { E: { date: '2024-03-01' }, I: { date: '2025-05-01' } },
    date: '2025-05-01',
  };

  const payload = buildPayload(book, ['otherBadges']);
  assert.equal(payload.t, KIND_MEMBER);
  assert.deepEqual(Object.keys(payload.otherBadges['OT-A26'].levels).sort(), ['E', 'I']);

  const mirrored = mirrorFromTransfer({ ...payload, at: '2026-01-01T00:00:00.000Z' });
  const entry = mirrored.book.otherBadges['OT-A26'];
  assert.equal(entry.levels.E.date, '2024-03-01');
  assert.equal(entry.levels.I.date, '2025-05-01');
  assert.equal(entry.date, '2025-05-01');
  assert.equal(entry.levels.I.verified, true);
});

test('領袖核簽回傳碼：只簽某一級時不覆蓋其他級別', () => {
  const book = makeBook();
  book.otherBadges['OT-A33'] = { levels: { E: { date: '2024-03-01' } }, date: '2024-03-01' };

  const payload = {
    t: KIND_SIGNOFF,
    v: 1,
    at: '2026-01-01T00:00:00.000Z',
    member: { nameZh: '測試員', scoutId: YMIS },
    leader: { name: '陳團長', title: '幼童軍團長 CSL', at: '2026-01-01', png: null },
    items: [],
    otherBadges: [{ id: 'A33', level: 'I', date: '2026-01-05', verified: true }],
    note: '',
  };
  const { book: next, changes } = applySignoff(book, payload);
  assert.equal(next.otherBadges['OT-A33'].levels.E.date, '2024-03-01');
  assert.equal(next.otherBadges['OT-A33'].levels.I.date, '2026-01-05');
  assert.equal(next.otherBadges['OT-A33'].date, '2026-01-05');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].level, 'I');
});

test('api/cubbadge：送交時保留級別並逐級去重', () => {
  const items = sanitizePendingSubmissions([
    { itemId: 'A26', level: 'E', date: '2024-03-01' },
    { itemId: 'A26-E', date: '2024-03-01' }, // 同一級的重複寫法要被去重
    { itemId: 'A26', level: 'I', date: '2025-05-01' },
    { itemId: 'A25-NATURE', date: '2026-04-04' },
    { itemId: 'A26', level: 'Z', date: '2026-01-01' }, // 非法級別 → 當作整個徽章
  ]);
  assert.equal(items.length, 4);
  assert.deepEqual(
    items.filter((it) => it.itemId === 'A26').map((it) => it.level || '—').sort(),
    ['E', 'I', '—'],
  );
  assert.equal(items.find((it) => it.itemId === 'A25-NATURE').level, undefined);
});

test('api/cubbadge：載入時把三種級別寫法統一成「官方編號 + level 鍵」', () => {
  const out = filterPersonalConfirmedLoad(
    {
      success: true,
      otherBadges: {
        [YMIS]: {
          A26: { date: '2025-05-01', level: 'I' },
          'A27-A': { date: '2026-02-02' },
          A39: { levels: { E: { date: '2024-01-01' } } },
          'A25-NATURE': { date: '2026-04-04' },
        },
      },
    },
    YMIS,
  );
  const map = out.otherBadges[YMIS];
  assert.equal(map['A26-I'].date, '2025-05-01');
  assert.equal(map['A27-A'].date, '2026-02-02');
  assert.equal(map.A39.levels.E.date, '2024-01-01');
  assert.equal(map['A25-NATURE'].date, '2026-04-04');

  // 再把這份載入結果灌進 BOOK，確認兩級並存
  const book = importFromBadge({ otherBadges: out.otherBadges }, makeBook()).book;
  assert.equal(book.otherBadges['OT-A26'].levels.I.date, '2025-05-01');
  assert.equal(book.otherBadges['OT-A27'].levels.A.date, '2026-02-02');
  assert.equal(book.otherBadges['OT-A39'].levels.E.date, '2024-01-01');
});
