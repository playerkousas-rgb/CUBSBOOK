import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/* ------------------------------------------------------------------ */
/* 1. 家長模式開關：只寫一個本機旗標，永不改動書本資料                    */
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

test('家長模式：localStorage 旗標可開可關，並會通知畫面', () => {
  let hits = 0;
  const off = parent.onParentChange(() => {
    hits += 1;
  });

  assert.equal(parent.isParent(), false);
  parent.enterParentMode();
  assert.equal(parent.isParent(), true);
  assert.equal(mem.get('cubbook.parent.v1'), '1');
  assert.equal(hits, 1);

  parent.exitParentMode();
  assert.equal(parent.isParent(), false);
  assert.equal(hits, 2);
  off();

  parent.enterParentMode();
  assert.equal(hits, 2, '取消訂閱後不應再收到通知');
  parent.exitParentMode();
});

/* ------------------------------------------------------------------ */
/* 2. 家長模式 = 全域只讀：寫入路徑被鎖，家長毋須填任何個人資料           */
/* ------------------------------------------------------------------ */

test('家長模式與領袖模式共用同一個 readOnly 鎖，個人資料欄位全部停用', () => {
  const app = read('web/src/App.jsx');
  assert.match(app, /readOnly: leader \|\| parent/);
  assert.match(app, /if \(isLeader\(\) \|\| isParent\(\)\) return;/);
  assert.match(app, /<ParentView/);
  assert.match(app, /className="parentbar no-print"/);

  const ctx = read('web/src/bookContext.js');
  assert.match(ctx, /export function useReadOnly\(\)/);
  assert.match(ctx, /if \(readOnly\) return;/);

  const view = read('web/src/pages/ParentView.jsx');
  assert.equal(/<(input|textarea|select)\b/.test(view), false, '家長模式不得有任何輸入欄位');
  assert.equal(/useField|setField|contentEditable/.test(view), false, '家長模式不得提供欄位寫入 API');
  assert.match(view, /毋須填寫任何個人資料/);
  assert.match(view, /read-only/i);
});

/* ------------------------------------------------------------------ */
/* 3. 入口：封面 + 選單 + 工具列；可隨時退出                              */
/* ------------------------------------------------------------------ */

test('家長模式有封面、選單及工具列三個入口，並可退出', () => {
  const menu = read('web/src/components/MenuDialog.jsx');
  assert.match(menu, /enterParentMode/);
  assert.match(menu, /exitParentMode/);
  assert.match(menu, /家長模式（只讀查看）/);
  assert.match(menu, /退回家長模式/);
  assert.match(menu, /\{!leader && !parent && \(/, '家長模式不得匯入備份／載入示範／清除資料');

  const cover = read('web/src/pages/CoverPage.jsx');
  assert.match(cover, /onParent/);
  assert.match(cover, /家長查看/);

  const app = read('web/src/App.jsx');
  assert.match(app, /chipbtn--parent/);
  assert.match(app, /'家長 · 只讀'/);
});

/* ------------------------------------------------------------------ */
/* 4. 領袖模式變數名稱固定（伺服器 LEADER_CODE、前端 flag key / TTL）      */
/* ------------------------------------------------------------------ */

test('領袖模式變數名稱與家長模式互不混淆', () => {
  const apiLeader = read('api/leader.js');
  assert.match(apiLeader, /process\.env\.LEADER_CODE/);
  assert.equal(apiLeader.includes('VITE_LEADER_CODE'), false);

  const leader = read('web/src/leader.js');
  assert.match(leader, /const KEY = 'cubbook\.leader\.v1'/);
  assert.match(leader, /const TTL = 12 \* 60 \* 60 \* 1000/);
  assert.match(leader, /export function isLeader/);
  assert.match(leader, /export async function leaderAvailable/);
  assert.match(leader, /export async function enterLeaderMode/);
  assert.match(leader, /export function exitLeaderMode/);

  assert.match(read('web/src/parent.js'), /const KEY = 'cubbook\.parent\.v1'/);
});

/* ------------------------------------------------------------------ */
/* 5. 幼童軍黃是主色：封面黃布面深綠字，白字配黃仍然禁用                    */
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

test('幼童軍黃主色：封面黃布面 + 深綠字，對比度達到 AA', () => {
  const css = read('web/src/styles.css');
  assert.ok(css.includes('--cub-yellow: #f2b705'));
  assert.ok(css.includes('linear-gradient(155deg, #ffd84a 0%, #f2b705 46%, #dca700 100%)'));
  assert.ok(css.includes('.parentbar'));
  assert.ok(css.includes('.parent__kpis'));

  assert.ok(ratio('#123420', '#f2b705') >= 6.8, '深綠字於幼童軍黃 >= 6.8:1');
  assert.ok(ratio('#1a1206', '#f2b705') >= 8.0, '深炭字於幼童軍黃 >= 8:1');
  assert.ok(ratio('#ffe27a', '#143b28') >= 7.0, '金黃字於深綠 >= 7:1');
  assert.ok(ratio('#ffffff', '#f2b705') < 3.0, '白字配黃依然不可用');

  // 封面所有文字顏色都不得再是奶白（黃底上會失去對比）
  const coverBlock = css.slice(css.indexOf('v1.0.1 · 幼童軍黃'));
  assert.equal(/\.coverart__title[^}]*#f8ecd0/.test(coverBlock), false, '封面標題不得再用奶白字');
  assert.ok(coverBlock.includes('.coverart__title,'), '封面標題須覆寫為深綠字');
});
