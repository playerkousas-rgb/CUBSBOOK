import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  KIND_MEMBER,
  KIND_SIGNOFF,
  TRANSFER_OPTIONS,
  applySignoff,
  decodePayload,
} from '@shared/transfer.js';
import { syllabusItem } from '@shared/forms.js';
import { otherBadgeRows } from '@shared/book.js';
import { useBook } from '../bookContext.js';
import SignoffPanel from '../components/SignoffPanel.jsx';
import { Crest, Icon, useToast } from '../ui.jsx';
import { Link, navigate } from '../router.jsx';
import { useLang } from '../i18n.jsx';
import { exitLeaderMode } from '../leader.js';
import { enterParentMode, exitParentMode, mirrorFromTransfer, saveParentBook } from '../parent.js';

const SCAN_MEMBER_KEY = 'cubbook.scan.member.v1';
const SCAN_SIGNOFF_KEY = 'cubbook.scan.signoff.v1';
const APPLIED_KEY = 'cubbook.signoff.applied.v1';

const saveSession = (key, data) => {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore */
  }
};

const readSession = (key) => {
  try {
    return JSON.parse(window.sessionStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

/* ============================================================
   相機／貼上掃描器 (/scan) —— 領袖當面唯讀查閱單一成員紀錄冊並簽署回傳碼
   ============================================================ */

export function Scan({ hasBook = true, parentMode = false }) {
  const { isEn } = useLang();
  const videoRef = useRef(null);
  const [status, setStatus] = useState('starting');
  const [error, setError] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState('');

  const routePayload = (payload) => {
    if (payload.t === KIND_SIGNOFF) {
      saveSession(SCAN_SIGNOFF_KEY, payload);
      navigate('/scan/signoff');
    } else if (payload.t === KIND_MEMBER) {
      saveSession(SCAN_MEMBER_KEY, payload);
      navigate('/scan/view');
    }
  };

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector =
      typeof window !== 'undefined' && 'BarcodeDetector' in window
        ? new window.BarcodeDetector({ formats: ['qr_code'] })
        : null;

    const stop = () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const tick = async () => {
      if (stopped) return;
      const v = videoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth > 0) {
        try {
          let raw = '';
          if (detector) {
            const codes = await detector.detect(v);
            if (codes?.[0]?.rawValue) raw = codes[0].rawValue;
          }
          if (!raw && ctx) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
            if (code?.data) raw = code.data;
          }
          if (raw) {
            const payload = await decodePayload(raw);
            stop();
            routePayload(payload);
            return;
          }
        } catch (err) {
          if (err?.message?.includes('CUBBOOK')) setError(err.message);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('blocked');
        setShowManual(true);
        setError(
          isEn
            ? 'Camera unavailable on this browser. Paste the CB1 code below.'
            : '此環境未支援相機鏡頭，請改用下方貼上二維碼代碼。',
        );
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus('scanning');
        raf = requestAnimationFrame(tick);
      } catch {
        setStatus('blocked');
        setShowManual(true);
        setError(
          isEn
            ? 'Camera permission denied or no camera found. You can paste the CB1 code below.'
            : '未能開啟相機（可能未授權或無鏡頭），請使用下方貼上代碼讀取。',
        );
      }
    })();

    return stop;
  }, [isEn]);

  return (
    <div className="scanpage">
      <header className="scanhead">
        <Link to="/" className="scanhead__back" aria-label={isEn ? 'Back' : '返回'}>
          <Icon name="back" size={18} />
        </Link>
        <div style={{ flex: 1 }}>
          <span className="eyebrow">
            {parentMode
              ? isEn
                ? 'PARENT MODE · READ-ONLY'
                : '家長模式 · 只讀'
              : isEn
                ? 'LEADER MODE · READ-ONLY'
                : '領袖只讀模式 · 不修改本機紀錄冊'}
          </span>
          <h1>
            {parentMode
              ? isEn
                ? 'Scan your child’s QR code'
                : '掃描孩子的二維碼'
              : isEn
                ? 'Scan Member Record Book (Read-Only)'
                : '掃描成員紀錄冊（只讀檢視及當面核簽）'}
          </h1>
          <p>
            {parentMode
              ? isEn
                ? 'Point the camera at the QR your child shows. The shared progress becomes a read-only copy on this phone — nothing is sent back, and no sign-off is possible.'
                : '對準孩子手機出示的二維碼即可。分享的進度會成為這部手機上的只讀副本；不會回傳任何內容，亦不能核簽。'
              : isEn
                ? 'Leader Mode is strictly read-only: inspect a member’s shared book sections face-to-face and issue a signed Return QR.'
                : '領袖模式為只讀狀態：對準成員出示的二維碼即可唯讀查閱已分享內容，核對後可當面簽發核簽回傳碼。'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            if (parentMode) {
              exitParentMode();
              navigate('/parent/connect');
              return;
            }
            exitLeaderMode();
            navigate('/');
          }}
        >
          <Icon name="lock" size={13} />{' '}
          {parentMode
            ? isEn
              ? 'Leave parent mode'
              : '退回家長模式'
            : isEn
              ? 'Leave Leader Mode'
              : '退出領袖模式'}
        </button>
      </header>

      <div className={`scanner scanner--${status}`}>
        <video ref={videoRef} className="scanner__video" playsInline muted autoPlay />
        <div className="scanner__frame" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
        {status === 'starting' && (
          <div className="scanner__overlay">
            <Crest size={34} />
            <p>{isEn ? 'Starting camera…' : '正在啟動相機鏡頭…'}</p>
          </div>
        )}
        {status === 'blocked' && (
          <div className="scanner__overlay scanner__overlay--error">
            <Icon name="camera" size={26} />
            <p>{error}</p>
          </div>
        )}
      </div>

      <div className="scanactions">
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setShowManual((v) => !v);
            setError('');
          }}
        >
          <Icon name="copy" size={15} /> {isEn ? 'Paste CB1 Code / Link' : '手動貼上代碼或連結'}
        </button>
        {hasBook && (
          <Link to="/forms" className="btn btn--ghost">
            <Icon name="file" size={15} /> {isEn ? 'Official Forms' : '官方申請表'}
          </Link>
        )}
      </div>

      {showManual && (
        <div className="scanmanual">
          <label>
            <span>{isEn ? 'Paste CB1... code or #v=CB1... link:' : '請貼上以 CB1. 開頭的二維碼內容或唯讀連結：'}</span>
            <textarea
              rows={4}
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="CB1.H4sIAAAAAAAA..."
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            onClick={async () => {
              try {
                const payload = await decodePayload(manual);
                routePayload(payload);
              } catch (e) {
                setError(e.message || (isEn ? 'Unable to decode content' : '未能解讀內容'));
              }
            }}
          >
            <Icon name="check" size={15} /> {isEn ? 'Decode & Open' : '解碼並開啟'}
          </button>
        </div>
      )}

      {error && status !== 'blocked' && <p className="form-error">{error}</p>}
    </div>
  );
}

