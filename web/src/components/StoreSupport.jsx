import React from 'react';
import { useLang } from '../i18n.jsx';

const APP_STORE_SLUG = 'cubsbook';

export default function StoreSupport({ onPaper = false }) {
  const { isEn } = useLang();
  const helper = typeof window !== 'undefined' ? window.ScoutStoreGate?.getAppStoreUrl : null;
  const href = typeof helper === 'function' ? helper(APP_STORE_SLUG) : '';
  const label = isEn
    ? 'Like or save this app on SCOUT APP STORE (opens in a new tab)'
    : '前往主站讚好或收藏此程式（開新分頁）';
  return (
    <a
      id="storeSupportTop"
      className={`store-support${onPaper ? ' store-support--paper' : ''}`}
      href={href || undefined}
      hidden={!href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">♥</span>
      <span>{isEn ? 'Like / Save' : '讚好／收藏'}</span>
    </a>
  );
}
