import React from 'react';
import { ALL_AWARDS, allStats, badgeStats, ITEM_INDEX, latestRenewal, membershipStatus } from '@shared/book.js';
import { useBook } from '../bookContext.js';
import { Icon, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { navigate } from '../router.jsx';
import { UNIFORM_ITEMS } from './BookBack.jsx';

/**
 * 家長模式（只讀儀表板）
 * ------------------------------------------------------------------
 * 一部裝置、一本紀錄冊：孩子填寫，家長只讀查看。
 * 此頁不設任何輸入欄位，亦不會寫入書本資料；家長毋須填寫個人資料。
 */
export default function ParentView({ onShowQr, onExit }) {
  const { book } = useBook();
  const { isEn } = useLang();
  const m = book?.member || {};
  const stats = allStats(book);
  const membership = membershipStatus(book);
  const renewal = latestRenewal(book);
  const synced = book?.meta?.parent || null;
  const uniform = book?.pages?.p17?.uniform || {};
  const uniformDone = UNIFORM_ITEMS.filter((i) => uniform[i.key]).length;

  const recent = Object.entries(book?.progress || {})
    .filter(([id, entry]) => entry?.date && ITEM_INDEX[id])
    .map(([id, entry]) => ({
      id,
      date: entry.date,
      name: isEn ? ITEM_INDEX[id].en || ITEM_INDEX[id].name : ITEM_INDEX[id].name,
      group: ITEM_INDEX[id].badgeIdGroup,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
    .slice(0, 8);

  const name = (isEn ? m.nameEn || m.nameZh : m.nameZh || m.nameEn) || (isEn ? 'Unnamed member' : '未填姓名');
  const troop = [m.pack, m.group, m.unit].filter(Boolean).join(' · ') || (isEn ? 'Cub Scout Pack' : '幼童軍團');
  const idText = m.scoutId || m.memberNo || '—';

  const earnedAwards = stats.awards.filter(
    (a) => a.complete || Boolean(book?.pages?.[`award_${a.award.id}`]?.date),
  );

  return (
    <div className="parent">
      <div className="parent__hero">
        <span className="parent__eyebrow">
          <Icon name="lock" size={12} /> {isEn ? 'PARENT MODE · READ-ONLY' : '家長模式 · 只讀'}
        </span>
        <h1 className="parent__name">{name}</h1>
        <p className="parent__meta">
          {troop}
          <span className="parent__dot">·</span>
          {isEn ? `Scout ID ${idText}` : `童軍編號 ${idText}`}
        </p>
        <p className="parent__note">
          {isEn
            ? 'You are viewing your child’s record book on your own phone, in read-only mode. Progress came from cubbadge (or their QR) and nothing here can be edited or sent back.'
            : '你正在自己的手機以只讀方式查看孩子的紀錄冊。進度由 cubbadge（或孩子的二維碼）匯出，這裡不能修改，亦不會回傳任何內容。'}
        </p>
        <p className="parent__source">
          {synced
            ? isEn
              ? `Source: ${synced.source === 'qr' ? 'child’s QR' : 'cubbadge export'} · ${synced.imported ?? 0} items · updated ${new Date(synced.syncedAt).toLocaleString('en-HK')}`
              : `來源：${synced.source === 'qr' ? '孩子二維碼' : 'cubbadge 匯出'} · ${synced.imported ?? 0} 項 · 更新於 ${new Date(synced.syncedAt).toLocaleString('zh-HK')}`
            : isEn
              ? 'No sync record yet — export again from cubbadge or scan your child’s QR.'
              : '尚未有同步紀錄——請由 cubbadge 重新匯出，或掃描孩子的二維碼。'}
        </p>
        <div className="parent__actions">
          <button type="button" className="btn btn--gold btn--sm" onClick={() => navigate('/p/p18')}>
            <Icon name="book" size={14} /> {isEn ? 'Open the book' : '翻開紀錄冊'}
          </button>
          <button type="button" className="btn btn--gold btn--sm" onClick={() => navigate('/parent/connect')}>
            <Icon name="download" size={14} /> {isEn ? 'Update from cubbadge / QR' : '由 cubbadge／QR 更新'}
          </button>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/print')}>
            <Icon name="print" size={14} /> {isEn ? 'Print / Save PDF' : '列印／存 PDF'}
          </button>
          {onShowQr && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onShowQr}>
              <Icon name="qr" size={14} /> {isEn ? 'Show QR' : '出示 QR'}
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={onExit || (() => navigate('/'))}>
            <Icon name="lock" size={14} /> {isEn ? 'Leave parent mode' : '退出家長模式'}
          </button>
        </div>
      </div>

      <div className="parent__kpis">
        <div className="parent__kpi">
          <span>{isEn ? 'Syllabus items' : '綱要細項'}</span>
          <strong>
            {stats.done}
            <em>/ {stats.total}</em>
          </strong>
        </div>
        <div className="parent__kpi">
          <span>{isEn ? 'Awards earned' : '已獲獎章'}</span>
          <strong>
            {stats.earned}
            <em>/ {ALL_AWARDS.length}</em>
          </strong>
        </div>
        <div className="parent__kpi">
          <span>{isEn ? 'Activity badges' : '活動徽章'}</span>
          <strong>{stats.activityBadges}</strong>
        </div>
        <div className="parent__kpi">
          <span>{isEn ? 'Membership' : '會員資格'}</span>
          <strong className={cx(membership.active ? 'is-ok' : 'is-warn')}>
            {membership.active ? (isEn ? 'Valid' : '有效') : renewal ? (isEn ? 'Expired' : '已到期') : isEn ? 'No record' : '未記錄'}
          </strong>
          {membership.validUntil && <em className="parent__kpi-sub">{membership.validUntil}</em>}
        </div>
      </div>

      <div className="parent__cols">
        <section className="parent__card">
          <h2>{isEn ? 'Progress by award' : '各獎章進度'}</h2>
          <ul className="parent__awards">
            {stats.awards.map((s) => {
              const date = book?.pages?.[`award_${s.award.id}`]?.date;
              return (
                <li key={s.award.id}>
                  <span className="parent__awardname">
                    {isEn ? s.award.en : s.award.name}
                    {date && <em>{isEn ? `Awarded ${date}` : `${date} 頒發`}</em>}
                  </span>
                  <span className="parent__bar">
                    <i style={{ width: `${s.complete ? 100 : s.percent}%` }} />
                  </span>
                  <span className={cx('parent__awardstate', s.complete && 'is-ok')}>
                    {s.complete ? (isEn ? 'Completed' : '已完成') : `${s.done}/${s.total}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="parent__card">
          <h2>{isEn ? 'Badges already awarded' : '已頒發獎章'}</h2>
          {earnedAwards.length ? (
            <ul className="parent__chips">
              {earnedAwards.map((a) => (
                <li key={a.award.id}>
                  <Icon name="seal" size={13} /> {isEn ? a.award.en : a.award.name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="parent__empty">{isEn ? 'No award recorded yet.' : '暫時未記錄任何已頒發獎章。'}</p>
          )}

          <h2 className="parent__h2gap">{isEn ? 'Uniform checklist' : '制服及徽章清單'}</h2>
          <div className="ribbon">
            <span className="ribbon__bar">
              <i style={{ width: `${(uniformDone / UNIFORM_ITEMS.length) * 100}%` }} />
            </span>
            <span className="ribbon__text">
              {isEn ? `${uniformDone} / ${UNIFORM_ITEMS.length} ready` : `已齊備 ${uniformDone} / ${UNIFORM_ITEMS.length} 項`}
            </span>
          </div>
          <ul className="parent__uniform">
            {UNIFORM_ITEMS.map((item) => (
              <li key={item.key} className={cx(uniform[item.key] && 'is-on')}>
                <span className="checklist__box is-static" aria-hidden="true">
                  {uniform[item.key] ? '✓' : ''}
                </span>
                {isEn ? item.en : item.zh}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="parent__card parent__card--wide">
        <h2>{isEn ? 'Recently completed' : '最近完成項目'}</h2>
        {recent.length ? (
          <ul className="parent__recent">
            {recent.map((r) => (
              <li key={r.id}>
                <span className="parent__recentdate">{r.date}</span>
                <span className="parent__recentname">{r.name}</span>
                <span className="parent__recentgroup">{r.group}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="parent__empty">{isEn ? 'No dated items yet.' : '暫時未有已填日期的項目。'}</p>
        )}
        <p className="parent__foot">
          {isEn
            ? 'Dates come straight from the award pages — nothing is recalculated. Only a leader can confirm progress.'
            : '以上日期直接來自各獎章頁，不會另行推算；進度是否完成仍以領袖核實為準。'}
        </p>
      </section>
    </div>
  );
}
