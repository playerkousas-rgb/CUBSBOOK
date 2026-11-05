import React from 'react';
import { SECTIONS, PAGE_TOTAL } from '@shared/book.js';
import { Crest, Icon, Modal, cx } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';

/** 單頁紙本內頁（對齊 ROVERBOOK v15 紙張質感與頁眉頁腳） */
export function Sheet({ id, no, title, en, children, className = '', dense = false, badge }) {
  const { isEn } = useLang();
  return (
    <article className={cx('sheet', dense && 'sheet--dense', className)} data-page={id} data-badge={badge || undefined}>
      <span className="sheet__gutter" aria-hidden="true" />
      <span className="sheet__watermark" aria-hidden="true">
        <Crest size={130} />
      </span>
      <span className="sheet__corner" aria-hidden="true" />
      <header className="sheet__head">
        <span className="sheet__run">
          {isEn ? (
            'CUB SCOUT RECORD BOOK'
          ) : (
            <>
              幼童軍紀錄冊 <em>CUB SCOUT RECORD BOOK</em>
            </>
          )}
        </span>
        {no && no !== '—' && (
          <span className="sheet__pageno">
            {isEn ? `PAGE ${no} / ${PAGE_TOTAL}` : `第 ${no} 頁 · 共 ${PAGE_TOTAL} 頁`}
          </span>
        )}
      </header>
      <div className="sheet__titlebar">
        <h1>
          {isEn && en ? en : title}
          {!isEn && en && <em>{en}</em>}
        </h1>
        <span className="sheet__rule" aria-hidden="true" />
      </div>
      <div className="sheet__body">{children}</div>
      <footer className="sheet__foot">
        <span>{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</span>
        <span>{isEn ? (en || 'CONTENTS').toUpperCase() : title || '目錄'}</span>
      </footer>
    </article>
  );
}

export function Spread({ section, right, className = '', dense = false }) {
  const meta = SECTIONS.find((s) => s.id === section) || {};
  return (
    <Sheet
      id={section}
      no={meta.page}
      title={meta.label || ''}
      en={meta.en || ''}
      className={className}
      dense={dense}
      badge={meta.badge}
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
        {!cur?.page || cur.page === '—'
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
      subtitle={isEn ? '19 printed pages, one to one; plus a digital appendix.' : '紙本 19 頁，逐頁對應；另設數位附錄。'}
      wide
    >
      <div className="indexlist">
        <Link to="/" className="indexrow indexrow--cover" onClick={onClose}>
          <span className="indexrow__no">{isEn ? 'Cover' : '封面'}</span>
          <span className="indexrow__title">{isEn ? 'Cub Scout Record Book' : '幼童軍紀錄冊'}</span>
          <Icon name="book" size={14} />
        </Link>
        <Link to="/p/contents" onClick={onClose} className={cx('indexrow indexrow--cover', current === 'contents' && 'is-current')}>
          <span className="indexrow__no">{isEn ? 'Index' : '目錄'}</span>
          <span className="indexrow__title">{isEn ? 'How to use & progress summary' : '使用說明及進度摘要'}</span>
          <Icon name="info" size={14} />
        </Link>
        {list.map((s) => (
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
