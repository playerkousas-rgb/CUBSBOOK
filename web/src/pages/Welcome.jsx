import React, { useRef, useState } from 'react';
import { useToast, Crest, Icon } from '../ui.jsx';
import { demoBook, importFromBadge, newBook } from '@shared/book.js';
import { persistBook } from '../bookStore.js';
import { navigate } from '../router.jsx';
import { useLang } from '../i18n.jsx';

export default function Welcome({ onReady, onLeader }) {
  const { push } = useToast();
  const { isEn, toggle } = useLang();
  const [form, setForm] = useState({
    nameZh: '',
    nameEn: '',
    scoutId: '',
    unit: '',
    group: '',
    district: '',
    region: '',
  });
  const fileRef = useRef(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const start = (book, target) => {
    persistBook(book);
    onReady(book);
    navigate(target);
  };

  const create = (e) => {
    e.preventDefault();
    if (!form.nameZh.trim() && !form.nameEn.trim()) return;
    start(newBook({ member: form }), '/p/p01');
    push(isEn ? 'Record book created' : '紀錄冊已建立，開始填寫吧');
  };

  const importFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.member && data?.pages) {
          start(newBook(data), '/p/contents');
          push(isEn ? 'Backup restored' : '備份已還原');
          return;
        }
        if (data?.progress || data?.otherBadges || data?.flatProgress || Array.isArray(data?.members) || data?.schema?.includes('cubbadge')) {
          const res = importFromBadge(data, newBook());
          start(res.book, '/p/contents');
          push(
            isEn
              ? `Imported ${res.imported} leader-verified items from cubbadge`
              : `已從 cubbadge 匯入 ${res.imported} 項領袖已核實進度`,
          );
          return;
        }
        throw new Error(isEn ? 'Not a CUBBOOK or cubbadge JSON file' : '這不是 CUBBOOK 或 cubbadge 備份檔');
      } catch (err) {
        push(err.message || (isEn ? 'Invalid file format' : '檔案格式不正確'), 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="welcome">
      <div className="welcome__cover">
        <div className="coverart coverart--inline">
          <div className="coverart__grain" aria-hidden="true" />
          <span className="coverart__frame coverart__frame--outer" aria-hidden="true" />
          <span className="coverart__frame coverart__frame--inner" aria-hidden="true" />
          <span className="coverart__spine" aria-hidden="true" />
          <div className="coverart__top">
            <Crest size={48} />
            <div>
              <strong>{isEn ? 'SCOUT ASSOCIATION OF HONG KONG' : '香港童軍總會'}</strong>
            </div>
          </div>
          <div className="coverart__center">
            {isEn ? (
              <>
                <span className="coverart__kicker">CUB SCOUT SECTION</span>
                <h1 className="coverart__title coverart__title--en">VENTURE SCOUT</h1>
                <h2 className="coverart__subtitle">RECORD BOOK</h2>
              </>
            ) : (
              <>
                <span className="coverart__kicker">CUB SCOUT</span>
                <h1 className="coverart__title">幼童軍</h1>
                <h2 className="coverart__subtitle">紀　錄　冊</h2>
              </>
            )}
          </div>
          <div className="coverart__plate">
            <span className="coverart__plate-label">{isEn ? 'HOLDER' : '持有人'}</span>
            <strong>{(isEn ? form.nameEn || form.nameZh : form.nameZh || form.nameEn) || (isEn ? 'Your Name' : '你的名字')}</strong>
            <span className="coverart__plate-sub">{form.unit || form.group || (isEn ? 'Cub Scout Unit' : '幼童軍團')}</span>
          </div>
        </div>
      </div>

      <div className="welcome__panel">
        <div className="welcome__topbar">
          <div className="welcome__brand">
            <Crest size={28} />
            <span>
              <strong>CUBBOOK</strong>
              <em>{isEn ? 'Cub Scout Record Book' : '幼童軍紀錄冊'}</em>
            </span>
          </div>
          <button type="button" className="btn btn--onpaper btn--sm" onClick={toggle}>
            <Icon name="globe" size={13} /> {isEn ? '中文' : 'EN'}
          </button>
        </div>

        <h1>{isEn ? 'This record book is yours.' : '這本紀錄冊，是你的。'}</h1>
        <p className="welcome__lede">
          {isEn
            ? 'No account, no login. Your entire record book stays on this device — tap any line to fill, and present a QR code when sharing selected sections with your leader.'
            : '不需要帳號、不需要登入。整本冊子存在你這部裝置；逐頁點擊就可以填寫，並可出示二維碼讓領袖在「領袖模式（只讀）」下查閱及核簽。'}
        </p>

        <form className="welcome__form" onSubmit={create}>
          <div className="welcome__row">
            <label className="field">
              <span className="field__label">{isEn ? 'Name (Chinese)' : '姓名（中文）'}</span>
              <input className="welcome__input" value={form.nameZh} onChange={set('nameZh')} placeholder="張芷晴" required={!form.nameEn.trim()} />
            </label>
            <label className="field">
              <span className="field__label">{isEn ? 'Name (English)' : '姓名（英文）'}</span>
              <input className="welcome__input" value={form.nameEn} onChange={set('nameEn')} placeholder="CHEUNG Tsz-ching" />
            </label>
          </div>
          <div className="welcome__row">
            <label className="field">
              <span className="field__label">
                {isEn ? 'SCOUT ID (same as cubbadge)' : '童軍成員編號 SCOUT ID'}
              </span>
              <input
                className="welcome__input"
                value={form.scoutId}
                onChange={(e) => setForm((f) => ({ ...f, scoutId: e.target.value }))}
                placeholder="25081420"
              />
            </label>
            <label className="field">
              <span className="field__label">{isEn ? 'Group' : '旅'}</span>
              <input className="welcome__input" value={form.group} onChange={set('group')} placeholder={isEn ? '28th Hong Kong Group' : '港島第 28 旅'} />
            </label>
          </div>
          <div className="welcome__row">
            <label className="field">
              <span className="field__label">{isEn ? 'Cub Scout Unit' : '幼童軍團'}</span>
              <input className="welcome__input" value={form.unit} onChange={set('unit')} placeholder={isEn ? '28th HK Cub Scout Unit' : '港島第 28 旅幼童軍團'} />
            </label>
            <label className="field">
              <span className="field__label">{isEn ? 'District' : '區'}</span>
              <input className="welcome__input" value={form.district} onChange={set('district')} placeholder={isEn ? 'Wan Chai' : '灣仔區'} />
            </label>
          </div>

          <div className="welcome__actions">
            <button className="btn btn--gold btn--lg" type="submit">
              <Icon name="book" size={17} /> {isEn ? 'Create My Record Book' : '建立我的紀錄冊'}
            </button>
            <button
              type="button"
              className="btn btn--onpaper"
              onClick={() => {
                start(demoBook(), '/p/contents');
                push(isEn ? 'Demo record book loaded' : '已載入示範紀錄冊');
              }}
            >
              {isEn ? 'Try Demo Data' : '用示範資料看看'}
            </button>
            <button type="button" className="btn btn--onpaper" onClick={() => fileRef.current?.click()}>
              {isEn ? 'Import Backup' : '匯入備份'}
            </button>
            {onLeader && (
              <button type="button" className="btn btn--onpaper" onClick={onLeader}>
                <Icon name="lock" size={14} /> {isEn ? 'Leader Mode' : '領袖模式'}
              </button>
            )}
          </div>
          <p className="welcome__fine">
            {isEn
              ? 'No sign-up or cloud sync. Data lives on this device — export a backup before switching phones.'
              : '沒有「註冊」或「登入」。資料留在這部裝置；換機前請在選單匯出備份。'}
          </p>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </form>
      </div>
    </div>
  );
}
