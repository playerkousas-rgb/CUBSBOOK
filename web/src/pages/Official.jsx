import React, { useState } from 'react';
import { BADGE_SYLLABUS, GOLD_AWARD, OTHER_BADGES, ageFromDob, allStats, membershipStatus } from '@shared/book.js';
import { OFFICIAL_GROUPS, OFFICIAL_PAGES } from '@shared/officialPages.js';
import { ACTIVITY_DOMAINS, LEVEL_LABEL, expandActivityPlan } from '@shared/officialActivityBadges.js';
import { useBook, useField, useReadOnly } from '../bookContext.js';
import { Area, AssessTable, Grid, H, Line, Note, P, Page, Sig } from '../components/Form.jsx';
import Write from '../components/Write.jsx';
import { PhotoPicker } from '../components/PhotoPicker.jsx';
import { SignModal } from '../components/Ink.jsx';
import { Crest, Icon, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { Link } from '../router.jsx';

/**
 * 官方《幼童軍紀錄冊》（© 2026 香港童軍總會）電子版。
 * 頁碼、頁序、標題、欄目、表格排列一律照官方：封面不計頁碼，內頁第 1–32 頁。
 * 官方頁不出現逐項勾選表；72 項課程細節只放在「數位附錄」。
 */

const awardById = Object.fromEntries([...BADGE_SYLLABUS, GOLD_AWARD].map((a) => [a.id, a]));
const CORE_ROWS = (awardId) =>
  awardById[awardId].segments
    .filter((s) => !s.code.endsWith('-INTEREST'))
    .map((s, i) => ({ code: s.code, no: String(i + 1), zh: s.name.replace(/^（.）/, ''), en: s.en, items: s.items }));

/* ------------------------------------------------------------------ 小元件 */

function CslSign({ path, label = '幼童軍團長簽署', en = 'C.S.L. Signature' }) {
  const [sig, setSig] = useField(path, null);
  const readOnly = useReadOnly();
  const { isEn } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="offsign">
      <span className="offsign__label">
        {isEn ? en : label}
        {!isEn && <em>{en}</em>}
      </span>
      {sig?.png ? (
        <button type="button" className="offsign__img" onClick={() => setOpen(true)} title={sig.name || ''}>
          <img src={sig.png} alt={isEn ? 'Signature' : '簽署'} />
        </button>
      ) : readOnly ? (
        <span className="offsign__blank" aria-label={isEn ? 'Not signed' : '未簽署'} />
      ) : (
        <button type="button" className="offsign__btn no-print" onClick={() => setOpen(true)}>
          <Icon name="pen" size={12} /> {isEn ? 'Sign' : '簽署'}
        </button>
      )}
      <SignModal
        open={open}
        onClose={() => setOpen(false)}
        title={isEn ? en : label}
        defaultName={sig?.name || ''}
        defaultTitle={isEn ? 'C.S.L.' : '幼童軍團長'}
        onSave={(next) => {
          setSig(next);
          setOpen(false);
        }}
      />
    </div>
  );
}

function AwardDate({ awardId, label = '頒發／完成日期', en = 'Awarded / Completed Date' }) {
  const [row, set] = useField(`pages.award_${awardId}`, {});
  const { isEn } = useLang();
  return (
    <>
      <div className="offline">
        <span className="offline__label">
          {isEn ? en : label}
          {!isEn && <em>{en}</em>}
        </span>
        <span className="offline__field">
          <Write value={row.date || ''} onChange={(v) => set({ ...row, date: v })} type="date" compact label={en} />
        </span>
      </div>
      <CslSign path={`pages.award_${awardId}.signature`} />
    </>
  );
}

/** 官方「主考人／日期」點線表 */
function ExamTable({ rows, showDigital = false, awardId = '', withNo = true }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const setCell = (code, key, value) => {
    if (readOnly) return;
    update((b) => ({
      ...b,
      domains: { ...(b.domains || {}), [code]: { ...(b.domains?.[code] || {}), [key]: value } },
    }));
  };
  return (
    <div className="offexam">
      <div className="offexam__head">
        <span />
        <span />
        <span className="offexam__h">{isEn ? 'Examiner' : '主考人'}<em>Examiner</em></span>
        <span className="offexam__h">{isEn ? 'Date' : '日期'}<em>Date</em></span>
      </div>
      {rows.map((r) => {
        const st = book.domains?.[r.code] || {};
        return (
          <div className="offexam__row" key={r.code}>
            <span className="offexam__no">{withNo ? `(${r.no})` : ''}</span>
            <span className="offexam__name">
              {isEn ? r.en || r.zh : r.zh}
              {!isEn && r.en && <em>{r.en}</em>}
              {showDigital && r.items?.length > 0 && (
                <small className="offexam__hint">
                  {isEn
                    ? `${r.items.filter((i) => book.progress?.[i.id]?.date).length}/${r.items.length} items in appendix`
                    : `附錄 ${r.items.filter((i) => book.progress?.[i.id]?.date).length}/${r.items.length} 項`}
                </small>
              )}
            </span>
            <span className="offexam__cell">
              <Write value={st.examiner || ''} onChange={(v) => setCell(r.code, 'examiner', v)} compact placeholder={isEn ? 'Name' : '姓名'} label={`${r.zh} 主考人`} />
            </span>
            <span className="offexam__cell">
              <Write value={st.date || ''} onChange={(v) => setCell(r.code, 'date', v)} type="date" compact label={`${r.zh} 日期`} />
            </span>
          </div>
        );
      })}
      {awardId && (
        <p className="offexam__foot no-print">
          <Link to="/p/appendix">{isEn ? 'Item-by-item detail → digital appendix' : '逐項課程細節 → 數位附錄'}</Link>
        </p>
      )}
    </div>
  );
}

