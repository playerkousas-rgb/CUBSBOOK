import React, { useRef } from 'react';
import { Icon, useToast } from '../ui.jsx';
import { shrinkPhoto } from '../signature.js';
import { useLang } from '../i18n.jsx';
import { useReadOnly } from '../bookContext.js';

export function PhotoPicker({ value, onChange }) {
  const inputRef = useRef(null);
  const { push } = useToast();
  const { isEn } = useLang();
  const readOnly = useReadOnly();

  const onFile = async (e) => {
    if (readOnly) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      push(isEn ? 'Please choose an image file' : '請選擇圖片檔案', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const compressed = await shrinkPhoto(String(reader.result || ''));
      onChange?.(compressed);
      push(isEn ? 'Photo compressed & saved locally' : '近照已自動壓縮並儲存於本機');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="photobox">
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} disabled={readOnly} />
      {value ? (
        <div className="photobox__filled">
          <img src={value} alt={isEn ? 'Member Photo' : '個人近照'} onClick={() => !readOnly && inputRef.current?.click()} />
          {!readOnly && (
            <div className="photobox__actions">
              <button type="button" className="linkbtn" onClick={() => inputRef.current?.click()}>
                {isEn ? 'Replace' : '更換'}
              </button>
              <button type="button" className="linkbtn" onClick={() => onChange?.(null)}>
                {isEn ? 'Remove' : '移除'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <button type="button" className="photobox__empty" disabled={readOnly} onClick={() => !readOnly && inputRef.current?.click()}>
          <Icon name="image" size={20} />
          <strong>{isEn ? 'PHOTO' : '近照'}</strong>
          <small>{isEn ? '(Photo with group chop)' : '(請蓋旅印於近照上)'}</small>
        </button>
      )}
    </div>
  );
}
