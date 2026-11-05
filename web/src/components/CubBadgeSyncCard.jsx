import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collectPendingForBadge,
  exportForBadge,
  importFromBadge,
  scoutId,
} from '@shared/book.js';
import { useBook } from '../bookContext.js';
import { download, slugify } from '../bookStore.js';
import { useLang } from '../i18n.jsx';
import { Icon, useToast } from '../ui.jsx';
import { probeCubBadgeBridge } from '../cubadgeBridge.js';

const CUBBADGE_MEMBER_SESSION_KEY = 'cubbook.cubbadge.member.v1';

function readMemberSession() {
  try {
    return JSON.parse(window.sessionStorage.getItem(CUBBADGE_MEMBER_SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeMemberSession(sess) {
  try {
    if (!sess) window.sessionStorage.removeItem(CUBBADGE_MEMBER_SESSION_KEY);
    else window.sessionStorage.setItem(CUBBADGE_MEMBER_SESSION_KEY, JSON.stringify(sess));
  } catch {
    /* ignore */
  }
}

export default function CubBadgeSyncCard({ readOnly = false }) {
  const { book, update, replace } = useBook();
  const { push } = useToast();
  const { isEn } = useLang();
  const fileRef = useRef(null);

  const mySid = scoutId(book?.member);
  const [troops, setTroops] = useState({});
  const [troopId, setTroopId] = useState(() => readMemberSession()?.troopId || '');
  const [loginYmis, setLoginYmis] = useState(() => mySid || readMemberSession()?.ymis || '');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(() => readMemberSession());
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  // 'checking' → 尚未探測；'ready' → 伺服器端橋接可用；'unavailable' → 純靜態部署，BOOK 以獨立模式運作
  const [bridge, setBridge] = useState('checking');
  const [remoteConfirmed, setRemoteConfirmed] = useState({});
  const [remotePendingIds, setRemotePendingIds] = useState([]);

  useEffect(() => {
    if (mySid && !loginYmis) setLoginYmis(mySid);
  }, [mySid, loginYmis]);

  const probeBridge = useCallback(async () => {
    setBridge('checking');
    const result = await probeCubBadgeBridge();
    // 靜態主機（GitHub Pages／S3／本機 file://）沒有 /api：BOOK 仍 100% 可用，只是少了自動同步。
    if (!result.available) {
      setBridge('unavailable');
      return;
    }
    setTroops(result.troops);
    setBridge('ready');
    if (!troopId) {
      const first = Object.keys(result.troops)[0];
      if (first) setTroopId(first);
    }
  }, [troopId]);

  useEffect(() => {
    probeBridge();
    // 只在首次掛載探測一次；使用者可按「重新偵測」再試。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmedInBookCount = useMemo(
    () =>
      Object.values(book?.progress || {}).filter(
        (p) => p?.date && (p.confirmedByBadge || p.signature?.png || p.signedAt),
      ).length +
      Object.values(book?.otherBadges || {}).filter((p) => p?.date && p.confirmedByBadge).length,
    [book],
  );

  const pendingToSubmit = useMemo(
    () => collectPendingForBadge(book, remoteConfirmed, remotePendingIds),
    [book, remoteConfirmed, remotePendingIds],
  );

  const pullConfirmedFromCloud = async (activeSession = session) => {
    if (!activeSession?.token || !activeSession?.troopId || !activeSession?.ymis) return;
    if (readOnly) {
      push(isEn ? 'Exit Leader Mode to update your personal book' : '領袖只讀模式下不會修改本機紀錄冊', 'error');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/cubbadge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          troopId: activeSession.troopId,
          action: 'load',
          data: { token: activeSession.token, ymis: activeSession.ymis },
        }),
      });
      const json = await r.json();
      if (!json?.success) {
        if (r.status === 401) {
          setSession(null);
          writeMemberSession(null);
        }
        throw new Error(json?.error || (isEn ? 'Failed to fetch from cubbadge' : '讀取 cubbadge 失敗'));
      }

      const confirmedMap = {
        ...(json.progress?.[activeSession.ymis] || {}),
        ...(json.otherBadges?.[activeSession.ymis] || {}),
      };
      const pendingIds = (json.pendingRequests || []).map((x) => x.item_id).filter(Boolean);
      setRemoteConfirmed(confirmedMap);
      setRemotePendingIds(pendingIds);

      const res = importFromBadge(json, book, { expectedScoutId: activeSession.ymis });
      replace(res.book);
      push(
        isEn
          ? `Imported ${res.imported} leader-confirmed items${res.skippedPending ? ` (${res.skippedPending} unconfirmed skipped)` : ''}`
          : `已無條件錄入 ${res.imported} 項領袖已核實進度${
              res.skippedPending ? `（另有 ${res.skippedPending} 項待領袖核實，未錄入）` : ''
            }`,
      );
    } catch (err) {
      push(err.message || (isEn ? 'Sync failed' : '同步失敗'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const cleanTroop = troopId.trim();
    const cleanYmis = (loginYmis || mySid || '').trim();
    if (!cleanTroop || !cleanYmis || !password) {
      push(
        isEn
          ? 'Enter Group ID, your Scout ID and cubbadge password'
          : '請填寫旅團編號、你的童軍成員編號及 cubbadge 密碼',
        'error',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/cubbadge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          troopId: cleanTroop,
          action: 'login',
          data: { login_id: cleanYmis, password },
        }),
      });
      const json = await r.json();
      if (!json?.success || !json?.token) {
        throw new Error(json?.error || (isEn ? 'Sign-in failed' : '登入 cubbadge 失敗'));
      }
      const nextSess = {
        troopId: cleanTroop,
        troopName: troops[cleanTroop]?.name || cleanTroop,
        token: json.token,
        ymis: json.ymis || cleanYmis,
      };
      setSession(nextSess);
      writeMemberSession(nextSess);
      // 空白簿免填個人資料即可同步：只綁定 SCOUT ID，不寫入任何其他個人資料。
      if (!mySid) {
        update((b) => ({
          ...b,
          member: { ...(b.member || {}), scoutId: nextSess.ymis, memberNo: nextSess.ymis },
        }));
        setLoginYmis(nextSess.ymis);
      }
      setPassword('');
      setShowLogin(false);
      if (!readOnly) {
        await pullConfirmedFromCloud(nextSess);
      } else {
        push(isEn ? 'Connected to cubbadge' : '已連接 cubbadge');
      }
    } catch (err) {
      push(err.message || (isEn ? 'Sign-in failed' : '登入失敗'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const submitBookProgressAsPending = async () => {
    if (!session?.token || !session?.troopId || !session?.ymis) {
      setShowLogin(true);
      push(
        isEn
          ? 'Sign in to your cubbadge account first'
          : '請先連接你的 cubbadge 帳戶，再送交待核實進度',
        'error',
      );
      return;
    }
    if (pendingToSubmit.length === 0) {
      push(
        isEn
          ? 'All recorded items are already confirmed or pending in cubbadge'
          : '紀錄冊內的項目均已在 cubbadge 核實或等候領袖批核，無須重複送出',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/cubbadge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          troopId: session.troopId,
          action: 'submitPending',
          data: {
            token: session.token,
            ymis: session.ymis,
            items: pendingToSubmit,
          },
        }),
      });
      const json = await r.json();
      if (!json?.success) {
        throw new Error(json?.error || (isEn ? 'Submission failed' : '送交失敗'));
      }
      setRemotePendingIds((prev) => [
        ...new Set([...prev, ...pendingToSubmit.map((x) => x.itemId)]),
      ]);
      push(
        isEn
          ? `Sent ${json.submitted} items to cubbadge as Pending Leader Confirmation`
          : `已將 ${json.submitted} 項進度送交 cubbadge「待領袖核實」（領袖 CONFIRM 後即可錄入回紀錄冊）`,
      );
    } catch (err) {
      push(err.message || (isEn ? 'Failed to submit to cubbadge' : '送交 cubbadge 失敗'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (readOnly) {
      push(isEn ? 'Exit Leader Mode to import into your book' : '領袖只讀模式下不可匯入修改本機紀錄冊', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || '{}'));
        const res = importFromBadge(parsed, book, { expectedScoutId: mySid || session?.ymis || '' });
        replace(res.book);
        push(
          isEn
            ? `Imported ${res.imported} leader-confirmed items${res.skippedPending ? ` (${res.skippedPending} unconfirmed skipped)` : ''}`
            : `已錄入 ${res.imported} 項領袖已核實進度${
                res.skippedPending ? `（已略過 ${res.skippedPending} 項未核實項目）` : ''
              }`,
        );
      } catch (err) {
        push(err.message || (isEn ? 'Import failed' : '匯入 cubbadge 失敗'), 'error');
      }
    };
    reader.readAsText(file);
  };

  const troopEntries = Object.entries(troops);

  return (
    <section className="appxcard cubsync">
      <h3>
        <Icon name="verified" size={16} />{' '}
        {isEn
          ? 'Optional: Sync Progress with cubbadge (Progress Only · Zero Personal Data)'
          : '可選：與 cubbadge 同步個人進度（只同步進度 · 不錄入個人資料）'}
      </h3>
      <p className="tiny">
        {isEn
          ? 'Everything works without cubbadge. Connecting only saves double typing: BOOK → cubbadge always submits as “Pending Leader Confirmation” (cannot self-confirm); cubbadge → BOOK trusts only leader-confirmed items.'
          : '不連接亦可用完整紀錄冊、簽名、列印與二維碼。連接後可免除重複輸入：由 BOOK 送往 cubbadge 一律轉為「待領袖核實（pending）」，必須由領袖在 cubbadge 內 CONFIRM；由 cubbadge 錄入回 BOOK 時，只無條件相信領袖已核實的資料，未核實項目絕不錄入。'}
      </p>

      {bridge === 'unavailable' && (
        <div className="cubsync__offline">
          <Icon name="info" size={15} />
          <div>
            <strong>{isEn ? 'Running in standalone mode' : '現時以獨立模式運作'}</strong>
            <p>
              {isEn
                ? 'This deployment has no cubbadge bridge (static hosting). Your record book is fully usable: pages, signatures, forms, printing and QR all work offline. You can still exchange progress with a leader using the JSON file below.'
                : '此部署未接駁 cubbadge（純靜態主機）。紀錄冊全部功能照常運作：逐頁填寫、簽名、表格、列印及二維碼均可離線使用。你仍可用下方 JSON 檔與領袖交換進度。'}
            </p>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={probeBridge}>
            <Icon name="refresh" size={13} /> {isEn ? 'Retry' : '重新偵測'}
          </button>
        </div>
      )}

      <div className="cubsync__stats">
        <span>
          <b>{confirmedInBookCount}</b>{' '}
          {isEn ? 'Confirmed / Signed in BOOK' : '項已獲核實／領袖簽署'}
        </span>
        <span>
          <b>{pendingToSubmit.length}</b>{' '}
          {isEn ? 'Unconfirmed in BOOK (Ready to Submit)' : '項本機新填（待送交 cubbadge 核實）'}
        </span>
        {remotePendingIds.length > 0 && (
          <span>
            <b>{remotePendingIds.length}</b>{' '}
            {isEn ? 'Waiting for Leader in cubbadge' : '項正在 cubbadge 等候領袖 CONFIRM'}
          </span>
        )}
      </div>

      {/* 雲端直連 cubbadge */}
      <div className="appxbtns">
        {session ? (
          <>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={busy || readOnly}
              onClick={() => pullConfirmedFromCloud(session)}
            >
              <Icon name="download" size={14} />{' '}
              {isEn
                ? 'Pull Leader-Confirmed from cubbadge'
                : '從 cubbadge 錄入「領袖已核實」進度'}
            </button>
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={busy || pendingToSubmit.length === 0}
              onClick={submitBookProgressAsPending}
            >
              <Icon name="upload" size={14} />{' '}
              {isEn
                ? `Submit to cubbadge as Pending (${pendingToSubmit.length})`
                : `送交 cubbadge 待領袖核實（${pendingToSubmit.length} 項）`}
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              disabled={busy}
              onClick={() => {
                setSession(null);
                writeMemberSession(null);
                setRemoteConfirmed({});
                setRemotePendingIds([]);
                push(isEn ? 'Signed out of cubbadge' : '已中斷 cubbadge 連線');
              }}
            >
              {isEn ? `Disconnect (${session.ymis})` : `登出（${session.ymis}）`}
            </button>
          </>
        ) : (
          bridge !== 'unavailable' && (
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={bridge === 'checking'}
              onClick={() => setShowLogin((v) => !v)}
            >
              <Icon name="link" size={14} />{' '}
              {bridge === 'checking'
                ? isEn
                  ? 'Checking cubbadge…'
                  : '正在偵測 cubbadge…'
                : isEn
                  ? 'Connect My cubbadge Account'
                  : '連接我的 cubbadge 帳戶（一鍵同步）'}
            </button>
          )
        )}
      </div>

      {showLogin && !session && (
        <form className="cubsync__login" onSubmit={handleLogin}>
          <div className="cubsync__fields">
            <label>
              <span>{isEn ? 'Group / Unit' : '所屬旅團'}</span>
              {troopEntries.length > 0 ? (
                <select value={troopId} onChange={(e) => setTroopId(e.target.value)}>
                  {troopEntries.map(([id, info]) => (
                    <option key={id} value={id}>
                      {id} · {isEn && info.en ? info.en : info.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={troopId}
                  onChange={(e) => setTroopId(e.target.value)}
                  placeholder={isEn ? 'e.g. 0082' : '旅團編號（如 0082）'}
                />
              )}
            </label>
            <label>
              <span>{isEn ? 'My Scout ID (YMIS)' : '我的童軍成員編號'}</span>
              <input
                type="text"
                inputMode="numeric"
                value={loginYmis}
                onChange={(e) => setLoginYmis(e.target.value)}
                placeholder={isEn ? '10-digit Scout ID' : '10 位童軍成員編號'}
              />
            </label>
            <label>
              <span>{isEn ? 'cubbadge Password' : 'cubbadge 密碼'}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </label>
            <button type="submit" className="btn btn--primary btn--sm" disabled={busy}>
              {busy
                ? isEn
                  ? 'Connecting…'
                  : '連線中…'
                : isEn
                  ? 'Connect & Sync Confirmed'
                  : '登入並錄入已核實進度'}
            </button>
          </div>
        </form>
      )}

      {/* 離線 JSON 交換 */}
      <div className="appxbtns cubsync__files">
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => {
            const payload = exportForBadge(book, session?.troopId || troopId || '');
            download(`cubbook-pending-for-cubbadge-${slugify(mySid || 'member')}.json`, payload);
            push(
              isEn
                ? 'Exported Pending submission JSON (status: pending, zero personal data)'
                : '已匯出「待領袖核實」純進度檔（status: pending，不含個人資料）',
            );
          }}
        >
          <Icon name="download" size={14} />{' '}
          {isEn
            ? 'Export Pending JSON for cubbadge'
            : '匯出「待領袖核實」進度檔（供 cubbadge）'}
        </button>

        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          disabled={readOnly}
          onClick={() => fileRef.current?.click()}
        >
          <Icon name="upload" size={14} />{' '}
          {isEn
            ? 'Import Confirmed JSON from cubbadge'
            : '從 cubbadge 匯入「領袖已核實」進度檔'}
        </button>
      </div>
    </section>
  );
}
