import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_VERSION, PAGE_TOTAL, SECTIONS, PRINT_PAGES } from '../shared/book.js';
import leaderHandler from '../api/leader.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function luminance(hex) {
  const c = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

function contrastRatio(hexA, hexB) {
  const l1 = luminance(hexA);
  const l2 = luminance(hexB);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function callLeaderApi(method, body, envCode) {
  const prev = process.env.LEADER_CODE;
  if (envCode === undefined) delete process.env.LEADER_CODE;
  else process.env.LEADER_CODE = envCode;
  let status = 200;
  let payload = null;
  const res = {
    setHeader() {},
    status(c) {
      status = c;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };
  try {
    leaderHandler({ method, body }, res);
  } finally {
    if (prev === undefined) delete process.env.LEADER_CODE;
    else process.env.LEADER_CODE = prev;
  }
  return { status, payload };
}

test('官方 32 頁紙本 + 目錄 + 數位附錄全部映射於 App.jsx，並可整本列印', () => {
  assert.equal(PAGE_TOTAL, 32);
  assert.equal(SECTIONS.filter((s) => !s.digital).length, 32);
  assert.equal(PRINT_PAGES.length, 32);

  const app = read('web/src/App.jsx');
  for (const sec of SECTIONS) {
    assert.match(app, new RegExp(`\\b${sec.id}\\s*:`), `App.jsx 缺少 ${sec.id} 路由`);
  }
  assert.match(app, /\bcontents\s*:/);
  assert.match(app, /\bprint\b/);
  assert.match(app, /'\/print'/);
  // 表格以 /forms/:id 動態路由，並以 FORM_META 白名單核對編號
  assert.ok(app.includes('FormDoc'));
  assert.ok(app.includes('FormsIndex'));
  assert.ok(app.includes('FormsAll'));
  assert.ok(app.includes("path.startsWith('/forms')"));
  const formsPage = read('web/src/pages/Forms.jsx');
  for (const formId of ['pt67', 'pt68', 'gbac']) {
    assert.ok(formsPage.includes(`'${formId}'`) || formsPage.includes(`"${formId}"`), `Forms.jsx 缺少 ${formId}`);
  }

  // 官方 32 頁全部由官方頁面模組匯出
  const official = read('web/src/pages/Official.jsx');
  const exported = official.match(/export function P\d\d\b/g) || [];
  assert.equal(exported.length, 32);
});

test('版權與非官方聲明只出現於封面頁腳、數位附錄、選單「關於」三處', () => {
  const legal = read('web/src/components/Legal.jsx');
  assert.ok(legal.includes('Copyright © 2026 SCOUT SYSTEM'));
  assert.ok(legal.includes('本網站為非官方獨立工具，旨在方便成員，與香港童軍總會無任何官方從屬關係'));
  assert.ok(legal.includes('This site is an independent, unofficial tool for members'));

  const usages = [];
  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.jsx$/.test(ent.name)) {
        const txt = fs.readFileSync(full, 'utf8');
        if (/<Legal(Line|Note)\b/.test(txt)) usages.push(path.relative(root, full));
      }
    }
  };
  walk(path.join(root, 'web/src'));
  assert.deepEqual(usages.sort(), [
    'web/src/components/MenuDialog.jsx',
    'web/src/pages/Appendix.jsx',
    'web/src/pages/CoverPage.jsx',
  ]);

  // 內頁、目錄、列印及表格不得重複版權聲明
  for (const rel of ['web/src/pages/Welcome.jsx', 'web/src/components/Paper.jsx', 'web/src/pages/Official.jsx', 'web/src/pages/Forms.jsx', 'web/src/pages/Scan.jsx']) {
    assert.ok(!/Legal(Line|Note)/.test(read(rel)), `${rel} 不得重複版權聲明`);
  }
});

