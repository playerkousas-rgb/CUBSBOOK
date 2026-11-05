import React, { useMemo, useRef, useState } from 'react';
import {
  APP_VERSION,
  ALL_AWARDS,
  OTHER_BADGES,
  PRINT_PAGES,
  allStats,
  badgeStats,
  demoBook,
  newBook,
  today,
  toBadgeId,
} from '@shared/book.js';
import { useBook, useReadOnly } from '../bookContext.js';
import { Grid, H, Line, Note, P, Page, Rows } from '../components/Form.jsx';
import CubBadgeSyncCard from '../components/CubBadgeSyncCard.jsx';
import Write from '../components/Write.jsx';
import { download, slugify } from '../bookStore.js';
import { compressBookMedia, imageSizeLabel, storageUsage } from '../storageHealth.js';
import { Icon, SealMark, cx, useToast } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';
import { LegalNote } from '../components/Legal.jsx';
import { AwardPresentation } from '../components/AwardBlock.jsx';
import { SignModal } from '../components/Ink.jsx';

/* ============================================================
   活動徽章表（OT-A01…OT-A42，共 49 個可獨立記錄類型）
   ============================================================ */

const BADGE_CATEGORY_SETS = {
  p13: ['SCOUT_SKILLS', 'CARING'],
  p14: ['CREATIVE', 'COUNTRY', 'SCIENCE', 'SPORTS', 'OTHER'],
};

