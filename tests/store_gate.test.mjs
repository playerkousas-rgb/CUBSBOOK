import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const gateSource = read('web/public/store_gate_v1.0.js');
const context = vm.createContext({ URL, console });
vm.runInContext(gateSource, context);
const gate = context.ScoutStoreGate;

const options = {
  appKey: 'cubsbook',
  mode: 'entry-gate',
  portalIds: ['appstore'],
  silentPortalIds: ['library', 'member'],
  allowStandalone: true,
  autoRedirectSeconds: 0,
};

function makePage(referrer = '', { pass = false, standalone = false, iosStandalone = false, lang = 'zh' } = {}) {
  const nodes = new Map();
  function element(tag) {
    const el = {
      tagName: tag.toUpperCase(),
      children: [],
      attributes: {},
      style: {},
      textContent: '',
      setAttribute(k, v) {
        this.attributes[k] = String(v);
      },
      getAttribute(k) {
        return this.attributes[k] || '';
      },
      appendChild(child) {
        this.children.push(child);
        if (child.id) nodes.set(child.id, child);
        return child;
      },
      removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) this.children.splice(idx, 1);
      },
    };
    Object.defineProperty(el, 'firstChild', {
      get() {
        return this.children[0] || null;
      },
    });
    return el;
  }

  const documentElement = element('html');
  documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-Hant-HK');
  documentElement.setAttribute('data-lang', lang === 'en' ? 'en' : 'zh');

  const document = {
    referrer,
    documentElement,
    head: element('head'),
    body: element('body'),
    createElement: element,
    getElementById: (id) => nodes.get(id) || null,
  };

  const values = new Map(pass ? [['cubsbook.store_pass', '1']] : []);
  const win = {
    document,
    location: { origin: 'https://cubsbook.vercel.app' },
    navigator: { serviceWorker: {}, standalone: iosStandalone },
    matchMedia: () => ({ matches: standalone }),
    sessionStorage: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  win.self = win;
  win.top = win;
  return { document, win, values, nodes };
}

test('入口來源精確比對、靜默放行圖書館與成員系統並保留工作階段通行', () => {
  for (const [origin, id] of [
    ['https://scoutappstore.vercel.app/', 'appstore'],
    ['https://scout-circulars.vercel.app/', 'library'],
    ['https://member-portal-sigma-swart.vercel.app/books', 'member'],
  ]) {
    const p = makePage(origin);
    const decision = gate.initStoreGate(options, p.win);
    assert.equal(decision.allowed, true);
    assert.equal(decision.reason, 'referrer-whitelist');
    assert.equal(decision.matchedPortalId, id);
    assert.equal(p.values.get('cubsbook.store_pass'), '1');
    assert.equal(p.document.documentElement.getAttribute('data-store-gated'), '');
  }

  for (const referrer of [
    '',
    'https://scoutappstore.vercel.app.evil.com/',
    'http://scoutappstore.vercel.app/',
    'https://scout-district-portal.vercel.app/',
    'https://gemini-woad-sigma.vercel.app/',
  ]) {
    const decision = gate.evaluateStoreGate(options, { referrer });
    assert.equal(decision.allowed, false, `不應放行 ${referrer || '(empty)'}`);
  }

  assert.equal(gate.initStoreGate(options, makePage('', { pass: true }).win).reason, 'session-pass');
  assert.equal(gate.initStoreGate(options, makePage('', { standalone: true }).win).reason, 'standalone-pwa');
  assert.equal(gate.initStoreGate(options, makePage('', { iosStandalone: true }).win).reason, 'standalone-pwa');

  // 成員系統 /books 以 iframe 嵌入時（win.self !== win.top 且 Referer 為 member-portal）必須放行
  const embedded = makePage('https://member-portal-sigma-swart.vercel.app/');
  embedded.win.top = {};
  const embDecision = gate.initStoreGate(options, embedded.win);
  assert.equal(embDecision.allowed, true);
  assert.equal(embDecision.matchedPortalId, 'member');
  assert.equal(embedded.values.get('cubsbook.store_pass'), '1');
});

test('儲存遭封鎖時准許入口仍可進入且不拋錯，無來源的後續訪問會被攔截', () => {
  const allowed = makePage('https://scoutappstore.vercel.app/');
  Object.defineProperty(allowed.win, 'sessionStorage', {
    get() {
      throw new Error('blocked');
    },
  });
  assert.equal(gate.initStoreGate(options, allowed.win).allowed, true);

  const blocked = makePage('');
  Object.defineProperty(blocked.win, 'sessionStorage', {
    get() {
      throw new Error('blocked');
    },
  });
  assert.equal(gate.initStoreGate(options, blocked.win).allowed, false);
});

