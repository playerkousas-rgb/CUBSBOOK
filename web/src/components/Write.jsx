import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Icon, Modal, cx } from '../ui.jsx';
import { SignaturePad } from './Ink.jsx';
import { shrinkInk } from '../signature.js';
import { useLang } from '../i18n.jsx';
import { useReadOnly } from '../bookContext.js';

/**
 * Write — 紙本橫線／欄位填寫元件（對齊 ROVERBOOK v15）：
 * 螢幕上空白欄位只顯示小圓圈（.write__dot），點一下即可輸入或手寫；
 * 列印時自動隱藏圓圈並回復紙本橫線。
 */

export const isInkValue = (v) => Boolean(v && typeof v === 'object' && typeof v.ink === 'string');
export const plainText = (v) => (isInkValue(v) ? '' : typeof v === 'string' ? v : '');

const MAX = 15.5;
const MIN = 7;
const STEP = 0.5;

function fitText(el, max = MAX) {
  if (!el) return;
  let size = max;
  el.style.fontSize = `${size}px`;
  const overflow = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
  let guard = 40;
  while (size > MIN && overflow() && guard-- > 0) {
    size -= STEP;
    el.style.fontSize = `${size}px`;
  }
}

export default function Write({
  value = '',
  onChange,
  multiline = false,
  rows = 2,
  type = 'text',
  placeholder = '',
  className = '',
  label,
  compact = false,
  align,
  max = MAX,
}) {
  const { isEn } = useLang();
  const readOnly = useReadOnly();
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(false);
  const fieldRef = useRef(null);
  const inputRef = useRef(null);

  // 手機：開始輸入時，把欄位拉到畫面中央，避免被鍵盤遮住
  const reveal = useCallback((el) => {
    if (!el || typeof window === 'undefined') return;
    if (!window.matchMedia?.('(max-width: 740px)').matches) return;
    setTimeout(() => {
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 280);
  }, []);

  useEffect(() => {
    if (editing) reveal(inputRef.current);
  }, [editing, reveal]);

  const commit = useCallback((next) => onChange?.(next), [onChange]);

  useLayoutEffect(() => {
    if (!editing && !isInkValue(value)) fitText(fieldRef.current, max);
  }, [value, editing, max, multiline, rows]);

  useEffect(() => {
    const el = fieldRef.current;
    if (!el || editing) return;
    const parent = el.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitText(el, max));
    ro.observe(parent);
    return () => ro.disconnect();
  }, [editing, max]);

  if (readOnly) {
    return (
      <span
        className={cx(
          'write write--readonly',
          multiline && 'write--multi',
          compact && 'write--compact',
          !value && 'is-empty',
          className,
        )}
        style={multiline ? { '--rows': rows } : undefined}
      >
        {isInkValue(value) ? (
          <img className="write__ink" src={value.ink} alt={label || '手寫'} />
        ) : (
          <span className="write__fit write__text" ref={fieldRef} style={align ? { textAlign: align } : undefined}>
            {plainText(value)}
          </span>
        )}
      </span>
    );
  }

  if (type === 'date') {
    return (
      <span className={cx('write write--date', !value && 'is-empty', className)}>
        <input
          className="write__date"
          type="date"
          value={value || ''}
          onChange={(e) => commit(e.target.value)}
          aria-label={label || placeholder || (isEn ? 'Date' : '日期')}
        />
      </span>
    );
  }

  const openZoom = (e) => {
    e.stopPropagation();
    setEditing(false);
    setZoom(true);
  };

  return (
    <>
      <span
        className={cx(
          'write',
          multiline && 'write--multi',
          compact && 'write--compact',
          !value && 'is-empty',
          editing && 'is-editing',
          className,
        )}
        style={multiline ? { '--rows': rows } : undefined}
        onClick={() => {
          if (editing) return;
          const touch = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
          if (isInkValue(value) || touch) setZoom(true);
          else setEditing(true);
        }}
        onDoubleClick={openZoom}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (!editing && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            if (isInkValue(value)) setZoom(true);
            else setEditing(true);
          }
        }}
        aria-label={label || placeholder || (isEn ? 'Fill field' : '填寫')}
      >
        {editing ? (
          multiline ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
                if (el) fitText(el, max);
              }}
              className="write__input write__fit"
              autoFocus
              defaultValue={plainText(value)}
              placeholder={placeholder}
              onChange={(e) => {
                commit(e.target.value);
                fitText(e.target, max);
              }}
              onBlur={() => setEditing(false)}
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
                if (el) fitText(el, max);
              }}
              className="write__input write__fit"
              autoFocus
              defaultValue={plainText(value)}
              placeholder={placeholder}
              onChange={(e) => {
                commit(e.target.value);
                fitText(e.target, max);
              }}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
              }}
            />
          )
        ) : isInkValue(value) ? (
          <img className="write__ink" src={value.ink} alt={label || placeholder || '手寫'} />
        ) : (
          <span
            className="write__fit write__text"
            ref={fieldRef}
            title={plainText(value) || undefined}
            style={align ? { textAlign: align } : undefined}
          >
            {plainText(value) || <span className="write__dot" aria-hidden="true" />}
          </span>
        )}

        {!editing && Boolean(value) && (
          <button
            type="button"
            className="write__zoom"
            onClick={openZoom}
            aria-label={isEn ? 'Expand editor' : '放大填寫'}
            title={isEn ? 'Expand editor' : '放大填寫'}
          >
            <Icon name="expand" size={11} />
          </button>
        )}
      </span>

      {zoom && (
        <Modal
          onClose={() => setZoom(false)}
          eyebrow="WRITE"
          title={label || (isEn ? 'Edit Field' : '放大填寫')}
          subtitle={
            isEn
              ? 'Long text shrinks automatically to fit. Type comfortably here or write with stylus/finger.'
              : '字數多時會自動縮小；在這裡可以舒服地打字或手寫（手寫板適用於平板／觸控筆）。'
          }
          wide
        >
          <ZoomEditor
            value={value}
            multiline={multiline}
            rows={multiline ? Math.max(rows, 6) : 1}
            placeholder={placeholder}
            onSave={(next) => {
              commit(next);
              setZoom(false);
            }}
            onCancel={() => setZoom(false)}
          />
        </Modal>
      )}
    </>
  );
}

