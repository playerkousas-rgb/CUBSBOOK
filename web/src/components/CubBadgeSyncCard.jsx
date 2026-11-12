import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEMO_NOTICE,
  DEMO_SYNC_BLOCKED,
  collectPendingForBadge,
  exportForBadge,
  importFromBadge,
  isDemoBook,
  scoutId,
} from '@shared/book.js';
import { useBook } from '../bookContext.js';
import { download, slugify } from '../bookStore.js';
import { useLang } from '../i18n.jsx';
import { Icon, useToast } from '../ui.jsx';
import { DEFAULT_CUBSBADGE_URL, probeCubBadgeBridge } from '../cubadgeBridge.js';

const CUBBADGE_MEMBER_SESSION_KEY = 'cubbook.cubbadge.member.v1';
const TROOP_NOT_FOUND = '__NOT_FOUND__';

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

/**
 * 示範紀錄冊（虛構資料）一律不顯示任何連線、送交或匯出入口：
 * 連登入表單也不渲染，亦不會向 /api/cubbadge 發出任何請求。
 */
function DemoSyncLocked() {
  const { isEn } = useLang();
  return (
    <section className="appxcard cubsync cubsync--demo" data-demo-sync="blocked">
      <h3>
        <Icon name="lock" size={16} />{' '}
        {isEn ? 'CUBSBADGE Sync Is Disabled for Demo Data' : '示範資料不可同步至 CUBSBADGE'}
      </h3>
      <p className="cubsync__demo-notice">{isEn ? DEMO_NOTICE.en : DEMO_NOTICE.zh}</p>
      <p className="tiny">{isEn ? DEMO_SYNC_BLOCKED.en : DEMO_SYNC_BLOCKED.zh}</p>
      <p className="tiny">
        {isEn
          ? 'To use sync: open “Sample Data & Reset” below and start a new blank record book, or restore your own backup.'
          : '如要使用同步：請在下方「示範資料與重設」建立全新空白紀錄冊，或匯入自己的備份。'}
      </p>
    </section>
  );
}

export default function CubBadgeSyncCard(props) {
  const { book } = useBook();
  if (isDemoBook(book)) return <DemoSyncLocked />;
  return <CubBadgeSyncLive {...props} />;
}

