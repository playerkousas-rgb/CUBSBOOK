import React, { useCallback, useEffect, useState } from 'react';
import { DEFAULT_CUBSBADGE_URL, probeCubBadgeBridge } from '../cubadgeBridge.js';
import {
  PARENT_NOTICE,
  clearParentSession,
  enterParentMode,
  exitParentMode,
  loadParentBook,
  loadParentSession,
  mirrorFromBadge,
  saveParentBook,
  saveParentSession,
} from '../parent.js';
import { Icon, cx } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { navigate } from '../router.jsx';

const TROOP_NOT_FOUND = '__NOT_FOUND__';

/**
 * 家長模式連線頁（/parent/connect）
 * ---------------------------------------------------------------
 * 兩條取得資料的路徑：
 *   A. 連接 CUBSBADGE：用孩子的旅團＋SCOUT ID＋密碼，把已核實現進度
 *      「匯出」到這部手機（只下載，永不提交）。
 *   B. 掃描孩子出示的 CB1 二維碼：離線、免登入。
 */
export default function ParentConnect() {
  const { isEn } = useLang();
  const existing = typeof window === 'undefined' ? null : loadParentBook();
  const [bridge, setBridge] = useState('checking');
  const [reason, setReason] = useState('');
  const [troops, setTroops] = useState({});
  const [badgeOrigin, setBadgeOrigin] = useState(DEFAULT_CUBSBADGE_URL);
  const [upstreamOk, setUpstreamOk] = useState(true);
  const [troopId, setTroopId] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const session = typeof window === 'undefined' ? null : loadParentSession();

  const probe = useCallback(async () => {
    setBridge('checking');
    const r = await probeCubBadgeBridge();
    setBridge(r.available ? 'ready' : 'unavailable');
    setReason(r.reason || '');
    if (r.available) {
      const nextTroops = r.troops || {};
      setTroops(nextTroops);
      setBadgeOrigin(r.origin || DEFAULT_CUBSBADGE_URL);
      setUpstreamOk(r.upstreamOk !== false);
      const keys = Object.keys(nextTroops);
      setTroopId((cur) => {
        if (cur && cur !== TROOP_NOT_FOUND && nextTroops[cur]) return cur;
        if (keys.length === 1) return keys[0];
        return '';
      });
    }
  }, []);

  useEffect(() => {
    probe();
  }, [probe]);

  useEffect(() => {
    if (session?.ymis) setScoutId((cur) => cur || session.ymis);
  }, [session]);

  const fetchProgress = async (active) => {
    const r = await fetch('/api/cubbadge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        troopId: active.troopId,
        action: 'load',
        data: { token: active.token, ymis: active.ymis },
      }),
    });
    const json = await r.json().catch(() => null);
    if (!r.ok || !json?.success) {
      const err = new Error(json?.error || (isEn ? 'cubbadge export failed' : '由 cubbadge 匯出失敗'));
      err.status = r.status;
      throw err;
    }
    return json;
  };

  const commit = (book, imported) => {
    saveParentBook(book);
    enterParentMode();
    setInfo(
      isEn
        ? `Exported ${imported} confirmed item${imported === 1 ? '' : 's'} into this phone — read-only.`
        : `已把 ${imported} 項領袖已核實進度匯出到這部手機（只讀）。`,
    );
    navigate('/parent');
  };

  const login = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const tid = troopId.trim();
    const sid = scoutId.trim();
    if (!tid || tid === TROOP_NOT_FOUND || !sid || !password) {
      setError(isEn ? 'Select Group, enter Scout ID and CUBSBADGE password.' : '請選擇已登記旅團，並填寫 SCOUT ID 及 CUBSBADGE 密碼。');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/cubbadge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ troopId: tid, action: 'login', data: { login_id: sid, password } }),
      });
      const json = await r.json().catch(() => null);
      if (!r.ok || !json?.success || !json.token) {
        throw new Error(json?.error || (isEn ? 'cubbadge sign-in failed' : 'cubbadge 登入失敗'));
      }
      const active = {
        troopId: tid,
        troopName: troops[tid]?.name || tid,
        token: json.token,
        ymis: json.ymis || sid,
      };
      saveParentSession(active);
      const cloud = await fetchProgress(active);
      const res = mirrorFromBadge(cloud, active);
      setPassword('');
      commit(res.book, res.imported);
    } catch (err) {
      setError(err.message || (isEn ? 'Export failed' : '匯出失敗'));
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    if (!session) return;
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const cloud = await fetchProgress(session);
      const res = mirrorFromBadge(cloud, session);
      commit(res.book, res.imported);
    } catch (err) {
      if (err.status === 401) clearParentSession();
      setError(
        err.status === 401
          ? isEn
            ? 'Session expired — sign in again below.'
            : '登入已失效，請在下方重新登入。'
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  };

  const startScan = () => {
    enterParentMode();
    navigate('/scan');
  };

  const leave = () => {
    exitParentMode();
    navigate('/');
  };

  const synced = existing?.meta?.parent;
  const syncedAt = synced?.syncedAt ? new Date(synced.syncedAt) : null;
  const troopEntries = Object.entries(troops);
  const noTroopsFound = bridge === 'ready' && troopEntries.length === 0;
  const troopNotListed = troopId === TROOP_NOT_FOUND;

  return (
    <div className="pconnect">
      <header className="pconnect__head">
        <span className="pconnect__eyebrow">
          <Icon name="lock" size={12} /> {isEn ? 'PARENT MODE · READ-ONLY' : '家長模式 · 只讀'}
        </span>
        <h1>{isEn ? 'View your child’s progress on this phone' : '在這部手機查看孩子的進度'}</h1>
        <p>
          {isEn
            ? 'One cubbadge backend, two BOOK phones: the Cub Scout keeps filling in their own book, and you read the same confirmed progress here. Nothing on this phone is ever uploaded.'
            : '一個 cubbadge 後端、兩部 BOOK 手機：孩子在自己手機繼續填寫，你在這部手機讀取同一個成員的已核實進度。這部手機永遠不會上載任何資料。'}
        </p>
        <p className="pconnect__rule">{isEn ? PARENT_NOTICE.en : PARENT_NOTICE.zh}</p>
      </header>

      {synced && (
        <section className="pconnect__card pconnect__card--status">
          <h2>{isEn ? 'Parent copy on this phone' : '這部手機上的家長副本'}</h2>
          <ul className="pconnect__facts">
            <li>
              <span>{isEn ? 'Child Scout ID' : '孩子 SCOUT ID'}</span>
              <strong>{synced.ymis || '—'}</strong>
            </li>
            <li>
              <span>{isEn ? 'Source' : '來源'}</span>
              <strong>
                {synced.source === 'qr'
                  ? isEn
                    ? 'Child’s QR (offline)'
                    : '孩子二維碼（離線）'
                  : isEn
                    ? 'cubbadge export'
                    : 'cubbadge 匯出'}
              </strong>
            </li>
            <li>
              <span>{isEn ? 'Exported items' : '匯出項目'}</span>
              <strong>{synced.imported ?? 0}</strong>
            </li>
            <li>
              <span>{isEn ? 'Last updated' : '最後更新'}</span>
              <strong>{syncedAt ? syncedAt.toLocaleString(isEn ? 'en-HK' : 'zh-HK') : '—'}</strong>
            </li>
          </ul>
          <div className="pconnect__actions">
            <button type="button" className="btn btn--gold btn--sm" onClick={() => navigate('/parent')}>
              <Icon name="book" size={14} /> {isEn ? 'Open overview' : '查看總覽'}
            </button>
            {session && bridge === 'ready' && (
              <button type="button" className="btn btn--ghost btn--sm" disabled={busy} onClick={refresh}>
                <Icon name="download" size={14} /> {busy ? (isEn ? 'Updating…' : '更新中…') : isEn ? 'Export again from cubbadge' : '再由 cubbadge 匯出'}
              </button>
            )}
            <button type="button" className="btn btn--ghost btn--sm" onClick={leave}>
              <Icon name="lock" size={14} /> {isEn ? 'Leave parent mode' : '退出家長模式'}
            </button>
          </div>
        </section>
      )}

      {(error || info) && (
        <p className={cx('pconnect__msg', error && 'is-error')} role="status">
          {error || info}
        </p>
      )}

      <section className="pconnect__card">
        <h2>
          <span className="pconnect__num">A</span>
          {isEn ? 'Connect with the child’s cubbadge account' : '用孩子的 cubbadge 帳戶連接'}
        </h2>
        <p className="pconnect__hint">
          {isEn
            ? 'Exports every leader-confirmed item from cubbadge into this phone. This is a download only — parent mode never submits or changes anything in cubbadge.'
            : '把 cubbadge 內所有「領袖已核實」項目匯出到這部手機。全程只有下載；家長模式永不向 cubbadge 提交或修改任何內容。'}
        </p>

        {bridge === 'unavailable' ? (
          <div className="cubsync__offline">
            <Icon name="lock" size={15} />
            <div>
              <strong>{isEn ? 'This deployment has no cubbadge bridge' : '此部署沒有 cubbadge 連接'}</strong>
              <p>
                {isEn
                  ? 'Parent mode needs /api/cubbadge to export progress. You can still use the QR method below, which works fully offline.'
                  : '家長模式需要 /api/cubbadge 才可由 BADGE 匯出進度。你仍可用下方「掃描孩子二維碼」，完全離線。'}
                {reason ? ` (${reason})` : ''}
              </p>
            </div>
          </div>
        ) : (
          <form className="pconnect__form" onSubmit={login}>
            {troopEntries.length > 0 && (
              <div className="field">
                <div className="field__label cubsync__labelrow">
                  <label htmlFor="pconnect-troop">{isEn ? 'Registered Group' : '已登記旅團'}</label>
                  <button
                    type="button"
                    className="cubsync__hintlink"
                    onClick={() => setTroopId(TROOP_NOT_FOUND)}
                  >
                    {isEn ? 'Not listed?' : '找不到旅團？'}
                  </button>
                </div>
                <select id="pconnect-troop" value={troopId} onChange={(e) => setTroopId(e.target.value)} disabled={busy || bridge === 'checking'}>
                  <option value="">
                    {isEn
                      ? `— Select registered group (${troopEntries.length}) —`
                      : `— 請選擇已登記旅團（共 ${troopEntries.length} 個）—`}
                  </option>
                  {troopEntries.map(([id, t]) => (
                    <option key={id} value={id}>
                      {id} · {isEn && t?.en ? t.en : t?.name || id}
                    </option>
                  ))}
                  <option value={TROOP_NOT_FOUND}>
                    {isEn
                      ? '— Group not listed (Open account on CUBSBADGE) —'
                      : '— 找不到我的旅團（前往 CUBSBADGE 開戶）—'}
                  </option>
                </select>
              </div>
            )}

            {(noTroopsFound || troopNotListed) && (
              <div className="cubsync__notfound">
                <Icon name="info" size={16} />
                <div className="cubsync__notfound-body">
                  <strong>
                    {noTroopsFound
                      ? isEn
                        ? 'No registered groups found — open an account on CUBSBADGE first'
                        : '未找到已登記旅團，請先前往 CUBSBADGE 開戶'
                      : isEn
                        ? 'Group not listed? Open an account on CUBSBADGE first'
                        : '找不到旅團？請先前往 CUBSBADGE 開戶及登記旅團'}
                  </strong>
                  <p>
                    {noTroopsFound && !upstreamOk
                      ? isEn
                        ? 'Could not load registered groups from CUBSBADGE right now. Click Refresh, or visit CUBSBADGE to verify your group and open an account.'
                        : '暫時未能從 CUBSBADGE 讀取已登記旅團清單。請按「重新讀取」，或先前往 CUBSBADGE 確認旅團已完成登記並開戶。'
                      : isEn
                        ? 'The Cub Scout and group must be registered with an account on CUBSBADGE before connecting here.'
                        : '必須先在 CUBSBADGE 完成旅團登記及成員開戶，方可於此選取旅團並匯出進度。'}
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
                      <button type="button" className="btn btn--ghost btn--sm" onClick={probe}>
                        <Icon name="refresh" size={13} /> {isEn ? 'Refresh List' : '重新讀取旅團清單'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!noTroopsFound && !troopNotListed && (
              <>
                <label className="field">
                  <span className="field__label">{isEn ? 'Child’s Scout ID' : '孩子的 SCOUT ID'}</span>
                  <input value={scoutId} onChange={(e) => setScoutId(e.target.value)} placeholder="25081420" inputMode="numeric" disabled={busy} />
                </label>
                <label className="field">
                  <span className="field__label">{isEn ? 'CUBSBADGE password' : 'CUBSBADGE 密碼'}</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" disabled={busy} />
                </label>
                <div className="pconnect__actions">
                  <button
                    type="submit"
                    className="btn btn--gold"
                    disabled={busy || bridge === 'checking' || !troopId || troopId === TROOP_NOT_FOUND}
                  >
                    <Icon name="download" size={15} />{' '}
                    {busy ? (isEn ? 'Exporting…' : '匯出中…') : isEn ? 'Export progress to this phone' : '匯出進度到這部手機'}
                  </button>
                </div>
              </>
            )}
            {session && (
              <p className="pconnect__small">
                {isEn ? 'Signed in as ' : '目前已登入：'}
                <strong>{session.ymis}</strong>
                {' · '}
                <button type="button" className="linkish" onClick={() => clearParentSession()}>
                  {isEn ? 'clear session' : '清除登入'}
                </button>
              </p>
            )}
          </form>
        )}
      </section>

      <section className="pconnect__card">
        <h2>
          <span className="pconnect__num">B</span>
          {isEn ? 'Scan the child’s QR code' : '掃描孩子的二維碼'}
        </h2>
        <p className="pconnect__hint">
          {isEn
            ? 'No sign-in and no network: the Cub Scout taps “Show QR” on their phone, you scan it, and the shared progress becomes a read-only copy here.'
            : '免登入、免網絡：孩子在自己手機按「出示 QR」，你在這部手機掃描，分享的進度就會成為這裡的只讀副本。'}
        </p>
        <div className="pconnect__actions">
          <button type="button" className="btn btn--gold" onClick={startScan}>
            <Icon name="qr" size={15} /> {isEn ? 'Open scanner' : '開啟掃描器'}
          </button>
        </div>
      </section>

      <p className="pconnect__foot">
        {isEn
          ? 'Parent mode is not a leader account: it cannot sign items off, cannot read other members, and cannot write to cubbadge.'
          : '家長模式不是領袖帳戶：不能核簽、不能讀取其他成員，亦不能向 cubbadge 寫入任何內容。'}
      </p>
    </div>
  );
}
