import test from 'node:test';
import assert from 'node:assert/strict';
import {
  demoBook,
  newBook,
  collectPendingForBadge,
  exportForBadge,
  importFromBadge,
} from '../shared/book.js';
import handler, {
  resolveBadgeOrigin,
  filterPersonalConfirmedLoad,
  sanitizePendingSubmissions,
} from '../api/cubbadge.js';

const BACKEND = 'https://script.google.com/macros/s/AKfycbxTESTKEY0123456789/exec';

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

async function callApi(method, body) {
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
  await handler({ method, body }, res);
  return { status: statusCode, body: payload };
}

function stubFetch(impl) {
  const prev = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
    return impl({ url: String(url), init });
  };
  return {
    calls,
    restore() {
      globalThis.fetch = prev;
    },
  };
}

const okJson = (obj) => ({ ok: true, json: async () => obj });

test('後端來源只接受 https；開發測試可明確開啟本機位址', () => {
  withEnv({ CUBBADGE_ORIGIN: 'https://cubbadge.vercel.app/' }, () => {
    assert.equal(resolveBadgeOrigin(), 'https://cubbadge.vercel.app');
  });
  withEnv({ CUBBADGE_ORIGIN: 'http://evil.example.com' }, () => {
    assert.equal(resolveBadgeOrigin(), 'https://cubbadge.vercel.app');
  });
  withEnv({ CUBBADGE_ORIGIN: 'https://user:pass@cubbadge.vercel.app' }, () => {
    assert.equal(resolveBadgeOrigin(), 'https://cubbadge.vercel.app');
  });
  withEnv({ CUBBADGE_ORIGIN: 'not a url' }, () => {
    assert.equal(resolveBadgeOrigin(), 'https://cubbadge.vercel.app');
  });
  withEnv({ CUBBADGE_ORIGIN: 'http://127.0.0.1:8787', CUBBOOK_PROXY_TEST: '1', VERCEL: undefined }, () => {
    assert.equal(resolveBadgeOrigin(), 'http://127.0.0.1:8787');
  });
});

test('GET /api/cubbadge：零金鑰旅團清單，永不回傳後端網址或 API key', async () => {
  await withEnv({ TROOP_T12_NAME: '沙田第 12 旅', TROOP_T12_EN: '12th Sha Tin', TROOP_T12_BACKEND: BACKEND, TROOP_T12_APIKEY: 'SECRET-KEY-123' }, async () => {
    const stub = stubFetch(() => okJson({ troops: { T99: { name: '遠端旅團', en: 'Remote' } } }));
    try {
      const res = await callApi('GET');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.privacy, 'progress-only');
      assert.equal(res.body.troops.T12.name, '沙田第 12 旅');
      assert.equal(res.body.troops.T12.en, '12th Sha Tin');
      assert.deepEqual(res.body.troops.T99, { name: '遠端旅團', en: 'Remote' });
      const json = JSON.stringify(res.body);
      assert.equal(json.includes('SECRET-KEY-123'), false);
      assert.equal(json.includes('script.google.com'), false);
    } finally {
      stub.restore();
    }
  });
});

test('BOOK 只能讀取及申報待核實；save / saveOtherBadge 一律 403', async () => {
  const stub = stubFetch(() => okJson({ success: true }));
  try {
    for (const action of ['save', 'saveOtherBadge', 'reviewRequest', 'approveRequest', 'rejectRequest']) {
      const res = await callApi('POST', { action, troopId: 'T12', data: { ymis: '0012345678' } });
      assert.equal(res.status, 403, `${action} 必須被拒`);
      assert.equal(res.body.code, 'FORBIDDEN_WRITE');
      assert.match(res.body.error, /待領袖核實/);
    }
    for (const action of ['', 'deleteMember', 'dump']) {
      const res = await callApi('POST', { action, troopId: 'T12' });
      assert.equal(res.status, 403);
    }
    const badTroop = await callApi('POST', { action: 'login', troopId: 'bad troop!', data: {} });
    assert.equal(badTroop.status, 400);
    assert.equal(stub.calls.length, 0, '被拒的操作不得接觸 cubbadge 後端');
  } finally {
    stub.restore();
  }
});

