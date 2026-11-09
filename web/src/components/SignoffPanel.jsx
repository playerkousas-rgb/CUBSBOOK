import React, { useEffect, useMemo, useState } from 'react';
import { Icon, useToast } from '../ui.jsx';
import { SignModal } from './Ink.jsx';
import { qrSvg } from '../qr.js';
import { shrinkSignature } from '../signature.js';
import { syllabusItem } from '@shared/forms.js';
import { otherBadgeRows } from '@shared/book.js';
import { QR_LIMIT, encodeSignoff } from '@shared/transfer.js';
import { useLang } from '../i18n.jsx';

const nameOf = (id, isEn) => {
  const it = syllabusItem(id);
  if (!it) return id;
  return isEn && it.en ? it.en : it.name;
};

export default function SignoffPanel({ payload }) {
  const { push } = useToast();
  const { isEn } = useLang();
  const [leader, setLeader] = useState(null);
  const [openSign, setOpenSign] = useState(false);
  const [withSig, setWithSig] = useState(true);
  const [selected, setSelected] = useState(() => new Set());
  const [result, setResult] = useState(null);
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const entries = useMemo(() => {
    const progress = payload?.progress || {};
    return Object.entries(progress)
      .filter(([, v]) => v?.date)
      .map(([id, v]) => ({
        id,
        date: v.date || '',
        assessor: v.assessor || '',
        signed: Boolean(v.assessor || payload?.signatures?.[id]),
        name: nameOf(id, isEn),
      }))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [payload, isEn]);

  // 活動徽章：官方 7 枚分級徽章逐級一行（A26 初級與中級是兩個獨立核簽）
  const badgeEntries = useMemo(
    () => otherBadgeRows(payload?.otherBadges, { lang: isEn ? 'en' : 'zh' }),
    [payload, isEn],
  );

  const [selectedBadges, setSelectedBadges] = useState(() => new Set());

  useEffect(() => {
    setSelected(new Set(entries.filter((e) => !e.signed).map((e) => e.id)));
  }, [entries]);

  useEffect(() => {
    setSelectedBadges(new Set(badgeEntries.map((b) => b.key)));
  }, [badgeEntries]);

  const chosen = entries.filter((e) => selected.has(e.id));
  const chosenBadges = badgeEntries.filter((b) => selectedBadges.has(b.key));
  const chosenTotal = chosen.length + chosenBadges.length;
  const hasAny = entries.length + badgeEntries.length > 0;

  useEffect(() => {
    let alive = true;
    if (!leader || chosen.length + chosenBadges.length === 0) {
      setResult(null);
      setSvg('');
      return () => {
        alive = false;
      };
    }
    setBusy(true);
    setError('');
    (async () => {
      const png = withSig ? await shrinkSignature(leader.png) : null;
      const res = await encodeSignoff({
        member: payload.member,
        leader: { ...leader, png },
        items: chosen.map((e) => ({ id: e.id, date: e.date, assessor: leader.name })),
        otherBadges: chosenBadges.map((b) => ({
          id: b.badgeId,
          ...(b.level ? { level: b.level } : {}),
          date: b.date,
          cert: b.cert,
        })),
        note: 'CUBBOOK 領袖當面核簽',
      });
      if (!alive) return;
      setResult(res);
      if (res.tooBig && withSig) {
        setWithSig(false);
        return;
      }
      setSvg(res.tooBig ? '' : qrSvg(res.value, { cell: 5 }));
    })()
      .catch((e) => alive && setError(e.message || '未能產生回傳碼'))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [leader, selected, selectedBadges, withSig, entries, badgeEntries, payload]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleBadge = (key) =>
    setSelectedBadges((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (!hasAny) {
    return (
      <section className="signpanel">
        <h2>
          <Icon name="seal" size={16} /> {isEn ? 'Leader Sign-off' : '領袖當面核簽'}
        </h2>
        <p className="signpanel__hint">
          {isEn
            ? 'Member did not include Training Progress or Activity Badges in this QR. Ask the member to tick those groups and present again.'
            : '成員今次未剔選「訓練綱要進度」或「活動徽章」，如要核簽，請成員剔選後再出示二維碼。'}
        </p>
      </section>
    );
  }

  return (
    <section className="signpanel">
      <h2>
        <Icon name="seal" size={16} /> {isEn ? 'Leader Sign-off & Return QR' : '領袖一次簽名 · 產生核簽回傳碼'}
      </h2>
      <p className="signpanel__hint">
        {isEn
          ? 'Sign once below and tick the items verified. Have the member scan the generated Return QR to write your signature into their book.'
          : '簽名一次並勾選已核實的項目，系統即產生「核簽回傳碼」；請成員打開「掃描二維碼」一掃即可寫入其紀錄冊。'}
      </p>

      <div className="signpanel__leader">
        {leader ? (
          <div className="signpanel__sig">
            {leader.png && <img src={leader.png} alt="領袖簽名" />}
            <span>{[leader.name, leader.title, leader.at].filter(Boolean).join(' · ')}</span>
            <button type="button" className="linkbtn" onClick={() => setOpenSign(true)}>
              {isEn ? 'Re-sign' : '重簽'}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--gold" onClick={() => setOpenSign(true)}>
            <Icon name="pen" size={15} /> {isEn ? 'Sign as Leader / Assessor' : '以領袖／主考身分簽名'}
          </button>
        )}
      </div>

      <div className="signpanel__list">
        <div className="signpanel__listhead">
          <span>
            {isEn ? 'Items selected' : '已勾選'}（{chosenTotal} / {entries.length + badgeEntries.length}）
          </span>
          <div>
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                setSelected(new Set(entries.map((e) => e.id)));
                setSelectedBadges(new Set(badgeEntries.map((b) => b.key)));
              }}
            >
              {isEn ? 'Select All' : '全選'}
            </button>{' '}
            ·{' '}
            <button
              type="button"
              className="linkbtn"
              onClick={() => {
                setSelected(new Set());
                setSelectedBadges(new Set());
              }}
            >
              {isEn ? 'None' : '全不選'}
            </button>
          </div>
        </div>
        {entries.length > 0 && (
          <>
            <div className="signpanel__subhead">
              {isEn ? 'Training progress' : '訓練綱要進度'}（{chosen.length} / {entries.length}）
            </div>
            <ul>
              {entries.map((entry) => (
                <li key={entry.id} className={selected.has(entry.id) ? 'is-on' : ''}>
                  <label>
                    <input type="checkbox" checked={selected.has(entry.id)} onChange={() => toggle(entry.id)} />
                    <span className="signpanel__item">
                      <strong>{entry.name}</strong>
                      <em>
                        {entry.date}
                        {entry.assessor ? ` · 已簽：${entry.assessor}` : ' · 待核簽'}
                      </em>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        {badgeEntries.length > 0 && (
          <>
            <div className="signpanel__subhead">
              {isEn ? 'Activity badges' : '活動徽章'}（{chosenBadges.length} / {badgeEntries.length}）
            </div>
            <ul>
              {badgeEntries.map((badge) => (
                <li key={badge.key} className={selectedBadges.has(badge.key) ? 'is-on' : ''}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedBadges.has(badge.key)}
                      onChange={() => toggleBadge(badge.key)}
                    />
                    <span className="signpanel__item">
                      <strong>{badge.name}</strong>
                      <em>
                        {badge.date}
                        {badge.cert ? ` · 證書：${badge.cert}` : ''}
                      </em>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {leader && chosenTotal > 0 && (
        <div className="signpanel__code">
          {busy && !result && <p className="qrstatus">{isEn ? 'Generating Return QR…' : '正在產生核簽回傳碼…'}</p>}
          {svg && <div className="qrpanel__code" dangerouslySetInnerHTML={{ __html: svg }} />}
          {result && (
            <div className="qrmeter">
              <span className={`qrmeter__bar${result.tooBig ? ' is-over' : ''}`}>
                <i style={{ width: `${Math.min(100, (result.chars / QR_LIMIT) * 100)}%` }} />
              </span>
              <span className="tiny">
                {result.chars} / {QR_LIMIT} chars · {result.compressed ? 'gzip' : 'raw'}
              </span>
            </div>
          )}
          <label className="signpanel__withsig">
            <input type="checkbox" checked={withSig} onChange={(e) => setWithSig(e.target.checked)} />
            <span>{isEn ? 'Embed signature ink image' : '連同簽名墨跡圖片放入回傳碼'}</span>
          </label>
          {result && !result.tooBig && (
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.value);
                  push(isEn ? 'Return code copied' : '已複製核簽回傳碼');
                } catch {
                  push('瀏覽器未允許複製', 'error');
                }
              }}
            >
              <Icon name="copy" size={14} /> {isEn ? 'Copy Return Code' : '複製回傳碼'}
            </button>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <SignModal
        open={openSign}
        onClose={() => setOpenSign(false)}
        title={isEn ? 'Leader / Assessor Signature' : '領袖／主考簽署'}
        defaultTitle=""
        onSave={(sig) => {
          setLeader(sig);
          setOpenSign(false);
        }}
      />
    </section>
  );
}