function CheckLine({ path, zh, en, inline = false }) {
  const [checked, set] = useField(path, false);
  const readOnly = useReadOnly();
  const { isEn } = useLang();
  return (
    <label className={cx('offcheck', inline && 'offcheck--inline', checked && 'is-checked')}>
      <input type="checkbox" checked={Boolean(checked)} disabled={readOnly} onChange={(e) => set(e.target.checked)} />
      <span aria-hidden="true" className="offcheck__box">{checked ? '✓' : ''}</span>
      <span className="offcheck__text">
        {isEn ? en : zh}
        {!isEn && <em>{en}</em>}
      </span>
    </label>
  );
}

function MiniSig({ path, label = '團長簽署', en = 'C.S.L. Signature' }) {
  const [sig, set] = useField(path, null);
  const readOnly = useReadOnly();
  const { isEn } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      {sig?.png ? (
        <button type="button" className="offsig" onClick={() => setOpen(true)}>
          <img src={sig.png} alt={isEn ? 'Signature' : '簽署'} />
        </button>
      ) : readOnly ? (
        <span className="offsig offsig--blank" aria-hidden="true" />
      ) : (
        <button type="button" className="offsig offsig--empty no-print" onClick={() => setOpen(true)} aria-label={isEn ? en : label}>
          <Icon name="pen" size={10} />
        </button>
      )}
      <SignModal
        open={open}
        onClose={() => setOpen(false)}
        title={isEn ? en : label}
        defaultName={sig?.name || ''}
        defaultTitle={isEn ? 'C.S.L.' : '幼童軍團長'}
        onSave={(next) => {
          set(next);
          setOpen(false);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ 封面（不計頁碼） */

export function PCover() {
  const [name, setName] = useField('member.nameZh', '');
  const [six, setSix] = useField('member.six', '');
  const [group, setGroup] = useField('member.group', '');
  const { isEn } = useLang();
  return (
    <Page id="cover" className="offcover-page">
      <div className="offcover2">
        <img
          className="offcover2__art"
          src="/official/cover.webp"
          alt={isEn ? 'Official Cub Scout Record Book cover (© Scout Association of Hong Kong)' : '《幼童軍紀錄冊》官方封面（© 香港童軍總會）'}
        />
        <div className="offcover2__fields">
          <label className="offcover2__row offcover2__row--1" aria-label={isEn ? 'Name' : '姓名'}>
            <Write value={name || ''} onChange={setName} compact label={isEn ? 'Name' : '姓名'} />
          </label>
          <label className="offcover2__row offcover2__row--2" aria-label={isEn ? 'Six' : '小隊'}>
            <Write value={six || ''} onChange={setSix} compact label={isEn ? 'Six' : '小隊'} />
          </label>
          <label className="offcover2__row offcover2__row--3" aria-label={isEn ? 'Group' : '旅別'}>
            <Write value={group || ''} onChange={setGroup} compact label={isEn ? 'Group' : '旅別'} />
          </label>
        </div>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 1 頁 個人摘要（一） */

export function P01() {
  const [photo, setPhoto] = useField('member.photo', null);
  const { book } = useBook();
  const { isEn } = useLang();
  return (
    <Page id="p01">
      <Line label="童軍成員編號" en="Scout ID." path="member.scoutId" placeholder="0012345678" />
      <div className="offphoto">
        <PhotoPicker value={photo} onChange={setPhoto} />
        <p className="offphoto__note">
          {isEn ? 'Please stamp group chop across the photo' : '請於相片上蓋上旅印'}
          <em>Please stamp group chop across the photo</em>
        </p>
        <p className="offphoto__cap">{isEn ? 'Photo' : '相片'}<em>Photo</em></p>
      </div>
      <div className="offstack">
        <Line label="姓名（中文）" en="Name (in Chinese)" path="member.nameZh" />
        <Line label="（英文）" en="(in English)" path="member.nameEn" />
        <Sig label="持有人簽署" en="Holder's Signature" path="holderSignature" defaultName={book.member?.nameZh || ''} />
      </div>
      <div className="offbannerbar">
        {isEn ? 'In the event of accident please contact:' : '如有意外請代通知：'}
        <em>In the event of accident please contact:</em>
      </div>
      <div className="offstack">
        <Line label="姓名" en="Name" path="member.emergencyName" />
        <Line label="電話" en="Telephone" path="member.emergencyPhone" />
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 2 頁 個人摘要（二） */

export function P02() {
  const { isEn } = useLang();
  return (
    <Page id="p02">
      <div className="offstack">
        <Line label="身份證號碼" en="HKID No." path="member.hkidPrefix" transform={(v) => v.toUpperCase()} />
        <Line label="出生日期" en="Date of Birth" path="member.dob" type="date" />
        <Line label="出生地點" en="Place of Birth" path="member.pob" />
      </div>
      <Area label="地址" en="Address" path="member.addressZh" rows={3} />
      <div className="offstack">
        <Line label="家長或監護人姓名" en="Parent or Guardian" path="member.parentName" />
        <Line label="聯絡電話" en="Telephone" path="member.parentPhone" />
        <Line label="學校" en="School" path="member.school" />
        <Line label="簽證日期" en="Date of Issue" path="member.dateOfIssue" type="date" />
      </div>
      <p className="offref">
        {isEn ? '(Please also refer to the information on Page 4)' : '（請同時參閱第 4 頁之資料）'}
        <em>(Please also refer to the information on Page 4)</em>
      </p>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 3 頁 童軍紀錄 */

export function P03() {
  const { book } = useBook();
  const { isEn } = useLang();
  const age = book.member?.dateJoined && book.member?.dob ? ageFromDob(book.member.dob, new Date(book.member.dateJoined)) : null;
  return (
    <Page id="p03">
      <div className="offstack">
        <Line label="隊名" en="Six" path="member.six" />
        <Line label="旅別" en="Group" path="member.group" />
        <Line label="所屬童軍區" en="Scout District" path="member.district" />
        <Line label="所屬地域" en="Region" path="member.region" />
        <Line label="幼童軍團長姓名" en="Name of C.S.L." path="member.csl" />
        <Line label="聯絡電話" en="Telephone" path="member.cslPhone" />
        <Line label="入團日期" en="Date Joined" path="member.dateJoined" type="date" />
        <Line label="入團年歲" en="Age on Joining" path="member.ageOnJoining" placeholder={age == null ? '' : String(age)} />
      </div>
      <Area label="旅部地址" en="Address of Group HQ" path="member.groupAddress" rows={2} />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 4 頁 會員資格 */

export function P04() {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const rows = book.renewals || [];
  const total = Math.max(8, rows.length);
  const setCell = (i, key, value) => {
    if (readOnly) return;
    update((b) => {
      const next = (b.renewals || []).slice();
      while (next.length <= i) next.push({});
      next[i] = { ...(next[i] || {}), [key]: value };
      return { ...b, renewals: next };
    });
  };
  return (
    <Page id="p04" dense>
      <div className="offgrid offgrid--renewal">
        <div className="offgrid__head offgrid__head--span">
          <span>{isEn ? 'Valid Date' : '有效日期'}<em>Valid Date</em></span>
          <span>{isEn ? 'Signature of Leader and Group Chop' : '領袖簽署及旅印'}<em>Signature of Leader and Group Chop</em></span>
          <span>{isEn ? 'Name of Leader' : '領袖姓名'}<em>Name of Leader</em></span>
        </div>
        <div className="offgrid__head offgrid__head--sub">
          <span>{isEn ? 'From' : '由'}<em>From</em></span>
          <span>{isEn ? 'To' : '至'}<em>To</em></span>
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </div>
        {Array.from({ length: total }).map((_, i) => {
          const row = rows[i] || {};
          return (
            <div className="offgrid__row" key={i}>
              <span><Write value={row.from || ''} onChange={(v) => setCell(i, 'from', v)} type="date" compact label="由" /></span>
              <span><Write value={row.validUntil || ''} onChange={(v) => setCell(i, 'validUntil', v)} type="date" compact label="至" /></span>
              <span><MiniSig path={`renewals.${i}.signature`} label={`第 ${i + 1} 年領袖簽署`} /></span>
              <span><Write value={row.leaderName || ''} onChange={(v) => setCell(i, 'leaderName', v)} compact label="領袖姓名" /></span>
            </div>
          );
        })}
      </div>
      <Note en="Membership is normally renewed on 1st January by the Group, and valid until 31st December each year.">
        會員資格通常每年由旅部簽認，由一月一日起至十二月三十一日止。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 5 頁 轉旅／遷移地址 */

export function P05() {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const setCell = (key, i, field, value) => {
    if (readOnly) return;
    update((b) => {
      const next = (b[key] || []).slice();
      while (next.length <= i) next.push({});
      next[i] = { ...(next[i] || {}), [field]: value };
      return { ...b, [key]: next };
    });
  };
  return (
    <Page id="p05" dense>
      <h3 className="offband offband--orange">{isEn ? 'Transfer of Group' : '轉旅'}<em>Transfer of Group</em></h3>
      <div className="offgrid offgrid--transfer">
        <div className="offgrid__head">
          <span>{isEn ? 'Date' : '日期'}<em>Date</em></span>
          <span>{isEn ? 'No. of New Group' : '新旅號'}<em>No. of New Group</em></span>
        </div>
        {[0, 1, 2].map((i) => {
          const row = book.transfers?.[i] || {};
          return (
            <div className="offgrid__row" key={i}>
              <span>
                <b className="offgrid__idx">{i + 1})</b>
                <Write value={row.date || ''} onChange={(v) => setCell('transfers', i, 'date', v)} type="date" compact label="日期" />
              </span>
              <span><Write value={row.group || ''} onChange={(v) => setCell('transfers', i, 'group', v)} compact label="新旅號" /></span>
            </div>
          );
        })}
      </div>

      <h3 className="offband offband--orange">{isEn ? 'Change of Address' : '遷移地址'}<em>Change of Address</em></h3>
      <div className="offgrid offgrid--address">
        <div className="offgrid__head">
          <span>{isEn ? 'Date' : '日期'}<em>Date</em></span>
          <span>{isEn ? 'Address of New Group HQ' : '新旅部地址'}<em>Address of New Group HQ</em></span>
        </div>
        {[0, 1, 2, 3, 4].map((i) => {
          const row = book.addressChanges?.[i] || {};
          return (
            <div className="offgrid__row" key={i}>
              <span><Write value={row.date || ''} onChange={(v) => setCell('addressChanges', i, 'date', v)} type="date" compact label="日期" /></span>
              <span><Write value={row.address || ''} onChange={(v) => setCell('addressChanges', i, 'address', v)} compact label="新地址" /></span>
            </div>
          );
        })}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 6 頁 誓詞／規律／銘言 */

export function P06() {
  const { isEn } = useLang();
  return (
    <Page id="p06" banner={false}>
      <section className="offcreed">
        <h3>{isEn ? 'Cub Scout Promise' : '幼童軍誓詞'}<em>Cub Scout Promise</em></h3>
        <p>
          {isEn ? (
            <>
              I promise that I will do my best
              <br />
              to do my duty to God and to my Country
              <br />
              to help other people
              <br />
              and to keep the Cub Scout Law.
            </>
          ) : (
            <>
              我願盡所能；
              <br />
              對神明，對國家，盡責任；
              <br />
              對別人，要幫助；
              <br />
              對規律，必遵行。
            </>
          )}
        </p>
      </section>
      <section className="offcreed">
        <h3>{isEn ? 'Cub Scout Law' : '幼童軍規律'}<em>Cub Scout Law</em></h3>
        <p>
          {isEn ? (
            <>
              Cub Scouts always do their best,
              <br />
              think of others before themselves
              <br />
              and do a good turn every day.
            </>
          ) : (
            <>
              幼童軍，盡所能，
              <br />
              先顧別人才顧己，
              <br />
              日行一善富精神。
            </>
          )}
        </p>
      </section>
      <section className="offcreed">
        <h3>{isEn ? 'Scout Motto' : '童軍銘言'}<em>Scout Motto</em></h3>
        <p className="offcreed__motto">{isEn ? '“Be Prepared”' : '「準備」'}</p>
      </section>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 7 頁 進度性獎章 */

export function P07() {
  const { isEn } = useLang();
  return (
    <Page id="p07">
      <P en="There are four progressive badges, including Cub Scout Experience Badge, Cub Scout Adventure Award, Cub Scout Adventure Crest Award, and Golden Bauhinia Award.">
        共有四個進度性獎章，包括幼童軍體驗章、幼童軍歷奇章、幼童軍高級歷奇章及金紫荊獎章。
      </P>
      <P en="Under normal circumstances, a Cub Scout should complete the entire syllabus of a badge before proceeding to the next one. For late-joining Cub Scouts, they are required to complete the designated syllabus within the “Core Domains” of the preceding progressive badge(s) before they can commence the progressive badge syllabus appropriate for their age.">
        在正常情況下，一個幼童軍應完成某一獎章全部課程後，才去考取另一個獎章；而遲加入的幼童軍成員，則須完成之前進度性獎章內的「核心範疇」指定課程後，才可開展該年齡的進度性獎章課程。
      </P>
      <div className="offawards">
        {[
          { zh: '幼童軍體驗章', en: 'C.S. Experience Badge', page: 'p13' },
          { zh: '幼童軍歷奇章', en: 'C.S. Adventure Award', page: 'p14' },
          { zh: '幼童軍高級歷奇章', en: 'C.S. Adventure Crest Award', page: 'p16' },
          { zh: '金紫荊獎章', en: 'Golden Bauhinia Award', page: 'p18' },
        ].map((b) => (
          <Link key={b.page} to={`/p/${b.page}`} className="offawards__card">
            <strong>{isEn ? b.en : b.zh}</strong>
            {!isEn && <em>{b.en}</em>}
          </Link>
        ))}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 8 頁 個人進度紀錄 */

const PROGRESS_ROWS = [
  { key: 'membership', zh: '會員章', en: 'Membership Badge' },
  { key: 'experience', zh: '幼童軍體驗章', en: 'C.S. Experience Badge' },
  { key: 'adventure', zh: '幼童軍歷奇章', en: 'C.S. Adventure Award' },
  { key: 'crest', zh: '幼童軍高級歷奇章', en: 'C.S. Adventure Crest Award' },
  { key: 'goldenBauhinia', zh: '金紫荊獎章', en: 'Golden Bauhinia Award' },
  { key: 'scoutLink', zh: '童軍先修章', en: 'Scout Link Badge' },
  { key: 'second', zh: '副隊長', en: 'Second' },
  { key: 'sixer', zh: '隊長', en: 'Sixer' },
];

export function P08() {
  const { isEn } = useLang();
  return (
    <Page id="p08">
      <div className="offdotted">
        <div className="offdotted__head">{isEn ? 'Date Completed' : '獲取日期'}<em>Date Completed</em></div>
        {PROGRESS_ROWS.map((r) => (
          <DateRow key={r.key} path={`personalProgress.${r.key}`} zh={r.zh} en={r.en} />
        ))}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 9 頁 服務年星 */

export function P09() {
  const { isEn } = useLang();
  const years = [
    ['y1', '一年星', '1st Year'],
    ['y2', '二年星', '2nd Year'],
    ['y3', '三年星', '3rd Year'],
    ['y4', '四年星', '4th Year'],
    ['y5', '五年星', '5th Year'],
    ['y6', '六年星', '6th Year'],
  ];
  return (
    <Page id="p09">
      <PageRows title={isEn ? 'Service Star' : '服務年星'} en="Service Star" rows={years.map(([key, zh, en]) => ({ key: `serviceStars.${key}`, zh, en }))} />
      <div className="offdotted__head offdotted__head--single">{isEn ? 'Transfer to Scout Troop' : '晉升童軍團'}<em>Transfer to Scout Troop</em></div>
      <Line label="日期" en="Date" path="personalProgress.transferToScout" type="date" />
    </Page>
  );
}

function PageRows({ title, en, rows }) {
  const { isEn } = useLang();
  return (
    <>
      <div className="offdotted__head">{isEn ? en : title}<em>{en}</em></div>
      {rows.map((r) => (
        <DateRow key={r.key} path={r.key} zh={r.zh} en={r.en} />
      ))}
    </>
  );
}

function DateRow({ path, zh, en }) {
  const [value, set] = useField(path, '');
  const { isEn } = useLang();
  return (
    <div className="offdotted__row">
      <span className="offdotted__name">
        {isEn ? en : zh}
        {!isEn && <em>{en}</em>}
      </span>
      <span className="offdotted__line">
        <Write value={value || ''} onChange={set} type="date" compact label={zh} />
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ 第 10–11 頁 會員章 */

export function P10() {
  const { isEn } = useLang();
  return (
    <Page id="p10">
      <div className="offmembership">
        <img
          className="offmembership__emblem"
          src="/official/membership-emblem.png"
          alt={isEn ? 'World Membership Badge' : '世界會員章'}
        />
        <P en="When completed all the requirements for membership (within 2-3 months after joining the Pack), he/she can become a Cub Scout member and presented with his/her World Membership Badge.">
          必須在入團後兩至三個月內全部完成以下活動，才可以獲得世界會員章及正式成為幼童軍。
        </P>
      </div>
      <AssessTable
        items={[
          { id: 'L1-A', no: 'a', zh: '了解童軍運動的起源', en: 'Understand the origin of the Scout Movement' },
          { id: 'L1-B', no: 'b', zh: '認識童軍家庭', en: 'Recognise Scout Family' },
          { id: 'L1-C', no: 'c', zh: '誓詞、規律和銘言', en: 'Promise, Law, and Motto' },
        ]}
      />
    </Page>
  );
}

export function P11() {
  const { isEn } = useLang();
  return (
    <Page id="p11">
      <AssessTable
        items={[
          { id: 'L1-D', no: 'd', zh: '認識幼童軍徽章', en: 'Recognise Cub Scout Badges' },
          { id: 'L1-E', no: 'e', zh: '森林故事', en: 'Jungle Book Story' },
          { id: 'L1-F', no: 'f', zh: '口號和手號', en: 'Pack Calls and Commands' },
          { id: 'L1-G', no: 'g', zh: '禮儀', en: 'Ceremonies' },
          { id: 'L1-H', no: 'h', zh: '認識所屬旅團', en: 'Know Your Pack' },
          { id: 'L1-I', no: 'i', zh: '保護童軍成員免受傷害', en: 'Safe from Harm' },
        ]}
      />
      <Line label="宣誓日期" en="Investiture Date" path="member.dateInvestiture" type="date" />
      <CslSign path="pages.membershipSignature" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 12 頁 章節扉頁 */

export function P12() {
  const { isEn } = useLang();
  return (
    <Page id="p12" kind="divider">
      <div className="offdivider2">
        <img
          className="offdivider2__art"
          src="/official/divider.webp"
          alt={isEn ? 'Progressive Badges — Cub Scout Experience, Adventure, Adventure Crest and Golden Bauhinia badges' : '進度性獎章：幼童軍體驗章、歷奇章、高級歷奇章及金紫荊獎章'}
        />
        <h2 className="sr-only">{isEn ? 'Progressive Badges' : '進度性獎章'}</h2>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 13–18 頁 核心範疇 */

function CorePage({ id, awardId, titleZh, titleEn, level, intro, noBanner, art }) {
  const { isEn } = useLang();
  const rows = CORE_ROWS(awardId);
  return (
    <Page id={id} dense banner={!noBanner}>
      {(intro || art) && (
        <div className={cx('offintro', art && 'offintro--art')}>
          {art && <img className="offintro__art" src={art} alt="" aria-hidden="true" />}
          {intro && <P en={intro.en}>{intro.zh}</P>}
        </div>
      )}
      {awardId !== 'OT-GB' && <div className="offlate">
        <span className="offlate__note">
          {isEn
            ? 'Please tick the ☐ if the member joined late and has only completed the designated syllabus of Core Domains.'
            : '如成員為遲加入之成員並只完成「核心範疇」指定課程，請在 ☐ 加上 ✓ 號。'}
          <em>Please tick the ☐ if the member joined late and has only completed the designated syllabus of Core Domains.</em>
        </span>
        <CheckLine path={`lateJoin.${awardId}`} zh="只完成核心範疇" en="Core Domains only" inline />
      </div>}

      {level && (
        <h3 className="offband offband--green">
          {isEn ? `Core Domains (${level.en})` : `核心範疇（${level.zh}）`}
          <em>{`Core Domains (${level.en})`}</em>
        </h3>
      )}
      {!level && (
        <h3 className="offband offband--green">
          {isEn ? 'Core Domains' : '核心範疇'}
          <em>Core Domains</em>
        </h3>
      )}
      <ExamTable rows={rows} showDigital awardId={awardId} />
      <AwardDate awardId={awardId} label={awardId === 'OT-GB' ? '完成日期' : '頒發／完成日期'} en={awardId === 'OT-GB' ? 'Completed Date' : 'Awarded / Completed Date'} />
    </Page>
  );
}

export function P13() {
  const { isEn } = useLang();
  return (
    <CorePage
      id="p13"
      awardId="L2"
      titleZh="幼童軍體驗章"
      titleEn="C.S. Experience Badge"
      art="/official/badge-experience.png"
      intro={{
        zh: '此為幼童軍支部第一個進度性獎章，適合年滿六歲而考獲會員章之成員。',
        en: 'This is the first progressive badge for the Cub Scout Section, suitable for Cub Scout members who have reached the age of 6 and have earned the Membership Badge.',
      }}
    />
  );
}

export function P14() {
  return <CorePage id="p14" awardId="L3" titleZh="幼童軍歷奇章" titleEn="C.S. Adventure Award" level={{ zh: '初級', en: 'Elementary Level' }} art="/official/badge-adventure.png" />;
}

export function P16() {
  return <CorePage id="p16" awardId="L4" titleZh="幼童軍高級歷奇章" titleEn="C.S. Adventure Crest Award" level={{ zh: '中級', en: 'Intermediate Level' }} art="/official/badge-crest.png" />;
}

export function P18() {
  return <CorePage id="p18" awardId="OT-GB" titleZh="金紫荊獎章" titleEn="Golden Bauhinia Award" level={{ zh: '高級', en: 'Advanced Level' }} art="/official/badge-golden.png" />;
}

/* ------------------------------------------------------------------ 第 15／17／19 頁 興趣範疇 */

const INTEREST_DOMAINS = [
  { code: 'CREATIVE', no: '5', zh: '多元創藝', en: 'Diverse Creativity', category: 'CREATIVE' },
  { code: 'NATURE', no: '6', zh: '科學與大自然', en: 'Science and Nature', category: 'SCIENCE' },
  { code: 'SPORTS', no: '7', zh: '運動與愛好', en: 'Sports and Hobbies', category: 'SPORTS' },
];

function InterestPage({ id, awardId }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const state = book.interest?.[awardId] || { chosen: [], badges: {} };

  const setState = (patch) => {
    if (readOnly) return;
    update((b) => ({ ...b, interest: { ...(b.interest || {}), [awardId]: { ...state, ...patch } } }));
  };
  const toggle = (code) => {
    if (readOnly) return;
    const chosen = state.chosen || [];
    setState({ chosen: chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code].slice(0, 2) });
  };
  const setBadge = (code, patch) => setState({ badges: { ...(state.badges || {}), [code]: { ...(state.badges?.[code] || {}), ...patch } } });

  return (
    <Page id={id} dense>
      <P en="Members can elect to complete at least one activity badge from any two of the following three domains.">
        成員可選擇其中兩個範疇，每個範疇必須完成至少一個活動徽章。
      </P>
      <div className="offexam">
        <div className="offexam__head">
          <span />
          <span />
          <span className="offexam__h">{isEn ? 'Examiner' : '主考人'}<em>Examiner</em></span>
          <span className="offexam__h">{isEn ? 'Date' : '日期'}<em>Date</em></span>
        </div>
        {INTEREST_DOMAINS.map((d) => {
          const picked = state.chosen?.includes(d.code);
          const row = state.badges?.[d.code] || {};
          const options = OTHER_BADGES.filter((b) => b.category === d.category);
          return (
            <div className={cx('offexam__row', picked && 'is-picked')} key={d.code}>
              <span className="offexam__no">
                <button type="button" className={cx('offtick', picked && 'is-on')} onClick={() => toggle(d.code)} aria-pressed={picked} aria-label={d.zh}>
                  {picked ? '✓' : ''}
                </button>
                ({d.no})
              </span>
              <span className="offexam__name">
                {isEn ? d.en : d.zh}
                {!isEn && <em>{d.en}</em>}
                <span className="offselect">
                  <select value={row.badgeId || ''} onChange={(e) => setBadge(d.code, { badgeId: e.target.value })} disabled={readOnly} aria-label={`${d.zh} 徽章`}>
                    <option value="">{isEn ? '— Badge —' : '— 章 Badge —'}</option>
                    {options.map((b) => (
                      <option key={b.id} value={b.id}>
                        {isEn ? b.en : b.zh}
                      </option>
                    ))}
                  </select>
                </span>
              </span>
              <span className="offexam__cell">
                <Write value={row.examiner || ''} onChange={(v) => setBadge(d.code, { examiner: v })} compact placeholder={isEn ? 'Name' : '姓名'} label={`${d.zh} 主考人`} />
              </span>
              <span className="offexam__cell">
                <Write value={row.date || ''} onChange={(v) => setBadge(d.code, { date: v })} type="date" compact label={`${d.zh} 日期`} />
              </span>
            </div>
          );
        })}
      </div>
      <AwardDate awardId={awardId} />
    </Page>
  );
}

export function P15() {
  return <InterestPage id="p15" awardId="L3" />;
}

export function P17() {
  return <InterestPage id="p17" awardId="L4" />;
}

export function P19() {
  return <InterestPage id="p19" awardId="OT-GB" />;
}

/* ------------------------------------------------------------------ 第 20 頁 童軍先修章 */

export function P20() {
  return (
    <Page id="p20">
      <ExamTable
        rows={[
          { code: 'SL-1', no: '1', zh: '認知', en: 'Awareness' },
          { code: 'SL-2', no: '2', zh: '參與', en: 'Participation' },
          { code: 'SL-3', no: '3', zh: '新體驗', en: 'New Experience' },
        ]}
      />
      <AwardDate awardId="OT-SL" label="頒發童軍先修章日期" en="Awarded Date" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 21–27 頁 活動徽章紀錄 */

function ActivityPage({ id, plan }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const sections = expandActivityPlan(plan);

  const rowState = (row) => {
    const entry = book.otherBadges?.[row.id] || {};
    return row.level ? entry.levels?.[row.level] || {} : entry;
  };
  const setRow = (row, patch) => {
    if (readOnly) return;
    update((b) => {
      const entry = b.otherBadges?.[row.id] || {};
      if (!row.level) {
        return { ...b, otherBadges: { ...(b.otherBadges || {}), [row.id]: { ...entry, ...patch } } };
      }
      const levels = { ...(entry.levels || {}), [row.level]: { ...(entry.levels?.[row.level] || {}), ...patch } };
      const dates = Object.values(levels).map((l) => l.date).filter(Boolean).sort();
      return {
        ...b,
        otherBadges: { ...(b.otherBadges || {}), [row.id]: { ...entry, levels, date: dates[dates.length - 1] || '' } },
      };
    });
  };

  const badge = (idStr) => OTHER_BADGES.find((x) => x.id === idStr) || {};

  return (
    <Page id={id} dense>
      <div className="offact">
        <div className="offact__head">
          <span>{isEn ? 'Activity Badge' : '活動徽章'}<em>Activity Badge</em></span>
          <span>{isEn ? 'Completed Date' : '完成日期'}<em>Completed Date</em></span>
          <span>{isEn ? 'C.S.L. Signature' : '團長簽署'}<em>C.S.L. Signature</em></span>
        </div>
        {sections.map((sec, secIndex) => (
          <React.Fragment key={`${sec.domain}-${sec.rows[0]?.id}`}>
            <div className={cx('offact__band', `offact__band--${sec.tone}`)}>
              {isEn ? sec.en : sec.zh}
              <em>{sec.en}</em>
            </div>
            {sec.rows.map((row) => {
              const b = badge(row.id);
              const st = rowState(row);
              const zh = row.zh || b.zh || b.name || '';
              const en = row.en || b.en || '';
              const levelLabel = row.level ? LEVEL_LABEL[row.level] : null;
              const displayZh = levelLabel ? `${zh}（${levelLabel.zh}）` : zh;
              const displayEn = levelLabel ? `${en} (${levelLabel.en})` : en;
              return (
                <div className="offact__row" key={`${row.id}-${row.level || ''}`}>
                  <span className="offact__name">
                    {isEn ? displayEn : displayZh}
                    {!isEn && <em>{displayEn}</em>}
                  </span>
                  <span className="offact__date">
                    <Write value={st.date || ''} onChange={(v) => setRow(row, { date: v })} type="date" compact label={displayZh} />
                  </span>
                  <span className="offact__sig">
                    <MiniSig path={row.level ? `otherBadges.${row.id}.levels.${row.level}.signature` : `otherBadges.${row.id}.signature`} label={`${displayZh} 團長簽署`} />
                  </span>
                </div>
              );
            })}
            {secIndex < sections.length - 1 && (
              <div className="offact__row offact__row--blank" aria-hidden="true">
                <span className="offact__name" />
                <span className="offact__date" />
                <span className="offact__sig" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
      <img className="offhexes" src="/official/hexagons.png" alt="" aria-hidden="true" />
    </Page>
  );
}

export function P21() { return <ActivityPage id="p21" plan={21} />; }
export function P22() { return <ActivityPage id="p22" plan={22} />; }
export function P23() { return <ActivityPage id="p23" plan={23} />; }
export function P24() { return <ActivityPage id="p24" plan={24} />; }
export function P25() { return <ActivityPage id="p25" plan={25} />; }
export function P26() { return <ActivityPage id="p26" plan={26} />; }
export function P27() { return <ActivityPage id="p27" plan={27} />; }

/* ------------------------------------------------------------------ 第 28–31 頁 活動及服務紀錄 */

function ActivityLog({ from, pageId }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const setCell = (index, key, value) => {
    if (readOnly) return;
    update((b) => {
      const next = (b.activities || []).slice();
      while (next.length <= index) next.push({});
      next[index] = { ...(next[index] || {}), [key]: value };
      return { ...b, activities: next };
    });
  };
  return (
    <div className="offlog">
      <div className="offlog__head">
        <span>{isEn ? 'Events' : '事項'}<em>Events</em></span>
        <span>{isEn ? 'Date' : '日期'}<em>Date</em></span>
      </div>
      {Array.from({ length: 12 }).map((_, i) => {
        const index = from + i;
        const row = book.activities?.[index] || {};
        return (
          <div className="offlog__row" key={`${pageId}-${index}`}>
            <span><Write value={row.text || ''} onChange={(v) => setCell(index, 'text', v)} compact label={`事項 ${index + 1}`} /></span>
            <span><Write value={row.date || ''} onChange={(v) => setCell(index, 'date', v)} type="date" compact label={`日期 ${index + 1}`} /></span>
          </div>
        );
      })}
    </div>
  );
}

export function P28() { return <Page id="p28"><ActivityLog from={0} pageId="p28" /></Page>; }
export function P29() { return <Page id="p29"><ActivityLog from={12} pageId="p29" /></Page>; }
export function P30() { return <Page id="p30"><ActivityLog from={24} pageId="p30" /></Page>; }
export function P31() { return <Page id="p31"><ActivityLog from={36} pageId="p31" /></Page>; }

/* ------------------------------------------------------------------ 第 32 頁 團呼 */

export function P32() {
  const { isEn } = useLang();
  return (
    <Page id="p32">
      <P en="This is a special way to saying “hello” to Akela, your Cub Scout Leader, and a way of reminding you about your Cub Scout Promise every time you do it. When you have made your Promise and have been invested as a Cub Scout, you will be able to join in the Grand Howl at the beginning and end of a Pack meeting or event to say “hello!” and “thank you!” to Akela.">
        團呼是幼童軍向亞基拿——你們的團長致敬的儀式。每次團集會開始和完結時，幼童軍都會向團長做一個團呼，以表示向團長打招呼和感謝的意思。當你宣誓加入幼童軍團後，你也需要參加這個儀式。
      </P>
      <img
        className="offhowl__art"
        src="/official/grand-howl.png"
        alt={isEn ? 'Cub Scouts standing in a circle for the Grand Howl' : '幼童軍圍圈進行團呼'}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ 目錄（不計官方頁碼） */

export function ContentsPage() {
  const { book } = useBook();
  const { isEn } = useLang();
  const stats = allStats(book);
  const membership = membershipStatus(book);

  return (
    <Page id="contents" dense banner={false}>
      <H en="CONTENTS">目錄</H>
      <p className="tocnote">
        {isEn
          ? 'Cover (unnumbered) + 32 printed pages, in the exact order of the official Cub Scout Record Book (© 2026).'
          : '封面（不計頁碼）＋ 官方印刷頁 1–32，頁序與《幼童軍紀錄冊》（© 2026）完全一致。'}
      </p>

      <Link to="/p/cover" className="tocrow">
        <span className="tocrow__no">—</span>
        <span className="tocrow__title">{isEn ? 'Cover' : '封面'}<em>Cover</em></span>
        <Icon name="chevron" size={12} />
      </Link>

      {OFFICIAL_GROUPS.map((g) => (
        <section key={g.id} className="tocgroup">
          <h3>
            {isEn ? g.en : g.zh}
            {!isEn && <em>{g.en}</em>}
          </h3>
          {OFFICIAL_PAGES.filter((p) => p.group === g.id).map((p) => (
            <Link key={p.id} to={`/p/${p.id}`} className="tocrow">
              <span className="tocrow__no">{p.no}</span>
              <span className="tocrow__title">
                {isEn ? p.en : p.zh}
                {!isEn && <em>{p.en}</em>}
              </span>
              <Icon name="chevron" size={12} />
            </Link>
          ))}
        </section>
      ))}

      <section className="tocgroup">
        <h3>
          {isEn ? 'Digital Appendix' : '數位附錄'}
          <em>Digital Appendix</em>
        </h3>
        <Link to="/p/appendix" className="tocrow">
          <span className="tocrow__no">{isEn ? 'App.' : '附錄'}</span>
          <span className="tocrow__title">
            {isEn ? 'Item progress · sync · backup' : '逐項進度 · 同步 · 備份'}
            <em>{isEn ? '逐項進度 · 同步 · 備份' : 'Item progress · sync · backup'}</em>
          </span>
          <Icon name="chevron" size={12} />
        </Link>
      </section>

      <div className="tocsum">
        {stats.awards.map((a) => (
          <span key={a.award.id} className="tocsum__card">
            <span className="tocsum__name">
              {isEn ? a.award.en : a.award.name}
              <em>{isEn ? a.award.name : a.award.en}</em>
            </span>
            <span className="tocsum__bar">
              <i style={{ width: `${a.percent}%` }} />
            </span>
            <span className="tocsum__num">
              {a.done}/{a.total} {a.complete && <b>✓</b>}
            </span>
          </span>
        ))}
      </div>

      <Grid cols={2}>
        <div className="tocfact">
          <span>{isEn ? 'Membership valid until' : '會員資格有效期'}</span>
          <strong>{membership.validUntil || '—'}</strong>
        </div>
        <div className="tocfact">
          <span>{isEn ? 'Activity badges recorded' : '活動徽章紀錄'}</span>
          <strong>{stats.activityBadges}</strong>
        </div>
      </Grid>
    </Page>
  );
}