function CubBadgeSyncLive({ readOnly = false }) {
  const { book, update, replace } = useBook();
  const { push } = useToast();
  const { isEn } = useLang();
  const fileRef = useRef(null);

  const mySid = scoutId(book?.member);
  const [troops, setTroops] = useState({});
  const [badgeOrigin, setBadgeOrigin] = useState(DEFAULT_CUBSBADGE_URL);
  const [upstreamOk, setUpstreamOk] = useState(true);
  const [troopId, setTroopId] = useState(() => readMemberSession()?.troopId || '');
  const [manualTroop, setManualTroop] = useState(false);
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
    const nextTroops = result.troops || {};
    setTroops(nextTroops);
    setBadgeOrigin(result.origin || DEFAULT_CUBSBADGE_URL);
    setUpstreamOk(result.upstreamOk !== false);
    setBridge('ready');
    const keys = Object.keys(nextTroops);
    if (keys.length > 0) setManualTroop(false);
    setTroopId((prev) => {
      if (prev && prev !== TROOP_NOT_FOUND && nextTroops[prev]) return prev;
      if (keys.length === 1) return keys[0];
      return '';
    });
  }, []);

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
      Object.values(book?.otherBadges || {}).reduce((n, p) => {
        if (!p) return n;
        const levelHits = Object.values(p.levels || {}).filter((row) => row?.date && row.confirmedByBadge).length;
        if (levelHits) return n + levelHits;
        return n + (p.date && p.confirmedByBadge ? 1 : 0);
      }, 0),
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
        throw new Error(json?.error || (isEn ? 'Failed to fetch from CUBSBADGE' : '讀取 CUBSBADGE 失敗'));
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
    if (!cleanTroop || cleanTroop === TROOP_NOT_FOUND || !cleanYmis || !password) {
      push(
        isEn
          ? 'Select your Group ID, enter your Scout ID and CUBSBADGE password'
          : '請選擇所屬旅團，並填寫你的童軍成員編號及 CUBSBADGE 密碼',
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
        throw new Error(json?.error || (isEn ? 'Sign-in failed' : '登入 CUBSBADGE 失敗'));
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
        push(isEn ? 'Connected to CUBSBADGE' : '已連接 CUBSBADGE');
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
          ? 'Sign in to your CUBSBADGE account first'
          : '請先連接你的 CUBSBADGE 帳戶，再送交待核實進度',
        'error',
      );
      return;
    }
    if (pendingToSubmit.length === 0) {
      push(
        isEn
          ? 'All recorded items are already confirmed or pending in CUBSBADGE'
          : '紀錄冊內的項目均已在 CUBSBADGE 核實或等候領袖批核，無須重複送出',
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
        ...new Set([
          ...prev,
          // 分級徽章以 `A26-E` 記住「哪一級已送交」，否則第二級會被當成重複而漏送
          ...pendingToSubmit.map((x) => (x.level ? `${x.itemId}-${x.level}` : x.itemId)),
        ]),
      ]);
      push(
        isEn
          ? `Sent ${json.submitted} items to CUBSBADGE as Pending Leader Confirmation`
          : `已將 ${json.submitted} 項進度送交 CUBSBADGE「待領袖核實」（領袖 CONFIRM 後即可錄入回紀錄冊）`,
      );
    } catch (err) {
      push(err.message || (isEn ? 'Failed to submit to CUBSBADGE' : '送交 CUBSBADGE 失敗'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onExportFile = () => {
    if (!session?.token || !session?.ymis) {
      push(
        isEn
          ? 'Connect and sign in to your CUBSBADGE account first before exporting progress'
          : '請先連接並登入 CUBSBADGE 帳戶，方可匯出「待領袖核實」進度檔',
        'error',
      );
      return;
    }
    const payload = exportForBadge(book, session.troopId || troopId || '');
    download(`cubbook-pending-for-cubbadge-${slugify(mySid || session.ymis || 'member')}.json`, payload);
    push(
      isEn
        ? 'Exported Pending submission JSON (status: pending, zero personal data)'
        : '已匯出「待領袖核實」純進度檔（status: pending，不含個人資料）',
    );
  };

  const onImportFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!session?.token || !session?.ymis) {
      push(
        isEn
          ? 'Connect and sign in to your CUBSBADGE account first before importing progress'
          : '請先連接並登入 CUBSBADGE 帳戶，方可從 CUBSBADGE 匯入進度檔',
        'error',
      );
      return;
    }
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
        push(err.message || (isEn ? 'Import failed' : '匯入 CUBSBADGE 失敗'), 'error');
      }
    };
    reader.readAsText(file);
  };

  const troopEntries = Object.entries(troops);
  const noTroopsFound = bridge === 'ready' && troopEntries.length === 0;
  const troopNotListed = troopId === TROOP_NOT_FOUND;
  const showOpenAccountNotice = bridge === 'ready' && !session && ((noTroopsFound && !manualTroop) || troopNotListed);

  return (
    <section className="appxcard cubsync">
      <h3>
        <Icon name="verified" size={16} />{' '}
        {isEn
          ? 'Optional: Sync Progress with CUBSBADGE (Progress Only · Zero Personal Data)'
          : '可選：與 CUBSBADGE 同步個人進度（只同步進度 · 不錄入個人資料）'}
      </h3>
      <p className="tiny">
        {isEn
          ? 'Everything works without CUBSBADGE. Connecting only saves double typing: BOOK → CUBSBADGE always submits as “Pending Leader Confirmation” (cannot self-confirm); CUBSBADGE → BOOK trusts only leader-confirmed items.'
          : '不連接亦可用完整紀錄冊、簽名、列印與二維碼。連接後可免除重複輸入：由 BOOK 送往 CUBSBADGE 一律轉為「待領袖核實（pending）」，必須由領袖在 CUBSBADGE 內 CONFIRM；由 CUBSBADGE 錄入回 BOOK 時，只無條件相信領袖已核實的資料，未核實項目絕不錄入。'}
      </p>

      {bridge === 'unavailable' && (
        <div className="cubsync__offline">
          <Icon name="info" size={15} />
          <div>
            <strong>{isEn ? 'Running in standalone mode' : '現時以獨立模式運作'}</strong>
            <p>
              {isEn
                ? 'This deployment has no CUBSBADGE bridge (static hosting). Your record book is fully usable: pages, signatures, forms, printing, QR and full book backups below all work offline.'
                : '此部署未接駁 CUBSBADGE（純靜態主機）。紀錄冊全部功能照常運作：逐頁填寫、簽名、表格、列印、二維碼及下方完整備份均可離線使用。'}
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
          {isEn ? 'Unconfirmed in BOOK (Ready to Submit)' : '項本機新填（待送交 CUBSBADGE 核實）'}
        </span>
        {remotePendingIds.length > 0 && (
          <span>
            <b>{remotePendingIds.length}</b>{' '}
            {isEn ? 'Waiting for Leader in CUBSBADGE' : '項正在 CUBSBADGE 等候領袖 CONFIRM'}
          </span>
        )}
      </div>

      {/* 雲端直連 CUBSBADGE */}
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
                ? 'Pull Leader-Confirmed from CUBSBADGE'
                : '從 CUBSBADGE 錄入「領袖已核實」進度'}
            </button>
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={busy || pendingToSubmit.length === 0}
              onClick={submitBookProgressAsPending}
            >
              <Icon name="upload" size={14} />{' '}
              {isEn
                ? `Submit to CUBSBADGE as Pending (${pendingToSubmit.length})`
                : `送交 CUBSBADGE 待領袖核實（${pendingToSubmit.length} 項）`}
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
                push(isEn ? 'Signed out of cubbadge' : '已中斷 CUBSBADGE 連線');
              }}
            >
              {isEn ? `Disconnect (${session.ymis})` : `登出（${session.ymis}）`}
            </button>
          </>
        ) : (
          bridge !== 'unavailable' &&
          (troopEntries.length > 0 || manualTroop || bridge === 'checking') && (
            <button
              type="button"
              className="btn btn--gold btn--sm"
              disabled={bridge === 'checking'}
              onClick={() => setShowLogin((v) => !v)}
            >
              <Icon name="link" size={14} />{' '}
              {bridge === 'checking'
                ? isEn
                  ? 'Checking CUBSBADGE…'
                  : '正在偵測 CUBSBADGE…'
                : troopEntries.length > 0
                  ? isEn
                    ? `Connect My CUBSBADGE Account (${troopEntries.length} groups found)`
                    : `連接我的 CUBSBADGE 帳戶（已自動讀取 ${troopEntries.length} 個旅團）`
                  : isEn
                    ? 'Connect My CUBSBADGE Account'
                    : '連接我的 CUBSBADGE 帳戶（一鍵同步）'}
            </button>
          )
        )}
      </div>

      {showLogin && !session && (troopEntries.length > 0 || manualTroop) && (
        <form className="cubsync__login" onSubmit={handleLogin}>
          <div className="cubsync__fields">
            <div className="cubsync__field">
              <div className="cubsync__labelrow">
                <label htmlFor="cubsync-troop">{isEn ? 'Registered Group / Unit' : '已登記旅團'}</label>
                {troopEntries.length > 0 ? (
                  <button
                    type="button"
                    className="cubsync__hintlink"
                    onClick={() => setTroopId(TROOP_NOT_FOUND)}
                  >
                    {isEn ? 'Not listed?' : '找不到旅團？'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="cubsync__hintlink"
                    onClick={() => setManualTroop(false)}
                  >
                    {isEn ? 'Back' : '返回開戶提示'}
                  </button>
                )}
              </div>
              {troopEntries.length > 0 ? (
                <select id="cubsync-troop" value={troopId} onChange={(e) => setTroopId(e.target.value)}>
                  <option value="">
                    {isEn
                      ? `— Select registered group (${troopEntries.length}) —`
                      : `— 請選擇已登記旅團（共 ${troopEntries.length} 個）—`}
                  </option>
                  {troopEntries.map(([id, info]) => (
                    <option key={id} value={id}>
                      {id} · {isEn && info.en ? info.en : info.name}
                    </option>
                  ))}
                  <option value={TROOP_NOT_FOUND}>
                    {isEn
                      ? '— My group is not listed (Open account on CUBSBADGE) —'
                      : '— 找不到我的旅團（前往 CUBSBADGE 開戶）—'}
                  </option>
                </select>
              ) : (
                <input
                  id="cubsync-troop"
                  type="text"
                  value={troopId}
                  onChange={(e) => setTroopId(e.target.value)}
                  placeholder={isEn ? 'e.g. 0082' : '旅團編號（如 0082）'}
                />
              )}
            </div>
            {!troopNotListed && (
              <>
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
                  <span>{isEn ? 'CUBSBADGE Password' : 'CUBSBADGE 密碼'}</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                  />
                </label>
                <button type="submit" className="btn btn--primary btn--sm" disabled={busy || !troopId}>
                  {busy
                    ? isEn
                      ? 'Connecting…'
                      : '連線中…'
                    : isEn
                      ? 'Connect & Sync Confirmed'
                      : '登入並錄入已核實進度'}
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {showOpenAccountNotice && (
        <div className="cubsync__notfound">
          <Icon name="info" size={16} />
          <div className="cubsync__notfound-body">
            <strong>
              {noTroopsFound
                ? isEn
                  ? 'No registered groups found — please open an account on CUBSBADGE first'
                  : '未找到已登記旅團，請先前往 CUBSBADGE 開戶'
                : isEn
                  ? 'Group not found? Please open an account / register on CUBSBADGE first'
                  : '找不到你的旅團？請先前往 CUBSBADGE 開戶及登記旅團'}
            </strong>
            <p>
              {noTroopsFound && !upstreamOk
                ? isEn
                  ? 'Could not load the registered group list from CUBSBADGE right now. Click Retry, or visit CUBSBADGE to confirm your group is registered and open an account first.'
                  : '暫時未能從 CUBSBADGE 讀取已登記旅團清單。請按「重新讀取」，或先前往 CUBSBADGE 確認旅團已完成登記並開戶。'
                : isEn
                  ? 'You must register your group and open a member account on CUBSBADGE first before selecting your group and syncing progress here.'
                  : '必須先在 CUBSBADGE 完成旅團登記及成員開戶，方可於此自動選取旅團並連接帳戶同步進度。'}
            </p>
            <div className="cubsync__notfound-actions">
              <a
                className="btn btn--gold btn--sm"
                href={badgeOrigin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="external" size={14} />{' '}
                {isEn ? 'Open Account on CUBSBADGE' : '前往 CUBSBADGE 開戶'}
              </a>
              {noTroopsFound && (
                <>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={probeBridge}>
                    <Icon name="refresh" size={13} /> {isEn ? 'Refresh List' : '重新讀取旅團清單'}
                  </button>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      setManualTroop(true);
                      setShowLogin(true);
                    }}
                  >
                    {isEn ? 'Enter Group ID Manually' : '手動輸入旅團編號'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 離線 JSON 交換（必須先連接並登入 CUBSBADGE 方可使用） */}
      {session ? (
        <div className="appxbtns cubsync__files">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onExportFile}
          >
            <Icon name="download" size={14} />{' '}
            {isEn
              ? 'Export Pending JSON for CUBSBADGE'
              : '匯出「待領袖核實」進度檔（供 CUBSBADGE）'}
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
              ? 'Import Confirmed JSON from CUBSBADGE'
              : '從 CUBSBADGE 匯入「領袖已核實」進度檔'}
          </button>
        </div>
      ) : (
        <div className="cubsync__locked">
          <Icon name="lock" size={14} />
          <span>
            {isEn
              ? 'Connect and sign in to your CUBSBADGE account first to unlock “Export Pending JSON” and “Import Confirmed JSON”. Full record-book backup & restore below still works offline.'
              : '未連接 CUBSBADGE 前不可匯出或匯入 CUBSBADGE 進度檔；請先於上方連接並登入 CUBSBADGE 帳戶。（下方「完整紀錄冊備份與換機轉移」仍可離線使用）'}
          </span>
        </div>
      )}
    </section>
  );
}