test('幼童軍綠金配色符合 WCAG AA，且絕無白字配金黃底', () => {
  const css = read('web/src/styles.css');

  assert.ok(css.includes('--cover-bg: #143b28'));
  assert.ok(css.includes('--cover-bg-deep: #08180f'));
  assert.ok(css.includes('--vs-red: #1c5236'));
  assert.ok(css.includes('--foil: #e3c07a'));
  assert.ok(css.includes("html[data-lang='zh']"));
  assert.ok(css.includes('.write__dot'));
  assert.ok(css.includes('env(safe-area-inset-top)'));

  // 舊有深資童軍酒紅殘留必須清零
  for (const stale of ['#540f1e', '#2a060f', '#7a1426', '#4a0e1b', '#7b1d31', '#5a1321', '#2b0710']) {
    assert.equal(css.toLowerCase().includes(stale), false, `styles.css 仍有深資酒紅 ${stale}`);
  }

  assert.ok(contrastRatio('#1c5236', '#f7f2e7') >= 7.0, '深森林綠標題於象牙紙 >= 7:1');
  assert.ok(contrastRatio('#1e1a14', '#f7f2e7') >= 14.0, '主墨色於象牙紙 >= 14:1');
  assert.ok(contrastRatio('#19386b', '#f7f2e7') >= 8.0, '手寫藍墨於象牙紙 >= 8:1');
  assert.ok(contrastRatio('#f6e6bb', '#143b28') >= 7.0, '燙金字於深綠布面 >= 7:1');
  assert.ok(contrastRatio('#1a1206', '#e3c07a') >= 8.0, '深炭字於幼童軍金黃 >= 8:1');
  assert.ok(contrastRatio('#ffffff', '#1c5236') >= 4.5, '白字於深綠按鈕 >= 4.5:1');

  // 反例：白字配幼童軍黃必須低於 AA，證明設計上不可用
  assert.ok(contrastRatio('#ffffff', '#e6a800') < 3.0);
  // 因此金黃底按鈕一律使用深炭文字
  assert.match(css, /\.btn--gold\s*\{[^}]*color: #1a1206/);
  assert.match(css, /\.chipbtn--gold\s*\{[^}]*color: #1a1206/);
});

test('api/leader.js 只於伺服器比對 LEADER_CODE（timingSafeEqual），前端零密碼', () => {
  assert.deepEqual(callLeaderApi('GET', null, undefined), { status: 200, payload: { enabled: false } });
  assert.deepEqual(callLeaderApi('GET', null, '852963'), { status: 200, payload: { enabled: true } });
  assert.deepEqual(callLeaderApi('POST', { code: '852963' }, undefined), { status: 503, payload: { error: 'unset' } });
  assert.deepEqual(callLeaderApi('POST', { code: '' }, '852963'), { status: 400, payload: { error: 'empty' } });
  assert.deepEqual(callLeaderApi('POST', { code: '000000' }, '852963'), { status: 401, payload: { error: 'wrong' } });
  assert.deepEqual(callLeaderApi('POST', { code: '85296' }, '852963'), { status: 401, payload: { error: 'wrong' } });
  assert.deepEqual(callLeaderApi('POST', { code: '852963' }, '852963'), { status: 200, payload: { ok: true } });

  const api = read('api/leader.js');
  assert.ok(api.includes('crypto.timingSafeEqual'));
  assert.ok(!/process\.env\.VITE_/.test(api));

  const checkDir = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) checkDir(full);
      else if (/\.(js|jsx|html)$/.test(ent.name)) {
        const txt = fs.readFileSync(full, 'utf8');
        assert.ok(!txt.includes('VITE_LEADER'), `${full} 不得把領袖密碼帶入前端 bundle`);
      }
    }
  };
  checkDir(path.join(root, 'web'));
  assert.ok(!read('vite.config.js').includes('VITE_LEADER'));

  const env = read('.env.example');
  assert.match(env, /^LEADER_CODE=/m);
  assert.match(env, /^CUBBADGE_ORIGIN=/m);
  assert.ok(!/^VITE_/m.test(env), '.env.example 不得定義任何 VITE_ 變數');
});

