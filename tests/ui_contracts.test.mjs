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
  assert.equal(SECTIONS.filter((s) => !s.digital).length, 33);
  assert.equal(PRINT_PAGES.length, 33);

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

test('全本幼童軍黃 × 深墨配色：官方版面亦不得殘留森林綠／酒紅／紫', () => {
  const css = read('web/src/styles.css');

  assert.ok(css.includes('--cover-bg: #1a1206'));
  assert.ok(css.includes('--cover-bg-deep: #0d0904'));
  assert.ok(css.includes('--vs-red: #7a5600'));
  assert.ok(css.includes('--foil: #d6bd67'));
  assert.ok(css.includes("html[data-lang='zh']"));
  assert.ok(css.includes('.write__dot'));
  assert.ok(css.includes('env(safe-area-inset-top)'));

  // 其他 BOOK 的顏色必須清零：深資酒紅、森林綠、紫
  const stale = [
    '#540f1e', '#2a060f', '#7a1426', '#4a0e1b', '#7b1d31', '#5a1321', '#2b0710', '#2e0710',
    '#143b28', '#1c5236', '#2f6b3a', '#14532d', '#0a2415', '#0b2417', '#1f5c3a', '#1f4d2b',
    '#563a78', '#4b2e83', '#6b4a92', '#5b3f7a', '#5b6b7a', '#1f5f8b', '#c0392b',
  ];
  for (const hex of stale) {
    assert.equal(css.toLowerCase().includes(hex), false, `styles.css 仍有其他 BOOK 顏色 ${hex}`);
  }

  // 主色必須是總會《幼童軍紀錄冊》PDF 封面實測的黃 #ead040（不是更淺的 #ffd23f／#f2b705）
  assert.ok(css.includes('--cub-yellow-bright: #ead040'), '主色 token 必須為官方黃 #ead040');
  const bright = ['#ffd23f', '#ffe27a', '#ffe9a6', '#ffdf7a', '#ffd94f', '#f2b705', '#ffd84a'];
  for (const hex of bright) {
    assert.equal(css.toLowerCase().includes(hex), false, `styles.css 仍有過淺的黃 ${hex}`);
  }

  // 官方頁：金黃標題帶配深墨字，頁碼金黃圓底
  assert.match(css, /\.sheet__banner h1 \{[^}]*color: #2b1a04/);
  assert.match(css, /\.sheet__folio \{[^}]*#ead040/);
  assert.match(css, /\.sheet__folio \{[^}]*color: #2b1a04/);
  assert.match(css, /\.offact__head \{[^}]*#241605/);

  assert.ok(contrastRatio('#7a5600', '#f7f2e7') >= 5.0, '深金標題於象牙紙 >= 5:1');
  assert.ok(contrastRatio('#1e1a14', '#f7f2e7') >= 14.0, '主墨色於象牙紙 >= 14:1');
  assert.ok(contrastRatio('#6b4608', '#f7f2e7') >= 7.0, '手寫墨色於象牙紙 >= 7:1');
  assert.ok(contrastRatio('#2b1a04', '#ead040') >= 8.0, '深墨字於幼童軍黃 #ead040 >= 8:1');
  assert.ok(contrastRatio('#ffffff', '#ead040') < 3.0, '白字配黃仍然禁止');

  // 按鈕一律深墨字
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

const OFFICIAL_ASSETS = fs
  .readdirSync(path.join(root, 'web/public/official'))
  .filter((f) => !f.startsWith('.'))
  .sort();

test('圖示全套 9 個 + 根目錄 favicon、manifest 與 Service Worker 一致', () => {
  const html = read('web/index.html');
  assert.ok(html.includes(`content="${APP_VERSION}"`));
  assert.ok(html.includes('href="/favicon.svg"'));
  assert.ok(html.includes('href="/favicon.ico"'));
  assert.ok(html.includes('href="/favicon-32.png"'));
  assert.ok(html.includes('href="/favicon-48.png"'));
  assert.ok(html.includes('href="/icons/apple-touch-icon.png"'));
  assert.ok(html.includes('content="#ead040"'), '幼童軍黃 theme-color');

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
  assert.equal(manifest.theme_color, '#ead040');
  assert.equal(manifest.background_color, '#14100a');
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, 'web/public', icon.src.replace(/^\//, ''))), `manifest 圖示不存在 ${icon.src}`);
  }

  const sw = read('web/public/sw.js');
  assert.ok(sw.includes("const CACHE_NAME = 'cubbook-cache-v3'"), '配色改版後需更新快取版本');
  // 官方 PDF 圖稿必須離線可用，否則露營現場翻開紀錄冊會破圖
  for (const asset of OFFICIAL_ASSETS) assert.ok(sw.includes(`'/official/${asset}'`), `Service Worker 未預快取 /official/${asset}`);
  assert.ok(!sw.includes('vsbook'));
  // 預快取清單每一項都必須真實存在，否則離線首次載入會破圖
  const shell = sw.match(/const SHELL = \[([\s\S]*?)\];/)[1];
  for (const m of shell.matchAll(/'([^']+)'/g)) {
    const url = m[1];
    const rel = url === '/' || url === '/index.html' ? null : path.join(root, 'web/public', url.replace(/^\//, ''));
    if (rel) assert.ok(fs.existsSync(rel), `Service Worker 預快取檔案不存在：${url}`);
  }
  assert.ok(sw.includes("url.pathname.startsWith('/official/')"), 'Service Worker 需快取 /official/ 圖稿');
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

test('官方原圖：封面／扉頁／徽章全部裁自官方 PDF，不用近似幾何圖形', async () => {
  const { statSync } = await import('node:fs');
  const assets = [
    'cover.webp',
    'divider.webp',
    'membership-emblem.png',
    'badge-experience.png',
    'badge-adventure.png',
    'badge-crest.png',
    'badge-golden.png',
    'hexagons.png',
    'grand-howl.png',
  ];
  for (const name of assets) {
    const file = new URL(`../web/public/official/${name}`, import.meta.url);
    assert.ok(statSync(file).size > 1000, `${name} 缺失或太小`);
  }
  const official = read('web/src/pages/Official.jsx');
  for (const name of assets) {
    assert.ok(official.includes(`/official/${name}`), `Official.jsx 未使用官方原圖 ${name}`);
  }
  // 舊的自繪幾何徽章必須已經移除
  for (const legacy of ['offdiamond--flower', 'offcover__diamond', 'offhowl > span', '🐺']) {
    assert.equal(official.includes(legacy), false, `仍有自繪圖形 ${legacy}`);
  }
  assert.ok(read('scripts/crop_official_art.py').includes('pypdfium2'), '缺少裁圖 script');
});
