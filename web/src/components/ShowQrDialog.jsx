import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Icon, Modal, useToast } from '../ui.jsx';
import { useBook } from '../bookContext.js';
import { qrSvg } from '../qr.js';
import { QR_LIMIT, TRANSFER_OPTIONS, KIND_SIGNOFF, decodePayload, encodeTransfer } from '@shared/transfer.js';
import { navigate } from '../router.jsx';
import { useLang } from '../i18n.jsx';

export default function ShowQrDialog({ open, onClose }) {
  const { book } = useBook();
  const { push } = useToast();
  const { isEn } = useLang();
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [showSignoffBox, setShowSignoffBox] = useState(false);
  const [scanSignoffCam, setScanSignoffCam] = useState(false);
  const [signoffCode, setSignoffCode] = useState('');
  const camVideoRef = useRef(null);

  useEffect(() => {
    if (open) {
      setSelected([]);
      setResult(null);
      setSvg('');
      setError('');
      setScanSignoffCam(false);
    }
  }, [open]);

  useEffect(() => {
    let alive = true;
    if (!open || selected.length === 0) {
      setResult(null);
      setSvg('');
      return () => {
        alive = false;
      };
    }
    setBusy(true);
    setError('');
    encodeTransfer(book, selected)
      .then((res) => {
        if (!alive) return;
        setResult(res);
        if (!res.tooBig) {
          setSvg(qrSvg(res.value, { cell: 5 }));
        } else {
          setSvg('');
        }
      })
      .catch((e) => alive && setError(e.message || (isEn ? 'Failed to generate QR' : '未能產生二維碼')))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [open, selected, book, isEn]);

  // 普通模式專用：只接受領袖簽發的核簽回傳碼（KIND_SIGNOFF），嚴禁讀取他人紀錄冊（KIND_MEMBER）
  const acceptSignoffRaw = async (rawText) => {
    const payload = await decodePayload(rawText);
    if (payload.t !== KIND_SIGNOFF) {
      throw new Error(
        isEn
          ? 'Normal mode cannot read member record books. Only Leader Sign-off Return QRs are accepted.'
          : '普通模式不能讀取他人紀錄冊；此處只接收領袖簽發的核簽回傳碼。',
      );
    }
    window.sessionStorage.setItem('cubbook.scan.signoff.v1', JSON.stringify(payload));
    setScanSignoffCam(false);
    onClose();
    navigate('/scan/signoff');
  };

  useEffect(() => {
    if (!open || !scanSignoffCam) return undefined;
    let stream = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const stop = () => {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };

    const tick = async () => {
      if (stopped) return;
      const v = camVideoRef.current;
      if (v && v.readyState >= 2 && v.videoWidth > 0 && ctx) {
        const scale = Math.min(1, 560 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code?.data) {
          try {
            stop();
            await acceptSignoffRaw(code.data);
            return;
          } catch (err) {
            setError(err.message || (isEn ? 'Invalid sign-off QR' : '核簽二維碼無效'));
            setScanSignoffCam(false);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanSignoffCam(false);
        setShowSignoffBox(true);
        setError(
          isEn
            ? 'Camera unavailable on this browser. Paste the return code below.'
            : '此瀏覽器不支援鏡頭掃描，請在下方貼上回傳碼。',
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
        if (camVideoRef.current) {
          camVideoRef.current.srcObject = stream;
          await camVideoRef.current.play().catch(() => {});
        }
        raf = requestAnimationFrame(tick);
      } catch {
        setScanSignoffCam(false);
        setShowSignoffBox(true);
        setError(
          isEn
            ? 'Camera permission denied. Paste the return code below.'
            : '未能開啟鏡頭，請改為貼上回傳碼。',
        );
      }
    })();

    return stop;
  }, [open, scanSignoffCam, isEn]);

  if (!open) return null;

  const toggle = (key) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  const ratio = result ? Math.min(100, Math.round((result.chars / QR_LIMIT) * 100)) : 0;
  const heavyChosen = TRANSFER_OPTIONS.filter((o) => o.heavy && selected.includes(o.key)).map((o) =>
    isEn ? o.en : o.label,
  );

  return (
    <Modal
      onClose={onClose}
      eyebrow={isEn ? 'SHOW RECORD VIA QR' : '當面出示紀錄冊 · 零伺服器二維碼'}
      title={isEn ? 'Choose Sections to Present' : '揀選今次要給領袖查閱的內容'}
      subtitle={
        isEn
          ? 'Members can only show their own QR code or scan a Leader Return QR. Ask your leader to enter Leader Mode in CUBBOOK to scan.'
          : '普通模式只可出示自己的二維碼或接收領袖核簽碼（不能讀取他人紀錄冊）。請領袖開啟領袖模式掃描查閱或一簽簽發。'
      }
      wide
    >
      <div className="qrquick">
        <button
          type="button"
          className="btn btn--gold btn--sm"
          onClick={() => setSelected(['progress'])}
        >
          {isEn
            ? 'Progress Only (Scout ID + Progress · Zero Personal Data)'
            : '純進度出示（只含成員編號＋進度 · 不含個人資料）'}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => setSelected(['particulars', 'progress', 'summaries'])}
        >
          {isEn ? 'Preset: Full Leader Sign-off' : '完整核簽組合（個人＋進度＋簡述）'}
        </button>
        {selected.length > 0 && (
          <button type="button" className="linkbtn" onClick={() => setSelected([])}>
            {isEn ? 'Clear all' : '全部取消'}
          </button>
        )}
      </div>

      <div className="qrgrid">
        {TRANSFER_OPTIONS.map((opt) => (
          <label key={opt.key} className={`qropt${selected.includes(opt.key) ? ' is-on' : ''}`}>
            <input type="checkbox" checked={selected.includes(opt.key)} onChange={() => toggle(opt.key)} />
            <span>
              <strong>
                {isEn ? opt.en : opt.label}
                {opt.sensitive && <b className="qropt__tag">{isEn ? 'Private' : '私隱'}</b>}
                {opt.heavy && <b className="qropt__tag qropt__tag--heavy">{isEn ? 'Large' : '大檔'}</b>}
              </strong>
              <small>{opt.hint}</small>
            </span>
          </label>
        ))}
      </div>

      <div className="qrpanel">
        {selected.length === 0 && (
          <div className="qrpanel__empty">
            <Icon name="qr" size={34} />
            <p>{isEn ? 'Tick at least one section above to generate QR code.' : '請先在上方剔選最少一項要傳送的資料。'}</p>
          </div>
        )}

        {selected.length > 0 && busy && !result && <p className="qrstatus">{isEn ? 'Compressing…' : '正在本機壓縮資料…'}</p>}

        {result && !result.tooBig && svg && (
          <div className="qrpanel__code" dangerouslySetInnerHTML={{ __html: svg }} />
        )}

        {result?.tooBig && (
          <div className="qrpanel__warn">
            <Icon name="alert" size={16} />
            <div>
              <strong>{isEn ? 'Exceeds Single QR Capacity' : '超出單張二維碼容量上限'}</strong>
              <p>
                {isEn
                  ? 'Please untick heavy image items or use JSON export in Digital Appendix.'
                  : '相片或大量手寫墨跡超出單張二維碼容量；請先取消大檔項目，或改用複製唯讀連結／匯出備份檔。'}
              </p>
              {heavyChosen.length > 0 && (
                <p className="tiny">
                  {isEn ? 'Suggested to untick: ' : '建議先取消：'}
                  {heavyChosen.join('、')}
                </p>
              )}
            </div>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}

        {result && (
          <div className="qrmeter">
            <span className={`qrmeter__bar${result.tooBig ? ' is-over' : ''}`}>
              <i style={{ width: `${ratio}%` }} />
            </span>
            <span className="tiny">
              {result.chars} / {QR_LIMIT} · {result.compressed ? (isEn ? 'gzip compressed' : 'gzip 已壓縮') : 'raw'}
            </span>
          </div>
        )}
      </div>

      <div className="qrsignoff-in">
        <div className="qrsignoff-in__triggers">
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              setScanSignoffCam((v) => !v);
              setError('');
            }}
          >
            <Icon name="camera" size={14} />{' '}
            {scanSignoffCam
              ? isEn
                ? 'Close Camera'
                : '關閉鏡頭'
              : isEn
                ? 'Scan Leader Return QR'
                : '相機掃描領袖核簽回傳碼'}
          </button>
          <button
            type="button"
            className="linkbtn"
            onClick={() => {
              setShowSignoffBox((v) => !v);
              setError('');
            }}
          >
            {isEn ? 'Or paste return code (CB1.)' : '或點此貼上回傳碼（CB1.）'}
          </button>
        </div>

        {scanSignoffCam && (
          <div className="qrsignoff-cam">
            <video ref={camVideoRef} playsInline muted autoPlay />
            <p className="tiny">
              {isEn
                ? 'Point at the Leader’s Sign-off Return QR.'
                : '對準領袖手機上的「核簽回傳碼」二維碼即可自動讀取寫入。'}
            </p>
          </div>
        )}

        {showSignoffBox && (
          <div className="qrsignoff-in__row">
            <input
              type="text"
              value={signoffCode}
              onChange={(e) => {
                setSignoffCode(e.target.value);
                setError('');
              }}
              placeholder="CB1...."
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={async () => {
                try {
                  await acceptSignoffRaw(signoffCode);
                } catch (e) {
                  setError(e.message || (isEn ? 'Invalid sign-off code' : '核簽回傳碼格式不正確'));
                }
              }}
            >
              {isEn ? 'Apply' : '讀取核簽單'}
            </button>
          </div>
        )}
      </div>

      <div className="modal__actions">
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!result}
          onClick={async () => {
            try {
              const link = `${window.location.origin}/#v=${encodeURIComponent(result.value)}`;
              await navigator.clipboard.writeText(link);
              push(isEn ? 'Copied zero-server read-only link (#v=...)' : '已複製純前端唯讀連結（# 內封裝，不經伺服器）');
            } catch {
              push(isEn ? 'Clipboard blocked by browser' : '瀏覽器未允許複製', 'error');
            }
          }}
        >
          <Icon name="link" size={14} /> {isEn ? 'Copy Read-Only Link' : '複製唯讀連結'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={!result}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(result.value);
              push(isEn ? 'Copied CB1 code' : '已複製 CB1 二維碼字串');
            } catch {
              push(isEn ? 'Clipboard blocked by browser' : '瀏覽器未允許複製', 'error');
            }
          }}
        >
          <Icon name="copy" size={14} /> {isEn ? 'Copy Code' : '複製代碼'}
        </button>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {isEn ? 'Done' : '完成'}
        </button>
      </div>
    </Modal>
  );
}
