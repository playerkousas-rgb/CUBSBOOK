import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleBook } from './fixtures/sampleBook.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { newBook, ALL_AWARDS, OTHER_BADGES } from '../shared/book.js';
import {
  FORM_META,
  FORM_ORDER,
  PT67_CHECKLIST,
  PT68_CHECKLIST,
  PRINT_CHECKLIST,
  itemRowsForAward,
  activityBadgeRows,
  buildFormValues,
  formReadiness,
} from '../shared/forms.js';
import {
  TRANSFER_PREFIX,
  TRANSFER_OPTIONS,
  QR_LIMIT,
  KIND_MEMBER,
  KIND_SIGNOFF,
  buildPayload,
  encodePayload,
  encodeTransfer,
  decodeTransfer,
  decodePayload,
  encodeSignoff,
  applySignoff,
  extractToken,
  describeSelection,
} from '../shared/transfer.js';

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('官方表格 PT/67・PT/68 齊備，2026 新制只提供清晰標示的非官方核對清單', () => {
  assert.deepEqual(FORM_ORDER, ['pt67', 'pt68', 'gbac']);

  assert.equal(FORM_META.pt67.official, true);
  assert.equal(FORM_META.pt67.code, 'FORM PT/67 (4/2019)');
  assert.equal(FORM_META.pt67.title, '金紫荊獎章開展通知書');
  assert.equal(FORM_META.pt67.pages, 1);

  assert.equal(FORM_META.pt68.official, true);
  assert.equal(FORM_META.pt68.code, 'FORM PT/68 (06/2024)');
  assert.equal(FORM_META.pt68.title, '金紫荊獎章及證書申請表');
  assert.equal(FORM_META.pt68.pages, 2);

  // 新制若官方表格尚未公布，絕不可自行編造 PT/XX 編號或簽署欄
  assert.equal(FORM_META.gbac.official, false);
  assert.match(FORM_META.gbac.code, /非官方/);
  assert.doesNotMatch(FORM_META.gbac.code, /PT\/\d/);
  assert.match(FORM_META.gbac.note, /不是官方表格/);

  assert.equal(PT67_CHECKLIST.length >= 4, true);
  assert.equal(PT68_CHECKLIST.length >= 5, true);
  // 附件頁碼按 2026 年版紀錄冊（封面＋第 1–32 頁）由 officialPages.js 推導，不得再出現舊冊頁碼
  assert.ok(PT67_CHECKLIST.some((line) => line.includes('第 1–4、10–11、13 頁')));
  assert.ok(PT68_CHECKLIST.some((line) => line.includes('第 1–4、10–11、13–19 頁')));
  assert.equal([...PT67_CHECKLIST, ...PT68_CHECKLIST].some((line) => line.includes('1 至 3、5、10 至 13')), false);
  assert.ok(PT68_CHECKLIST.some((line) => line.includes('PT/67')));
  assert.equal(PRINT_CHECKLIST.length, 5);
  assert.ok(PRINT_CHECKLIST[0].items[0].startsWith('個人摘要（第 1–2 頁）'));
});

