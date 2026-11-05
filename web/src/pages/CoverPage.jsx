import React from 'react';
import { allStats, GOLD_AWARD } from '@shared/book.js';
import { Crest, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { LegalLine } from '../components/Legal.jsx';

/**
 * 全螢幕幼童軍布面燙金封面（對齊 ROVERBOOK v16 CoverPage）：
 * 整個螢幕就是紀錄冊封面；深森林綠布面 × 幼童軍金黃燙印，避免黃底白字的對比度陷阱。
 */
export default function CoverPage({ book, onOpen, last, onContinue, onLeader, onParent }) {
  const { isEn } = useLang();
  const m = book?.member || {};
  const stats = allStats(book);

  const hint = !m.nameZh && !m.nameEn
    ? isEn
      ? 'Step 1: write your name on page 1 — or leave it blank and sync with your Scout ID'
      : '第一步：在第 1 頁寫上名字；或全部留白，直接用 SCOUT ID 同步'
    : isEn
      ? `${stats.done} / ${stats.total} items · Next: ${stats.nextAward?.award?.en || 'All completed'}`
      : `已完成 ${stats.done} / ${stats.total} 項 · 下一步：${
          stats.nextAward?.award?.name || '全部完成，等領袖簽署'
        }`;

  const medals = [
    { id: 'L1', label: isEn ? 'Membership Badge' : '會員章', short: isEn ? 'MB' : '會', earned: Boolean(book?.pages?.award_L1?.date) || stats.awards[0]?.complete },
    { id: 'L2', label: isEn ? 'C.S. Experience Badge' : '幼童軍體驗章', short: isEn ? 'EX' : '體', earned: Boolean(book?.pages?.award_L2?.date) || stats.awards[1]?.complete },
    { id: 'L3', label: isEn ? 'C.S. Adventure Award' : '幼童軍歷奇章', short: isEn ? 'AD' : '歷', earned: Boolean(book?.pages?.award_L3?.date) || stats.awards[2]?.complete },
    { id: 'L4', label: isEn ? 'C.S. Adventure Crest Award' : '幼童軍高級歷奇章', short: isEn ? 'AC' : '高', earned: Boolean(book?.pages?.award_L4?.date) || stats.awards[3]?.complete },
    { id: 'OT-GB', label: isEn ? 'Golden Bauhinia' : '金紫荊', short: isEn ? 'GB' : '紫', earned: Boolean(book?.pages?.award_OT_GB?.date) || stats.awards[4]?.complete },
  ];

  return (
    <div className="coverart">
      <div className="coverart__grain" aria-hidden="true" />
      <span className="coverart__frame coverart__frame--outer" aria-hidden="true" />
      <span className="coverart__frame coverart__frame--inner" aria-hidden="true" />
      <span className="coverart__spine" aria-hidden="true" />

      <div className="coverart__top">
        <Crest size={58} />
        <div>
          <strong>{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</strong>
        </div>
      </div>

      <div className="coverart__center">
        {isEn ? (
          <>
            <span className="coverart__kicker">CUB SCOUT SECTION</span>
            <h1 className="coverart__title coverart__title--en">CUB SCOUT</h1>
            <h2 className="coverart__subtitle">RECORD BOOK</h2>
          </>
        ) : (
          <>
            <span className="coverart__kicker">CUB SCOUT</span>
            <h1 className="coverart__title">幼童軍</h1>
            <h2 className="coverart__subtitle">紀　錄　冊</h2>
          </>
        )}
      </div>

      <div className="coverart__plate">
        <span className="coverart__plate-label">{isEn ? 'HOLDER' : '持有人'}</span>
        <strong>{(isEn ? m.nameEn || m.nameZh : m.nameZh || m.nameEn) || (isEn ? 'Your Name' : '你的名字')}</strong>
        <span className="coverart__plate-sub">
          {[m.pack, m.group].filter(Boolean).join(' · ') || (isEn ? 'Cub Scout Pack' : '幼童軍團')}
        </span>
        {m.scoutId && <span className="coverart__plate-no">No. {m.scoutId}</span>}
        {hint && <span className="coverart__hint">{hint}</span>}
        <div className="coverart__badges">
          {medals.map((b) => (
            <span
              key={b.id}
              className={cx('coverart__medal', b.earned && 'is-earned')}
              title={`${b.label}${b.earned ? (isEn ? ' · Earned' : ' · 已完成') : isEn ? ' · In progress' : ' · 進行中'}`}
            >
              {b.short}
            </span>
          ))}
        </div>
      </div>

      <div className="coverart__foot">
        <span className="coverart__year">{new Date().getFullYear()}</span>
        <div className="coverart__ctas">
          <div className="coverart__ctarow">
            <button type="button" className="coverart__open" onClick={onOpen}>
              {isEn ? 'Open the record book' : '打開紀錄冊'}
            </button>
            {onLeader && (
              <button type="button" className="coverart__leader" onClick={onLeader}>
                {isEn ? 'Leader mode' : '領袖模式'}
              </button>
            )}
            {onParent && (
              <button type="button" className="coverart__parent" onClick={onParent}>
                {isEn ? 'Parent view' : '家長查看'}
              </button>
            )}
          </div>
          {last && (
            <button type="button" className="coverart__resume" onClick={onContinue}>
              {isEn ? `Continue · page ${last.page}` : `繼續上次 · 第 ${last.page} 頁`}{' '}
              <span>{isEn ? last.en || last.label : last.label}</span>
            </button>
          )}
        </div>
        <span className="coverart__edition">{isEn ? '2026 Scheme · 10th Edition' : '2026 綱要 · 第十版'}</span>
      </div>

      <LegalLine className="coverart__legal" />
      <span className="coverart__awardnote" aria-hidden="true">
        {isEn ? GOLD_AWARD.en : GOLD_AWARD.legacyZh}
      </span>
    </div>
  );
}