test('login 只回傳 token 與 SCOUT ID，姓名／電郵／角色一律不回傳', async () => {
  const stub = stubFetch(() =>
    okJson({
      success: true,
      token: 'tok-abc-123',
      user: { ymis: '0012345678', name: '陳小狼', email: 'cub@example.com', role: 'admin' },
    }),
  );
  try {
    const res = await callApi('POST', {
      action: 'login',
      troopId: 'T12',
      data: { login_id: '0012345678', password: 'pw', name: '我', phone: '91234567' },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body).sort(), ['success', 'token', 'ymis']);
    assert.equal(res.body.ymis, '0012345678');
    assert.equal(JSON.stringify(res.body).includes('陳小狼'), false);

    const sent = stub.calls[0];
    assert.match(sent.url, /\/api\/proxy$/);
    assert.equal(sent.body.action, 'login');
    assert.equal(sent.body.apikey, undefined, '金鑰只由伺服器注入，BOOK 不傳');
    assert.equal(sent.body.name, undefined, 'BOOK 不得傳送姓名');
    assert.equal(sent.body.phone, undefined, 'BOOK 不得傳送電話');

    const missing = await callApi('POST', { action: 'login', troopId: 'T12', data: { login_id: '0012345678' } });
    assert.equal(missing.status, 400);
  } finally {
    stub.restore();
  }
});

test('filterPersonalConfirmedLoad：只留本人已核實項目，剔除所有個人資料與他人紀錄', () => {
  const raw = {
    success: true,
    members: [
      { ymis: '0012345678', name: '陳小狼', phone: '91234567', address: '沙田' },
      { ymis: '0099999999', name: '別人', phone: '90000000' },
    ],
    progress: {
      '0012345678': {
        a: { date: '2024-09-07', confirmer: '陳團長', note: '私人備註' },
        c: { date: '', confirmer: '未完成' },
        b: '2024-09-14',
      },
      '0099999999': { a: { date: '2023-01-01', confirmer: '別人' } },
    },
    otherBadges: {
      '0012345678': { A01: { date: '2025-03-15', cert: 'ACT/2025/0181', phone: '91234567' } },
      '0099999999': { A02: { date: '2025-01-01' } },
    },
    pendingRequests: [
      { ymis: '0012345678', item_id: '1.2.2', requested_date: '2026-10-01', status: 'pending', name: '陳小狼' },
      { ymis: '0012345678', item_id: '1.2.3', requested_date: '2026-10-02', status: 'approved' },
      { ymis: '0099999999', item_id: '1.2.1', requested_date: '2026-10-03', status: 'pending' },
    ],
  };

  const out = filterPersonalConfirmedLoad(raw, '12345678');
  assert.equal(out.success, true);
  assert.equal(out.privacy, 'progress-only');
  assert.equal(out.scoutId, '12345678');
  // 前導零容忍：同一成員
  assert.deepEqual(out.progress['12345678'], {
    a: { date: '2024-09-07', confirmer: '陳團長' },
    b: { date: '2024-09-14' },
  });
  assert.deepEqual(out.otherBadges['12345678'], { A01: { date: '2025-03-15', cert: 'ACT/2025/0181' } });
  assert.deepEqual(out.pendingRequests, [
    { ymis: '12345678', item_id: '1.2.2', requested_date: '2026-10-01', status: 'pending' },
  ]);

  const json = JSON.stringify(out);
  for (const pii of ['陳小狼', '別人', '91234567', '90000000', '沙田', 'members', 'approved']) {
    assert.equal(json.includes(pii), false, `過濾後仍含 ${pii}`);
  }

  assert.equal(filterPersonalConfirmedLoad({ success: false, error: '登入已過期' }, '12345678').success, false);
  assert.equal(filterPersonalConfirmedLoad(raw, '').success, false);
});

