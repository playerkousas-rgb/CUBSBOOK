import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PAGE_TOTAL, SECTIONS, syncIdentity } from '@shared/book.js';
import { BookCtx } from './bookContext.js';
import { loadBook, persistBook } from './bookStore.js';
import { LangProvider, useLang } from './i18n.jsx';
import { isLeader, leaderAvailable, onLeaderChange } from './leader.js';
import { exitParentMode, isParent, loadParentBook, onParentChange, saveParentBook } from './parent.js';
import { UPDATE_EVENT, applyPwaUpdate } from './pwa.js';
import { Link, navigate, useFullLocation, useRoute } from './router.jsx';
import { Crest, Icon, ToastProvider, cx, useToast } from './ui.jsx';
import { IndexSheet, Pager } from './components/Paper.jsx';
import ShowQrDialog from './components/ShowQrDialog.jsx';
import MenuDialog from './components/MenuDialog.jsx';
import LeaderGate from './components/LeaderGate.jsx';
import Welcome from './pages/Welcome.jsx';
import CoverPage from './pages/CoverPage.jsx';
import {
  ContentsPage,
  P01, P02, P03, P04, P05, P06, P07, P08, P09, P10, P11,
  P12, P13, P14, P15, P16, P17, P18, P19, P20, PCover,
  P21, P22, P23, P24, P25, P26, P27, P28, P29, P30, P31, P32,
} from './pages/Official.jsx';
import { AppendixPage, PrintBook } from './pages/Appendix.jsx';
import { FormDoc, FormsAll, FormsIndex } from './pages/Forms.jsx';
import { DemoRibbon } from './components/DemoNotice.jsx';
import ParentView from './pages/ParentView.jsx';
import ParentConnect from './pages/ParentConnect.jsx';
import { HashSnapshotViewer, Scan, ScanView, Signoff } from './pages/Scan.jsx';

const PAGES = {
  contents: ContentsPage,
  cover: PCover,
  p01: P01, p02: P02, p03: P03, p04: P04, p05: P05, p06: P06, p07: P07,
  p08: P08, p09: P09, p10: P10, p11: P11, p12: P12, p13: P13, p14: P14,
  p15: P15, p16: P16, p17: P17, p18: P18, p19: P19, p20: P20, p21: P21,
  p22: P22, p23: P23, p24: P24, p25: P25, p26: P26, p27: P27, p28: P28,
  p29: P29, p30: P30, p31: P31, p32: P32,
  appendix: AppendixPage,
};