test('紀錄冊資料一次填寫即自動帶入 PT/67・PT/68，缺漏欄位準確回報', () => {
  const demo = sampleBook();
  // 年齡以固定參考日期計算，測試結果不隨執行當日改變
  const ref = new Date('2026-11-05');
  const v67 = buildFormValues(demo, 'pt67', ref);
  assert.equal(v67.nameZh, '陳小狼');
  assert.equal(v67.nameEn, 'CHAN SIU-LONG');
  assert.equal(v67.scoutId, '0012345678');
  assert.equal(v67.unit, '沙田第 12 旅幼童軍團');
  assert.equal(v67.group, '沙田第 12 旅');
  assert.equal(v67.district, '沙田北區');
  assert.equal(v67.region, '新界東地域');
  assert.equal(v67.age, '10');
  assert.equal(v67.ageMonths, '126');
  assert.ok(v67.goldRows.length >= 17);
  assert.equal(v67.goldRows[0].badgeId, '4.1.1');

  const r67 = formReadiness(demo, 'pt67', ref);
  assert.equal(r67.ready, true);
  assert.deepEqual(r67.missing, []);

  // PT/68 需要更多個人資料：只填姓名與編號不足以遞交
  const bare = newBook({ member: { nameZh: '陳小狼', nameEn: 'CHAN Siu-long', dob: '2016-04-12' } });
  const r68 = formReadiness(bare, 'pt68', ref);
  assert.equal(r68.ready, false);
  assert.ok(r68.missing.includes('SCOUT ID'));
  assert.ok(r68.missing.includes('性別'));
  assert.ok(r68.missingEn.includes('Gender'), '英文介面須有獨立的英文缺漏欄位名稱');
  assert.equal(buildFormValues(bare, 'pt68', ref).ageMonths, '126');

  // 細項列只取該獎章，並保留 cubbadge 官方編號供對照
  const rows = itemRowsForAward(demo, ALL_AWARDS[3]);
  assert.equal(rows.length, 18);
  assert.ok(rows.every((r) => r.id.startsWith('L4-')));
  const gb = itemRowsForAward(demo, ALL_AWARDS[4]);
  assert.equal(gb.length, 17);
  assert.equal(gb[0].badgeId, '4.1.1');

  const acts = activityBadgeRows(demo);
  assert.equal(acts.length, OTHER_BADGES.length);
  assert.equal(acts.find((b) => b.id === 'OT-A22').date, '2025-05-10');
});

test('QR 預設全不剔選（私隱自決），空格包不含任何個人資料', () => {
  assert.deepEqual(TRANSFER_OPTIONS.map((o) => o.key), [
    'particulars',
    'contact',
    'progress',
    'otherBadges',
    'renewals',
    'investiture',
    'signatures',
    'holderSignature',
    'photo',
  ]);
  for (const opt of TRANSFER_OPTIONS) {
    assert.equal(opt.default, undefined, `${opt.key} 不得預設剔選`);
  }
  assert.equal(TRANSFER_OPTIONS.filter((o) => o.sensitive).length, 1);

  const demo = sampleBook();
  const empty = buildPayload(demo, []);
  assert.deepEqual(empty.sel, []);
  assert.equal(empty.member, undefined);
  assert.equal(empty.progress, undefined);
  assert.equal(empty.sumS, undefined);
  assert.equal(empty.t, KIND_MEMBER);
  assert.equal(describeSelection([]), '（未剔選任何組別）');

  // 剔選後仍只包含所選組別：不勾 contact 就沒有電話／地址／家長資料
  const only = buildPayload(demo, ['particulars', 'progress']);
  assert.deepEqual(only.sel, ['particulars', 'progress']);
  const json = JSON.stringify(only);
  assert.equal(json.includes('91234567'), false);
  assert.equal(json.includes('parentName'), false);
  assert.equal('photo' in (only.member || {}), false);
  assert.equal(only.progress['L1-A'].date, '2023-09-16');
});

test('CB1 二維碼壓縮編解碼、CB1S 核簽碼與 #v= 連結解析', async () => {
  const demo = sampleBook();
  const enc = await encodeTransfer(demo, ['particulars', 'progress']);
  assert.match(enc.value, /^CB1(P?)\./);
  assert.equal(enc.tooBig, false);
  assert.ok(enc.chars < QR_LIMIT);
  assert.ok(enc.bytes < enc.rawBytes);
  assert.equal(TRANSFER_PREFIX, 'CB1');

  const back = await decodeTransfer(enc.value);
  assert.equal(back.t, KIND_MEMBER);
  assert.equal(back.member.scoutId, '0012345678');
  assert.equal(back.progress['L2-SKILLS-01'].date, '2024-01-13');

  // 完整網址片段：#v=CB1...
  const url = `https://cubbook.example/#v=${enc.value}`;
  assert.equal(extractToken(url), enc.value);
  assert.equal((await decodePayload(url)).t, KIND_MEMBER);

  // 核簽碼必以 CB1S. 開頭，且不可被當成成員紀錄冊
  const signoff = await encodeSignoff({
    member: { nameZh: '陳小狼', scoutId: '0012345678' },
    leader: { name: '陳團長', title: '幼童軍團長 CSL' },
    items: [{ id: 'L2-CARING-02', date: '2026-10-20' }],
    otherBadges: [{ id: 'OT-A23', date: '2026-10-21', cert: 'ACT/2026/0102' }],
  });
  assert.match(signoff.value, /^CB1S(P?)\./);
  await assert.rejects(() => decodeTransfer(signoff.value), /核簽/);

  const decoded = await decodePayload(signoff.value);
  assert.equal(decoded.t, KIND_SIGNOFF);
  assert.equal(decoded.leader.name, '陳團長');
  assert.equal(decoded.items[0].verified, true);

  await assert.rejects(() => decodePayload('VS1.abcdef'), /CUBBOOK/);
  await assert.rejects(() => decodePayload('CB1.%%%'), /CUBBOOK/);
  const broken = await encodePayload({ t: KIND_MEMBER, v: 99 });
  await assert.rejects(() => decodePayload(broken.value), /版本不相容/);
});