test('sanitizePendingSubmissions：零個人資料、BOOK 編號轉 cubbadge 編號、去重及上限', () => {
  const cleaned = sanitizePendingSubmissions([
    {
      itemId: 'L2-CARING-02',
      name: '陳小狼',
      phone: '91234567',
      address: '沙田',
      photo: 'data:image/png;base64,AAA',
      date: '2026-10-01',
      evidence: '自行完成',
    },
    // 同項目同日期重複
    { itemId: '1.2.2', date: '2026-10-01' },
    { itemId: 'OT-A22', itemName: '園藝章', date: '2026-10-02', cert: 'ACT/1' },
    { itemId: 'L1-A', date: '2026-13-99' },
    { itemId: '', date: '2026-10-03' },
    null,
  ]);

  assert.equal(cleaned.length, 2);
  assert.deepEqual(cleaned[0], {
    itemId: '1.2.2',
    itemName: '小幫手任務',
    requested_date: '2026-10-01',
    evidence: '自行完成',
  });
  assert.equal(cleaned[1].itemId, 'A22');
  const json = JSON.stringify(cleaned);
  for (const pii of ['陳小狼', '91234567', '沙田', 'base64']) {
    assert.equal(json.includes(pii), false);
  }

  const many = Array.from({ length: 260 }, (_, i) => ({ itemId: 'L1-A', date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}` }));
  assert.ok(sanitizePendingSubmissions(many).length <= 200);
  assert.deepEqual(sanitizePendingSubmissions('not-an-array'), []);
});

test('load 與 submitPending 經 /api/proxy 轉發，且送交只會是 requestComplete / pending', async () => {
  const stub = stubFetch(({ url }) => {
    if (url.includes('action=load') || url.endsWith('/api/proxy')) {
      return okJson({
        success: true,
        progress: { '0012345678': { a: { date: '2024-09-07', confirmer: '陳團長' } } },
        otherBadges: {},
        pendingRequests: [],
        members: [{ name: '陳小狼', phone: '91234567' }],
      });
    }
    return okJson({ success: true });
  });
  try {
    const load = await callApi('POST', {
      action: 'load',
      troopId: 'T12',
      data: { token: 'tok-abc-123', ymis: '0012345678' },
    });
    assert.equal(load.status, 200);
    assert.equal(load.body.success, true);
    assert.equal(load.body.progress['0012345678'].a.date, '2024-09-07');
    assert.equal(JSON.stringify(load.body).includes('91234567'), false);

    const shortToken = await callApi('POST', { action: 'load', troopId: 'T12', data: { token: 'ab', ymis: '0012345678' } });
    assert.equal(shortToken.status, 401);

    const noItems = await callApi('POST', { action: 'submitPending', troopId: 'T12', data: { token: 'tok-abc-123', ymis: '0012345678', items: [] } });
    assert.equal(noItems.status, 400);

    stub.calls.length = 0;
    const submitted = await callApi('POST', {
      action: 'submitPending',
      troopId: 'T12',
      data: {
        token: 'tok-abc-123',
        ymis: '0012345678',
        items: [
          { itemId: 'L2-CARING-02', date: '2026-10-01', name: '陳小狼', phone: '91234567' },
          { itemId: 'OT-A22', date: '2026-10-02', cert: 'ACT/2025/0244' },
        ],
      },
    });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.status, 'pending');
    assert.equal(submitted.body.confirmed, false);
    assert.equal(submitted.body.submitted, 2);
    assert.deepEqual(submitted.body.failed, []);
    assert.equal(stub.calls.length, 2);
    for (const call of stub.calls) {
      assert.equal(call.body.action, 'requestComplete');
      assert.equal(call.body.apikey, undefined);
      assert.equal(call.body.name, undefined);
      assert.equal(call.body.phone, undefined);
      assert.equal(call.body.status, undefined, 'BOOK 不得自行設定 status');
    }
    assert.equal(stub.calls[0].body.itemId, '1.2.2');
    assert.equal(stub.calls[1].body.itemId, 'A22');
  } finally {
    stub.restore();
  }
});

test('BOOK ⇄ BADGE 端到端：空白冊同步、只匯入已核實、申報永不自我核實', () => {
  const blank = newBook();
  const payload = {
    success: true,
    progress: {
      '0012345678': {
        a: { date: '2024-09-07', confirmer: '陳團長' },
        b: { date: '2024-09-14', confirmer: '陳團長' },
      },
    },
    otherBadges: { '0012345678': { A01: { date: '2025-03-15', cert: 'ACT/2025/0181' } } },
    pendingRequests: [{ ymis: '0012345678', item_id: '1.2.2', requested_date: '2026-10-01', status: 'pending' }],
  };
  const { book, imported } = importFromBadge(payload, blank, { expectedScoutId: '0012345678' });
  assert.equal(imported, 3);
  assert.equal(book.member.scoutId, '0012345678');
  assert.equal(book.member.nameZh, '', '同步不得寫入任何個人資料');
  assert.equal(book.progress['L1-A'].confirmedByBadge, true);
  assert.equal(book.progress['L2-CARING-02'], undefined);

  // 成員自行新增一項 → 匯出成 pending
  book.progress['L2-CARING-02'] = { date: '2026-10-05' };
  const out = exportForBadge(book, 'T12');
  assert.equal(out.status, 'pending');
  assert.equal(out.confirmed, false);
  assert.equal(out.pendingRequests.length, 1);
  assert.equal(out.pendingRequests[0].item_id, '1.2.2');
  assert.equal(out.pendingRequests[0].status, 'pending');
  assert.equal(JSON.stringify(out).includes('陳小狼'), false);

  // 已在雲端待核實的同一項目不再重複送交
  assert.equal(collectPendingForBadge(book, {}, ['1.2.2']).length, 0);

  // 未經領袖核實的申報檔不可倒灌成已核實進度
  assert.throws(() => importFromBadge(out, book), /待領袖核實/);

  // 示範紀錄冊：已核實項目不會被重複申報，只有自填的活動徽章需送交
  const demo = demoBook();
  const demoOut = exportForBadge(demo, 'T12');
  assert.equal(demoOut.pendingRequests.length, 2);
  assert.deepEqual(demoOut.pendingRequests.map((r) => r.item_id), ['A22', 'A26']);
});