test('領袖模式（只讀、可掃描他人）與普通模式（不可讀他人）嚴格分離', () => {
  const app = read('web/src/App.jsx');
  assert.ok(app.includes('readOnly: leader || parent'));
  assert.ok(app.includes('if (isLeader() || isParent()) return;'));
  assert.ok(app.includes('leader ? <HashSnapshotViewer token={hashToken} /> : <LeaderGate mode="gate" />'));
  assert.ok(app.includes('LeaderGate'));

  const write = read('web/src/components/Write.jsx');
  assert.ok(write.includes('write--readonly'));

  // 普通模式出示的二維碼只接受領袖簽發的 CB1S 核簽碼
  const showQr = read('web/src/components/ShowQrDialog.jsx');
  assert.ok(showQr.includes('payload.t !== KIND_SIGNOFF'));
  // 出示預設不剔選任何組別
  assert.ok(!/useState\(\[[^\]]*'(particulars|contact)'/.test(showQr), '出示二維碼不得預設剔選組別');

  const scan = read('web/src/pages/Scan.jsx');
  assert.ok(scan.includes('Signoff'));
  assert.ok(scan.toLowerCase().includes('cb1') || scan.includes('encodeSignoff'));
});

test('中英文完全分離：一鍵切換、不以並排方式塞入表格', () => {
  const i18n = read('web/src/i18n.jsx');
  assert.ok(i18n.includes("setAttribute('data-lang'"));
  assert.ok(i18n.includes('toggle'));

  const css = read('web/src/styles.css');
  assert.ok(css.includes('html[data-lang="zh"]'), '中文介面必須隱藏雙語小字');
  assert.ok(css.includes("data-lang"), 'styles.css 需按語言切換排版');

  // 內頁不得把中英並列寫死於同一字串（例如「日期 Date」）
  for (const rel of ['web/src/pages/Official.jsx', 'web/src/pages/Appendix.jsx', 'web/src/pages/CoverPage.jsx']) {
    const src = read(rel);
    for (const bad of ['日期 Date', '由 From', '或 OR', '所選項目 Selected Item', '姓名 Name']) {
      assert.equal(src.includes(bad), false, `${rel} 出現中英並列字串「${bad}」`);
    }
  }

  // 誓詞與規律中英分開呈現（官方第 6 頁）
  const back = read('web/src/pages/Official.jsx');
  assert.ok(back.includes('我願盡所能'));
  assert.ok(back.includes('幼童軍，盡所能'));
  assert.ok(back.includes('日行一善'));
  assert.ok(back.includes('I promise that I will do my best'));
  assert.ok(back.includes('to do my duty to God and to my Country'));
  // 同一頁不可把中英文串接成一行
  assert.ok(!back.includes('誓詞 Promise'));
});

test('圖示全套 9 個 + 根目錄 favicon、manifest 與 Service Worker 一致', () => {
  const html = read('web/index.html');
  assert.ok(html.includes(`content="${APP_VERSION}"`));
  assert.ok(html.includes('href="/favicon.svg"'));
  assert.ok(html.includes('href="/favicon.ico"'));
  assert.ok(html.includes('href="/favicon-32.png"'));
  assert.ok(html.includes('href="/favicon-48.png"'));
  assert.ok(html.includes('href="/icons/apple-touch-icon.png"'));
  assert.ok(html.includes('content="#f2b705"'), '幼童軍黃 theme-color');

  const files = [
    'web/public/favicon.svg',
    'web/public/favicon.ico',
    'web/public/favicon-32.png',
    'web/public/favicon-48.png',
    'web/public/icons/favicon.ico',
    'web/public/icons/favicon-16.png',
    'web/public/icons/favicon-32.png',
    'web/public/icons/apple-touch-icon.png',
    'web/public/icons/icon-192.png',
    'web/public/icons/icon-512.png',
    'web/public/icons/icon-maskable-192.png',
    'web/public/icons/icon-maskable-512.png',
    'web/public/icons/og-image.png',
  ];
  for (const rel of files) {
    const f = path.join(root, rel);
    assert.ok(fs.existsSync(f) && fs.statSync(f).size > 100, `缺少或空白圖示 ${rel}`);
  }

  const manifest = JSON.parse(read('web/public/manifest.webmanifest'));
  assert.equal(manifest.short_name, 'CUBBOOK');
  assert.equal(manifest.theme_color, '#f2b705');
  assert.equal(manifest.background_color, '#14100a');
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, 'web/public', icon.src.replace(/^\//, ''))), `manifest 圖示不存在 ${icon.src}`);
  }

  const sw = read('web/public/sw.js');
  assert.ok(sw.includes("const CACHE_NAME = 'cubbook-cache-v1'"));
  assert.ok(!sw.includes('vsbook'));
  // 預快取清單每一項都必須真實存在，否則離線首次載入會破圖
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  for (const m of shell.matchAll(/'([^']+)'/g)) {
    const url = m[1];
    const rel = url === '/' || url === '/index.html' ? null : path.join(root, 'web/public', url.replace(/^\//, ''));
    if (rel) assert.ok(fs.existsSync(rel), `Service Worker 預快取檔案不存在：${url}`);
  }
  assert.ok(!fs.existsSync(path.join(root, 'web/public/img')), '不應保留深資童軍徽章圖片');
});

test('package.json / vite.config.js 已完全改用 cubbook 及 /api/cubbadge', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'cubbook');
  assert.match(pkg.description, /CUBBOOK/);
  assert.ok(pkg.scripts.syllabus);

  const vite = read('vite.config.js');
  assert.ok(vite.includes("from './api/cubbadge.js'"));
  assert.ok(vite.includes("'/api/cubbadge'"));
  assert.ok(!vite.includes('vsbadge'));
  assert.ok(vite.includes('0.0.0.0'));

  assert.ok(!fs.existsSync(path.join(root, 'api/vsbadge.js')));
});
