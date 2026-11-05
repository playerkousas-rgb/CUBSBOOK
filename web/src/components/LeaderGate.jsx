import React, { useEffect, useState } from 'react';
import { navigate } from '../router.jsx';
import { Icon } from '../ui.jsx';
import { useLang } from '../i18n.jsx';
import { enterLeaderMode, leaderAvailable } from '../leader.js';

/**
 * 領袖模式驗證閘門（對齊 ROVERBOOK v16）：
 * - 普通模式不能讀取紀錄冊二維碼；
 * - 輸入伺服器端 LEADER_CODE 後開啟領袖模式（只讀檢視與核簽）。
 */
export default function LeaderGate({ mode = 'page', onDone }) {
  const { isEn } = useLang();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    let live = true;
    leaderAvailable().then((v) => live && setAvailable(v));
    return () => {
      live = false;
    };
  }, []);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (busy) return;
    setBusy(true);
    const result = await enterLeaderMode(code);
    setBusy(false);
    if (result.ok) {
      setError('');
      if (onDone) onDone();
      else if (mode === 'page') navigate('/scan');
      return;
    }
    setError(
      result.reason === 'unset'
        ? isEn
          ? 'This deployment has no leader code yet. Set LEADER_CODE in Vercel and redeploy.'
          : '此部署尚未設定領袖密碼。請在 Vercel 加入環境變數 LEADER_CODE（不要加 VITE_ 前綴）並重新部署。'
        : result.reason === 'offline'
          ? isEn
            ? 'Cannot reach the server. Connect to the internet once to enter leader mode.'
            : '連不到伺服器。請先連上網絡一次以驗證領袖密碼。'
          : isEn
            ? 'Incorrect leader code. Please check with your Cub Scout Leader / GSL.'
            : '密碼不正確，請向幼童軍團長或旅長查詢。',
    );
  };

  return (
    <div className="leadergate">
      <div className="leadergate__card">
        <span className="leadergate__eyebrow">LEADER MODE · READ-ONLY</span>
        <h2 className="leadergate__title">{isEn ? 'Leader Mode (Read-Only)' : '領袖模式（只讀）'}</h2>
        <p className="leadergate__lead">
          {isEn
            ? 'Normal member mode cannot read record-book QR codes — members can only show their own QR code. Enter the leader code to scan and view a member’s book in read-only mode.'
            : '普通模式不能讀取他人紀錄冊（成員只可出示自己的二維碼）。輸入領袖密碼進入「領袖模式（只讀）」後，方可掃描及唯讀查閱成員紀錄冊或進行核簽。'}
        </p>

        {available === false && (
          <p className="leadergate__note">
            <Icon name="alert" size={14} />
            <span>
              {isEn
                ? 'LEADER_CODE is not set for this deployment, so leader mode is closed.'
                : '此部署未設定 LEADER_CODE，領袖模式暫時關閉。'}
            </span>
          </p>
        )}

        <form className="leadergate__form" onSubmit={submit}>
          <label className="leadergate__label" htmlFor="leader-code">
            {isEn ? 'Leader Code' : '領袖密碼'}
          </label>
          <div className="leadergate__row">
            <input
              id="leader-code"
              className="leadergate__input"
              type={show ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              placeholder={isEn ? 'Enter code' : '輸入密碼'}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError('');
              }}
              disabled={available === false || busy}
            />
            <button
              type="button"
              className="leadergate__eye"
              aria-label={isEn ? 'Show code' : '顯示密碼'}
              onClick={() => setShow((v) => !v)}
            >
              <Icon name={show ? 'x' : 'zoom'} size={15} />
            </button>
          </div>
          {error && <p className="leadergate__error">{error}</p>}
          <button
            className="btn btn--primary leadergate__go"
            type="submit"
            disabled={available === false || busy}
          >
            {busy ? (isEn ? 'Checking…' : '核對中…') : isEn ? 'Enter Leader Mode' : '進入領袖模式（只讀）'}
          </button>
        </form>

        <button className="leadergate__back" onClick={() => navigate('/')} type="button">
          {isEn ? 'Back to Record Book' : '返回紀錄冊'}
        </button>
      </div>
    </div>
  );
}
