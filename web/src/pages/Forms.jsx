import React, { useEffect, useState } from 'react';
import {
  FORM_META,
  FORM_ORDER,
  PRINT_CHECKLIST,
  PT67_CHECKLIST,
  PT68_CHECKLIST,
  buildFormValues,
  formReadiness,
  itemRowsForAward,
} from '@shared/forms.js';
import { GOLD_AWARD, OTHER_BADGES, goldenBauhiniaEligibility, levelSummary } from '@shared/book.js';
import { useBook } from '../bookContext.js';
import Write from '../components/Write.jsx';
import { Icon, cx } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';

function usePrintPreview() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-print-preview', on);
    return () => document.documentElement.removeAttribute('data-print-preview');
  }, [on]);
  return [on, () => setOn((v) => !v)];
}

function useFormEditor(formId) {
  const { book, update } = useBook();
  const values = buildFormValues(book, formId);
  const set = (key, val) => {
    update((b) => ({
      ...b,
      forms: { ...(b.forms || {}), [formId]: { ...(b.forms?.[formId] || {}), [key]: val } },
    }));
  };
  return [values, set];
}

function FCell({ label, en, k, values, set, type = 'text', span = 1, placeholder = '' }) {
  const { isEn } = useLang();
  return (
    <div className={cx('ptcell', `ptcell--s${span}`)}>
      <span className="ptcell__lbl">
        {isEn && en ? en : label}
        {!isEn && en && <em>{en}</em>}
      </span>
      <div className="ptcell__val">
        <Write value={values[k] || ''} onChange={(v) => set(k, v)} type={type} compact placeholder={placeholder} label={label} />
      </div>
    </div>
  );
}

