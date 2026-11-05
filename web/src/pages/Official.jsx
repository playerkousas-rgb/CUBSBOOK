import React, { useState } from 'react';
import { BADGE_SYLLABUS, GOLD_AWARD, OTHER_BADGES, allStats, ageFromDob, membershipStatus } from '@shared/book.js';
import { OFFICIAL_GROUPS, OFFICIAL_PAGES } from '@shared/officialPages.js';
import { useBook, useField } from '../bookContext.js';
import { Area, AssessTable, Grid, H, Line, Note, P, Page, Rows, Sig } from '../components/Form.jsx';
import Write from '../components/Write.jsx';
import { PhotoPicker } from '../components/PhotoPicker.jsx';
import { SignModal } from '../components/Ink.jsx';
import { Crest, Icon, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { Link } from '../router.jsx';

/**
 * 官方《幼童軍紀錄冊》（© 2026 香港童軍總會）32 頁的電子版。
 * 每一頁的頁碼、標題、欄目、表格排列均照官方；不加入官方沒有的欄位。
 * 72 項課程細節只放在「數位附錄」，不在官方頁上出現勾選表。
 */

const awardById = Object.fromEntries([...BADGE_SYLLABUS, GOLD_AWARD].map((a) => [a.id, a]));

const CORE_ROWS = (awardId) => {
  const award = awardById[awardId];
  return award.segments
    .filter((s) => !s.code.endsWith('-INTEREST'))
    .map((s, i) => ({ code: s.code, no: String(i + 1), zh: s.name, en: s.en, items: s.items }));
};

/* ------------------------------------------------------------------ 小元件 */

function CslSign({ path, label = '幼童軍團長簽署', en = 'C.S.L. Signature' }) {
  const [sig, setSig] = useField(path, null);
  const { isEn } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="offsign">
      <span className="frow__label">
        {isEn ? en : label}
        {!isEn && <em>{en}</em>}
      </span>
      {sig?.png ? (
        <button type="button" className="offsign__img" onClick={() => setOpen(true)} title={sig.name || ''}>
          <img src={sig.png} alt={isEn ? 'Signature' : '簽署'} />
        </button>
      ) : (
        <button type="button" className="offsign__btn no-print" onClick={() => setOpen(true)}>
          <Icon name="pen" size={13} /> {isEn ? 'Sign' : '簽署'}
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
    <div className="offaward">
      <div className="frow">
        <span className="frow__label">
          {isEn ? en : label}
          {!isEn && <em>{en}</em>}
        </span>
        <span className="frow__value">
          <Write
            value={row.date || ''}
            onChange={(v) => set({ ...row, date: v })}
            type="date"
            compact
            label={isEn ? en : label}
          />
        </span>
      </div>
      <CslSign path={`pages.award_${awardId}.signature`} />
    </div>
  );
}

function ExamTable({ rows, en = 'Examiner / Date', showDigital = false, awardId }) {
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
    <div className="offtable">
      <div className="offtable__head">
        <span className="offtable__c-no">{isEn ? 'No.' : '項'}</span>
        <span className="offtable__c-name">{isEn ? 'Domain / Item' : '範疇／項目'}</span>
        <span className="offtable__c-exam">{isEn ? 'Examiner' : '主考人'}</span>
        <span className="offtable__c-date">{isEn ? 'Date' : '日期'}</span>
      </div>
      {rows.map((r) => {
        const st = book.domains?.[r.code] || {};
        return (
          <div className="offtable__row" key={r.code}>
            <span className="offtable__c-no">({r.no})</span>
            <span className="offtable__c-name">
              {isEn ? r.en || r.zh : r.zh}
              {!isEn && r.en && <em>{r.en}</em>}
              {showDigital && r.items?.length > 0 && (
                <small className="offtable__hint">
                  {isEn
                    ? `${r.items.filter((i) => book.progress?.[i.id]?.date).length}/${r.items.length} items in appendix`
                    : `附錄 ${r.items.filter((i) => book.progress?.[i.id]?.date).length}/${r.items.length} 項`}
                </small>
              )}
            </span>
            <span className="offtable__c-exam">
              <Write
                value={st.examiner || ''}
                onChange={(v) => setCell(r.code, 'examiner', v)}
                compact
                placeholder={isEn ? 'Name' : '姓名'}
                label={`${r.no} 主考人`}
              />
            </span>
            <span className="offtable__c-date">
              <Write
                value={st.date || ''}
                onChange={(v) => setCell(r.code, 'date', v)}
                type="date"
                compact
                label={`${r.no} 日期`}
              />
            </span>
          </div>
        );
      })}
      {awardId && (
        <p className="offtable__foot no-print">
          <Link to="/p/appendix">
            {isEn ? 'Item-by-item detail lives in the digital appendix' : '逐項課程細節請看「數位附錄」'}
          </Link>
        </p>
      )}
    </div>
  );
}

function CheckLine({ path, zh, en }) {
  const [checked, set] = useField(path, false);
  const { isEn } = useLang();
  return (
    <label className={cx('offcheck', checked && 'is-checked')}>
      <input type="checkbox" checked={Boolean(checked)} onChange={(e) => set(e.target.checked)} />
      <span aria-hidden="true">{checked ? '✓' : ''}</span>
      {isEn ? en : zh}
    </label>
  );
}

function MiniSig({ path, label = '團長簽署', en = 'C.S.L. Signature' }) {
  const [sig, set] = useField(path, null);
  const { isEn } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      {sig?.png ? (
        <button type="button" className="offsig" onClick={() => setOpen(true)}>
          <img src={sig.png} alt={isEn ? 'Signature' : '簽署'} />
        </button>
      ) : (
        <button
          type="button"
          className="offsig offsig--empty no-print"
          onClick={() => setOpen(true)}
          aria-label={isEn ? en : label}
        >
          <Icon name="pen" size={11} />
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

/* ------------------------------------------------------------------ 第 1 頁 封面 */

export function P01() {
  const { isEn } = useLang();
  return (
    <Page id="p01" className="offcover">
      <div className="offcover__inner">
        <Crest size={64} />
        <p className="offcover__org">{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</p>
        <h1 className="offcover__title">
          {isEn ? 'CUB SCOUT' : '幼童軍'}
          <em>{isEn ? 'RECORD BOOK' : '紀　錄　冊'}</em>
        </h1>
        <p className="offcover__edition">{isEn ? 'Cub Scout Record Book' : 'Cub Scout Record Book · 2026 年版'}</p>
        <div className="offcover__fields">
          <Line label="姓名" en="Name" path="member.nameZh" />
          <Line label="小隊" en="Six" path="member.six" />
          <Line label="旅別" en="Group" path="member.group" />
        </div>
        <p className="offcover__foot">
          {isEn ? '© 2026 Scout Association of Hong Kong' : '© 2026 香港童軍總會'}
        </p>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 2 頁 個人摘要 */

export function P02() {
  const [photo, setPhoto] = useField('member.photo', null);
  const { book } = useBook();
  const { isEn } = useLang();
  const joined = book.member?.dateJoined && book.member?.dob ? ageFromDob(book.member.dob, new Date(book.member.dateJoined)) : null;

  return (
    <Page id="p02">
      <H en="PERSONAL DETAILS">個人摘要</H>
      <p className="pglead">{isEn ? 'Please also refer to the information on Page 4.' : '（請同時參閱第 4 頁之資料）'}</p>

      <div className="ptop">
        <div className="ptop__photo">
          <PhotoPicker value={photo} onChange={setPhoto} />
          <small className="ptop__stamp">{isEn ? 'Please stamp group chop across the photo' : '請於相片上蓋上旅印'}</small>
        </div>
        <div className="ptop__id">
          <Line label="姓名（中文）" en="Name (in Chinese)" path="member.nameZh" />
          <Line label="姓名（英文）" en="Name (in English)" path="member.nameEn" />
          <Line label="童軍成員編號" en="Scout ID." path="member.scoutId" placeholder="0012345678" />
          <Line label="電話" en="Telephone" path="member.phone" />
        </div>
      </div>

      <Grid cols={2}>
        <Line label="出生日期" en="Date of Birth" path="member.dob" type="date" />
        <Line label="出生地點" en="Place of Birth" path="member.pob" />
        <Line label="學校" en="School" path="member.school" />
        <Line label="身份證號碼" en="HKID No." path="member.hkidPrefix" transform={(v) => v.toUpperCase()} hint={isEn ? 'CUBBOOK only stores the first 4 characters.' : 'CUBBOOK 只儲存首 4 個字元。'} />
      </Grid>

      <Area label="地址" en="Address" path="member.addressZh" rows={2} />

      <Grid cols={2}>
        <Line label="家長或監護人姓名" en="Parent or Guardian" path="member.parentName" />
        <Line label="聯絡電話" en="Telephone" path="member.parentPhone" />
      </Grid>
      <Grid cols={2}>
        <Line label="簽證日期" en="Date of Issue" path="member.dateOfIssue" type="date" />
        <Line
          label="入團年歲"
          en="Age on Joining"
          path="member.ageOnJoining"
          placeholder={joined == null ? '' : String(joined)}
        />
      </Grid>

      <Sig label="持有人簽署" en="Holder's Signature" path="holderSignature" defaultName={book.member?.nameZh || ''} />
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
      <H en="SCOUTING RECORD">童軍紀錄</H>
      <Grid cols={2}>
        <Line label="小隊" en="Six" path="member.six" />
        <Line label="旅別" en="Group" path="member.group" />
        <Line label="所屬幼童軍區" en="Scout District" path="member.district" />
        <Line label="所屬地域" en="Region" path="member.region" />
        <Line label="幼童軍團長姓名" en="Name of C.S.L." path="member.csl" />
        <Line label="聯絡電話" en="Telephone" path="member.cslPhone" />
        <Line label="入團日期" en="Date Joined" path="member.dateJoined" type="date" />
        <Line
          label="入團年歲"
          en="Age on Joining"
          path="member.ageOnJoining"
          placeholder={age == null ? '' : String(age)}
        />
      </Grid>
      <Area label="旅部地址" en="Address of Group HQ" path="member.groupAddress" rows={2} />
      <Note en="The Scout ID is the only identifier CUBBOOK uses to match your cubbadge record. Everything else may be left blank.">
        童軍成員編號是 CUBBOOK 與 cubbadge 對應的唯一識別；其餘資料可留白。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 4 頁 會員資格續期 */

export function P04() {
  const { isEn } = useLang();
  return (
    <Page id="p04">
      <H en="RENEWAL OF MEMBERSHIP">會員資格續期</H>
      <P en="Membership is normally renewed on 1st January by the Group, and valid until 31st December each year.">
        會員資格通常每年由旅部簽認，由一月一日至十二月三十一日止。
      </P>
      <Rows
        path="renewals"
        min={6}
        addLabel="加一年"
        cols={[
          { k: 'from', label: '由', en: 'From', type: 'date' },
          { k: 'validUntil', label: '至', en: 'To', type: 'date' },
          { k: 'leaderName', label: '領袖姓名', en: 'Name of Leader' },
          { k: 'memberNo', label: '會員編號', en: 'Membership No.' },
        ]}
      />
      <CslSign path="pages.renewalSignature" label="領袖簽署及旅印" en="Signature of Leader and Group Chop" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 5 頁 轉旅及遷移地址 */

export function P05() {
  const { isEn } = useLang();
  return (
    <Page id="p05">
      <H en="TRANSFER OF GROUP & CHANGE OF ADDRESS">轉旅及遷移地址</H>

      <h3 className="offsub">{isEn ? 'Transfer of Group' : '轉旅'}</h3>
      <Rows
        path="transfers"
        min={3}
        addLabel="加一次轉旅"
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date' },
          { k: 'group', label: '新旅別', en: 'No. of New Group' },
          { k: 'address', label: '新旅部地址', en: 'Address of New Group HQ' },
        ]}
      />

      <h3 className="offsub">{isEn ? 'Change of Address' : '遷移地址'}</h3>
      <Rows
        path="addressChanges"
        min={3}
        addLabel="加一次遷移"
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date' },
          { k: 'address', label: '新地址', en: 'New Address' },
        ]}
      />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 6 頁 誓詞、規律、銘言 */

export function P06() {
  const { isEn } = useLang();
  return (
    <Page id="p06">
      <H en="CUB SCOUT PROMISE, LAW AND MOTTO">幼童軍誓詞、規律及銘言</H>

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
      <H en="PROGRESSIVE BADGES">進度性獎章</H>
      <P en="There are four progressive badges, including Cub Scout Experience Badge, Cub Scout Adventure Award, Cub Scout Adventure Crest Award, and Golden Bauhinia Award.">
        共有四個進度性獎章，包括幼童軍體驗章、幼童軍歷奇章、幼童軍高級歷奇章及金紫荊獎章。
      </P>
      <P en="Under normal circumstances, a Cub Scout should complete the entire syllabus of a badge before proceeding to the next one. For late-joining Cub Scouts, they are required to complete the designated syllabus within the “Core Domains” of the preceding progressive badge(s) before they can commence the progressive badge syllabus appropriate for their age.">
        在正常情況下，一個幼童軍應完成某一獎章全部課程後，才去考取另一個獎章；而遲加入的幼童軍成員，則須完成之前進度性獎章內的「核心範疇」指定課程後，才可開展該年齡的進度性獎章課程。
      </P>

      <div className="offawards">
        {[
          { id: 'L2', zh: '幼童軍體驗章', en: 'C.S. Experience Badge', page: 'p12' },
          { id: 'L3', zh: '幼童軍歷奇章', en: 'C.S. Adventure Award', page: 'p14' },
          { id: 'L4', zh: '幼童軍高級歷奇章', en: 'C.S. Adventure Crest Award', page: 'p16' },
          { id: 'OT-GB', zh: '金紫荊獎章', en: 'Golden Bauhinia Award', page: 'p18' },
        ].map((b) => (
          <Link key={b.id} to={`/p/${b.page}`} className="offawards__card">
            <strong>{isEn ? b.en : b.zh}</strong>
            {!isEn && <em>{b.en}</em>}
            <span>
              {isEn ? 'See page' : '見第'} {Number(b.page.slice(1))} {isEn ? '' : '頁'}
            </span>
          </Link>
        ))}
      </div>

      <Note en="Every progressive badge is recorded on two pages: the Core Domains table (Examiner / Date) and, for the three higher badges, the Interest Domains table.">
        每個進度性獎章以兩頁記錄：核心範疇表（主考人／日期），以及三個較高獎章的興趣範疇表。
      </Note>
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
      <H en="PERSONAL PROGRESS RECORD">個人進度紀錄</H>
      <div className="offtable">
        <div className="offtable__head offtable__head--two">
          <span className="offtable__c-name">{isEn ? 'Award / Appointment' : '獎章／職務'}</span>
          <span className="offtable__c-date">{isEn ? 'Date Completed' : '獲取日期'}</span>
        </div>
        {PROGRESS_ROWS.map((r) => (
          <div className="offtable__row offtable__row--two" key={r.key}>
            <span className="offtable__c-name">
              {isEn ? r.en : r.zh}
              {!isEn && <em>{r.en}</em>}
            </span>
            <span className="offtable__c-date">
              <Line label={r.zh} en={r.en} path={`personalProgress.${r.key}`} type="date" />
            </span>
          </div>
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
      <H en="SERVICE STAR">服務年星</H>
      <div className="offtable">
        <div className="offtable__head offtable__head--two">
          <span className="offtable__c-name">{isEn ? 'Service Star' : '服務年星'}</span>
          <span className="offtable__c-date">{isEn ? 'Date Completed' : '獲取日期'}</span>
        </div>
        {years.map(([key, zh, en]) => (
          <div className="offtable__row offtable__row--two" key={key}>
            <span className="offtable__c-name">
              {isEn ? en : zh}
              {!isEn && <em>{en}</em>}
            </span>
            <span className="offtable__c-date">
              <Line label={zh} en={en} path={`serviceStars.${key}`} type="date" />
            </span>
          </div>
        ))}
      </div>

      <h3 className="offsub">{isEn ? 'Transfer to Scout Troop' : '晉升童軍團'}</h3>
      <Line label="日期" en="Date" path="personalProgress.transferToScout" type="date" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 10–11 頁 會員章 */

export function P10() {
  const { isEn } = useLang();
  return (
    <Page id="p10">
      <H en="MEMBERSHIP BADGE (a)–(c)">會員章（一）</H>
      <P en="When completed all the requirements for membership (within 2-3 months after joining the Pack), he/she can become a Cub Scout member and presented with his/her World Membership Badge.">
        必須在入團後兩至三個月內全部完成以下活動，才可以獲得世界會員章及正式成為幼童軍。
      </P>
      <AssessTable
        title={isEn ? 'Membership Badge' : '會員章'}
        en="Membership Badge"
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
      <H en="MEMBERSHIP BADGE (d)–(i)">會員章（二）</H>
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
      <Grid cols={2}>
        <Line label="宣誓日期" en="Investiture Date" path="member.dateInvestiture" type="date" />
      </Grid>
      <CslSign path="pages.membershipSignature" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 12 頁 體驗章簡介 */

export function P12() {
  const { isEn } = useLang();
  return (
    <Page id="p12">
      <H en="C.S. EXPERIENCE BADGE">幼童軍體驗章</H>
      <P en="This is the first progressive badge for the Cub Scout Section, suitable for Cub Scout members who have reached the age of 6 and have earned the Membership Badge.">
        此為幼童軍支部第一個進度性獎章，適合年滿六歲而考獲會員章之成員。
      </P>
      <Note en="Please tick the ☐ if the member joined late and has only completed the designated syllabus of Core Domains.">
        如成員為遲加入之成員並只完成「核心範疇」指定課程，請在 ☐ 加上 ✓ 號。
      </Note>
      <CheckLine path="lateJoin.L2" zh="只完成核心範疇指定課程" en="Core Domains only (late joiner)" />
      <div className="offnext">
        <Link to="/p/p13" className="btn btn--ghost btn--sm">
          {isEn ? 'Core Domains → page 13' : '核心範疇 → 第 13 頁'}
        </Link>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 13／14／16／18 頁 核心範疇 */

function CorePage({ id, awardId, no, zh, en, level, checkable = true }) {
  const { isEn } = useLang();
  const rows = CORE_ROWS(awardId);
  return (
    <Page id={id} dense>
      <H en={en}>{zh}</H>
      {level && (
        <p className="pglead">
          {isEn ? `Core Domains (${level.en})` : `核心範疇（${level.zh}）`}
          <em>{isEn ? '' : `Core Domains (${level.en})`}</em>
        </p>
      )}
      {checkable && (
        <CheckLine
          path={`lateJoin.${awardId}`}
          zh="如成員為遲加入並只完成核心範疇指定課程，請加上 ✓ 號"
          en="Tick if the member joined late and has only completed Core Domains"
        />
      )}
      <ExamTable rows={rows} showDigital awardId={awardId} />
      <AwardDate awardId={awardId} label={awardId === 'OT-GB' ? '完成日期' : '頒發／完成日期'} en={awardId === 'OT-GB' ? 'Completed Date' : 'Awarded / Completed Date'} />
    </Page>
  );
}

export function P13() {
  return <CorePage id="p13" awardId="L2" zh="幼童軍體驗章 — 核心範疇" en="C.S. EXPERIENCE BADGE · CORE DOMAINS" />;
}

export function P14() {
  return (
    <CorePage
      id="p14"
      awardId="L3"
      zh="幼童軍歷奇章 — 核心範疇"
      en="C.S. ADVENTURE AWARD · CORE DOMAINS (ELEMENTARY)"
      level={{ zh: '初級', en: 'Elementary Level' }}
    />
  );
}

export function P16() {
  return (
    <CorePage
      id="p16"
      awardId="L4"
      zh="幼童軍高級歷奇章 — 核心範疇"
      en="C.S. ADVENTURE CREST AWARD · CORE DOMAINS (INTERMEDIATE)"
      level={{ zh: '中級', en: 'Intermediate Level' }}
    />
  );
}

export function P18() {
  return (
    <CorePage
      id="p18"
      awardId="OT-GB"
      zh="金紫荊獎章 — 核心範疇"
      en="GOLDEN BAUHINIA AWARD · CORE DOMAINS (ADVANCED)"
      level={{ zh: '高級', en: 'Advanced Level' }}
      checkable={false}
    />
  );
}

/* ------------------------------------------------------------------ 第 15／17／19 頁 興趣範疇 */

const INTEREST_DOMAINS = [
  { code: 'CREATIVE', no: '5', zh: '多元創藝', en: 'Diverse Creativity', category: 'CREATIVE' },
  { code: 'NATURE', no: '6', zh: '科學與大自然', en: 'Science and Nature', category: 'NATURE' },
  { code: 'SPORTS', no: '7', zh: '運動與愛好', en: 'Sports and Hobbies', category: 'SPORTS' },
];

function InterestPage({ id, awardId, zh, en }) {
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
    const next = chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code].slice(0, 2);
    setState({ chosen: next });
  };

  const setBadge = (code, patch) => {
    setState({ badges: { ...(state.badges || {}), [code]: { ...(state.badges?.[code] || {}), ...patch } } });
  };

  return (
    <Page id={id} dense>
      <H en={en}>{zh}</H>
      <P en="Members can elect to complete at least one activity badge from any two of the following three domains.">
        成員可選擇其中兩個範疇，每個範疇必須完成至少一個活動徽章。
      </P>
      <p className="offhint">
        {isEn ? `Selected ${state.chosen?.length || 0} / 2` : `已選 ${state.chosen?.length || 0} / 2 個範疇`}
      </p>

      <div className="offtable">
        <div className="offtable__head">
          <span className="offtable__c-no">{isEn ? 'No.' : '項'}</span>
          <span className="offtable__c-name">{isEn ? 'Domain / Badge' : '範疇／徽章'}</span>
          <span className="offtable__c-exam">{isEn ? 'Examiner' : '主考人'}</span>
          <span className="offtable__c-date">{isEn ? 'Date' : '日期'}</span>
        </div>
        {INTEREST_DOMAINS.map((d) => {
          const picked = state.chosen?.includes(d.code);
          const row = state.badges?.[d.code] || {};
          const options = OTHER_BADGES.filter((b) => b.category === d.category);
          return (
            <div className={cx('offtable__row', picked && 'is-picked')} key={d.code}>
              <span className="offtable__c-no">
                <button
                  type="button"
                  className={cx('offtick', picked && 'is-on')}
                  onClick={() => toggle(d.code)}
                  aria-pressed={picked}
                  aria-label={isEn ? `Select ${d.en}` : `選擇${d.zh}`}
                >
                  {picked ? '✓' : ''}
                </button>
                ({d.no})
              </span>
              <span className="offtable__c-name">
                {isEn ? d.en : d.zh}
                {!isEn && <em>{d.en}</em>}
                <span className="offselect">
                  <select
                    value={row.badgeId || ''}
                    onChange={(e) => setBadge(d.code, { badgeId: e.target.value })}
                    disabled={readOnly}
                    aria-label={`${isEn ? d.en : d.zh} ${isEn ? 'badge' : '徽章'}`}
                  >
                    <option value="">{isEn ? '— select badge —' : '— 選擇徽章 —'}</option>
                    {options.map((b) => (
                      <option key={b.id} value={b.id}>
                        {isEn ? b.en : b.zh}
                      </option>
                    ))}
                  </select>
                </span>
              </span>
              <span className="offtable__c-exam">
                <Write
                  value={row.examiner || ''}
                  onChange={(v) => setBadge(d.code, { examiner: v })}
                  compact
                  placeholder={isEn ? 'Name' : '姓名'}
                  label={`${d.zh} 主考人`}
                />
              </span>
              <span className="offtable__c-date">
                <Write
                  value={row.date || ''}
                  onChange={(v) => setBadge(d.code, { date: v })}
                  type="date"
                  compact
                  label={`${d.zh} 日期`}
                />
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
  return <InterestPage id="p15" awardId="L3" zh="幼童軍歷奇章 — 興趣範疇" en="C.S. ADVENTURE AWARD · INTEREST DOMAINS" />;
}

export function P17() {
  return <InterestPage id="p17" awardId="L4" zh="幼童軍高級歷奇章 — 興趣範疇" en="C.S. ADVENTURE CREST AWARD · INTEREST DOMAINS" />;
}

export function P19() {
  return <InterestPage id="p19" awardId="OT-GB" zh="金紫荊獎章 — 興趣範疇" en="GOLDEN BAUHINIA AWARD · INTEREST DOMAINS" />;
}

/* ------------------------------------------------------------------ 第 20 頁 童軍先修章 */

export function P20() {
  const { isEn } = useLang();
  return (
    <Page id="p20">
      <H en="SCOUT LINK BADGE">童軍先修章</H>
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

/* ------------------------------------------------------------------ 第 21–26 頁 活動徽章 */

function BadgeTable({ category, otherBadges = false }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const rows = OTHER_BADGES.filter((b) => b.category === category);
  const setEntry = (id, patch) => {
    if (readOnly) return;
    update((b) => ({ ...b, otherBadges: { ...(b.otherBadges || {}), [id]: { ...(b.otherBadges?.[id] || {}), ...patch } } }));
  };
  const list = otherBadges
    ? [...rows, ...OTHER_BADGES.filter((b) => b.category === 'OTHER')]
    : rows;

  return (
    <div className="offtable offtable--badges">
      <div className="offtable__head offtable__head--badge">
        <span className="offtable__c-name">{isEn ? 'Activity Badge' : '活動徽章'}</span>
        <span className="offtable__c-date">{isEn ? 'Completed Date' : '完成日期'}</span>
        <span className="offtable__c-sig">{isEn ? 'C.S.L. Signature' : '團長簽署'}</span>
      </div>
      {list.map((b) => {
        const st = book.otherBadges?.[b.id] || {};
        return (
          <div className="offtable__row offtable__row--badge" key={b.id}>
            <span className="offtable__c-name">
              {isEn ? b.en : b.zh}
              {!isEn && <em>{b.en}</em>}
            </span>
            <span className="offtable__c-date">
              <Write
                value={st.date || ''}
                onChange={(v) => setEntry(b.id, { date: v })}
                type="date"
                compact
                label={`${b.zh} 完成日期`}
              />
            </span>
            <span className="offtable__c-sig">
              <MiniSig path={`otherBadges.${b.id}.signature`} label={`${b.zh} 團長簽署`} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function P21() {
  const { isEn } = useLang();
  return (
    <Page id="p21" dense>
      <H en="ACTIVITY BADGES · SCOUTCRAFT">活動徽章 — 童軍技能</H>
      <BadgeTable category="SCOUT_SKILLS" />
      {isEn ? null : <Note en="Levels (Elementary / Intermediate / Advanced) are shown where the official catalogue records them.">徽章如設初級／中級／高級，將按官方目錄列出。</Note>}
    </Page>
  );
}

export function P22() {
  return (
    <Page id="p22" dense>
      <H en="ACTIVITY BADGES · CARING FOR SELF AND OTHERS">活動徽章 — 關己愛人</H>
      <BadgeTable category="CARING" />
    </Page>
  );
}

export function P23() {
  return (
    <Page id="p23" dense>
      <H en="ACTIVITY BADGES · COUNTRY AND COMMUNITY">活動徽章 — 國家與社區</H>
      <BadgeTable category="COUNTRY" />
    </Page>
  );
}

export function P24() {
  return (
    <Page id="p24" dense>
      <H en="ACTIVITY BADGES · DIVERSE CREATIVITY">活動徽章 — 多元創藝</H>
      <BadgeTable category="CREATIVE" />
    </Page>
  );
}

export function P25() {
  return (
    <Page id="p25" dense>
      <H en="ACTIVITY BADGES · SCIENCE AND NATURE">活動徽章 — 科學與大自然</H>
      <BadgeTable category="NATURE" />
    </Page>
  );
}

export function P26() {
  return (
    <Page id="p26" dense>
      <H en="ACTIVITY BADGES · SPORTS AND HOBBIES / OTHER BADGES">活動徽章 — 運動與愛好／其他徽章</H>
      <BadgeTable category="SPORTS" otherBadges />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 27–30 頁 活動及服務紀錄 */

function ActivityLog({ from, pageId }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const rows = Array.from({ length: 10 }, (_, i) => from + i);
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
    <div className="offtable offtable--log">
      <div className="offtable__head offtable__head--two">
        <span className="offtable__c-name">{isEn ? 'Events' : '事項'}</span>
        <span className="offtable__c-date">{isEn ? 'Date' : '日期'}</span>
      </div>
      {rows.map((index) => {
        const row = book.activities?.[index] || {};
        return (
          <div className="offtable__row offtable__row--two" key={`${pageId}-${index}`}>
            <span className="offtable__c-name">
              <Write value={row.text || ''} onChange={(v) => setCell(index, 'text', v)} compact label={`${pageId} 事項 ${index + 1}`} />
            </span>
            <span className="offtable__c-date">
              <Write value={row.date || ''} onChange={(v) => setCell(index, 'date', v)} type="date" compact label={`${pageId} 日期 ${index + 1}`} />
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function P27() {
  return (
    <Page id="p27">
      <H en="ACTIVITIES & SERVICES RECORD">活動及服務紀錄</H>
      <ActivityLog from={0} pageId="p27" />
    </Page>
  );
}

export function P28() {
  return (
    <Page id="p28">
      <H en="ACTIVITIES & SERVICES RECORD">活動及服務紀錄</H>
      <ActivityLog from={10} pageId="p28" />
    </Page>
  );
}

export function P29() {
  return (
    <Page id="p29">
      <H en="ACTIVITIES & SERVICES RECORD">活動及服務紀錄</H>
      <ActivityLog from={20} pageId="p29" />
    </Page>
  );
}

export function P30() {
  return (
    <Page id="p30">
      <H en="ACTIVITIES & SERVICES RECORD">活動及服務紀錄</H>
      <ActivityLog from={30} pageId="p30" />
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 31 頁 團呼 */

export function P31() {
  const { isEn } = useLang();
  return (
    <Page id="p31">
      <H en="THE GRAND HOWL">幼童軍團呼</H>
      <P en="This is a special way of saying “hello” to Akela, your Cub Scout Leader, and a way of reminding you about your Cub Scout Promise every time you do it. When you have made your Promise and have been invested as a Cub Scout, you will be able to join in the Grand Howl at the beginning and end of a Pack meeting or event to say “hello!” and “thank you!” to Akela.">
        團呼是幼童軍向亞基拿——你們的團長致敬的儀式。每次團集會開始和完結時，幼童軍都會向團長做一個團呼，以表示向團長打招呼和感謝的意思。當你宣誓加入幼童軍團後，你也需要參加這個儀式。
      </P>
      <div className="offhowl">
        <Crest size={54} />
        <p>{isEn ? '“Akela! We’ll do our best!”' : '「亞基拿！我們會盡力而為！」'}</p>
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------ 第 32 頁 封底 */

export function P32() {
  const { isEn } = useLang();
  return (
    <Page id="p32" className="offback">
      <div className="offback__inner">
        <Crest size={52} />
        <h2>{isEn ? 'CUB SCOUT RECORD BOOK' : '幼童軍紀錄冊'}</h2>
        <p>{isEn ? 'Scout Association of Hong Kong' : '香港童軍總會'}</p>
        <p className="offback__addr">
          {isEn ? '10/F, Hong Kong Scout Centre, Scout Path, Austin Road, Kowloon' : '九龍柯士甸道童軍徑香港童軍中心 10 樓'}
        </p>
        <p className="offback__ed">© 2026 · {isEn ? 'Cub Scout Section' : '幼童軍支部'}</p>
      </div>
    </Page>
  );
}


/* ------------------------------------------------------------------ 目錄（不計入官方頁碼） */

export function ContentsPage() {
  const { book } = useBook();
  const { isEn } = useLang();
  const stats = allStats(book);
  const membership = membershipStatus(book);

  return (
    <Page id="contents" dense>
      <H en="CONTENTS">目錄</H>
      <p className="tocnote">
        {isEn
          ? '32 pages, in the exact order of the official Cub Scout Record Book (© 2026).'
          : '全書 32 頁，頁序與官方《幼童軍紀錄冊》（© 2026）完全一致。'}
      </p>

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

      <Note en="The 72-item syllabus detail is a digital aid only. The official pages record what the official book records: Examiner, Date, and the C.S.L. signature.">
        72 項課程細節只是數位輔助；官方頁面只記錄官方紀錄冊所要求的主考人、日期及團長簽署。
      </Note>
    </Page>
  );
}
