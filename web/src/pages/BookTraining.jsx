import React from 'react';
import { BADGE_SYLLABUS, GOLD_AWARD, badgeStats, goldenBauhiniaEligibility, ageFromDob } from '@shared/book.js';
import { useBook } from '../bookContext.js';
import { H, Note, P, Page } from '../components/Form.jsx';
import AwardBlock, { AwardPresentation } from '../components/AwardBlock.jsx';
import { Icon, cx } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';

const byId = Object.fromEntries(BADGE_SYLLABUS.map((b) => [b.id, b]));

function ProgressRibbon({ stats }) {
  const { isEn } = useLang();
  return (
    <div className={cx('ribbon', stats.complete && 'is-complete')}>
      <span className="ribbon__bar">
        <i style={{ width: `${stats.percent}%` }} />
      </span>
      <span className="ribbon__text">
        {stats.done} / {stats.total} {isEn ? 'items' : '項'}
        {stats.complete ? (isEn ? ' · completed' : ' · 已完成') : ''}
      </span>
    </div>
  );
}

function AwardIntro({ award }) {
  const { isEn } = useLang();
  return (
    <>
      <p className="pglead">
        {isEn ? award.en : award.name}
        {!isEn && award.legacyZh && award.legacyZh !== award.name && (
          <em>
            {' '}
            · 紙本名稱：{award.legacyZh}
          </em>
        )}
      </p>
      {award.purpose && <P en={isEn ? '' : ''}>{award.purpose}</P>}
      {award.description && award.description !== award.purpose && <Note>{award.description}</Note>}
    </>
  );
}

function MarkerLegend() {
  const { isEn } = useLang();
  return (
    <p className="marklegend">
      <span>
        <b>*</b> {isEn ? 'Required foundation content for members joining mid-stage' : '中途加入幼童軍的必修基礎課程'}
      </span>
      <span>
        <b>#</b> {isEn ? 'May be exempted under the Grasshopper Scout Badge rule' : '符合「小草蜢章」條件者可按綱要豁免指定內容'}
      </span>
    </p>
  );
}

function SyncFootnote() {
  const { isEn } = useLang();
  return (
    <p className="syncfoot no-print">
      <Icon name="verified" size={13} />
      <span>
        {isEn
          ? 'Items marked “cubbadge · verified” came from your leader’s confirmed records. New entries stay local until you submit them — they arrive at cubbadge as pending and need the leader’s CONFIRM.'
          : '標示「cubbadge · 已核實」的項目來自團長在 cubbadge 已核實的紀錄。新填寫的項目只留在本機；送交後在 cubbadge 只會是「待批」，須由團長按 CONFIRM。'}
      </span>
      <Link to="/p/appendix" className="syncfoot__link">
        {isEn ? 'Sync' : '同步'}
      </Link>
    </p>
  );
}

/* ------------------------------------------------------------ 第 8 頁：會員章 */
export function P08() {
  const { book } = useBook();
  const { isEn } = useLang();
  const award = byId.L1;
  const stats = badgeStats(book, 'L1');
  return (
    <Page id="p08" dense>
      <H en="MEMBERSHIP BADGE" progress={award.segments.flatMap((s) => s.items.map((i) => i.id))}>
        會員章
      </H>
      <AwardIntro award={award} />
      <ProgressRibbon stats={stats} />
      <AwardBlock award={award} />
      <MarkerLegend />
      <AwardPresentation awardId="L1" title="會員章頒發" en="Award of Membership Badge" />
      <Note en="The Membership Badge is awarded after investiture. Safe from Harm content (item i) must be completed — it is not optional.">
        會員章於宣誓後頒發。「保護童軍成員免受傷害」（第 i 項）為必修內容，不可省略。
      </Note>
      <SyncFootnote />
    </Page>
  );
}

/* ------------------------------------------------------------ 第 9 頁：銅箭章（體驗章） */
export function P09() {
  const { book } = useBook();
  const { isEn } = useLang();
  const award = byId.L2;
  const stats = badgeStats(book, 'L2');
  return (
    <Page id="p09" dense>
      <H en="BRONZE ARROW · CUB SCOUT EXPERIENCE BADGE" progress={award.segments.flatMap((s) => s.items.map((i) => i.id))}>
        銅箭章
      </H>
      <AwardIntro award={award} />
      <ProgressRibbon stats={stats} />
      <AwardBlock award={award} />
      <MarkerLegend />
      <AwardPresentation awardId="L2" title="銅箭章頒發" en="Award of Bronze Arrow" />
      <Note en="2026 scheme name: Cub Scout Experience Badge. Members who already hold the Grasshopper Scout Badge receive this badge on completing the Membership Badge, per the official scheme.">
        2026 新制名稱：幼童軍體驗章。已持有小童軍「小草蜢章」者，按綱要於完成會員章後可直接獲頒此章。
      </Note>
      <SyncFootnote />
    </Page>
  );
}