test('套用領袖核簽：寫入日期／主考／簽名，SCOUT ID 不符即拒絕', async () => {
  const demo = sampleBook();
  const sig = await encodeSignoff({
    member: { scoutId: '0012345678' },
    leader: { name: '陳團長', title: '幼童軍團長 CSL', png: 'data:image/png;base64,AAA' },
    items: [
      { id: '1.2.2', date: '2026-10-20' },
      { id: 'not-an-item', date: '2026-10-20' },
    ],
    otherBadges: [{ id: 'A23', date: '2026-10-21', cert: 'ACT/2026/0102' }],
  });
  const payload = await decodePayload(sig.value);
  assert.match(sig.value, /^CB1S\./);

  const { book, changes } = applySignoff(demo, payload);
  assert.equal(book.progress['L2-CARING-02'].date, '2026-10-20');
  assert.equal(book.progress['L2-CARING-02'].assessor, '陳團長');
  assert.equal(book.progress['L2-CARING-02'].signature.name, '陳團長');
  assert.equal(book.progress['L2-CARING-02'].signature.png, 'data:image/png;base64,AAA');
  assert.equal(book.otherBadges['OT-A23'].cert, 'ACT/2026/0102');
  assert.equal(book.otherBadges['OT-A23'].signature.png, 'data:image/png;base64,AAA');
  assert.equal(changes.length, 2);
  // 領袖在紀錄冊上簽署不等於在 cubbadge 核實，仍須送交 BADGE 由領袖 CONFIRM
  assert.equal(book.progress['L2-CARING-02'].confirmedByBadge ?? false, false);
  assert.equal(book.otherBadges['OT-A23'].confirmedByBadge ?? false, false);

  const other = newBook({ member: { scoutId: '0099999999' } });
  assert.throws(() => applySignoff(other, payload), /SCOUT ID/);

  // 空白紀錄冊未填編號時可直接套用，並保留核簽者身分
  const blank = newBook();
  const applied = applySignoff(blank, payload);
  assert.equal(applied.book.progress['L2-CARING-02'].assessor, '陳團長');

  assert.throws(() => applySignoff(demo, { t: KIND_MEMBER }), /核簽單/);
});

test('列印版面與版面契約：A4 表單、封面＋官方 32 頁列印、目錄及附錄存在', () => {
  const app = read('web/src/App.jsx');
  const forms = read('web/src/pages/Forms.jsx');
  const css = read('web/src/styles.css');

  assert.ok(app.includes('cover: PCover'), 'App.jsx 缺少封面（不計頁碼）');
  for (let i = 1; i <= 32; i += 1) {
    const id = `p${String(i).padStart(2, '0')}`;
    assert.ok(app.includes(`'${id}'`) || app.includes(id), `App.jsx 缺少 ${id} 路由`);
  }
  assert.ok(app.includes('contents'));
  assert.ok(app.includes('appendix'));
  assert.ok(app.includes('print'));

  for (const formId of ['pt67', 'pt68', 'gbac']) {
    assert.ok(forms.includes(formId), `Forms.jsx 缺少 ${formId}`);
  }
  assert.ok(forms.includes('a4sheet'));
  assert.ok(forms.includes('no-print'));
  assert.ok(existsSync(new URL('../web/src/pages/Forms.jsx', import.meta.url)));

  assert.ok(css.includes('@media print'));
  assert.ok(css.includes('.a4sheet'));
  assert.ok(css.includes('.no-print'));
  assert.ok(css.includes('html[data-print-preview]'));
  // 手機不得出現水平捲軸
  assert.ok(css.includes('max-width: 740px'));
});