function FormHead({ meta, values }) {
  const { isEn } = useLang();
  return (
    <div className="pthead">
      <div>
        <strong>{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</strong>
        <h1>{isEn ? meta.en : meta.title}</h1>
        <p>{isEn ? meta.title : meta.en}</p>
      </div>
      <div className="pthead__right">
        <span className="pthead__code">{meta.code}</span>
        <span className="ptphoto">
          {values.photo ? <img src={values.photo} alt="" /> : isEn ? 'PHOTO' : '近照'}
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children, en }) {
  const { isEn } = useLang();
  return (
    <h2 className="ptsec">
      {isEn && en ? en : children}
      {!isEn && en && <em> {en}</em>}
    </h2>
  );
}

function SignatureLine({ label, en, sig }) {
  const { isEn } = useLang();
  return (
    <div className="ptsignbox">
      <span className="ptcell__lbl">
        {isEn && en ? en : label}
        {!isEn && en && <em>{en}</em>}
      </span>
      <div className="ptsignbox__ink">
        {sig?.png ? <img src={sig.png} alt={label} /> : <span className="ptblank" />}
      </div>
      {sig?.name && <small>{sig.name}</small>}
    </div>
  );
}

function GoldItemTable({ rows, showCert = false }) {
  const { isEn } = useLang();
  return (
    <table className="pttable">
      <thead>
        <tr>
          <th style={{ width: '48%' }}>{isEn ? 'Item' : '考驗項目'}</th>
          <th style={{ width: '18%' }}>{isEn ? 'Date completed' : '完成日期'}</th>
          {showCert && <th style={{ width: '18%' }}>{isEn ? 'Certificate' : '證書編號'}</th>}
          <th>{isEn ? 'Assessor' : '考驗員'}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>
              {row.name}
              <small className="pttable__code"> {row.badgeId}</small>
            </td>
            <td>{row.date || ''}</td>
            {showCert && <td>{row.cert || ''}</td>}
            <td>{row.assessor || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ============================================================
   表格總覽頁 (/forms)
   ============================================================ */

export function FormsIndex() {
  const { book } = useBook();
  const { isEn } = useLang();

  return (
    <div className="formsindex">
      <div className="formsindex__head">
        <div>
          <span className="eyebrow">OFFICIAL FORMS · AUTO-FILLED</span>
          <h1>{isEn ? 'Cub Scout Forms & Print Checklist' : '幼童軍申請表及列印檢查清單'}</h1>
          <p>
            {isEn
              ? 'Personal particulars, Scout ID, HKID first 4 characters, Golden Bauhinia item dates and the applicant signature are auto-filled from your record book. Tap any box to fine-tune before A4 printing.'
              : '個人摘要、SCOUT ID、身份證首四位、金紫荊考驗項目日期及申請人簽名均由紀錄冊自動帶入；列印前仍可點擊任何格線微調。'}
          </p>
        </div>
        <div className="formsindex__btns">
          <Link to="/p/contents" className="btn btn--ghost btn--sm">
            <Icon name="back" size={14} /> {isEn ? 'Back to Book' : '返回紀錄冊'}
          </Link>
          <Link to="/forms/all" className="btn btn--gold btn--sm">
            <Icon name="print" size={14} /> {isEn ? 'Open All Forms' : '一次過預覽全部表格'}
          </Link>
        </div>
      </div>

      <div className="formcards">
        {FORM_ORDER.map((id) => {
          const meta = FORM_META[id];
          const check = formReadiness(book, id);
          return (
            <article key={id} className={cx('formcard', !meta.official && 'formcard--unofficial')}>
              <div className="formcard__top">
                <span className="formcard__code">{meta.code}</span>
                <span className={cx('formcard__status', check.ready && 'is-ready')}>
                  {check.ready
                    ? isEn
                      ? 'Ready to Print'
                      : '資料齊備'
                    : isEn
                      ? `${check.missing.length} fields pending`
                      : `尚有 ${check.missing.length} 項待填`}
                </span>
              </div>
              <h2>{isEn ? meta.en : meta.title}</h2>
              <p className="formcard__when">{meta.when}</p>
              <p className="tiny">{isEn && meta.noteEn ? meta.noteEn : meta.note}</p>
              {!check.ready && (
                <p className="formcard__missing">
                  <strong>{isEn ? 'Pending: ' : '待補填：'}</strong>
                  {check.missing.join('、')}
                </p>
              )}
              <div className="formcard__actions">
                <Link to={`/forms/${id}`} className="btn btn--primary btn--sm">
                  <Icon name="file" size={14} />{' '}
                  {isEn ? `Open ${meta.short} (${meta.pages}p)` : `開啟 ${meta.short}（共 ${meta.pages} 頁）`}
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      <section className="checklistcard">
        <h2>{isEn ? 'A4 Print Checklist & Paper Page Mapping' : 'A4 列印檢查清單及紙本頁碼對照'}</h2>
        <div className="checklistgrid">
          {PRINT_CHECKLIST.map((group) => (
            <article key={group.title}>
              <h3>{group.title}</h3>
              <p className="tiny">
                {group.paper} → {isEn ? 'digital pages' : '電子頁'} {group.digital}
              </p>
              <ul>
                {group.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   PT/67 金紫荊獎章開展通知書
   ============================================================ */

function FormPT67() {
  const { book } = useBook();
  const { isEn } = useLang();
  const [v, set] = useFormEditor('pt67');
  const gb = goldenBauhiniaEligibility(book);
  const rows = itemRowsForAward(book, GOLD_AWARD);

  return (
    <article className="a4sheet ptform">
      <FormHead meta={FORM_META.pt67} values={v} />

      <SectionTitle en="(1) Personal Particulars">（1）個人資料</SectionTitle>
      <div className="ptgrid">
        <FCell label="姓名（中文）" en="Name (Chinese)" k="nameZh" values={v} set={set} span={2} />
        <FCell label="姓名（英文）" en="Name (English)" k="nameEn" values={v} set={set} span={2} />
        <FCell label="出生日期" en="Date of Birth" k="dob" values={v} set={set} type="date" />
        <FCell label="年齡" en="Age" k="age" values={v} set={set} />
        <FCell label="就讀年級" en="Primary Level" k="primaryLevel" values={v} set={set} />
        <FCell label="性別" en="Gender" k="gender" values={v} set={set} />
        <FCell label="童軍成員編號" en="Scout ID" k="scoutId" values={v} set={set} span={2} />
        <FCell label="旅／團" en="Group / Pack" k="group" values={v} set={set} span={2} />
        <FCell label="區" en="District" k="district" values={v} set={set} span={2} />
        <FCell label="地域" en="Region" k="region" values={v} set={set} span={2} />
        <FCell label="聯絡電話" en="Contact No." k="phone" values={v} set={set} span={2} />
        <FCell label="電郵地址" en="E-mail" k="email" values={v} set={set} span={2} />
      </div>

      <SectionTitle en="(2) Assessment Plan">（2）考驗計劃</SectionTitle>
      <div className="ptgrid">
        <FCell label="預計開展日期" en="Planned Start" k="planStartDate" values={v} set={set} type="date" span={2} />
        <FCell label="預計完成日期" en="Planned Completion" k="planFinishDate" values={v} set={set} type="date" span={2} />
        <div className="ptcell ptcell--s4">
          <span className="ptcell__lbl">
            {isEn ? 'Planned items (A: core areas, B: interest areas)' : '計劃考驗項目（甲：核心範疇；乙：興趣範疇）'}
          </span>
          <div className="ptcell__val">
            <Write value={v.plannedItems || ''} onChange={(x) => set('plannedItems', x)} multiline rows={4} label="計劃項目" />
          </div>
        </div>
      </div>
      <p className="ptnotes">
        {isEn
          ? 'Eligibility: at least 9 years 6 months old and the Cub Scout Adventure Award completed.'
          : '參加資格：年滿九歲半或以上，並已完成幼童軍歷奇章。'}
      </p>
      <p className={cx('ptnotes', gb.halfPastTen ? 'is-ok' : '')}>
        {isEn
          ? `Recorded age: ${gb.age || '—'} · Golden Bauhinia must be completed at or after 10 years 6 months.`
          : `紀錄年齡：${gb.age || '—'} 歲 · 金紫荊獎章須於年滿十歲半或以後完成。`}
      </p>

      <SectionTitle en="(3) Confirmation and Approval">（3）確認及批核</SectionTitle>
      <div className="ptsignrow">
        <SignatureLine label="申請者簽署" en="Applicant's Signature" sig={v.holderSignature} />
        <div className="ptsignbox">
          <FCell label="日期" en="Date" k="applicantDate" values={v} set={set} type="date" />
        </div>
        <div className="ptsignbox">
          <FCell label="旅長／團長姓名" en="GSL / CSL Name" k="csl" values={v} set={set} />
          <FCell label="日期" en="Date" k="cslDate" values={v} set={set} type="date" />
          <span className="ptendorse__stamp">{isEn ? 'Group / Pack Stamp' : '旅／團印'}</span>
        </div>
        <div className="ptsignbox">
          <FCell label="區總監批核" en="District Commissioner" k="dcName" values={v} set={set} />
          <FCell label="日期" en="Date" k="dcDate" values={v} set={set} type="date" />
          <span className="ptendorse__stamp">{isEn ? 'District Stamp' : '區印'}</span>
        </div>
      </div>

      <div className="ptfollow">
        <strong>{isEn ? 'Documents to attach (PT/67):' : '遞交時須附上（PT/67）：'}</strong>
        <ul>
          {PT67_CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

/* ============================================================
   PT/68 金紫荊獎章及證書申請表
   ============================================================ */

function FormPT68() {
  const { book } = useBook();
  const { isEn } = useLang();
  const [v, set] = useFormEditor('pt68');
  const rows = itemRowsForAward(book, GOLD_AWARD);
  const gb = goldenBauhiniaEligibility(book);

  return (
    <>
      <article className="a4sheet ptform">
        <FormHead meta={FORM_META.pt68} values={v} />

        <SectionTitle en="(1) Personal Particulars">（1）個人資料</SectionTitle>
        <div className="ptgrid">
          <FCell label="姓名（中文）" en="Name (Chinese)" k="nameZh" values={v} set={set} span={2} />
          <FCell label="姓名（英文）" en="Name (English)" k="nameEn" values={v} set={set} span={2} />
          <FCell label="出生日期" en="Date of Birth" k="dob" values={v} set={set} type="date" />
          <FCell label="年齡" en="Age" k="age" values={v} set={set} />
          <FCell label="就讀年級" en="Primary Level" k="primaryLevel" values={v} set={set} />
          <FCell label="性別" en="Gender" k="gender" values={v} set={set} />
          <FCell label="身份證／護照首四位" en="HKID / Passport (first 4)" k="hkidPrefix" values={v} set={set} span={2} />
          <FCell label="童軍成員編號" en="Scout ID" k="scoutId" values={v} set={set} span={2} />
          <FCell label="旅／團" en="Group / Pack" k="group" values={v} set={set} span={2} />
          <FCell label="區" en="District" k="district" values={v} set={set} span={2} />
          <FCell label="地域" en="Region" k="region" values={v} set={set} span={2} />
          <FCell label="郵寄地址（中文）" en="Mailing Address (Chinese)" k="addressZh" values={v} set={set} span={4} />
          <FCell label="郵寄地址（英文）" en="Mailing Address (English)" k="addressEn" values={v} set={set} span={4} />
          <FCell label="家長／監護人" en="Parent / Guardian" k="parentName" values={v} set={set} span={2} />
          <FCell label="聯絡電話" en="Contact No." k="parentPhone" values={v} set={set} span={2} />
        </div>

        <SectionTitle en="(2) Items Completed">（2）完成之項目</SectionTitle>
        <div className="ptgrid">
          <FCell label="考獲高級歷奇章日期" en="Adventure Crest Award Date" k="l4Date" values={v} set={set} type="date" span={2} />
          <FCell label="證書號碼" en="Certificate No." k="l4CertNo" values={v} set={set} span={2} />
          <FCell label="露營日期" en="Camp Dates" k="campDates" values={v} set={set} span={2} />
          <FCell label="服務日期" en="Service Dates" k="serviceDates" values={v} set={set} span={2} />
          <FCell label="領導才能日期" en="Leadership Dates" k="leadershipDates" values={v} set={set} span={4} />
        </div>
        <GoldItemTable rows={rows} showCert />
        <table className="pttable pttable--chk">
          <thead>
            <tr>
              <th>{isEn ? 'Interest badges (two different areas)' : '興趣範疇活動徽章（兩個不同類別）'}</th>
              <th style={{ width: '16%' }}>{isEn ? 'Date' : '日期'}</th>
              <th style={{ width: '20%' }}>{isEn ? 'Certificate' : '證書編號'}</th>
            </tr>
          </thead>
          <tbody>
            {v.interestRows
              .filter((b) => b.date)
              .map((b) => (
                <tr key={b.id}>
                  <td>
                    {isEn ? b.en : b.name} <small className="pttable__code">{b.badgeId}</small>
                  </td>
                  <td>{b.date}</td>
                  <td>{b.cert || ''}</td>
                </tr>
              ))}
            {v.interestRows.filter((b) => b.date).length === 0 && (
              <tr>
                <td colSpan={3} className="tiny">
                  {isEn ? 'No activity badges recorded yet.' : '尚未記錄活動徽章。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <p className="ptnotes">
          {isEn
            ? 'Candidates must be between 10.5 and 12, or complete before finishing primary school. Documentary proof from the school is required when the Cub Scout is over 12.'
            : '所有考獲金紫荊獎章之幼童軍必須在十歲半至十二歲，或在完成小學階段前之期限內；超過十二歲必須提交學校證明文件。'}
        </p>
        <p className={cx('ptnotes', gb.halfPastTen ? 'is-ok' : '')}>
          {isEn ? `Recorded age: ${gb.age || '—'}` : `紀錄年齡：${gb.age || '—'} 歲`}
        </p>
      </article>

      <article className="a4sheet ptform">
        <div className="pthead">
          <div>
            <strong>{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</strong>
            <h1>{isEn ? 'Confirmation, Nomination & Approval' : '確認、提名及批核'}</h1>
            <p>FORM PT/68 (06/2024) · {isEn ? 'page 2' : '第 2 頁'}</p>
          </div>
          <span className="pthead__code">PT/68 · p.2</span>
        </div>

        <SectionTitle en="(3) Confirmation and Approval">（3）確認及批核</SectionTitle>
        <div className="ptendorse">
          <div className="ptendorse__box">
            <strong>{isEn ? 'Applicant' : '申請者簽署'}</strong>
            <p className="tiny">
              {isEn
                ? 'I declare that the above information is correct to my fullest understanding.'
                : '現證明上述資料正確無誤。'}
            </p>
            <SignatureLine label="簽署" en="Signature" sig={v.holderSignature} />
            <FCell label="日期" en="Date" k="applicantDate" values={v} set={set} type="date" />
          </div>
          <div className="ptendorse__box">
            <strong>{isEn ? 'Nomination — GSL / CSL' : '提名 — 旅長／團長'}</strong>
            <p className="tiny">
              {isEn
                ? 'I certify the information is correct and nominate the Cub Scout for the Golden Bauhinia Award.'
                : '現證明上述資料正確無誤，並提名該幼童軍獲取金紫荊獎章。'}
            </p>
            <FCell label="姓名" en="Name" k="nominationName" values={v} set={set} />
            <FCell label="日期" en="Date" k="nominationDate" values={v} set={set} type="date" />
            <span className="ptendorse__stamp">{isEn ? 'Group / Pack Stamp' : '旅／團印'}</span>
          </div>
          <div className="ptendorse__box">
            <strong>{isEn ? 'Recommendation — District Commissioner' : '推薦 — 區總監'}</strong>
            <p className="tiny">
              {isEn ? 'Recommended for the award.' : '現推薦頒發獎章。'}
            </p>
            <FCell label="姓名" en="Name" k="recommendationName" values={v} set={set} />
            <FCell label="日期" en="Date" k="recommendationDate" values={v} set={set} type="date" />
            <span className="ptendorse__stamp">{isEn ? 'District Stamp' : '區印'}</span>
          </div>
          <div className="ptendorse__box">
            <strong>{isEn ? 'Approval — Regional Commissioner' : '批核 — 地域總監'}</strong>
            <p className="tiny">
              {isEn ? 'The award is approved.' : '現批准該幼童軍獲金紫荊獎章。'}
            </p>
            <FCell label="姓名" en="Name" k="approvalName" values={v} set={set} />
            <FCell label="日期" en="Date" k="approvalDate" values={v} set={set} type="date" />
            <span className="ptendorse__stamp">{isEn ? 'Regional Stamp' : '地域印'}</span>
          </div>
          <div className="ptendorse__box ptendorse__box--office">
            <strong>{isEn ? 'For Regional Office Use' : '地域辦事處專用'}</strong>
            <div className="ptgrid">
              <FCell label="收表日期" en="Received Date" k="receivedDate" values={v} set={set} type="date" span={2} />
              <FCell label="證書號碼" en="Cert. No." k="goldenCertNo" values={v} set={set} span={2} />
              <FCell label="證書發出日期" en="Cert. Issue Date" k="certIssueDate" values={v} set={set} type="date" span={2} />
              <FCell label="獎章發出日期" en="Award Date" k="awardDate" values={v} set={set} type="date" span={2} />
              <FCell label="備註" en="Remarks" k="remarks" values={v} set={set} span={4} />
            </div>
          </div>
        </div>

        <div className="ptfollow">
          <strong>{isEn ? 'Documents to attach (PT/68):' : '遞交時須附上（PT/68）：'}</strong>
          <ul>
            {PT68_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <p className="ptnotes">
          {isEn
            ? 'Applications are accepted all year; submit to the Regional Office by 31 August to be considered for the same year’s Association Rally.'
            : '全年接受申請；每年 8 月 31 日或以前交抵地域辦事處，方獲安排於同年香港童軍大會操中接受嘉許。'}
        </p>
      </article>
    </>
  );
}

/* ============================================================
   2026 新制金紫荊資料核對清單（非官方）
   ============================================================ */

function FormGbac() {
  const { book } = useBook();
  const { isEn } = useLang();
  const [v, set] = useFormEditor('gbac');
  const rows = itemRowsForAward(book, GOLD_AWARD);
  const gb = goldenBauhiniaEligibility(book);
  const interest = OTHER_BADGES.filter((b) => book.otherBadges?.[b.id]?.date);

  return (
    <article className="a4sheet ptform ptform--unofficial">
      <div className="pthead">
        <div>
          <strong>{isEn ? 'UNOFFICIAL DATA CHECKLIST — NOT AN OFFICIAL FORM' : '非官方資料核對清單 — 不是官方表格'}</strong>
          <h1>{isEn ? '2026 Scheme Golden Bauhinia Award Checklist' : '2026 新制金紫荊獎章資料核對清單'}</h1>
          <p>
            {isEn
              ? 'For checking your own book with your leader. No official form number is invented and no signature boxes are simulated.'
              : '只供與領袖核對自己紀錄冊資料。不虛構官方表格編號，亦不模擬官方簽署欄。'}
          </p>
        </div>
        <div className="pthead__right">
          <span className="pthead__code">{isEn ? 'PT/XX — ask your District' : 'PT/XX — 請向所屬童軍區確認'}</span>
        </div>
      </div>

      <div className="ptgrid">
        <FCell label="姓名" en="Name" k="nameZh" values={v} set={set} span={2} />
        <FCell label="童軍成員編號" en="Scout ID" k="scoutId" values={v} set={set} span={2} />
        <FCell label="年齡" en="Age" k="age" values={v} set={set} span={2} />
        <FCell label="就讀年級" en="Primary Level" k="primaryLevel" values={v} set={set} span={2} />
      </div>

      <SectionTitle en="Core items (4.1.1 – 4.4.2)">核心項目（4.1.1 – 4.4.2）</SectionTitle>
      <GoldItemTable rows={rows} />

      <SectionTitle en="Interest area badges">興趣範疇活動徽章</SectionTitle>
      <table className="pttable">
        <thead>
          <tr>
            <th>{isEn ? 'Badge' : '活動徽章'}</th>
            <th>{isEn ? 'Area' : '類別'}</th>
            <th style={{ width: '18%' }}>{isEn ? 'Date' : '日期'}</th>
          </tr>
        </thead>
        <tbody>
          {interest.map((b) => (
            <tr key={b.id}>
              <td>
                {isEn ? b.en : b.name} <small className="pttable__code">{b.badgeId}</small>
              </td>
              <td>{isEn ? b.categoryNameEn : b.categoryName}</td>
              <td>
                {book.otherBadges[b.id].levels
                  ? levelSummary(book.otherBadges[b.id], isEn ? 'en' : 'zh')
                  : book.otherBadges[b.id].date}
              </td>
            </tr>
          ))}
          {interest.length === 0 && (
            <tr>
              <td colSpan={3} className="tiny">
                {isEn ? 'No activity badges recorded yet.' : '尚未記錄活動徽章。'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className={cx('ptnotes', gb.halfPastTen ? 'is-ok' : '')}>
        <strong>{isEn ? 'Age & schooling condition: ' : '年齡及學籍條件：'}</strong>
        {isEn
          ? 'The final item must be completed at or after 10 years 6 months; candidates over 12 who are still in primary school must provide school proof.'
          : '最後一項必須於年滿十歲半或以後完成；超過十二歲仍就讀小學須提交學校證明文件。'}
      </div>
      <p className="ptnotes">
        {isEn
          ? 'Official form numbers for the 2026 scheme have not yet been published in the Association’s form index. Confirm the current form with your District before submission.'
          : '2026 新制的官方表格編號尚未在總會表格目錄公布；遞交前請向所屬童軍區確認現行表格。'}
      </p>
    </article>
  );
}

export function FormDoc({ id }) {
  const { isEn } = useLang();
  const [preview, togglePreview] = usePrintPreview();
  const meta = FORM_META[id];
  if (!meta) return <FormsIndex />;

  return (
    <div className="formdoc">
      <div className="formdoc__bar no-print">
        <Link to="/forms" className="btn btn--ghost btn--sm">
          <Icon name="back" size={14} /> {isEn ? 'All Forms' : '全部表格'}
        </Link>
        <div className="formdoc__tabs">
          {FORM_ORDER.map((fid) => (
            <Link key={fid} to={`/forms/${fid}`} className={cx('formtab', fid === id && 'is-on')}>
              {isEn && FORM_META[fid].shortEn ? FORM_META[fid].shortEn : FORM_META[fid].short}
            </Link>
          ))}
        </div>
        <div className="formdoc__acts">
          <button type="button" className={cx('btn btn--ghost btn--sm', preview && 'is-on')} onClick={togglePreview}>
            {preview ? (isEn ? 'Resume Editing' : '返回填寫') : isEn ? 'Print Preview' : '預覽列印效果'}
          </button>
          <button type="button" className="btn btn--gold btn--sm" onClick={() => window.print()}>
            <Icon name="print" size={14} /> {isEn ? 'Print A4' : 'A4 列印／存 PDF'}
          </button>
        </div>
      </div>

      <p className="formdoc__hint no-print">
        <Icon name="info" size={14} /> <span>{isEn && meta.noteEn ? meta.noteEn : meta.note}</span>
      </p>

      {id === 'pt67' ? <FormPT67 /> : id === 'pt68' ? <FormPT68 /> : <FormGbac />}
    </div>
  );
}

export function FormsAll() {
  const { isEn } = useLang();
  const [preview, togglePreview] = usePrintPreview();
  return (
    <div className="formdoc">
      <div className="formdoc__bar no-print">
        <Link to="/forms" className="btn btn--ghost btn--sm">
          <Icon name="back" size={14} /> {isEn ? 'Back' : '返回表格總覽'}
        </Link>
        <strong>{isEn ? 'All Forms (4 A4 pages)' : '全部表格（共 4 頁 A4）'}</strong>
        <div className="formdoc__acts">
          <button type="button" className={cx('btn btn--ghost btn--sm', preview && 'is-on')} onClick={togglePreview}>
            {preview ? (isEn ? 'Resume Editing' : '返回填寫') : isEn ? 'Print Preview' : '預覽列印效果'}
          </button>
          <button type="button" className="btn btn--gold btn--sm" onClick={() => window.print()}>
            <Icon name="print" size={14} /> {isEn ? 'Print All' : '一次過列印'}
          </button>
        </div>
      </div>
      <FormPT67 />
      <FormPT68 />
      <FormGbac />
    </div>
  );
}
