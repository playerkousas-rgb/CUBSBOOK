import React, { useState } from 'react';
import { EMBED_ACK_KEY, isEmbedded, standaloneHost, standaloneUrl } from '@shared/embed.js';
import { today } from '@shared/book.js';
import { download, slugify } from '../bookStore.js';
import { useLang } from '../i18n.jsx';
import { Icon, useToast } from '../ui.jsx';

/* ============================================================
   服務平台 iframe 嵌入模式提示
   瀏覽器把跨網站 iframe 的本機儲存按頂層網站分割：平台內的紀錄冊與獨立版
   互不相通，舊資料只能以備份 JSON 搬移。以下元件只在嵌入時出現，獨立開啟
   時全部回傳 null，不影響原有版面。
   ============================================================ */

const readAck = () => {
  try {
    return window.sessionStorage.getItem(EMBED_ACK_KEY) === '1';
  } catch {
    return false;
  }
};

const writeAck = () => {
  try {
    window.sessionStorage.setItem(EMBED_ACK_KEY, '1');
  } catch {
    /* ignore */
  }
};

/** 以新分頁開啟獨立版（iframe 內不可直接跳轉，否則會離開服務平台）。 */
export function StandaloneLink({ className = 'btn btn--onpaper', children }) {
  return (
    <a className={className} href={standaloneUrl()} target="_blank" rel="noopener noreferrer" data-embed-standalone>
      {children}
    </a>
  );
}

/** 歡迎頁：平台內首次開啟時，說明舊資料不會自動出現，以及備份／還原步驟。 */
export function EmbedWelcomeNote() {
  const { isEn } = useLang();
  if (!isEmbedded()) return null;
  const host = standaloneHost();
  return (
    <section className="embednote" role="note" data-embed-notice="welcome">
      <h2>{isEn ? 'Opened inside the Service Portal' : '你正在服務平台內開啟 CUBBOOK'}</h2>
      <p>
        {isEn
          ? `The record book kept here is stored separately from the standalone site (${host}). A book you already have there will not appear here automatically.`
          : `平台內的紀錄冊與獨立版（${host}）分開儲存，獨立版原有的資料不會自動出現在這裏。`}
      </p>
      {isEn ? (
        <ol>
          <li>Open the standalone site in a new tab → Menu → “Export Backup” to download the JSON file.</li>
          <li>Come back here, tap “Import Backup” below and choose that file.</li>
        </ol>
      ) : (
        <ol>
          <li>在新分頁開啟獨立版 → 選單 →「匯出備份」，下載 JSON 檔。</li>
          <li>回到這裏，按下方「匯入備份」並選取該檔案。</li>
        </ol>
      )}
      <p className="embednote__warn">
        {isEn
          ? 'On iPhone, iPad and Safari, data kept inside the portal may be cleared when the browser is closed. Export a backup after every session, or use the standalone site for long-term records.'
          : 'iPhone／iPad 及 Safari 可能在關閉瀏覽器後清除平台內的資料：每次填寫後請匯出備份，長期紀錄建議使用獨立版。'}
      </p>
      <StandaloneLink>
        <Icon name="external" size={14} /> {isEn ? 'Open standalone site (new tab)' : '開啟獨立版（新分頁）'}
      </StandaloneLink>
    </section>
  );
}

/** 已有紀錄冊時的頂部提示條（不列印；按「知道了」後在本次工作階段隱藏）。 */
export function EmbedRibbon({ book, canBackup = true }) {
  const { isEn } = useLang();
  const { push } = useToast();
  const [ack, setAck] = useState(readAck);
  if (!isEmbedded() || ack) return null;

  const backup = () => {
    download(`cubbook-${slugify(book?.member?.nameZh || book?.member?.nameEn)}-${today()}.json`, book);
    push(isEn ? 'Backup exported' : '已匯出備份檔案');
  };

  return (
    <div className="embedbar no-print" role="status" data-embed-notice="ribbon">
      <span>
        <strong>{isEn ? 'Inside the Service Portal' : '服務平台內嵌模式'}</strong>{' '}
        {isEn
          ? 'This book is stored separately from the standalone site. Export a backup before you leave — iPhone, iPad and Safari may clear it when the browser closes.'
          : '這本紀錄冊與獨立版分開儲存；離開前請匯出備份（iPhone／iPad 及 Safari 可能在關閉瀏覽器後清除）。'}
      </span>
      <span className="embedbar__actions">
        {canBackup && book && (
          <button type="button" className="embedbar__btn embedbar__btn--main" onClick={backup}>
            <Icon name="download" size={13} /> {isEn ? 'Export Backup' : '匯出備份'}
          </button>
        )}
        <StandaloneLink className="embedbar__btn">
          <Icon name="external" size={13} /> {isEn ? 'Standalone site' : '開啟獨立版'}
        </StandaloneLink>
        <button
          type="button"
          className="embedbar__btn"
          onClick={() => {
            writeAck();
            setAck(true);
          }}
        >
          {isEn ? 'Got it' : '知道了'}
        </button>
      </span>
    </div>
  );
}