function BookApp({ book, saveIssue, leader, leaderReady, parent }) {
  const path = useRoute();
  const { push } = useToast();
  const { isEn, toggle } = useLang();
  const [indexOpen, setIndexOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [savedAt, setSavedAt] = useState(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [updateReady, setUpdateReady] = useState(false);
  const touch = useRef(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    const up = () => setUpdateReady(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener(UPDATE_EVENT, up);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener(UPDATE_EVENT, up);
    };
  }, []);

  const printAll = path === '/print';
  const leaderRoute = path === '/leader';
  const parentRoute = path === '/parent';
  const parentConnectRoute = path === '/parent/connect';
  const section = path.startsWith('/p/') ? path.slice(3) : null;
  const formId = path.startsWith('/forms') ? path.split('/').filter(Boolean)[1] || 'index' : null;
  const scanPath = ['/scan', '/scan/view', '/scan/signoff'].includes(path) ? path : null;

  const [lastSection, setLastSection] = useState(() => {
    try {
      return localStorage.getItem('cubbook.last') || '';
    } catch {
      return '';
    }
  });

  useEffect(() => {
    if (!section || !PAGES[section]) return;
    try {
      localStorage.setItem('cubbook.last', section);
    } catch {
      /* ignore */
    }
    setLastSection(section);
  }, [section]);

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo?.({ top: 0, behavior: 'instant' });
  }, [path]);

  useEffect(() => {
    const t = setTimeout(() => setSavedAt(new Date()), 350);
    return () => clearTimeout(t);
  }, [book, parent]);

  const lastMeta = SECTIONS.find((s) => s.id === lastSection && !s.digital);
  const meta = SECTIONS.find((s) => s.id === section);
  const secIndex = SECTIONS.findIndex((s) => s.id === section);
  const PageComp = section ? PAGES[section] || P01 : null;

  const go = useCallback(
    (delta) => {
      if (!section) {
        navigate('/p/p01');
        return;
      }
      const next = SECTIONS[secIndex + delta];
      if (next) navigate(`/p/${next.id}`);
      else if (delta < 0 && secIndex <= 0) navigate('/');
    },
    [section, secIndex],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.matches?.('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  return (
    <div
      className={cx(
        'app',
        leader && 'app--leader',
        printAll
          ? 'app--print'
          : scanPath || leaderRoute || parentRoute || parentConnectRoute
            ? 'app--scan'
            : formId
              ? 'app--forms'
              : section
                ? 'app--book'
                : 'app--cover',
      )}
    >
      <header className={cx('chipbar no-print', section && 'chipbar--page')}>
        <Link to="/" className="chipbar__brand">
          <Crest size={26} />
          <span>
            <strong>CUBBOOK</strong>
            <em>{isEn ? 'Cub Scout Record Book' : '幼童軍紀錄冊'}</em>
          </span>
        </Link>

        {formId && (
          <span className="chipbar__page chipbar__page--static">
            <span>{isEn ? 'FORMS' : '申請表'}</span>
            <strong>
              {formId === 'index'
                ? isEn
                  ? 'Forms'
                  : '表格'
                : formId === 'all'
                  ? isEn
                    ? '3 forms · 4 A4 sheets'
                    : '三款表格 · 共 4 張 A4'
                  : ``}
            </strong>
          </span>
        )}

        {section && (
          <button type="button" className="chipbar__page" onClick={() => setIndexOpen(true)}>
            <span>
              {section === 'contents'
                ? isEn
                  ? 'Contents'
                  : '目錄'
                : section === 'cover'
                  ? isEn
                    ? 'Unnumbered'
                    : '不計頁碼'
                  : !meta?.page || meta.page === '—'
                    ? isEn
                      ? 'Appendix'
                      : '附錄'
                    : isEn
                      ? `Page ${meta.page}`
                      : `第 ${meta.page} 頁`}
            </span>
            <strong>
              {section === 'contents'
                ? isEn
                  ? 'Record Book Index'
                  : '紀錄冊目錄'
                : isEn
                  ? meta?.en || meta?.label
                  : meta?.label}
            </strong>
            <Icon name="down" size={12} />
          </button>
        )}

        <div className="chipbar__actions">
          {parent && (
            <button
              type="button"
              className="chipbtn chipbtn--parent"
              onClick={() => navigate('/parent')}
              title={isEn ? 'Parent Mode (Read-Only) — view your child’s book' : '家長模式（只讀）— 查看孩子的紀錄冊'}
            >
              <Icon name="lock" size={13} />{' '}
              <span>{isEn ? 'Parent · Read-Only' : '家長 · 只讀'}</span>
            </button>
          )}

          {leader && (
            <button
              type="button"
              className="chipbtn chipbtn--leader"
              onClick={() => navigate('/scan')}
              title={isEn ? 'Leader Mode (Read-Only) — Scan member QR' : '領袖模式（只讀）— 掃描成員二維碼'}
            >
              <Icon name="lock" size={13} />{' '}
              <span>{isEn ? 'Leader · Read-Only' : '領袖 · 只讀'}</span>
            </button>
          )}

          {section && !leader && (
            <span className={cx('chipbar__save hide-sm', saveIssue && 'is-error')}>
              {saveIssue ? (isEn ? 'UNSAVED' : '未儲存') : savedAt ? (isEn ? 'SAVED' : '已儲存') : 'LOCAL'}
            </span>
          )}

          {section && (
            <button
              type="button"
              className={cx('chipbtn hide-sm', zoom > 1 && 'is-on')}
              onClick={() => setZoom((z) => (z > 1 ? 1 : 1.4))}
              title={isEn ? 'Zoom' : '放大紙面（方便細字填寫）'}
            >
              <Icon name="zoom" size={15} /> {zoom > 1 ? (isEn ? 'Reset' : '還原') : isEn ? 'Zoom' : '放大'}
            </button>
          )}

          {!leader && (
            <button type="button" className="chipbtn chipbtn--gold" onClick={() => setQrOpen(true)}>
              <Icon name="qr" size={15} /> <span className="hide-sm">{isEn ? 'Show QR' : '出示 QR'}</span>
            </button>
          )}

          <button
            type="button"
            className="chipbtn chipbtn--lang"
            onClick={toggle}
            title={isEn ? '切換至中文介面' : 'Switch to English'}
            aria-label={isEn ? '切換至中文介面' : 'Switch to English'}
          >
            <Icon name="globe" size={14} /> <span>{isEn ? '中文' : 'EN'}</span>
          </button>

          <button type="button" className="chipbtn chipbtn--icon" onClick={() => setMenuOpen(true)} aria-label="選單">
            <Icon name="menu" size={16} />
          </button>
        </div>
      </header>

      {leader && section && (
        <div className="readonlybar no-print" role="status">
          <Icon name="lock" size={13} />
          <span>
            {isEn
              ? 'Leader Mode (Read-Only): local book editing is locked. Tap “Scan” to inspect a member QR, or leave Leader Mode in Menu to edit your own book.'
              : '領袖模式（只讀）：目前為唯讀狀態，不會修改本機資料。可按上方「領袖 · 只讀」掃描成員二維碼，或在選單退出領袖模式。'}
          </span>
        </div>
      )}

      {parent && !printAll && !parentRoute && !parentConnectRoute && (
        <div className="parentbar no-print" role="status">
          <Icon name="lock" size={13} />
          <span>
            {isEn
              ? 'Parent Mode (Read-Only): you can read everything, but nothing can be edited and you do not need to fill in any particulars.'
              : '家長模式（只讀）：可查看全部內容，但不會修改任何資料；家長毋須填寫任何個人資料。'}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/parent')}>
            {isEn ? 'Overview' : '總覽'}
          </button>
        </div>
      )}

      {!printAll && !scanPath && !leaderRoute && !parentConnectRoute && <DemoRibbon />}

      {!online && (
        <div className="offlinebar no-print" role="status">
          <Icon name="lock" size={14} />
          <span>
            {isEn
              ? 'Offline Mode: your record book lives on this device — keep editing, signing, generating forms and QR codes.'
              : '離線模式：整本紀錄冊都在這部裝置上，照常可以填寫、手寫簽名、生成表格及出示二維碼。'}
          </span>
        </div>
      )}

      {saveIssue && (
        <div className="savealert no-print" role="alert">
          <Icon name="alert" size={16} />
          <span>
            {saveIssue === 'quota'
              ? '本機儲存空間接近上限，請前往數位附錄一鍵壓縮相片／墨跡並匯出備份。'
              : '瀏覽器封鎖了本機儲存（如無痕模式），請即時匯出 JSON 備份以免關閉後流失。'}
          </span>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/p/appendix')}>
            前往處理
          </button>
        </div>
      )}

      <main
        className="stage"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touch.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={(e) => {
          if (!touch.current || !section) return;
          const t = e.changedTouches[0] || {};
          const dx = (t.clientX ?? 0) - touch.current.x;
          const dy = (t.clientY ?? 0) - touch.current.y;
          touch.current = null;
          if (Math.abs(dx) > 75 && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx < 0 ? 1 : -1);
        }}
      >
        <div
          className={cx(
            'stage__inner',
            section && 'stage__inner--page',
            formId && 'stage__inner--forms',
            (scanPath || leaderRoute || parentRoute || parentConnectRoute) && 'stage__inner--scan',
          )}
          style={zoom > 1 ? { zoom } : undefined}
        >
          {printAll ? (
            <PrintBook pages={PAGES} />
          ) : parentConnectRoute ? (
            <ParentConnect />
          ) : parentRoute ? (
            <ParentView
              onShowQr={() => setQrOpen(true)}
              onExit={() => {
                exitParentMode();
                navigate('/');
                push(isEn ? 'Parent mode closed' : '已退回家長模式');
              }}
            />
          ) : leaderRoute ? (
            leader ? (
              <Scan hasBook />
            ) : (
              <LeaderGate mode="page" />
            )
          ) : scanPath ? (
            scanPath === '/scan/signoff' && !leader ? (
              parent ? <ParentConnect /> : <Signoff />
            ) : !leader && !parent ? (
              <LeaderGate mode="gate" />
            ) : scanPath === '/scan/view' ? (
              <ScanView parentMode={parent && !leader} />
            ) : scanPath === '/scan/signoff' ? (
              <Signoff />
            ) : (
              <Scan hasBook parentMode={parent && !leader} />
            )
          ) : formId ? (
            formId === 'index' ? (
              <FormsIndex />
            ) : formId === 'all' ? (
              <FormsAll />
            ) : (
              <FormDoc id={formId} />
            )
          ) : PageComp ? (
            <div className="turn" key={section}>
              <PageComp />
            </div>
          ) : (
            <CoverPage
              book={book}
              onOpen={() => {
                navigate('/p/p01');
                push(isEn ? 'Opened Cub Scout Record Book' : '已打開幼童軍紀錄冊');
              }}
              last={lastMeta}
              onContinue={() => lastMeta && navigate(`/p/${lastMeta.id}`)}
              onLeader={!leader && leaderReady ? () => navigate('/leader') : null}
              onParent={!leader && !parent ? () => navigate('/parent/connect') : null}
            />
          )}
        </div>
      </main>

      {section && !printAll && !scanPath && !leaderRoute && !parentRoute && !parentConnectRoute && (
        <Pager current={section} onOpenIndex={() => setIndexOpen(true)} />
      )}

      {!section && !printAll && !scanPath && !leaderRoute && !formId && (
        <div className="coverhint no-print">
          <span>
            {isEn
              ? `Cover + ${PAGE_TOTAL} official pages · Offline-first · Zero personal data upload`
              : `封面＋對應紙本第 1–${PAGE_TOTAL} 頁 · 點「打開紀錄冊」或按 → 翻開`}
          </span>
        </div>
      )}

      {updateReady && (
        <div className="updatebar no-print" role="status">
          <span>{isEn ? 'New version ready' : 'CUBBOOK 有新版本可用'}</span>
          <button type="button" className="btn btn--gold btn--sm" onClick={() => applyPwaUpdate()}>
            {isEn ? 'Reload' : '立即更新'}
          </button>
        </div>
      )}

      <IndexSheet open={indexOpen} onClose={() => setIndexOpen(false)} current={section} />
      <ShowQrDialog open={qrOpen} onClose={() => setQrOpen(false)} />
      <MenuDialog
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onShowQr={() => {
          setMenuOpen(false);
          setQrOpen(true);
        }}
        leader={leader}
        leaderReady={leaderReady}
        parent={parent}
      />
    </div>
  );
}