/* ============================================================
   唯讀快照顯示元件（供領袖掃描頁及 #v=CB1 連結頁共用）
   ============================================================ */

export function MemberPayloadView({ payload, withSignoff = false, onCloseHref = '/scan' }) {
  const { isEn } = useLang();
  const received = TRANSFER_OPTIONS.filter((o) => (payload.sel || []).includes(o.key));
  const m = payload.member || {};
  const c = payload.contact || {};
  const sid = m.scoutId || m.memberNo || payload.scoutId || '';
  const progressEntries = Object.entries(payload.progress || {});
  const summaries = Object.entries(payload.summaries || {});

  return (
    <div className="scanview">
      <div className="scanview__bar">
        <Link to={onCloseHref} className="btn btn--ghost btn--sm">
          <Icon name="back" size={14} /> {isEn ? 'Back' : '返回'}
        </Link>
        <span className="scanview__title">
          {m.nameZh || m.nameEn || (sid ? `#${sid}` : isEn ? 'Cub Scout Member' : '幼童軍成員')} ·{' '}
          {isEn ? `${received.length} sections (Read-Only)` : `只讀檢視 · 今次分享了 ${received.length} 組資料`}
        </span>
      </div>

      <div className="scanview__tags">
        {received.map((o) => (
          <span key={o.key} className={`scanview__tag${o.sensitive ? ' is-sensitive' : ''}`}>
            {isEn ? o.en : o.label}
          </span>
        ))}
      </div>

      {withSignoff && <SignoffPanel payload={{ ...payload, member: { ...m, scoutId: sid } }} />}

      <section className="snapcard">
        <div className="snapcard__head">
          {payload.photo && <img className="snapcard__photo" src={payload.photo} alt={isEn ? 'Member photo' : '近照'} />}
          <div>
            <h2>
              {m.nameZh || (isEn ? '(Progress Only · Name Not Shared)' : '（純進度出示 · 未附個人資料）')}{' '}
              {m.nameEn && <em>{m.nameEn}</em>}
            </h2>
            <p>
              {isEn ? 'Scout ID:' : '童軍成員編號：'} <strong>{sid || '—'}</strong>
              {(m.region || m.district || m.group || m.unit) &&
                ` · ${[m.region, m.district, m.group, m.unit].filter(Boolean).join(' · ')}`}
            </p>
            {(m.vsl || m.dateJoined) && (
              <p className="tiny">
                {m.vsl ? `${isEn ? 'CSL' : '團長'}：${m.vsl}` : ''}{' '}
                {m.dateJoined ? `· ${isEn ? 'Joined' : '入團日期'}：${m.dateJoined}` : ''}
              </p>
            )}
          </div>
        </div>

        {Object.keys(c).length > 0 && (
          <div className="snapcard__sec">
            <h3>{isEn ? 'Contact & Emergency' : '聯絡及緊急聯絡人'}</h3>
            <p>
              {isEn ? 'Phone' : '電話'}：{c.phone || '—'} · {isEn ? 'Email' : '電郵'}：{c.email || '—'}
            </p>
            {c.addressZh && (
              <p>
                {isEn ? 'Address' : '地址'}：{c.addressZh}
              </p>
            )}
            {(c.emergencyName || c.emergencyPhone) && (
              <p>
                {isEn ? 'Emergency Contact' : '緊急聯絡人'}：{c.emergencyName || '—'}（{c.emergencyPhone || '—'}）
              </p>
            )}
          </div>
        )}

        {summaries.length > 0 && (
          <div className="snapcard__sec">
            <h3>{isEn ? 'Badge & Bar Summaries' : '段章及金帶活動簡述／評語'}</h3>
            <dl className="snapsums">
              {summaries.map(([k, val]) => (
                <div key={k}>
                  <dt>{val?.label || k}</dt>
                  <dd>{val?.text || String(val)}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {progressEntries.length > 0 && (
          <div className="snapcard__sec">
            <h3>
              {isEn ? 'Completed Syllabus Items' : '已記錄訓練細項'}（{progressEntries.length}）
            </h3>
            <ul className="snapprog">
              {progressEntries.map(([id, row]) => {
                const it = syllabusItem(id);
                return (
                  <li key={id}>
                    <div>
                      <strong>{isEn && it?.en ? it.en : it?.name || id}</strong>
                      <small>
                        {row.date}
                        {row.assessor ? ` · ${isEn ? 'Assessor' : '主考'}：${row.assessor}` : ''}
                        {row.cert ? ` · ${isEn ? 'Cert' : '證書'}：${row.cert}` : ''}
                      </small>
                    </div>
                    {payload.signatures?.[id]?.png && <img src={payload.signatures[id].png} alt={isEn ? 'Signature' : '簽名'} />}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>

    </div>
  );
}

export function ScanView({ parentMode = false }) {
  const payload = readSession(SCAN_MEMBER_KEY);
  const { isEn } = useLang();
  const [saved, setSaved] = useState('');
  if (!payload) {
    return (
      <div className="scanpage">
        <header className="scanhead">
          <Link to="/scan" className="scanhead__back" aria-label={isEn ? 'Back' : '返回'}>
            <Icon name="back" size={18} />
          </Link>
          <div>
            <h1>{isEn ? 'No Member QR Scanned Yet' : '尚未掃描成員二維碼'}</h1>
            <p>{isEn ? 'Scan a member QR code first.' : '請先對準成員手機上的二維碼進行掃描。'}</p>
          </div>
        </header>
        <Link to="/scan" className="btn btn--primary">
          <Icon name="qr" size={15} /> {isEn ? 'Open Scanner' : '前往掃描'}
        </Link>
      </div>
    );
  }
  const saveAsParentCopy = () => {
    try {
      const res = mirrorFromTransfer(payload);
      saveParentBook(res.book);
      enterParentMode();
      setSaved(
        isEn
          ? `Saved ${res.imported} shared items as a read-only copy on this phone.`
          : `已把 ${res.imported} 項分享內容存為這部手機上的只讀副本。`,
      );
      navigate('/parent');
    } catch (err) {
      setSaved(err.message || (isEn ? 'Cannot read this QR code' : '無法讀取這個二維碼'));
    }
  };

  return (
    <>
      {parentMode && (
        <div className="parentsave">
          <span>
            {isEn
              ? 'Parent mode: this QR is a one-off snapshot. Save it to review again later — it stays read-only.'
              : '家長模式：這個二維碼是一次性快照。可存為只讀副本，日後再查看。'}
          </span>
          <button type="button" className="btn btn--gold btn--sm" onClick={saveAsParentCopy}>
            <Icon name="download" size={14} /> {isEn ? 'Save as parent copy' : '存為家長只讀副本'}
          </button>
          {saved && <em>{saved}</em>}
        </div>
      )}
      <MemberPayloadView payload={payload} withSignoff={!parentMode} onCloseHref={parentMode ? '/parent/connect' : '/scan'} />
    </>
  );
}

/* ============================================================
   成員接收領袖當面核簽回傳碼 (/scan/signoff)
   ============================================================ */

export function Signoff() {
  const { book, replace } = useBook();
  const { push } = useToast();
  const { isEn } = useLang();
  const payload = readSession(SCAN_SIGNOFF_KEY);
  const [done, setDone] = useState(null);

  const appliedList = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(APPLIED_KEY) || '[]');
    } catch {
      return [];
    }
  }, []);

  if (!payload) {
    return (
      <div className="scanpage">
        <header className="scanhead">
          <Link to="/" className="scanhead__back" aria-label={isEn ? 'Back' : '返回'}>
            <Icon name="back" size={18} />
          </Link>
          <div>
            <h1>{isEn ? 'No Sign-off Return QR Found' : '未收到領袖核簽單'}</h1>
          </div>
        </header>
        <Link to="/" className="btn btn--primary">
          {isEn ? 'Back to Cover' : '返回封面'}
        </Link>
      </div>
    );
  }

  const already = appliedList.includes(payload.seq);
  const rows = (payload.items || []).map((item) => {
    const cur = book.progress?.[item.id] || {};
    const it = syllabusItem(item.id);
    return {
      id: item.id,
      name: isEn && it?.en ? it.en : it?.name || item.id,
      beforeDate: cur.date || '',
      beforeAssessor: cur.assessor || '',
      date: item.date || '',
      assessor: item.assessor || payload.leader?.name || '',
    };
  });

  // 領袖核簽單內的活動徽章（含分級徽章逐級一行），令成員寫入前睇得到會改邊一級
  const badgeRows = otherBadgeRows(payload.otherBadges, { lang: isEn ? 'en' : 'zh' }).map((r) => {
    const cur = book.otherBadges?.[r.bookId] || {};
    const beforeDate = r.level ? cur.levels?.[r.level]?.date || '' : cur.date || '';
    return { ...r, beforeDate };
  });
  const totalRows = rows.length + badgeRows.length;

  const apply = () => {
    try {
      const { book: next, changes } = applySignoff(book, payload);
      replace(next);
      try {
        localStorage.setItem(APPLIED_KEY, JSON.stringify([payload.seq, ...appliedList].slice(0, 40)));
      } catch {
        /* ignore */
      }
      setDone(changes);
      push(isEn ? `Applied ${changes.length} leader sign-offs` : `已寫入 ${changes.length} 項領袖核簽`);
    } catch (e) {
      push(e.message || (isEn ? 'Failed to apply sign-off' : '寫入失敗'), 'error');
    }
  };

  return (
    <div className="scanpage signoffpage">
      <header className="scanhead">
        <Link to="/" className="scanhead__back" aria-label={isEn ? 'Back' : '返回'}>
          <Icon name="back" size={18} />
        </Link>
        <div>
          <span className="eyebrow">
            {isEn ? 'LEADER SIGN-OFF SLIP' : '領袖當面核簽回傳單'}
          </span>
          <h1>
            {payload.leader?.name || (isEn ? 'Leader' : '領袖')} · {totalRows} {isEn ? 'items' : '項核簽'}
          </h1>
          <p>
            {already
              ? isEn
                ? 'This sign-off slip was already applied earlier.'
                : '這張核簽單之前已經寫入過你的紀錄冊。'
              : isEn
                ? 'Confirm below to write these signatures and dates into your local record book.'
                : '確認無誤後按下方按鈕，即可將領袖簽名寫入你的本機紀錄冊。'}
          </p>
        </div>
      </header>

      {payload.leader?.png && (
        <div className="signoffsig">
          <img src={payload.leader.png} alt={isEn ? 'Leader signature' : '領袖簽名'} />
          <span>{[payload.leader.name, payload.leader.title, payload.leader.at].filter(Boolean).join(' · ')}</span>
        </div>
      )}

      <ul className="signofflist">
        {rows.map((r) => (
          <li key={`item:${r.id}`}>
            <strong>{r.name}</strong>
            <span className="signofflist__dates">
              <em>{r.beforeDate || (isEn ? 'Unset' : '未填')}</em> → <b>{r.date}</b> ·{' '}
              <em>{r.beforeAssessor || (isEn ? 'Unsigned' : '未簽')}</em> → <b>{r.assessor}</b>
            </span>
          </li>
        ))}
        {badgeRows.map((r) => (
          <li key={`badge:${r.key}`}>
            <strong>{r.name}</strong>
            <span className="signofflist__dates">
              <em>{r.beforeDate || (isEn ? 'Unset' : '未填')}</em> → <b>{r.date}</b>
              {r.cert ? ` · ${isEn ? 'Cert' : '證書'} ${r.cert}` : ''}
            </span>
          </li>
        ))}
      </ul>

      {done ? (
        <div className="signoffdone">
          <Crest size={30} />
          <p>{isEn ? `Updated ${done.length} items in your book!` : `已成功寫入 ${done.length} 項核簽！`}</p>
          <button type="button" className="btn btn--primary" onClick={() => navigate('/p/contents')}>
            {isEn ? 'View Record Book' : '查看紀錄冊內頁'}
          </button>
        </div>
      ) : (
        <div className="signoffactions">
          <button type="button" className="btn btn--primary" onClick={apply}>
            <Icon name="check" size={15} /> {isEn ? 'Write Sign-off into My Book' : '確認寫入我的紀錄冊'}
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
            {isEn ? 'Cancel' : '取消'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   純前端 URL Fragment 唯讀快照檢視器 (/#v=CB1...)
   ============================================================ */

export function HashSnapshotViewer({ token }) {
  const { isEn } = useLang();
  const [state, setState] = useState({ loading: true, payload: null, error: '' });

  useEffect(() => {
    let alive = true;
    decodePayload(token)
      .then((payload) => alive && setState({ loading: false, payload, error: '' }))
      .catch((err) => alive && setState({ loading: false, payload: null, error: err.message || '連結內容損壞' }));
    return () => {
      alive = false;
    };
  }, [token]);

  if (state.loading) {
    return (
      <div className="scanpage">
        <p>{isEn ? 'Decoding read-only snapshot locally…' : '正在本機解碼唯讀紀錄冊快照…'}</p>
      </div>
    );
  }
  if (state.error || !state.payload) {
    return (
      <div className="scanpage">
        <h1>{isEn ? 'Unable to Read Shared Link' : '未能讀取分享連結'}</h1>
        <p className="form-error">{state.error}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            window.location.hash = '';
            navigate('/');
          }}
        >
          {isEn ? 'Back to Home' : '返回首頁'}
        </button>
      </div>
    );
  }
  return <MemberPayloadView payload={state.payload} withSignoff onCloseHref="/" />;
}