function ZoomEditor({ value, multiline, rows, placeholder, onSave, onCancel }) {
  const { isEn } = useLang();
  const initialInk = isInkValue(value) ? value.ink : null;
  const [tab, setTab] = useState(initialInk ? 'ink' : 'type');
  const [draft, setDraft] = useState(plainText(value));
  const [ink, setInk] = useState(initialInk);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (tab !== 'ink') return onSave(draft);
    if (!ink) return onSave('');
    setSaving(true);
    try {
      const small = await shrinkInk(ink, { maxW: 640, maxH: 120 });
      onSave({ ink: small || ink });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="zoomtabs" role="tablist" aria-label={isEn ? 'Input mode' : '輸入方式'}>
        <button type="button" role="tab" aria-selected={tab === 'type'} className={cx('zoomtab', tab === 'type' && 'is-on')} onClick={() => setTab('type')}>
          <Icon name="edit" size={14} /> {isEn ? 'Type' : '打字'}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'ink'} className={cx('zoomtab', tab === 'ink' && 'is-on')} onClick={() => setTab('ink')}>
          <Icon name="pen" size={14} /> {isEn ? 'Handwrite' : '手寫'}
        </button>
      </div>

      {tab === 'type' ? (
        multiline ? (
          <textarea
            className="zoomfield"
            autoFocus
            rows={rows}
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
          />
        ) : (
          <input
            className="zoomfield"
            autoFocus
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') onCancel();
            }}
          />
        )
      ) : (
        <SignaturePad onInk={setInk} />
      )}

      <div className="modal__actions">
        {Boolean(value) && (
          <button type="button" className="btn btn--ghost" onClick={() => onSave('')}>
            {isEn ? 'Clear' : '清空'}
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          {isEn ? 'Cancel' : '取消'}
        </button>
        <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
          <Icon name="check" size={15} /> {saving ? (isEn ? 'Saving…' : '處理中…') : isEn ? 'Done' : '完成'}
        </button>
      </div>
    </>
  );
}
