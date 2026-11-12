import React from 'react';
import { SECTIONS, PAGE_TOTAL } from '@shared/book.js';
import { Crest, Icon, Modal, cx } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';
import { DemoSheetTag } from './DemoNotice.jsx';

/** 單頁紙本內頁（對齊 ROVERBOOK v15 紙張質感與頁眉頁腳） */
export function Sheet({ id, no, title, en, children, className = '', dense = false, badge, kind = '', banner = true }) {
  const { isEn } = useLang();
  const officialBanner = banner && kind !== 'cover' && kind !== 'divider';
  return (
    <article
      className={cx('sheet', dense && 'sheet--dense', kind === 'cover' && 'sheet--cover', kind === 'divider' && 'sheet--divider', className)}
      data-page={id}
      data-badge={badge || undefined}
    >
      {officialBanner && (
        <header className="sheet__banner">
          <span className="sheet__banner-fleur" aria-hidden="true" />
          <h1>
            {isEn && en ? en : title}
            {!isEn && en && <em>{en}</em>}
          </h1>
          <span className="sheet__banner-fleur" aria-hidden="true" />
        </header>
      )}
      <div className="sheet__body">{children}</div>
      {no && no !== '—' && kind !== 'divider' && <span className="sheet__folio">{no}</span>}
      {/* 示範紀錄冊：封面及每一頁（含整本列印）都帶標示，抽出任何一頁都不會被當成正式紀錄。 */}
      <DemoSheetTag />
    </article>
  );
}

export function Spread({ section, right, className = '', dense = false }) {
  const meta = SECTIONS.find((s) => s.id === section) || {};
  return (
    <Sheet
      id={section}
      no={meta.page}
      title={meta.bannerZh || meta.label || ''}
      en={meta.bannerEn || meta.en || ''}
      className={className}
      dense={dense}
      badge={meta.badge}
      kind={meta.kind}
      banner={Boolean(meta.label) && meta.banner !== false}
    >
      {right}
    </Sheet>
  );
}

const bookPages = () => SECTIONS.filter((s) => s.id !== 'contents');

export function Pager({ current, onOpenIndex }) {
  const { isEn } = useLang();
  const list = bookPages();
  const index = list.findIndex((s) => s.id === current);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 ? list[index + 1] : list[0];
  const cur = index >= 0 ? list[index] : SECTIONS.find((s) => s.id === current);

  return (
    <div className="pager no-print">
      {prev ? (
        <Link to={`/p/${prev.id}`} className="pager__link">
          <span className="pager__dir">{isEn ? 'PREVIOUS' : '上一頁'}</span>
          <span className="pager__title">{isEn ? prev.en || prev.label : prev.label}</span>
        </Link>
      ) : (
        <Link to="/" className="pager__link">
          <span className="pager__dir">{isEn ? 'COVER' : '封面'}</span>
          <span className="pager__title">{isEn ? 'Cub Scout Record Book' : '幼童軍紀錄冊'}</span>
        </Link>
      )}

      <button type="button" className="pager__count" onClick={onOpenIndex} title={isEn ? 'Contents' : '打開目錄'}>
        {cur?.id === 'cover'
          ? isEn
            ? 'COVER'
            : '封面'
          : !cur?.page || cur.page === '—'
            ? isEn
              ? 'CONTENTS'
              : '目錄'
            : `${cur.page} / ${PAGE_TOTAL}`}
      </button>

      {next ? (
        <Link to={`/p/${next.id}`} className="pager__link pager__link--next">
          <span className="pager__dir">{isEn ? 'NEXT' : '下一頁'}</span>
          <span className="pager__title">{isEn ? next.en || next.label : next.label}</span>
        </Link>
      ) : (
        <Link to="/" className="pager__link pager__link--next">
          <span className="pager__dir">{isEn ? 'END' : '完'}</span>
          <span className="pager__title">{isEn ? 'Back to cover' : '返回封面'}</span>
        </Link>
      )}
    </div>
  );
}

export function IndexSheet({ open, onClose, current }) {
  const { isEn } = useLang();
  if (!open) return null;
  const list = bookPages();
  return (
    <Modal
      onClose={onClose}
      eyebrow="CONTENTS"
      title={isEn ? 'Contents' : '目錄'}
      subtitle={isEn ? 'Cover + 32 official pages, one to one; plus a digital appendix.' : '封面＋官方 32 頁逐頁對應；另設數位附錄。'}
      wide
    >
      <div className="indexlist">
        <Link to="/p/cover" className="indexrow indexrow--cover" onClick={onClose}>
          <span className="indexrow__no">{isEn ? 'Cover' : '封面'}</span>
          <span className="indexrow__title">{isEn ? 'Cub Scout Record Book' : '幼童軍紀錄冊'}</span>
          <Icon name="book" size={14} />
        </Link>
        <Link to="/p/contents" onClick={onClose} className={cx('indexrow indexrow--cover', current === 'contents' && 'is-current')}>
          <span className="indexrow__no">{isEn ? 'Index' : '目錄'}</span>
          <span className="indexrow__title">{isEn ? 'How to use & progress summary' : '使用說明及進度摘要'}</span>
          <Icon name="info" size={14} />
        </Link>
        {list.filter((s) => s.id !== 'cover').map((s) => (
          <Link
            key={s.id}
            to={`/p/${s.id}`}
            onClick={onClose}
            className={cx('indexrow', current === s.id && 'is-current')}
          >
            <span className="indexrow__no">{s.page === '—' ? (isEn ? 'App.' : '附錄') : s.page}</span>
            <span className="indexrow__title">
              {isEn ? s.en || s.label : s.label}
              {!isEn && <em>{s.en}</em>}
            </span>
            {current === s.id ? <span className="indexrow__now">{isEn ? 'NOW' : '現在'}</span> : <Icon name="chevron" size={12} />}
          </Link>
        ))}
      </div>
    </Modal>
  );
}