test('直接開啟顯示單一 APP STORE 按鈕（SG19 簡短人話中英文）且隱藏底層內容', () => {
  const zhPage = makePage('', { lang: 'zh' });
  const zhDecision = gate.initStoreGate(options, zhPage.win);
  assert.equal(zhDecision.allowed, false);
  assert.equal(zhPage.document.documentElement.getAttribute('data-store-gated'), 'missing-whitelist-entry');

  const overlay = zhPage.nodes.get('scoutStoreGate');
  assert.equal(overlay.attributes.role, 'dialog');
  const h1 = overlay.children.find((c) => c.tagName === 'H1');
  const p = overlay.children.find((c) => c.tagName === 'P');
  assert.equal(h1.textContent, '需經由 SCOUT APP STORE 開啟');
  assert.equal(p.textContent, '請按下方按鈕前往 APP STORE 開啟。');

  const actions = overlay.children.find((c) => c.className === 'sg-actions');
  assert.equal(actions.children.length, 1);
  assert.equal(actions.children[0].href, 'https://scoutappstore.vercel.app/');
  assert.equal(actions.children[0].target, '_top');
  assert.equal(actions.children[0].textContent, '前往 APP STORE');
  assert.match(
    zhPage.nodes.get('scoutStoreGateStyle').textContent,
    /body > :not\(#scoutStoreGate\).*display: none !important/,
  );

  const enPage = makePage('', { lang: 'en' });
  assert.equal(gate.initStoreGate(options, enPage.win).allowed, false);
  const enOverlay = enPage.nodes.get('scoutStoreGate');
  assert.equal(enOverlay.children.find((c) => c.tagName === 'H1').textContent, 'Open via SCOUT APP STORE');
  const enActions = enOverlay.children.find((c) => c.className === 'sg-actions');
  assert.equal(enActions.children.length, 1);
  assert.equal(enActions.children[0].textContent, 'Go to APP STORE');
});

test('閘門掛在 HTML head 頂部、被攔時不啟動主介面、SW 預快取並避開 SPA rewrite', () => {
  const html = read('web/index.html');
  const idxCharset = html.indexOf('<meta charset=');
  const idxLang = html.indexOf("localStorage.getItem('cubbook.lang')");
  const idxGateScript = html.indexOf('<script src="/store_gate_v1.0.js">');
  const idxTitle = html.indexOf('<title>');
  assert.ok(idxCharset >= 0 && idxCharset < idxLang, '語系偵測應在 charset 之後');
  assert.ok(idxLang < idxGateScript, '語系偵測應在 store_gate 之前，讓提示卡跟隨介面語言');
  assert.ok(idxGateScript < idxTitle, 'store_gate 必須放在 <title> 之前');

  assert.match(html, /appKey:\s*'cubsbook'/);
  assert.match(html, /mode:\s*'entry-gate'/);
  assert.match(html, /portalIds:\s*\['appstore'\]/);
  assert.match(html, /silentPortalIds:\s*\['library',\s*'member'\]/);
  assert.match(html, /allowStandalone:\s*true/);
  assert.match(html, /autoRedirectSeconds:\s*0/);
  assert.equal(/supportNudge/.test(html), false, '不應同時開啟 supportNudge 浮窗');

  const mainSrc = read('web/src/main.jsx');
  assert.match(mainSrc, /!document\.documentElement\.hasAttribute\('data-store-gated'\)/);

  const sw = read('web/public/sw.js');
  assert.match(sw, /'\/store_gate_v1\.0\.js'/);
  assert.match(sw, /url\.pathname === '\/store_gate_v1\.0\.js'/);

  const vercel = JSON.parse(read('vercel.json'));
  const rewrite = vercel.rewrites[0].source;
  const regex = new RegExp(`^${rewrite}$`);
  assert.equal(regex.test('/store_gate_v1.0.js'), false, 'SPA rewrite 不得攔截 /store_gate_v1.0.js');
  assert.equal(regex.test('/scan'), true);
  assert.equal(regex.test('/p/p01'), true);
});

test('SG18 支持連結使用已核實 slug cubsbook、未載入隱藏、中英分離、零直連資料庫且列印隱藏', () => {
  assert.equal(gate.getAppStoreUrl('cubsbook'), 'https://scoutappstore.vercel.app/?app=cubsbook');

  const component = read('web/src/components/StoreSupport.jsx');
  assert.match(component, /APP_STORE_SLUG\s*=\s*'cubsbook'/);
  assert.match(component, /id="storeSupportTop"/);
  assert.match(component, /getAppStoreUrl/);
  assert.match(component, /hidden=\{!href\}/);
  assert.match(component, /target="_blank"/);
  assert.match(component, /rel="noopener"/);
  assert.match(component, /讚好／收藏/);
  assert.match(component, /Like \/ Save/);
  assert.equal(/https?:\/\//.test(component), false, '不得寫死主站網址');
  assert.equal(/supabase|bump_hearts|bump_stars|localStorage/i.test(component), false, '不得直連 Supabase 或寫入 localStorage');

  assert.ok(read('web/src/App.jsx').includes('<StoreSupport />'), '頂欄必須掛載 StoreSupport');
  assert.ok(read('web/src/pages/Welcome.jsx').includes('<StoreSupport onPaper />'), '歡迎頁頂欄必須掛載 StoreSupport');

  const css = read('web/src/styles.css');
  assert.match(css, /\.store-support\s*\{[^}]*min-height:\s*40px/);
  assert.match(css, /\.store-support\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  assert.match(css, /\.store-support:focus-visible\s*\{/);
  assert.match(css, /@media print\s*\{\s*\.store-support\s*\{\s*display:\s*none !important;\s*\}\s*\}/);
});

test('文件同步記錄白名單設定與誠實限制', () => {
  const readme = read('README.md');
  const scope = read('SCOPE.md');
  for (const text of ['entry-gate', "portalIds: ['appstore']", "silentPortalIds: ['library', 'member']", 'allowStandalone: true', 'cubsbook']) {
    assert.ok(readme.includes(text), `README.md 缺少 ${text}`);
    assert.ok(scope.includes(text), `SCOPE.md 缺少 ${text}`);
  }
});
