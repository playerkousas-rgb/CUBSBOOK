import React, { useRef, useState } from 'react';
import { APP_VERSION, BADGE_SYLLABUS, GOLD_AWARD, PRINT_PAGES, demoBook, isDemoBook, newBook, today } from '@shared/book.js';
import { OFFICIAL_PAGE_COUNT } from '@shared/officialPages.js';
import { useBook, useReadOnly } from '../bookContext.js';
import { H, Page } from '../components/Form.jsx';
import AwardBlock from '../components/AwardBlock.jsx';
import CubBadgeSyncCard from '../components/CubBadgeSyncCard.jsx';
import { download, slugify } from '../bookStore.js';
import { compressBookMedia, imageSizeLabel, storageUsage } from '../storageHealth.js';
import { Icon, cx, useToast } from '../ui.jsx';
import { Link } from '../router.jsx';
import { useLang } from '../i18n.jsx';
import { LegalNote } from '../components/Legal.jsx';
import { demoLoadConfirm, demoLoadedToast } from '../components/DemoNotice.jsx';

/* ============================================================
   數位附錄：逐項進度（數位延伸）、同步、備份、列印
   官方 32 頁以外的內容全部集中在這裡，不佔用官方頁碼。
   ============================================================ */

export function AppendixPage() {
  const { book, replace, parent = false } = useBook();
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
              : '這不是完整的 CUBBOOK 備份檔（cubbadge 進度檔請用上方同步卡）',
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

      {parent ? (
        <p className="cubsync__offline">
          <Icon name="lock" size={15} />
          <span>
            {isEn
              ? 'Parent mode: progress is exported from cubbadge in Parent Mode (read-only). Nothing is ever submitted from this phone.'
              : '家長模式：請在「家長模式」頁由 cubbadge 匯出進度（只讀）。這部手機永遠不會提交任何內容。'}
          </span>
        </p>
      ) : (
        <CubBadgeSyncCard readOnly={readOnly} />
      )}

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
              download(`cubbook-${isDemoBook(book) ? 'DEMO-' : ''}backup-${slugify(book.member?.nameZh || book.member?.scoutId)}-${today()}.json`, book);
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
            ? `A4 portrait, 10 mm margins. Cover + official pages 1–${OFFICIAL_PAGE_COUNT} = ${PRINT_PAGES.length} A4 sheets. Empty-field dots are hidden when printing.`
            : `A4 直向、10mm 邊界；封面＋官方第 1–${OFFICIAL_PAGE_COUNT} 頁，共 ${PRINT_PAGES.length} 張 A4。列印時會自動隱藏空白欄的小圓點。`}
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
              if (window.confirm(demoLoadConfirm(isEn))) {
                replace(demoBook());
                push(demoLoadedToast(isEn));
              }
            }}
          >
            {isEn ? 'Load Demo Book (fictional)' : '載入示範紀錄冊（虛構資料）'}
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
        <p className="tiny">
          {isEn
            ? 'The demo book is a complete, fictional Golden Bauhinia Award application: all 72 items, activity badges, renewals and the PT/67 and PT/68 fields. Every printed page is marked “SAMPLE ONLY — FOR TESTING — NOT FOR SUBMISSION”, signature boxes only show “SAMPLE SIGNATURE”, and CUBSBADGE sync is disabled.'
            : '示範紀錄冊是一份完整但全屬虛構的金紫荊獎章申請樣本：72 項進度、活動徽章、會員續期及 PT/67、PT/68 欄位一應俱全。每一頁列印都印有「示範樣本，只供測試，不可遞交」，簽署欄只顯示「示範簽署」，並已停用 CUBSBADGE 同步。'}
        </p>
      </section>


      <section className="appxcard appxcard--detail">
        <h3>
          <Icon name="cards" size={16} /> {isEn ? 'Item-by-item Progress (digital aid)' : '逐項進度（數位延伸）'}
        </h3>
        <p className="tiny">
          {isEn
            ? 'The official book records Examiner / Date per domain. These 72 items are CUBBOOK’s digital aid for planning and for cubbadge sync — they never replace the official tables.'
            : '官方紀錄冊只記錄每個範疇的主考人／日期；以下 72 項是 CUBBOOK 的數位輔助，方便規劃及與 cubbadge 同步，不會取代官方表格。'}
        </p>
        {[...BADGE_SYLLABUS, GOLD_AWARD].map((award) => (
          <details key={award.id} className="appxdetail">
            <summary>
              {isEn ? award.en : award.name}
              <em>{isEn ? award.name : award.en}</em>
            </summary>
            <AwardBlock award={award} showDetail />
          </details>
        ))}
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
            ? `Cover + official pages 1–${OFFICIAL_PAGE_COUNT} · ${PRINT_PAGES.length} A4 sheets (portrait)`
            : `整本《幼童軍紀錄冊》：封面＋官方第 1–${OFFICIAL_PAGE_COUNT} 頁，共 ${PRINT_PAGES.length} 張 A4`}
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
