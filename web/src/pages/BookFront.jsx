import React from 'react';
import { SECTIONS, allStats, sanitizeHkidPrefix, membershipStatus, goldenBauhiniaEligibility } from '@shared/book.js';
import { useBook, useField } from '../bookContext.js';
import { Area, Grid, H, Line, Note, P, Page, Rows, Sig } from '../components/Form.jsx';
import { PhotoPicker } from '../components/PhotoPicker.jsx';
import { Icon, SealMark, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { Link } from '../router.jsx';

const TOC_GROUPS = [
  {
    title: '個人資料及旅團',
    en: 'Personal Particulars & Pack',
    ids: ['p01', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07'],
  },
  {
    title: '會員章及三個箭章',
    en: 'Membership Badge & Three Arrows',
    ids: ['p08', 'p09', 'p10', 'p11'],
  },
  {
    title: '金紫荊獎章及活動徽章',
    en: 'Golden Bauhinia & Activity Badges',
    ids: ['p12', 'p13', 'p14', 'p15'],
  },
  {
    title: '誓詞、制服、總覽及說明',
    en: 'Promise, Uniform, Summary & Guide',
    ids: ['p16', 'p17', 'p18', 'p19', 'appendix'],
  },
];

/* ------------------------------------------------------------ 目錄及進度摘要 */
export function ContentsPage() {
  const { book } = useBook();
  const { isEn } = useLang();
  const stats = allStats(book);
  const membership = membershipStatus(book);
  const gb = goldenBauhiniaEligibility(book);
  const meta = (id) => SECTIONS.find((s) => s.id === id) || {};

  return (
    <Page id="contents" dense>
      <H en="CONTENTS & PROGRESS">{isEn ? 'Contents & Progress' : '目錄及進度摘要'}</H>

      <div className="tocsum">
        {stats.awards.map((a) => (
          <Link key={a.award.id} to={`/p/${a.award.id === 'L1' ? 'p08' : a.award.id === 'L2' ? 'p09' : a.award.id === 'L3' ? 'p10' : a.award.id === 'L4' ? 'p11' : 'p12'}`} className="tocsum__card">
            <span className="tocsum__name">
              {isEn ? a.award.en : a.award.legacyZh === a.award.name ? a.award.name : `${a.award.name}`}
              <em>{isEn ? a.award.legacyEn : a.award.legacyZh !== a.award.name ? `（${a.award.legacyZh}）` : a.award.en}</em>
            </span>
            <span className="tocsum__bar">
              <i style={{ width: `${a.percent}%` }} />
            </span>
            <span className="tocsum__num">
              {a.done}/{a.total} {a.complete && <b>✓</b>}
            </span>
          </Link>
        ))}
      </div>

      <Grid cols={3}>
        <div className="tocfact">
          <span>{isEn ? 'Activity badges' : '活動徽章紀錄'}</span>
          <strong>{stats.activityBadges}</strong>
        </div>
        <div className="tocfact">
          <span>{isEn ? 'Membership valid until' : '會員資格有效期'}</span>
          <strong>{membership.validUntil || '—'}</strong>
        </div>
        <div className="tocfact">
          <span>{isEn ? 'Golden Bauhinia age' : '金紫荊年齡條件'}</span>
          <strong>{gb.halfPastTen ? (isEn ? 'Met' : '已符合 10.5 歲') : isEn ? 'Not yet 10.5' : '未滿十歲半'}</strong>
        </div>
      </Grid>

      <div className="toclist">
        {TOC_GROUPS.map((group) => (
          <section key={group.title} className="tocgroup">
            <h3>
              {isEn ? group.en : group.title}
              {!isEn && <em>{group.en}</em>}
            </h3>
            {group.ids.map((id) => {
              const s = meta(id);
              if (!s.id) return null;
              return (
                <Link key={id} to={`/p/${id}`} className="tocrow">
                  <span className="tocrow__no">{s.page === '—' ? (isEn ? 'App.' : '附錄') : s.page}</span>
                  <span className="tocrow__title">
                    {isEn ? s.en : s.label}
                    {!isEn && s.en && <em>{s.en}</em>}
                  </span>
                  <Icon name="chevron" size={12} />
                </Link>
              );
            })}
          </section>
        ))}
      </div>

      <Note en="This book is one member's personal record book. Whole-pack progress overviews and batch approvals belong to cubbadge (leader's progress table).">
        本冊只屬一位成員的個人紀錄冊。「全團進度總覽」及「批量簽核」屬幼童軍旅團進度系統
        cubbadge（Akela 團長進度表）的工作，本冊不會收錄其他成員資料。
      </Note>
      <P en="Blank pages are intentional: write only what has been completed and verified. Anything submitted to cubbadge from this book always arrives as “pending leader verification”.">
        留白是刻意的：只記錄已完成並經領袖核實的內容。由本冊送交 cubbadge 的項目，一律以「待領袖核實」狀態送達，
        必須由團長在 cubbadge 按 CONFIRM 方為完成。
      </P>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 1 頁：個人資料 */
export function P01() {
  const [photo, setPhoto] = useField('member.photo', null);
  const { isEn } = useLang();

  return (
    <Page id="p01">
      <H en="PERSONAL PARTICULARS">個人資料</H>

      <div className="ptop">
        <div className="ptop__photo">
          <PhotoPicker value={photo} onChange={setPhoto} />
        </div>
        <div className="ptop__id">
          <Line
            label="童軍成員編號"
            en="Scout ID"
            path="member.scoutId"
            placeholder="0012345678"
            hint={
              isEn
                ? 'Only identifier used for cubbadge sync. Leave everything else blank and you can still log in.'
                : '與 cubbadge 同步只認這個編號；其他資料全部留白亦可登入同步。'
            }
          />
          <Line label="姓名（中文）" en="Name (Chinese)" path="member.nameZh" placeholder="陳小狼" />
          <Line label="姓名（英文）" en="Name (English)" path="member.nameEn" placeholder="CHAN Siu-long" />
        </div>
      </div>

      <Grid cols={3}>
        <Line label="性別" en="Gender" path="member.gender" placeholder="M / F" />
        <Line label="出生日期" en="Date of Birth" type="date" path="member.dob" />
        <Line label="就讀年級" en="Primary Level" path="member.primaryLevel" placeholder="小四" />
      </Grid>

      <Grid cols={2}>
        <Line label="學校" en="School" path="member.school" placeholder="學校名稱" />
        <Line label="宗教" en="Religion" path="member.religion" placeholder="（如有）" />
      </Grid>

      <details className="formsup">
        <summary>
          {isEn
            ? 'Official form supplement (HKID first 4 characters — optional, only needed when printing PT/68)'
            : '官方表格自動帶入補充欄（身份證首四位 — 選填，只在列印 PT/68 時需要）'}
        </summary>
        <div className="formsup__body">
          <Grid cols={2}>
            <Line
              label="身份證首四位"
              en="HKID First 4"
              path="member.hkidPrefix"
              placeholder="A123"
              transform={sanitizeHkidPrefix}
              hint={isEn ? 'First 4 characters only' : '只填首四位，例如 A123'}
            />
            <Line label="電郵地址" en="Email" path="member.email" placeholder="member@example.org" />
          </Grid>
        </div>
      </details>

      <Sig
        label="持有人簽署"
        en="Signature of Holder"
        path="holderSignature"
        defaultTitle={isEn ? 'Cub Scout' : '幼童軍成員'}
      />

      <Note en="Zero personal data cross-system sync: only the Scout ID, item codes and dates ever leave this device.">
        跨系統同步零個人資料：離開這部裝置的只有 SCOUT ID、項目代號及日期。姓名、電話、地址、家長資料及相片
        不會傳送至 cubbadge。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 2 頁：聯絡及家長／監護人 */
export function P02() {
  const { isEn } = useLang();
  return (
    <Page id="p02">
      <H en="CONTACT & GUARDIAN">聯絡及家長／監護人</H>
      <Grid cols={2}>
        <Line label="聯絡電話" en="Telephone" path="member.phone" placeholder="9123 4567" />
        <Line label="電郵地址" en="Email" path="member.email" placeholder="member@example.org" />
      </Grid>
      <Line label="通訊地址（中文）" en="Address (Chinese)" path="member.addressZh" wide placeholder="香港……" />
      <Line label="通訊地址（英文）" en="Address (English)" path="member.addressEn" wide placeholder="Flat A, 1/F, …" />

      <H en="PARENT / GUARDIAN">家長／監護人</H>
      <Grid cols={3}>
        <Line label="姓名" en="Name" path="member.parentName" placeholder="家長姓名" />
        <Line label="關係" en="Relationship" path="member.parentRelation" placeholder="父／母／監護人" />
        <Line label="聯絡電話" en="Telephone" path="member.parentPhone" placeholder="9123 4567" />
      </Grid>

      <H en="EMERGENCY CONTACT">緊急聯絡人</H>
      <Grid cols={2}>
        <Line label="姓名及關係" en="Name & Relationship" path="member.emergencyName" placeholder="陳大文（父親）" />
        <Line label="聯絡電話" en="Telephone" path="member.emergencyPhone" placeholder="9123 8899" />
      </Grid>
      <Area
        label="健康及敏感事項（如食物敏感、哮喘）"
        en="Health & Sensitivities"
        path="member.allergies"
        rows={3}
        placeholder={isEn ? 'Only what leaders need to keep you safe on activities' : '只填領袖在活動中需要知道的安全事項'}
      />

      <Note en="Contact details stay on this device. They are never part of any cubbadge sync payload.">
        聯絡資料只留在這部裝置，永不屬於任何 cubbadge 同步內容。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 3 頁：旅團資料 */
export function P03() {
  const { isEn } = useLang();
  return (
    <Page id="p03">
      <H en="PACK & GROUP">旅團資料</H>
      <Grid cols={3}>
        <Line label="地域" en="Region" path="member.region" placeholder="新界東地域" />
        <Line label="區" en="District" path="member.district" placeholder="沙田北區" />
        <Line label="旅" en="Group" path="member.group" placeholder="沙田第 12 旅" />
      </Grid>
      <Grid cols={2}>
        <Line label="幼童軍團" en="Cub Pack" path="member.pack" placeholder="沙田第 12 旅幼童軍團" />
        <Line label="主辦機構" en="Sponsoring Authority" path="member.sponsoringAuthority" placeholder="主辦機構名稱" />
      </Grid>
      <Area label="旅部地址／集會地點" en="Group Address / Meeting Place" path="member.groupAddress" rows={2} />

      <H en="LEADERS">領袖</H>
      <Grid cols={2}>
        <Line label="旅長" en="Group Scout Leader (GSL)" path="member.gsl" placeholder="旅長姓名" />
        <Line label="旅長聯絡電話" en="GSL Telephone" path="member.gslPhone" placeholder="9123 4567" />
        <Line label="幼童軍團長" en="Cub Scout Leader (CSL)" path="member.csl" placeholder="團長姓名" />
        <Line label="團長聯絡電話" en="CSL Telephone" path="member.cslPhone" placeholder="9123 4567" />
      </Grid>

      <Grid cols={3}>
        <Line label="入團日期" en="Date Joined Pack" type="date" path="member.dateJoined" />
        <Line label="宣誓日期" en="Investiture Date" type="date" path="member.dateInvestiture" />
        <Line label="加入童軍運動日期" en="Joined Scout Movement" type="date" path="member.dateScoutMovement" />
      </Grid>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 4 頁：童軍紀錄 */
const SCOUTING_ROWS = [
  { key: 'grasshopper', zh: '小童軍', en: 'Grasshopper Scout' },
  { key: 'cub', zh: '幼童軍', en: 'Cub Scout' },
  { key: 'scout', zh: '童軍', en: 'Scout' },
  { key: 'venture', zh: '深資童軍', en: 'Venture Scout' },
  { key: 'rover', zh: '樂行童軍', en: 'Rover Scout' },
];

export function P04() {
  const { book } = useBook();
  const { isEn } = useLang();
  const scouting = book.scouting || {};
  return (
    <Page id="p04">
      <H en="SCOUTING RECORD">童軍紀錄</H>
      <p className="pglead">
        {isEn
          ? 'Keep a simple record of each Section you have belonged to. This page is part of the official photocopy set for PT/67 and PT/68.'
          : '簡單記錄曾參與的支部。此頁屬 PT/67 及 PT/68 要求附上的紀錄冊副本範圍。'}
      </p>
      <div className="pgtable">
        <div className="pgtable__head pgtable__row pgtable__row--6">
          <span>{isEn ? 'Section' : '支部'}</span>
          <span>{isEn ? 'From' : '由'}</span>
          <span>{isEn ? 'To' : '至'}</span>
          <span>{isEn ? 'Unit' : '單位'}</span>
          <span>{isEn ? 'Post' : '職位'}</span>
          <span>{isEn ? 'Award' : '最高獎章'}</span>
        </div>
        {SCOUTING_ROWS.map((row) => {
          const data = scouting[row.key] || {};
          return (
            <div className="pgtable__row pgtable__row--6" key={row.key}>
              <span className="pgtable__cell pgtable__cell--label">
                {isEn ? row.en : row.zh}
                {!isEn && <em>{row.en}</em>}
              </span>
              <span className="pgtable__cell">
                <Line label="由" en="From" type="date" path={`scouting.${row.key}.from`} />
              </span>
              <span className="pgtable__cell">
                <Line label="至" en="To" type="date" path={`scouting.${row.key}.to`} />
              </span>
              <span className="pgtable__cell">
                <Line label="單位" en="Unit" path={`scouting.${row.key}.unit`} />
              </span>
              <span className="pgtable__cell">
                <Line label="職位" en="Post" path={`scouting.${row.key}.post`} />
              </span>
              <span className="pgtable__cell">
                <Line label="最高獎章" en="Award" path={`scouting.${row.key}.award`} />
              </span>
              {data.note ? null : null}
            </div>
          );
        })}
      </div>

      <H en="SCOUTING MILESTONES">童軍里程碑</H>
      <Area
        label="值得記下的事"
        en="Milestones worth remembering"
        path="pages.p04.milestones"
        rows={4}
        placeholder={isEn ? 'Camps, hikes, service, pack events…' : '露營、遠足、服務、團集會……'}
      />
    </Page>
  );
}

/* ------------------------------------------------------------ 第 5 頁：轉旅・遷移・更改 */
export function P05() {
  const { isEn } = useLang();
  return (
    <Page id="p05">
      <H en="TRANSFER OF GROUP">轉旅</H>
      <Rows
        path="transfers"
        min={3}
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date', width: 1 },
          { k: 'fromGroup', label: '原屬旅／團', en: 'From', width: 2 },
          { k: 'toGroup', label: '新屬旅／團', en: 'To', width: 2 },
          { k: 'note', label: '備註', en: 'Remarks', width: 2 },
        ]}
      />

      <H en="CHANGE OF ADDRESS">遷移地址</H>
      <Rows
        path="addressChanges"
        min={2}
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date', width: 1 },
          { k: 'addressZh', label: '新地址（中文）', en: 'New Address (Chinese)', width: 3 },
          { k: 'addressEn', label: '新地址（英文）', en: 'New Address (English)', width: 3 },
        ]}
      />

      <H en="CHANGE OF PARTICULARS">更改個人摘要</H>
      <Rows
        path="detailChanges"
        min={2}
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date', width: 1 },
          { k: 'item', label: '更改項目', en: 'Item Changed', width: 2 },
          { k: 'detail', label: '新資料', en: 'New Detail', width: 4 },
        ]}
      />
      <Note en="A transfer or address change is personal data: it stays in this book and is never sent to cubbadge.">
        轉旅及地址更改屬個人資料，只留在本冊，永不送往 cubbadge。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 6 頁：會員資格續期 */
export function P06() {
  const { isEn } = useLang();
  return (
    <Page id="p06">
      <H en="RENEWAL OF MEMBERSHIP">會員資格續期</H>
      <p className="pglead">
        {isEn
          ? 'One row per membership year. Ask your Cub Scout Leader to sign and stamp each year.'
          : '每一個會員年度一行，由幼童軍團長簽署及蓋旅印。'}
      </p>
      <Rows
        path="renewals"
        min={5}
        cols={[
          { k: 'date', label: '續期日期', en: 'Date', type: 'date', width: 1 },
          { k: 'validUntil', label: '有效期至', en: 'Valid Until', type: 'date', width: 1 },
          { k: 'memberNo', label: '會員編號', en: 'Membership No.', width: 2 },
          { k: 'leaderName', label: '團長簽署', en: 'Leader', width: 2 },
          { k: 'note', label: '備註', en: 'Remarks', width: 2 },
        ]}
      />
      <div className="stamprow">
        <SealMark text={isEn ? 'Pack Stamp' : '旅印'} sub="PACK" />
        <SealMark text={isEn ? 'Leader Signature' : '團長簽署'} sub="CSL" />
      </div>
      <Note en="Membership renewal is personal data and is never part of a cubbadge progress sync.">
        會員資格續期屬個人資料，不屬於 cubbadge 進度同步範圍。
      </Note>
    </Page>
  );
}

/* ------------------------------------------------------------ 第 7 頁：服務及獎勵紀錄 */
export function P07() {
  const { isEn } = useLang();
  return (
    <Page id="p07">
      <H en="SERVICE RECORD">服務紀錄</H>
      <Rows
        path="service"
        min={5}
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date', width: 1 },
          { k: 'activity', label: '服務／活動', en: 'Service / Activity', width: 4 },
          { k: 'hours', label: '時數', en: 'Hours', width: 1 },
          { k: 'role', label: '角色', en: 'Role', width: 2 },
          { k: 'ref', label: '負責人／證明', en: 'Reference', width: 2 },
        ]}
      />

      <H en="AWARDS & HONOURS">獎章及獎勵紀錄</H>
      <Rows
        path="awardsLog"
        min={4}
        cols={[
          { k: 'date', label: '日期', en: 'Date', type: 'date', width: 1 },
          { k: 'award', label: '獎章／獎勵', en: 'Award', width: 3 },
          { k: 'certNo', label: '證書編號', en: 'Certificate No.', width: 2 },
          { k: 'presentedBy', label: '頒發人', en: 'Presented By', width: 2 },
        ]}
      />
      <P en="Activity badges are recorded on pages 13–14; this page is for service hours and other honours such as the District Commissioner's Commendation.">
        活動徽章記錄於第 13–14 頁；本頁記錄服務時數，以及其他嘉許（例如區總監嘉許）。
      </P>
    </Page>
  );
}