/* ------------------------------------------------------------ 第 10 頁：銀箭章（歷奇章） */
export function P10() {
  const { book } = useBook();
  const { isEn } = useLang();
  const award = byId.L3;
  const stats = badgeStats(book, 'L3');
  return (
    <Page id="p10" dense>
      <H en="SILVER ARROW · CUB SCOUT ADVENTURE BADGE" progress={award.segments.flatMap((s) => s.items.map((i) => i.id))}>
        銀箭章
      </H>
      <AwardIntro award={award} />
      <ProgressRibbon stats={stats} />
      <AwardBlock award={award} />
      <MarkerLegend />
      <AwardPresentation awardId="L3" title="銀箭章頒發" en="Award of Silver Arrow" />
      <Note en="Interest requirement: two different areas, one listed activity badge each. Record the badges on pages 13–14; they are counted here automatically.">
        興趣範疇要求：兩個不同類別、各一個指定活動徽章。於第 13–14 頁記錄後會自動計入。
      </Note>
      <SyncFootnote />
    </Page>
  );
}

/* ------------------------------------------------------------ 第 11 頁：金箭章（高級歷奇章） */
export function P11() {
  const { book } = useBook();
  const { isEn } = useLang();
  const award = byId.L4;
  const stats = badgeStats(book, 'L4');
  return (
    <Page id="p11" dense>
      <H en="GOLD ARROW · CUB SCOUT ADVANCED ADVENTURE BADGE" progress={award.segments.flatMap((s) => s.items.map((i) => i.id))}>
        金箭章
      </H>
      <AwardIntro award={award} />
      <ProgressRibbon stats={stats} />
      <AwardBlock award={award} />
      <MarkerLegend />
      <AwardPresentation awardId="L4" title="金箭章頒發" en="Award of Gold Arrow" />
      <Note en="Badges already used for the Silver Arrow may not be reused for the interest requirement (a higher level of a three-level badge may be). The Scout Link Badge exempts part d of item 4.4.1 only.">
        已用於銀箭章的興趣徽章不得重複（三級制徽章可用更高級別）。童軍先修章只豁免第 4.4.1 項的 d 部分。
      </Note>
      <SyncFootnote />
    </Page>
  );
}

/* ------------------------------------------------------------ 第 12 頁：金紫荊獎章 */
export function P12() {
  const { book } = useBook();
  const { isEn } = useLang();
  const stats = badgeStats(book, 'OT-GB');
  const gb = goldenBauhiniaEligibility(book);
  const age = ageFromDob(book?.member?.dob);
  return (
    <Page id="p12" dense>
      <H en="GOLDEN BAUHINIA AWARD" progress={GOLD_AWARD.segments.flatMap((s) => s.items.map((i) => i.id))}>
        金紫荊獎章
      </H>
      <AwardIntro award={GOLD_AWARD} />
      <ProgressRibbon stats={stats} />
      <div className={cx('agebox', gb.halfPastTen && 'is-ok')}>
        <Icon name={gb.halfPastTen ? 'check' : 'alert'} size={14} />
        <span>
          {isEn
            ? `Age ${age || '—'} · completion must be at or after 10 years 6 months.`
            : `年齡 ${age || '—'} 歲 · 完成最後一項時必須年滿十歲半。`}
        </span>
      </div>
      <AwardBlock award={GOLD_AWARD} />
      <AwardPresentation awardId="OT_GB" title="金紫荊獎章頒發" en="Award of Golden Bauhinia Award" />
      <Note en="Record the award date only after the District Commissioner's recommendation and Regional approval. The official PT/67 and PT/68 forms live under Forms.">
        頒發日期請待區總監推薦及地域總監批核後才填寫。官方 PT/67 及 PT/68 表格在「申請表」頁。
      </Note>
      <div className="pgbtns no-print">
        <Link to="/forms/pt67" className="btn btn--ghost btn--sm">
          <Icon name="file" size={13} /> PT/67 {isEn ? 'Start notice' : '開展通知書'}
        </Link>
        <Link to="/forms/pt68" className="btn btn--ghost btn--sm">
          <Icon name="file" size={13} /> PT/68 {isEn ? 'Application' : '申請表'}
        </Link>
        <Link to="/forms/gbac" className="btn btn--ghost btn--sm">
          <Icon name="file" size={13} /> {isEn ? '2026 checklist' : '2026 核對清單'}
        </Link>
      </div>
      <SyncFootnote />
    </Page>
  );
}
