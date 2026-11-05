import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Modal } from '../ui.jsx';
import { shrinkSignature } from '../signature.js';
import { today } from '@shared/book.js';
import { useLang } from '../i18n.jsx';
import { useReadOnly } from '../bookContext.js';

const INK_COLOR = '#241605';

function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX <= minX || maxY <= minY) return null;
  const pad = 10;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width, maxX + pad);
  maxY = Math.min(height, maxY + pad);
  const out = document.createElement('canvas');
  out.width = maxX - minX;
  out.height = maxY - minY;
  out.getContext('2d').drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export function SignaturePad({ onInk, height = 170 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPt = useRef(null);
  const [hasStroke, setHasStroke] = useState(false);
  const { isEn } = useLang();

  const setup = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    const w = Math.max(280, Math.round(rect.width || 460));
    c.width = w * dpr;
    c.height = height * dpr;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = INK_COLOR;
  }, [height]);

  useEffect(() => {
    setup();
  }, [setup]);

  const point = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches?.[0] || e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const down = (e) => {
    e.preventDefault();
    drawing.current = true;
    lastPt.current = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(lastPt.current.x, lastPt.current.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = INK_COLOR;
    ctx.fill();
    setHasStroke(true);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    lastPt.current = p;
  };

  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const trimmed = trimCanvas(canvasRef.current);
    onInk?.(trimmed);
  };

  const clear = () => {
    setup();
    setHasStroke(false);
    onInk?.(null);
  };

  return (
    <div className="pad">
      <div className="pad__box" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="pad__canvas"
          style={{ height }}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        {!hasStroke && (
          <span className="pad__placeholder">
            {isEn ? 'Sign or write here with finger / stylus' : '請用手指或觸控筆在此簽署／書寫'}
          </span>
        )}
      </div>
      <div className="pad__bar">
        <span className="tiny">
          {isEn ? 'Auto-compressed to crisp monochrome transparent PNG' : '自動去白邊並壓成透明單色墨跡，慳位清晰'}
        </span>
        <button type="button" className="linkbtn" onClick={clear}>
          {isEn ? 'Clear' : '清除重寫'}
        </button>
      </div>
    </div>
  );
}

export function SignModal({
  open,
  onClose,
  onSave,
  title = '手寫簽署',
  subtitle = '簽名只儲存在這部裝置（或放入核簽回傳碼）。',
  defaultName = '',
  defaultTitle = '',
  showMeta = true,
}) {
  const { isEn } = useLang();
  const [ink, setInk] = useState(null);
  const [name, setName] = useState(defaultName);
  const [role, setRole] = useState(defaultTitle);
  const [at, setAt] = useState(today());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setInk(null);
      setName(defaultName || '');
      setRole(defaultTitle || '');
      setAt(today());
    }
  }, [open, defaultName, defaultTitle]);

  if (!open) return null;

  const submit = async () => {
    if (!ink) return;
    setBusy(true);
    try {
      const small = await shrinkSignature(ink);
      onSave?.({
        png: small || ink,
        name: name.trim(),
        title: role.trim(),
        at,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} eyebrow="SIGNATURE" title={title} subtitle={subtitle} wide>
      {showMeta && (
        <div className="sigmeta">
          <label>
            <span>{isEn ? 'Signer Name' : '簽署人姓名'}</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={isEn ? 'e.g. Chan Chi-hin' : '例如：陳志軒'} />
          </label>
          <label>
            <span>{isEn ? 'Post / Title' : '職位／身分'}</span>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder={isEn ? 'e.g. CSL' : '例如：幼童軍團長 CSL'} />
          </label>
          <label>
            <span>{isEn ? 'Date' : '簽署日期'}</span>
            <input type="date" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
        </div>
      )}

      <SignaturePad onInk={setInk} />

      <div className="modal__actions">
        <button type="button" className="btn btn--ghost" onClick={onClose}>
          {isEn ? 'Cancel' : '取消'}
        </button>
        <button type="button" className="btn btn--primary" disabled={!ink || busy} onClick={submit}>
          <Icon name="check" size={15} /> {busy ? (isEn ? 'Saving…' : '壓縮中…') : isEn ? 'Confirm Signature' : '確認簽署'}
        </button>
      </div>
    </Modal>
  );
}

export function SignatureBlock({ label, en, value, onChange, defaultName = '', defaultTitle = '' }) {
  const { isEn } = useLang();
  const readOnly = useReadOnly();
  const [open, setOpen] = useState(false);

  return (
    <div className="sigblock">
      <div className="sigblock__head">
        <span className="frow__label">
          {isEn && en ? en : label}
          {!isEn && en && <em>{en}</em>}
        </span>
        {!readOnly && (
          <div className="sigblock__actions">
            {value?.png && (
              <button type="button" className="linkbtn" onClick={() => onChange?.(null)}>
                {isEn ? 'Clear' : '清除'}
              </button>
            )}
            <button type="button" className="linkbtn" onClick={() => setOpen(true)}>
              <Icon name="pen" size={12} /> {value?.png ? (isEn ? 'Re-sign' : '重簽') : isEn ? 'Sign' : '手寫簽名'}
            </button>
          </div>
        )}
      </div>

      {value?.png ? (
        <div
          className="sigblock__preview"
          onClick={() => !readOnly && setOpen(true)}
          role={readOnly ? undefined : 'button'}
          tabIndex={readOnly ? undefined : 0}
        >
          <img src={value.png} alt={label || '簽名'} />
          {(value.name || value.at) && (
            <small>
              {[value.name, value.title, value.at].filter(Boolean).join(' · ')}
            </small>
          )}
        </div>
      ) : readOnly ? (
        <div className="sigblock__empty sigblock__empty--readonly">
          <span>{isEn ? 'Unsigned' : '尚未簽署'}</span>
        </div>
      ) : (
        <button type="button" className="sigblock__empty" onClick={() => setOpen(true)}>
          <Icon name="pen" size={14} />
          <span>{isEn ? 'Tap to sign' : '點擊此處手寫簽署'}</span>
        </button>
      )}

      <SignModal
        open={open}
        onClose={() => setOpen(false)}
        title={isEn && en ? en : label}
        defaultName={value?.name || defaultName}
        defaultTitle={value?.title || defaultTitle}
        onSave={(sig) => {
          onChange?.(sig);
          setOpen(false);
        }}
      />
    </div>
  );
}
