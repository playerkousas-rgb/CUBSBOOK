import React, { useContext } from 'react';
import { DEMO_NOTICE, isDemoBook } from '@shared/demo.js';
import { BookCtx } from '../bookContext.js';
import { useLang } from '../i18n.jsx';

/** 目前開啟的是否為示範紀錄冊（沒有紀錄冊情境時一律為否）。 */
export function useIsDemo() {
  const ctx = useContext(BookCtx);
  return isDemoBook(ctx?.book);
}

/** 載入示範資料前的確認文案：必須講明內容虛構、不可遞交、不可同步。 */
export const demoLoadConfirm = (isEn) =>
  isEn
    ? 'Load the demo record book? It replaces what is on this device now. Everything in it is fictional: for print testing only, not for submission, and it cannot be synced to CUBSBADGE.'
    : '確定載入示範紀錄冊？會取代這部裝置目前的內容。示範資料全部虛構：只供測試列印，不可遞交，亦不可同步至 CUBSBADGE。';

export const demoLoadedToast = (isEn) =>
  isEn ? 'Demo book loaded — sample only, not for submission' : '已載入示範紀錄冊（只供測試，不可遞交）';

/**
 * A4 表格頂部的示範標示。螢幕及列印同樣顯示，每一張 `.a4sheet` 各放一個，
 * 令任何單獨抽出的一頁都不會被誤當正式申請表。
 */
export function DemoNotice() {
  const demo = useIsDemo();
  const { isEn } = useLang();
  if (!demo) return null;
  return (
    <p className="demo-notice" role="note" data-demo-notice="form">
      {isEn ? DEMO_NOTICE.en : DEMO_NOTICE.zh}
    </p>
  );
}

/** 紀錄冊內頁（含整本列印）頁腳的示範標示：絕對定位於頁邊，不佔用官方版面。 */
export function DemoSheetTag() {
  const demo = useIsDemo();
  const { isEn } = useLang();
  if (!demo) return null;
  return (
    <span className="sheet__demo" role="note" data-demo-notice="sheet">
      {isEn ? DEMO_NOTICE.en : DEMO_NOTICE.zh}
    </span>
  );
}

/** 簽署格內的示範文字：示範紀錄冊沒有任何簽名圖片，只印這行字。 */
export function DemoSignMark({ className = '' }) {
  const { isEn } = useLang();
  return (
    <span className={`demo-sign ${className}`.trim()} data-demo-sign>
      {isEn ? DEMO_NOTICE.signEn : DEMO_NOTICE.signZh}
    </span>
  );
}

/** 螢幕頂部的示範提示條（不列印；列印頁面自身已有標示）。 */
export function DemoRibbon() {
  const demo = useIsDemo();
  const { isEn } = useLang();
  if (!demo) return null;
  return (
    <div className="demo-ribbon no-print" role="status" data-demo-notice="ribbon">
      <strong>{isEn ? DEMO_NOTICE.en : DEMO_NOTICE.zh}</strong>
      <span>
        {isEn
          ? 'Fictional data · no real signatures · CUBSBADGE sync disabled'
          : '資料全部虛構 · 不含真實簽署 · 已停用 CUBSBADGE 同步'}
      </span>
    </div>
  );
}
