import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EMBED_ACK_KEY,
  FRAME_ANCESTORS,
  IFRAME_ALLOW,
  PORTAL_ORIGIN,
  isEmbedded,
  standaloneHost,
  standaloneUrl,
} from '../shared/embed.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const vercel = JSON.parse(read('vercel.json'));
const allHeaders = vercel.headers.flatMap((rule) => rule.headers.map((h) => ({ source: rule.source, ...h })));
const catchAll = vercel.headers.find((rule) => rule.source === '/(.*)');
const headerOf = (key) => catchAll.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value;

test('部署安全標頭：只容許 BOOK 自身及服務平台以 iframe 嵌入', () => {
  assert.equal(PORTAL_ORIGIN, 'https://member-portal-sigma-swart.vercel.app');
  assert.equal(FRAME_ANCESTORS, "frame-ancestors 'self' https://member-portal-sigma-swart.vercel.app");

  assert.ok(catchAll, 'vercel.json 必須有覆蓋全站的 /(.*) 標頭規則');
  assert.equal(headerOf('Content-Security-Policy'), FRAME_ANCESTORS);

  // 白名單必須精確：不得出現萬用字元、其他來源或 http
  const sources = FRAME_ANCESTORS.replace(/^frame-ancestors\s+/, '').split(/\s+/);
  assert.deepEqual(sources, ["'self'", PORTAL_ORIGIN]);
  assert.ok(!/\*|http:\/\//.test(headerOf('Content-Security-Policy')));

  // 全檔只可有一條 CSP，避免多條規則互相收窄或放寬
  const csp = allHeaders.filter((h) => h.key.toLowerCase() === 'content-security-policy');
  assert.equal(csp.length, 1);
});

test('X-Frame-Options 必須完全移除（DENY 與 SAMEORIGIN 都會擋住服務平台）', () => {
  assert.equal(allHeaders.some((h) => h.key.toLowerCase() === 'x-frame-options'), false);
  for (const rel of ['vercel.json', 'vite.config.js', 'web/index.html', 'api/leader.js', 'api/cubbadge.js', 'web/public/sw.js']) {
    const src = read(rel);
    assert.equal(/x-frame-options/i.test(src), false, `${rel} 不得設定 X-Frame-Options`);
    assert.equal(/SAMEORIGIN/i.test(src), false, `${rel} 不得設定 SAMEORIGIN`);
  }
  // frame-ancestors 寫在 <meta> 內會被瀏覽器忽略，只可由回應標頭設定
  assert.equal(/http-equiv=["']Content-Security-Policy/i.test(read('web/index.html')), false);
});

test('其餘安全標頭與相機權限維持不變', () => {
  assert.equal(headerOf('X-Content-Type-Options'), 'nosniff');
  assert.equal(headerOf('Referrer-Policy'), 'strict-origin-when-cross-origin');
  // BOOK 自身可用相機（嵌入時由服務平台 iframe 的 allow 屬性委派），其餘感應器維持關閉
  assert.equal(headerOf('Permissions-Policy'), 'camera=(self), microphone=(), geolocation=()');
  assert.deepEqual(IFRAME_ALLOW.split(';').map((s) => s.trim()), ['camera', 'clipboard-write']);

  for (const rel of ['web/src/pages/Scan.jsx', 'web/src/components/ShowQrDialog.jsx']) {
    assert.ok(read(rel).includes('navigator.mediaDevices.getUserMedia'), `${rel} 相機掃描不得移除`);
  }
});

test('isEmbedded：獨立開啟為否；被嵌入或讀不到頂層視窗一律為是', () => {
  const top = {};
  top.self = top;
  top.top = top;
  assert.equal(isEmbedded(top), false);

  const framed = { top };
  framed.self = framed;
  assert.equal(isEmbedded(framed), true);

  const crossSite = {
    get self() {
      return this;
    },
    get top() {
      throw new Error('SecurityError');
    },
  };
  assert.equal(isEmbedded(crossSite), true);
  assert.equal(isEmbedded(null), false);

  const win = { location: { origin: 'https://cubsbook.vercel.app', host: 'cubsbook.vercel.app' } };
  assert.equal(standaloneUrl(win), 'https://cubsbook.vercel.app/');
  assert.equal(standaloneHost(win), 'cubsbook.vercel.app');
  assert.equal(standaloneUrl({ location: { origin: 'null' } }), '/');
});

test('嵌入模式提示：說明資料分開儲存，並提供備份／還原步驟（中英分開）', () => {
  const notice = read('web/src/components/EmbedNotice.jsx');
  assert.ok(notice.includes("from '@shared/embed.js'"));
  assert.ok(notice.includes('if (!isEmbedded()) return null'), '獨立開啟時不得顯示嵌入提示');
  assert.ok(notice.includes('if (!isEmbedded() || ack) return null'));

  for (const text of [
    '分開儲存',
    '匯出備份',
    '匯入備份',
    '開啟獨立版（新分頁）',
    'stored separately',
    'Export Backup',
    'Import Backup',
    'Open standalone site (new tab)',
    'iPhone',
    'Safari',
  ]) {
    assert.ok(notice.includes(text), `EmbedNotice.jsx 缺少文案：${text}`);
  }

  // 獨立版必須以新分頁開啟：在 iframe 內直接跳轉只會留在平台的分割儲存內
  assert.match(notice, /target="_blank" rel="noopener noreferrer"/);
  // 不得寫死任何 BOOK 網址，獨立版一律取自身來源
  assert.equal(/https?:\/\//.test(notice), false);
  // 「知道了」只記在 sessionStorage，不寫入紀錄冊
  assert.equal(EMBED_ACK_KEY, 'cubbook.embed.ack.v1');
  assert.ok(notice.includes('window.sessionStorage.setItem(EMBED_ACK_KEY'));
  assert.equal(/localStorage/.test(notice), false);
  // 中英文不得並排塞入同一字串
  assert.equal(/匯出備份 Export|Export Backup 匯出/.test(notice), false);

  assert.ok(read('web/src/pages/Welcome.jsx').includes('<EmbedWelcomeNote />'));
  const app = read('web/src/App.jsx');
  assert.ok(app.includes('<EmbedRibbon book={book} canBackup={!leader && !parent} />'));
  const menu = read('web/src/components/MenuDialog.jsx');
  assert.ok(menu.includes('const embedded = isEmbedded();'));
  assert.ok(menu.includes('<StandaloneLink className="menu__item menu__item--accent">'));

  const css = read('web/src/styles.css');
  assert.match(css, /\.embedbar__btn--main \{[^}]*background: #ead040[^}]*color: #2b1a04/);
  assert.match(css, /@media print \{\s*\.embedbar, \.embednote \{ display: none !important; \}/);
});

test('前端不得加入反嵌入（frame-busting）程式碼，否則服務平台會被強制跳離', () => {
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
      const full = path.join(dir, ent.name);
      return ent.isDirectory() ? walk(full) : /\.(jsx?|html)$/.test(ent.name) ? [full] : [];
    });
  for (const file of [...walk(path.join(root, 'web/src')), path.join(root, 'web/index.html')]) {
    const src = fs.readFileSync(file, 'utf8');
    assert.equal(/top\.location|parent\.location|window\.top\s*\.\s*location/.test(src), false, `${path.relative(root, file)} 含反嵌入跳轉`);
  }
});

test('文件：README、ADR 與速查卡記錄嵌入白名單、iframe 屬性及儲存限制', () => {
  const readme = read('README.md');
  assert.ok(readme.includes(FRAME_ANCESTORS));
  assert.ok(readme.includes(`allow="${IFRAME_ALLOW}"`));
  const adr = read('docs/adr/0003-portal-iframe-embedding.md');
  assert.ok(adr.includes(FRAME_ANCESTORS));
  assert.ok(adr.includes('X-Frame-Options'));
  assert.ok(read('docs/adr/README.md').includes('0003-portal-iframe-embedding.md'));
  assert.ok(read('docs/00-quickcard.md').includes('frame-ancestors'));
});
