import React, { useRef, useState } from 'react';
import { useBook } from '../bookContext.js';
import { useToast, Icon, Modal } from '../ui.jsx';
import { download, clearBook, slugify } from '../bookStore.js';
import { APP_VERSION, demoBook, importFromBadge, newBook, today } from '@shared/book.js';
import { LegalNote } from './Legal.jsx';
import { navigate } from '../router.jsx';
import { useLang } from '../i18n.jsx';
import { exitLeaderMode } from '../leader.js';

export default function MenuDialog({ open, onClose, onShowQr, leader = false, leaderReady = null }) {
  const { book, replace } = useBook();
  const { isEn } = useLang();
  const { push } = useToast();
  const backupRef = useRef(null);
  const vsRef = useRef(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showHome, setShowHome] = useState(false);

  if (!open) return null;

  const backup = () => {
    download(`cubbook-${slugify(book.member?.nameZh || book.member?.nameEn)}-${today()}.json`, book);
    push(isEn ? 'Backup exported' : '已匯出備份檔案');
  };

  const importBackup = (file) => {
    if (!file || leader) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!data?.member) throw new Error(isEn ? 'Not a CUBBOOK backup file' : '這不是 CUBBOOK 備份檔');
        if (!window.confirm(isEn ? 'Overwrite current record book with this backup?' : '匯入備份會覆蓋目前這本紀錄冊，確定嗎？')) return;
        replace(newBook(data));
        push(isEn ? 'Backup restored' : '備份已還原');
        onClose();
      } catch (e) {
        push(e.message || (isEn ? 'Invalid file format' : '檔案格式不正確'), 'error');
      }
    };
    reader.readAsText(file);
  };

  const importBadge = (file) => {
    if (!file || leader) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const result = importFromBadge(data, book);
        replace(result.book);
        push(
          isEn
            ? `Imported ${result.imported} leader-confirmed items (${result.matchedBy})`
            : `已從 cubbadge 錄入 ${result.imported} 項領袖已核實進度${
                result.skippedPending ? `（已略過 ${result.skippedPending} 項未核實項目）` : ''
              }`,
        );
        navigate('/p/p09');
        onClose();
      } catch (e) {
        push(e.message || (isEn ? 'Cannot read cubbadge file' : '無法讀取 cubbadge 檔案'), 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <Modal onClose={onClose} eyebrow="MENU" title={isEn ? 'Record Book Options' : '紀錄冊選項'}>
      <div className="menu">
        <button type="button" className="menu__item menu__item--accent" onClick={() => setShowHome((v) => !v)}>
          <Icon name={showHome ? 'down' : 'download'} size={18} />
          <span>
            <strong>{isEn ? 'Add to home screen' : '加到手機主畫面'}</strong>
            <em>
              {isEn
                ? 'One tap to open; no certificate, no fee, no server.'
                : '一按即開，毋須憑證、毋須付費、毋須伺服器'}
            </em>
          </span>
        </button>

        {showHome && (
          <div className="menuguide">
            {isEn ? (
              <ol>
                <li>
                  <b>iPhone</b>: Open in <b>Safari</b> → tap “Share” → “Add to Home Screen” → “Add”.
                </li>
                <li>
                  <b>Android</b>: Open in <b>Chrome</b> → top-right menu → “Install app” or “Add to Home screen”.
                </li>
              </ol>
            ) : (
              <ol>
                <li>
                  <b>iPhone</b>：用 <b>Safari</b> 開啟本頁 → 底部「分享」→「加入主畫面」→「新增」。
                </li>
                <li>
                  <b>Android</b>：用 <b>Chrome</b> 開啟本頁 → 右上三點 →「安裝應用程式」或「加到主畫面」。
                </li>
              </ol>
            )}
            <p>
              {isEn
                ? 'Works like a native app afterwards: full screen, no login, works offline.'
                : '之後同應用程式一樣：全螢幕、毋須登入、離線照用。'}
            </p>
          </div>
        )}

        {leader ? (
          <button
            type="button"
            className="menu__item menu__item--accent"
            onClick={() => {
              onClose();
              navigate('/scan');
            }}
          >
            <Icon name="qr" size={18} />
            <span>
              <strong>{isEn ? 'Scan Member QR Code (Leader · Read-Only)' : '掃描二維碼（領袖 · 只讀檢視）'}</strong>
              <em>
                {isEn
                  ? 'Read a member’s shared book in read-only mode and sign items off'
                  : '唯讀查閱成員出示的紀錄冊內容，核對後可簽署回傳碼'}
              </em>
            </span>
          </button>
        ) : null}

        <button type="button" className="menu__item" onClick={() => onShowQr?.()}>
          <Icon name="qr" size={18} />
          <span>
            <strong>{isEn ? 'Show My QR Code' : '出示二維碼（給領袖掃描）'}</strong>
            <em>
              {isEn
                ? 'Members can only share (cannot read others). Tick what to send; nothing sent by default.'
                : '普通模式只可出示分享（不能讀取他人紀錄冊）；每次自行剔選傳送項目，預設不傳任何內容'}
            </em>
          </span>
        </button>

        {leader ? (
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              exitLeaderMode();
              push(isEn ? 'Leader mode closed — editing restored' : '已退出領袖模式，恢復普通填寫模式');
              onClose();
            }}
          >
            <Icon name="lock" size={18} />
            <span>
              <strong>{isEn ? 'Leave Leader Mode' : '退出領袖模式'}</strong>
              <em>
                {isEn
                  ? 'Hide QR scanning and unlock your own record book for editing'
                  : '關閉掃描功能，並解除本機紀錄冊的只讀鎖定'}
              </em>
            </span>
          </button>
        ) : leaderReady ? (
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              onClose();
              navigate('/leader');
            }}
          >
            <Icon name="lock" size={18} />
            <span>
              <strong>{isEn ? 'Leader Mode (Read-Only)' : '領袖模式（只讀）'}</strong>
              <em>
                {isEn
                  ? 'For leaders: enter code to scan and view member books in read-only mode'
                  : '領袖專用：輸入領袖密碼以掃描及只讀檢視成員紀錄冊'}
              </em>
            </span>
          </button>
        ) : null}

        <button
          type="button"
          className="menu__item"
          onClick={() => {
            onClose();
            navigate('/forms');
          }}
        >
          <Icon name="seal" size={18} />
          <span>
            <strong>{isEn ? '3 Official Forms (One-Click)' : '官方表格（一鍵生成）'}</strong>
            <em>{isEn ? 'PT/67 and PT/68 plus the 2026 checklist, auto-filled from your record book' : 'PT/67 開展通知書、PT/68 申請表及 2026 核對清單，個人資料及考核紀錄自動填入'}</em>
          </span>
        </button>

        <button
          type="button"
          className="menu__item"
          onClick={() => {
            onClose();
            navigate('/print');
          }}
        >
          <Icon name="print" size={18} />
          <span>
            <strong>{isEn ? 'Print whole book / Save PDF' : '列印整本 / 儲存 PDF'}</strong>
            <em>
              {isEn
                ? '19 pages, one per record-book page; A4 portrait with the official page mapping in the print checklist.'
                : '19 頁一次過，每頁對應紙本一節；A4 直向，頁碼及紙本對照見列印檢查清單。'}
            </em>
          </span>
        </button>

        <button type="button" className="menu__item" onClick={backup}>
          <Icon name="download" size={18} />
          <span>
            <strong>{isEn ? 'Export Backup' : '匯出備份'}</strong>
            <em>{isEn ? 'Download full record-book JSON for cloud backup or device transfer' : '下載完整紀錄冊 JSON，可存雲端或換機還原'}</em>
          </span>
        </button>

        {!leader && (
          <>
            <button type="button" className="menu__item" onClick={() => backupRef.current?.click()}>
              <Icon name="upload" size={18} />
              <span>
                <strong>{isEn ? 'Import Backup' : '匯入備份'}</strong>
                <em>{isEn ? 'Restore from a CUBBOOK backup JSON' : '從 CUBBOOK 備份檔還原'}</em>
              </span>
            </button>

            <button
              type="button"
              className="menu__item"
              onClick={() => {
                onClose();
                navigate('/p/appendix');
              }}
            >
              <Icon name="link" size={18} />
              <span>
                <strong>{isEn ? 'Sync Progress with cubbadge' : '與 cubbadge 同步個人進度'}</strong>
                <em>
                  {isEn
                    ? 'Pull leader-confirmed progress into BOOK, or submit BOOK progress as Pending'
                    : '錄入 cubbadge 內領袖已核實進度，或將 BOOK 進度送交待領袖核實'}
                  </em>
              </span>
            </button>
          </>
        )}

        <button
          type="button"
          className="menu__item"
          onClick={() => {
            onClose();
            navigate('/p/appendix');
          }}
        >
          <Icon name="book" size={18} />
          <span>
            <strong>{isEn ? 'Digital Appendix & Storage Health' : '數位附錄與儲存健康'}</strong>
            <em>{isEn ? 'Export cubbadge JSON, shrink photos/ink, inspect storage' : '匯出 cubbadge 進度檔、壓縮相片墨跡及查看容量'}</em>
          </span>
        </button>

        {!leader && (
          <button
            type="button"
            className="menu__item"
            onClick={() => {
              if (!window.confirm(isEn ? 'Load demo book and overwrite current content?' : '載入示範紀錄冊會覆蓋目前內容，確定嗎？')) return;
              replace(demoBook());
              push(isEn ? 'Demo record book loaded' : '已載入示範紀錄冊');
              navigate('/p/contents');
              onClose();
            }}
          >
            <Icon name="book" size={18} />
            <span>
              <strong>{isEn ? 'Load Demo Record Book' : '載入示範紀錄冊'}</strong>
              <em>{isEn ? 'Explore all features with sample Cub Scout records' : '以陳小狼的示範資料試玩所有功能'}</em>
            </span>
          </button>
        )}

        <button type="button" className="menu__item" onClick={() => setShowAbout((v) => !v)}>
          <Icon name="info" size={18} />
          <span>
            <strong>{isEn ? 'About CUBBOOK' : '關於 CUBBOOK'}</strong>
            <em>{isEn ? 'Version, local storage policy & legal notice' : '版本、資料儲存方式及聲明'}</em>
          </span>
        </button>

        {showAbout && (
          <div className="about">
            <p>
              <strong>CUBBOOK {APP_VERSION}</strong> ·{' '}
              {isEn
                ? 'Digital Cub Scout Record Book. All data stays in your browser localStorage on this device.'
                : '幼童軍電子紀錄冊。所有內容只儲存在你這部裝置的瀏覽器（localStorage），不會自動上載。'}
            </p>
            <p>
              {isEn
                ? 'Syllabus item codes and badge IDs match cubbadge (2026 10th Edition Cub Scout Training Syllabus) for progress-only sync.'
                : '訓練綱要結構及項目編號對應 cubbadge（2026 年第十版幼童軍訓練綱要），可雙向交換進度資料。'}
            </p>
            <LegalNote compact />
          </div>
        )}

        {!leader && (
          <button
            type="button"
            className="menu__item menu__item--danger"
            onClick={() => {
              if (!window.confirm(isEn ? 'Clear local record book permanently?' : '清除本機紀錄冊？所有未備份的內容會永久消失。')) return;
              clearBook();
              replace(null);
              navigate('/');
              onClose();
              push(isEn ? 'Local record book cleared' : '已清除本機紀錄冊');
            }}
          >
            <Icon name="trash" size={18} />
            <span>
              <strong>{isEn ? 'Clear Local Record Book' : '清除本機紀錄冊'}</strong>
              <em>{isEn ? 'Permanently delete unbacked-up data on this device' : '永久刪除此裝置上的紀錄冊資料'}</em>
            </span>
          </button>
        )}

        <input ref={backupRef} type="file" accept="application/json,.json" hidden onChange={(e) => importBackup(e.target.files?.[0])} />
        <input ref={vsRef} type="file" accept="application/json,.json" hidden onChange={(e) => importBadge(e.target.files?.[0])} />
      </div>
    </Modal>
  );
}