function AppInner() {
  const fullLoc = useFullLocation();
  const path = useRoute();
  const [book, setBook] = useState(() => (isParent() ? loadParentBook() : loadBook()));
  const [saveIssue, setSaveIssue] = useState(null);
  const [leader, setLeader] = useState(isLeader);
  const [leaderReady, setLeaderReady] = useState(null);
  const [parent, setParent] = useState(isParent);

  useEffect(() => onLeaderChange(() => setLeader(isLeader())), []);
  useEffect(() => onParentChange(() => setParent(isParent())), []);
  useEffect(() => {
    // 家長模式讀寫獨立鏡像；退出後即回到這部手機原本的成員紀錄冊。
    setBook(parent ? loadParentBook() : loadBook());
  }, [parent]);
  useEffect(() => {
    let live = true;
    leaderAvailable().then((v) => live && setLeaderReady(v));
    return () => {
      live = false;
    };
  }, []);

  const hashMatch = /#v=([^&]+)/.exec(fullLoc);
  const hashToken = hashMatch ? decodeURIComponent(hashMatch[1]) : '';

  const update = useCallback((updater) => {
    if (isLeader() || isParent()) return;
    setBook((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(structuredClone(prev)) : { ...prev, ...updater };
      syncIdentity(next.member);
      next.meta = { ...(next.meta || {}), updatedAt: new Date().toISOString() };
      return next;
    });
  }, []);

  const replace = useCallback(
    (next) => {
      if (isParent()) saveParentBook(next);
      setBook(next);
    },
    [],
  );

  useEffect(() => {
    if (!book || parent) return;
    const t = setTimeout(() => {
      const err = persistBook(book);
      setSaveIssue(err ? (err.name === 'QuotaExceededError' ? 'quota' : 'error') : null);
    }, 220);
    return () => clearTimeout(t);
  }, [book, parent]);

  const ctx = useMemo(
    () => ({ book, update, replace, readOnly: leader || parent, parent }),
    [book, update, replace, leader, parent],
  );

  // 分享連結 #v=... 同樣必須先開啟領袖模式（只讀），普通模式不能讀取他人紀錄冊
  if (hashToken) {
    return (
      <ToastProvider>
        <div className="app app--scan">
          {leader ? <HashSnapshotViewer token={hashToken} /> : <LeaderGate mode="gate" />}
        </div>
      </ToastProvider>
    );
  }

  // 家長模式尚未有鏡像：可先掃描孩子二維碼，或顯示連線頁（連接 BADGE）。
  if (!book && (parent || path === '/parent/connect')) {
    return (
      <ToastProvider>
        <div className="app app--scan">
          {path === '/scan/view' ? (
            <ScanView parentMode />
          ) : path === '/scan' ? (
            <Scan parentMode />
          ) : (
            <ParentConnect />
          )}
        </div>
      </ToastProvider>
    );
  }

  // 未建立個人紀錄冊時進入 /leader、/scan、/scan/view：必須通過 LeaderGate
  if (!book && (path === '/leader' || path === '/scan' || path === '/scan/view')) {
    return (
      <ToastProvider>
        <div className="app app--scan">
          {!leader ? (
            <LeaderGate mode={path === '/leader' ? 'page' : 'gate'} />
          ) : path === '/scan/view' ? (
            <ScanView />
          ) : (
            <Scan hasBook={false} />
          )}
        </div>
      </ToastProvider>
    );
  }

  if (!book) {
    return (
      <ToastProvider>
        <Welcome
          onReady={(next) => replace(next)}
          onLeader={leaderReady ? () => navigate('/leader') : null}
          onParent={() => navigate('/parent/connect')}
        />
      </ToastProvider>
    );
  }

  return (
    <BookCtx.Provider value={ctx}>
      <ToastProvider>
        <BookApp book={book} saveIssue={saveIssue} leader={leader} leaderReady={leaderReady} parent={parent} />
      </ToastProvider>
    </BookCtx.Provider>
  );
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  );
}