export function ActivityBadgeTable({ page }) {
  const { book, update, readOnly } = useBook();
  const { isEn } = useLang();
  const [query, setQuery] = useState('');
  const categories = BADGE_CATEGORY_SETS[page] || [];
  const [sign, setSign] = useState(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .map((cat) => ({
        cat,
        badges: OTHER_BADGES.filter(
          (b) =>
            b.category === cat &&
            (!q ||
              b.name.toLowerCase().includes(q) ||
              b.en.toLowerCase().includes(q) ||
              b.badgeId.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.badges.length);
  }, [categories.join(','), query]);

  const setBadge = (id, patch) => {
    if (readOnly) return;
    update((b) => ({
      ...b,
      otherBadges: {
        ...(b.otherBadges || {}),
        [id]: { ...(b.otherBadges?.[id] || {}), ...patch },
      },
    }));
  };

  const recorded = OTHER_BADGES.filter((b) => book.otherBadges?.[b.id]?.date).length;

  return (
    <div className="otwrap">
      <div className="otwrap__bar no-print">
        <span className="otwrap__count">
          {isEn ? `${recorded} activity badges recorded` : `已記錄 ${recorded} 個活動徽章`}
        </span>
        <label className="otwrap__search">
          <Icon name="zoom" size={13} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={isEn ? 'Search badge or catalogue no.' : '搜尋徽章或目錄編號'}
            aria-label={isEn ? 'Search activity badges' : '搜尋活動徽章'}
          />
        </label>
      </div>

      {groups.map((group) => (
        <section key={group.cat} className="otgroup">
          <h3>
            {isEn ? group.badges[0].categoryNameEn : group.badges[0].categoryName}
            {!isEn && group.badges[0].categoryNameEn && <em>{group.badges[0].categoryNameEn}</em>}
          </h3>
          <div className="otlist">
            {group.badges.map((badge) => {
              const entry = book.otherBadges?.[badge.id] || {};
              return (
                <div className={cx('otrow', entry.date && 'is-done')} key={badge.id}>
                  <div className="otrow__name">
                    <strong>
                      {isEn ? badge.en : badge.name}
                      {badge.catalogueNo && <sup className="otrow__no">{badge.catalogueNo}</sup>}
                    </strong>
                    <em>{isEn ? badge.name : badge.en}</em>
                    <span className="otrow__id">{badge.badgeId}</span>
                    {entry.confirmedByBadge && (
                      <span className="assrow__verified">
                        <Icon name="verified" size={10} /> cubadge
                      </span>
                    )}
                  </div>
                  <div className="otrow__date">
                    <Write
                      value={entry.date || ''}
                      onChange={(v) => setBadge(badge.id, { date: v })}
                      type="date"
                      compact
                      label={`${badge.name} 日期`}
                    />
                  </div>
                  <div className="otrow__cert">
                    <Write
                      value={entry.cert || ''}
                      onChange={(v) => setBadge(badge.id, { cert: v })}
                      compact
                      placeholder={isEn ? 'Cert. no.' : '證書編號'}
                      label={`${badge.name} 證書編號`}
                    />
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      className="otrow__sig no-print"
                      onClick={() => setSign(badge)}
                      title={isEn ? 'Leader signature' : '領袖簽署'}
                    >
                      {entry.signature?.png ? (
                        <img src={entry.signature.png} alt="簽名" />
                      ) : (
                        <Icon name="pen" size={12} />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <SignModal
        open={Boolean(sign)}
        onClose={() => setSign(null)}
        title={sign ? `${isEn ? 'Badge sign-off' : '徽章簽核'} · ${isEn ? sign.en : sign.name}` : ''}
        defaultName={sign ? book.otherBadges?.[sign.id]?.signature?.name || book.member?.csl || '' : ''}
        defaultTitle={isEn ? 'Cub Scout Leader' : '幼童軍團長'}
        onSave={(sig) => {
          if (sign) {
            setBadge(sign.id, {
              signature: sig,
              date: book.otherBadges?.[sign.id]?.date || sig.at || today(),
            });
          }
          setSign(null);
        }}
      />
    </div>
  );
}

export function P13() {
  const { isEn } = useLang();
  return (
    <Page id="p13" dense>
      <H en="ACTIVITY BADGES (1) — SCOUTCRAFT & CARING">活動徽章（一）</H>
      <p className="pglead">
        {isEn
          ? 'One completion record per badge: award date and certificate number. Activity badges are not broken into invented sub-items.'
          : '每個徽章只記錄一項完成紀錄：取得日期及證書編號。活動徽章不會被虛構拆成逐項細項。'}
      </p>
      <ActivityBadgeTable page="p13" />
      <Note en="Activity badges count towards the Silver Arrow, Gold Arrow and Golden Bauhinia interest requirements where the official list allows.">
        活動徽章會按官方指定清單，自動計入銀箭章、金箭章及金紫荊獎章的興趣範疇要求。
      </Note>
    </Page>
  );
}

export function P14() {
  const { isEn } = useLang();
  return (
    <Page id="p14" dense>
      <H en="ACTIVITY BADGES (2) — CREATIVE, COMMUNITY, SCIENCE & SPORTS">活動徽章（二）</H>
      <p className="pglead">
        {isEn
          ? 'The official catalogue has 42 numbered entries; three-level badges are recorded as separate types, giving 49 recordable activity badges in total.'
          : '官方目錄共 42 個編號項目；三級制徽章按級別分開記錄，因此共有 49 個可獨立記錄的活動徽章類型。'}
      </p>
      <ActivityBadgeTable page="p14" />
    </Page>
  );
}

/* ============================================================
   第 15 頁：宣誓及頒發紀錄
   ============================================================ */

export function P15() {
  const { isEn } = useLang();
  return (
    <Page id="p15">
      <H en="INVESTITURE & AWARD PRESENTATION">宣誓及頒發紀錄</H>
      <Grid cols={3}>
        <Line label="宣誓日期" en="Investiture Date" type="date" path="pages.p15.investitureDate" />
        <Line label="頒發會員章日期" en="Membership Badge Date" type="date" path="pages.p15.membershipDate" />
        <Line label="宣誓時團長" en="Leader at Investiture" path="pages.p15.investingLeader" />
      </Grid>
      <div className="stamprow">
        <SealMark text={isEn ? 'Pack Stamp' : '旅團印'} sub="PACK" />
        <SealMark text={isEn ? 'Leader Signature' : '團長簽署'} sub="CSL" />
      </div>

      <H en="AWARD PRESENTATION">獎章頒發</H>
      <AwardPresentation awardId="L1" title="會員章" en="Membership Badge" />
      <AwardPresentation awardId="L2" title="銅箭章（體驗章）" en="Bronze Arrow" />
      <AwardPresentation awardId="L3" title="銀箭章（歷奇章）" en="Silver Arrow" />
      <AwardPresentation awardId="L4" title="金箭章（高級歷奇章）" en="Gold Arrow" />
      <AwardPresentation awardId="OT_GB" title="金紫荊獎章" en="Golden Bauhinia Award" />
    </Page>
  );
}

/* ============================================================
   第 16 頁：幼童軍誓詞與規律
   ============================================================ */

const PROMISE_ZH = ['我願盡所能；', '對神明，對國家，盡責任；', '對別人，要幫助；', '對規律，必遵行。'];
const LAW_ZH = ['幼童軍，盡所能，', '先顧別人才顧己，', '日行一善富精神。'];
const PROMISE_EN =
  'I promise that I will do my best to do my duty to God and to my Country, to help other people and to keep the Cub Scout Law.';
const LAW_EN = 'Cub Scouts always do their best, think of others before themselves and do a good turn every day.';

export function P16() {
  const { isEn } = useLang();
  return (
    <Page id="p16">
      <H en="CUB SCOUT PROMISE & LAW">幼童軍誓詞與規律</H>
      <div className="promisebox">
        <span className="promisebox__label">{isEn ? 'CUB SCOUT PROMISE' : '幼童軍誓詞'}</span>
        {isEn ? (
          <p className="promisebox__text">{PROMISE_EN}</p>
        ) : (
          PROMISE_ZH.map((line) => (
            <p className="promisebox__line" key={line}>
              {line}
            </p>
          ))
        )}
      </div>
      <div className="promisebox">
        <span className="promisebox__label">{isEn ? 'CUB SCOUT LAW' : '幼童軍規律'}</span>
        {isEn ? (
          <p className="promisebox__text">{LAW_EN}</p>
        ) : (
          LAW_ZH.map((line) => (
            <p className="promisebox__line" key={line}>
              {line}
            </p>
          ))
        )}
      </div>
      <div className="promisebox promisebox--motto">
        <span className="promisebox__label">{isEn ? 'CUB SCOUT MOTTO' : '幼童軍銘言'}</span>
        <p className="promisebox__text">{isEn ? 'Do a Good Turn Every Day' : '日行一善'}</p>
      </div>
      <Note en="Text follows the Scout Association of Hong Kong “Policy, Organisation and Rules” 1.2.2. The English text is the Association's English version.">
        誓詞及規律依香港童軍總會《政策、組織及規條》1.2.2；英文為總會英文版本。
      </Note>
      <Grid cols={2}>
        <Line label="我對誓詞的體會" en="My reflection on the Promise" path="pages.p16.promiseNote" rows={2} />
        <Line label="本年度日行一善紀錄" en="Good turns this year" path="pages.p16.goodTurns" rows={2} />
      </Grid>
      <div className="signrowline">
        <span>{isEn ? 'Cub Scout signature' : '幼童軍簽署'}</span>
        <span className="signrowline__hint">{isEn ? 'See page 1 holder signature' : '見第 1 頁持有人簽署'}</span>
      </div>
    </Page>
  );
}

/* ============================================================
   第 17 頁：制服及徽章位置
   ============================================================ */

const UNIFORM_ITEMS = [
  { zh: '幼童軍帽（總會指定款式）', en: 'Cub Scout cap (Association pattern)' },
  { zh: '幼童軍旅巾及旅巾圈', en: 'Group scarf and woggle' },
  { zh: '幼童軍制服上衣（短袖）', en: 'Cub Scout uniform shirt (short sleeves)' },
  { zh: '總會指定長褲／短褲及皮帶', en: 'Association pattern trousers/shorts and belt' },
  { zh: '深色襪及皮鞋', en: 'Dark socks and leather shoes' },
  { zh: '會員章、進度性獎章及活動徽章', en: 'Membership badge, progress badges and activity badges' },
];

export function P17() {
  const { isEn } = useLang();
  return (
    <Page id="p17">
      <H en="UNIFORM & BADGE PLACEMENT">制服及徽章位置</H>
      <p className="pglead">
        {isEn
          ? 'Tick what you already have. Always check the Association’s current uniform guidance before sewing on badges.'
          : '剔選已齊備的項目。縫上徽章前，請先核對總會最新的制服及佩戴指引。'}
      </p>
      <ul className="checklist">
        {UNIFORM_ITEMS.map((item) => (
          <li key={item.zh}>
            <span className="checklist__box" aria-hidden="true" />
            <span>
              {isEn ? item.en : item.zh}
              {!isEn && <em>{item.en}</em>}
            </span>
          </li>
        ))}
      </ul>
      <Note en="Badge positions (2026 scheme): Membership Badge on the left chest; progress badges on the right chest in the order awarded; activity badges on the right sleeve. New and old activity badges may be worn side by side; only the current scheme badges count for progress.">
        徽章位置（2026 新制）：會員章佩戴於左胸；進度性獎章按取得次序佩戴於右胸；活動徽章佩戴於右袖。
        新舊活動徽章可並列佩戴，但只有現行綱要徽章計入進度。
      </Note>
      <Line label="制服最後檢查日期" en="Last uniform check" type="date" path="pages.p17.lastCheck" />
      <Line label="檢查領袖" en="Checked by" path="pages.p17.checkedBy" />
    </Page>
  );
}

/* ============================================================
   第 18 頁：進度總覽
   ============================================================ */

export function P18() {
  const { book } = useBook();
  const { isEn } = useLang();
  const stats = allStats(book);
  return (
    <Page id="p18">
      <H en="PROGRESS SUMMARY">進度總覽</H>
      <p className="pglead">
        {isEn
          ? 'A one-page overview of your own book. Whole-pack figures belong to cubbadge.'
          : '只屬你個人紀錄冊的單頁總覽。全團數字屬 cubbadge。'}
      </p>
      {ALL_AWARDS.map((award) => {
        const s = badgeStats(book, award.id);
        return (
          <div className="sumrow" key={award.id}>
            <span className="sumrow__name">
              {isEn ? award.en : award.name}
              {!isEn && <em>{award.en}</em>}
            </span>
            <span className="sumrow__bar">
              <i style={{ width: `${s.percent}%` }} />
            </span>
            <span className={cx('sumrow__state', s.complete && 'is-ok')}>
              {s.complete ? (isEn ? 'Completed' : '已完成') : `${s.done}/${s.total}`}
            </span>
          </div>
        );
      })}
      <div className="sumgrid">
        <div>
          <span>{isEn ? 'Activity badges' : '活動徽章'}</span>
          <strong>{stats.activityBadges}</strong>
        </div>
        <div>
          <span>{isEn ? 'Awards earned' : '已獲獎章'}</span>
          <strong>{stats.earned} / {ALL_AWARDS.length}</strong>
        </div>
        <div>
          <span>{isEn ? 'Syllabus items' : '綱要細項'}</span>
          <strong>
            {stats.done} / {stats.total}
          </strong>
        </div>
      </div>
      <Line label="下一步" en="Next step" path="pages.p18.nextStep" wide placeholder={isEn ? 'What I will work on next' : '下一項想完成的內容'} />
      <Line label="團長備註" en="Leader's remarks" path="pages.p18.leaderNote" rows={2} wide />
      <Note en="Dates shown here are exactly what appears on the award pages; nothing is recalculated from cubbadge beyond leader-verified dates.">
        此頁日期直接來自各獎章頁；除團長已核實的日期外，不會另行推算或補寫。
      </Note>
    </Page>
  );
}

/* ============================================================
   第 19 頁：使用說明
   ============================================================ */

export function P19() {
  const { isEn } = useLang();
  return (
    <Page id="p19">
      <H en="HOW TO USE THIS RECORD BOOK">使用說明</H>
      <ol className="howto">
        <li>
          {isEn
            ? 'Tap any dotted line to type. Long text shrinks automatically; tap ⤢ (or the pen) to write by hand or enlarge.'
            : '點一下任何小圓點即可打字；字多會自動縮小。按筆或放大圖示可手寫或放大輸入。'}
        </li>
        <li>
          {isEn
            ? 'Only record what has actually been completed and checked. Blank lines are intended.'
            : '只記錄真正完成並已核對的內容；留白是刻意的。'}
        </li>
        <li>
          {isEn
            ? 'Everything stays on this device. Use the Digital Appendix to back up, compress photos and sync progress with cubbadge.'
            : '所有內容只留在這部裝置。請用數位附錄備份、壓縮相片，並與 cubbadge 同步進度。'}
        </li>
        <li>
          {isEn
            ? 'To show your book to a leader in person: tap “Show QR”, choose only the sections you want, and let the leader scan it in Leader Mode.'
            : '當面給領袖看：按「出示 QR」，只剔選你想出示的組別，由領袖在領袖模式掃描。'}
        </li>
        <li>
          {isEn
            ? 'Blank book? You can log in to cubbadge with just your Scout ID and password — no personal particulars needed. Fill them in later only when printing official forms.'
            : '空白簿亦可只輸入 SCOUT ID 及 cubbadge 密碼登入同步；個人資料留待日後列印官方表格時才填寫。'}
        </li>
      </ol>
      <Note en="Copyright and disclaimer appear in exactly three places: the cover, this appendix and the About menu — never on every page.">
        版權及免責聲明只出現於三處：封面底部、數位附錄及選單「關於」，不會每頁重複。
      </Note>
      <P en="Official paper record book: page 1–3 personal particulars, page 5 scouting record, page 10–13 Membership/Bronze/Silver, page 12–15 Gold Arrow/Golden Bauhinia. Use the print checklist for photocopy sets.">
        紙本《幼童軍紀錄冊》：第 1–3 頁個人摘要、第 5 頁童軍記錄、第 10–13 頁會員章／銅箭章／銀箭章、第 12–15 頁金箭章／金紫荊獎章。
        遞交申請時請用「列印檢查清單」核对所需副本。
      </P>
      <div className="pgbtns no-print">
        <Link to="/forms" className="btn btn--ghost btn--sm">
          <Icon name="file" size={13} /> {isEn ? 'Forms & print checklist' : '申請表及列印檢查清單'}
        </Link>
        <Link to="/p/appendix" className="btn btn--ghost btn--sm">
          <Icon name="lock" size={13} /> {isEn ? 'Digital appendix' : '數位附錄'}
        </Link>
      </div>
    </Page>
  );
}

/* ============================================================
   數位附錄
   ============================================================ */

export function AppendixPage() {
  const { book, replace } = useBook();
  const readOnly = useReadOnly();
  const { push } = useToast();
  const { isEn } = useLang();
  const backupInput = useRef(null);
  const [shrinking, setShrinking] = useState(false);

  const usage = storageUsage(book);
  const pct = Math.max(1, Math.round(usage.ratio * 100));

  const onRestoreFull = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        if (!parsed || typeof parsed !== 'object' || !parsed.member) {
          throw new Error(
            isEn
              ? 'This is not a full CUBBOOK backup (progress files are imported in the sync card above).'
              : '這不是完整的 CUBBOOK 備份檔（cubadge 進度檔請用上方同步卡）',
          );
        }
        replace(newBook(parsed));
        push(isEn ? 'Full record book restored' : '已成功還原完整紀錄冊備份');
      } catch (err) {
        push(err.message || (isEn ? 'Could not read backup' : '讀取備份失敗'), 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Page id="appendix">
      <H en="DIGITAL APPENDIX · SYNC, BACKUP & PRINT">數位附錄</H>

      <CubBadgeSyncCard readOnly={readOnly} />

      <section className="appxcard">
        <h3>
          <Icon name="lock" size={16} /> {isEn ? 'Full Device Backup & Phone Transfer' : '完整紀錄冊備份與換機轉移'}
        </h3>
        <p className="tiny">
          {isEn
            ? 'One JSON file with every page, photo, handwriting and signature. Keep it somewhere safe.'
            : '連同全部頁面文字、近照、手寫墨跡及簽名打包成單一 JSON 檔案，請自行保存。'}
        </p>
        <div className="appxbtns">
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => {
              download(`cubbook-backup-${slugify(book.member?.nameZh || book.member?.scoutId)}-${today()}.json`, book);
              push(isEn ? 'Full backup downloaded' : '已下載完整紀錄冊備份 JSON');
            }}
          >
            <Icon name="download" size={14} /> {isEn ? 'Export Full Backup' : '匯出完整備份 JSON'}
          </button>
          <input ref={backupInput} type="file" accept="application/json,.json" hidden onChange={onRestoreFull} />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => backupInput.current?.click()}>
            <Icon name="upload" size={14} /> {isEn ? 'Restore Backup' : '還原備份 JSON'}
          </button>
        </div>
      </section>

      <section className="appxcard">
        <h3>
          <Icon name="image" size={16} /> {isEn ? 'Local Storage Health' : '本機儲存健康檢查'}
        </h3>
        <div className="qrmeter">
          <span className={cx('qrmeter__bar', usage.ratio > 0.8 && 'is-over')}>
            <i style={{ width: `${pct}%` }} />
          </span>
          <span className="tiny">
            {usage.kb} KB / 5,120 KB ({pct}%) · {usage.images.length} {isEn ? 'images / ink' : '張相片或墨跡'}
          </span>
        </div>
        {usage.images.length > 0 && (
          <ul className="imglist">
            {usage.images.slice(0, 5).map((img) => (
              <li key={img.path}>
                <span>{img.label}</span>
                <b>{imageSizeLabel(img.chars)}</b>
              </li>
            ))}
          </ul>
        )}
        <div className="appxbtns">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={shrinking || usage.images.length === 0}
            onClick={async () => {
              setShrinking(true);
              try {
                const { book: next, savedKB } = await compressBookMedia(book);
                replace(next);
                push(
                  savedKB > 0
                    ? isEn
                      ? `Compressed, ${savedKB} KB freed`
                      : `已壓縮並釋放 ${savedKB} KB`
                    : isEn
                      ? 'Everything is already optimised'
                      : '所有圖片與墨跡已是最佳大小',
                );
              } finally {
                setShrinking(false);
              }
            }}
          >
            {shrinking
              ? isEn
                ? 'Compressing…'
                : '壓縮中…'
              : isEn
                ? 'Compress Photos & Ink'
                : '一鍵壓縮相片與手寫墨跡'}
          </button>
        </div>
      </section>

      <section className="appxcard">
        <h3>
          <Icon name="print" size={16} /> {isEn ? 'Print the Whole Book (A4)' : '整本 A4 列印'}
        </h3>
        <p className="tiny">
          {isEn 
            ? 'A4 portrait, 8 mm margins. Empty-field dots are hidden when printing.'
            : 'A4 直向、8mm 邊界；列印時會自動隱藏空白欄的小圓點。'}
        </p>
        <div className="appxbtns">
          <Link to="/print" className="btn btn--gold btn--sm">
            <Icon name="print" size={14} /> {isEn ? 'Open Print View' : '開啟列印預覽'}
          </Link>
          <Link to="/forms" className="btn btn--ghost btn--sm">
            <Icon name="file" size={14} /> {isEn ? 'Forms & checklist' : '申請表及列印檢查清單'}
          </Link>
        </div>
      </section>

      <section className="appxcard">
        <h3>
          <Icon name="info" size={16} /> {isEn ? 'Sample Data & Reset' : '示範資料與重設'} ({APP_VERSION})
        </h3>
        <div className="appxbtns">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (window.confirm(isEn ? 'Load sample data? Current unsaved content is replaced.' : '確定載入示範紀錄冊？目前未匯出的內容會被取代。')) {
                replace(demoBook());
                push(isEn ? 'Sample book loaded' : '已載入示範紀錄冊');
              }
            }}
          >
            {isEn ? 'Load Sample Book' : '載入示範紀錄冊'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (window.confirm(isEn ? 'Clear all local data and start a blank book?' : '確定清空本機紀錄冊並重新建立空白冊？請先確認已匯出備份。')) {
                replace(newBook());
                push(isEn ? 'Reset to a blank book' : '已重設為空白紀錄冊');
              }
            }}
          >
            {isEn ? 'Reset to Blank Book' : '清空重設為空白冊'}
          </button>
        </div>
      </section>

      <LegalNote />
    </Page>
  );
}

/* ============================================================
   整本 A4 列印模式 (/print)
   ============================================================ */

export function PrintBook({ pages }) {
  const { isEn } = useLang();
  return (
    <div className="printall">
      <div className="printall__bar no-print">
        <Link to="/p/p01" className="btn btn--ghost btn--sm">
          <Icon name="back" size={14} /> {isEn ? 'Back to Book' : '返回紀錄冊'}
        </Link>
        <span>
          {isEn
            ? `All ${PRINT_PAGES.length} pages (A4 portrait)`
            : `整本《幼童軍紀錄冊》共 ${PRINT_PAGES.length} 頁列印預覽`}
        </span>
        <button type="button" className="btn btn--gold btn--sm" onClick={() => window.print()}>
          <Icon name="print" size={14} /> {isEn ? 'Print / Save PDF' : '列印／存成 PDF'}
        </button>
      </div>
      {PRINT_PAGES.map((sec) => {
        const Comp = pages[sec.id];
        if (!Comp) return null;
        return (
          <div key={sec.id} className="printall__one">
            <Comp />
          </div>
        );
      })}
    </div>
  );
}
