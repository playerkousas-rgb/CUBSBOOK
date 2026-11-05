import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const LANG_KEY = 'cubbook.lang';

const LangCtx = createContext({ lang: 'zh', isEn: false, setLang() {}, toggle() {} });

function readLang() {
  try {
    return localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh';
  } catch {
    return 'zh';
  }
}

export function LangProvider({ children }) {
  const [lang, setLang] = useState(readLang);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang === 'en' ? 'en' : 'zh-Hant-HK');
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* private mode */
    }
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      isEn: lang === 'en',
      setLang,
      toggle: () => setLang((l) => (l === 'en' ? 'zh' : 'en')),
    }),
    [lang],
  );

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export function useLang() {
  return useContext(LangCtx);
}

export function bi(lang, zh, en) {
  return lang === 'en' && en ? en : zh;
}

export function englishOf(text) {
  if (!text) return '';
  const m = String(text).match(/^([^A-Za-z]*?[\u4e00-\u9fff][^A-Za-z]*)\s+([A-Za-z].*)$/);
  return m ? m[2].trim() : '';
}

const ADD_LABELS = {
  加一行: 'Add row',
  加一項: 'Add entry',
  加一個獎章: 'Add badge',
  加一次轉旅: 'Add transfer',
  加一次搬遷: 'Add address change',
  加一次更改: 'Add change',
  加一年續期: 'Add renewal year',
  加一項經驗: 'Add experience',
  加一次遠足或海外活動: 'Add expedition / overseas activity',
};

export function addLabelFor(lang, text) {
  if (lang !== 'en') return text;
  if (!text) return 'Add row';
  return ADD_LABELS[text] || englishOf(text) || 'Add row';
}

const TERMS = {
  項目: 'Items',
  主考: 'Initials',
  日期: 'Date',
  證書編號: 'Certificate No.',
  完成日期: 'Date of Completion',
  簽署: 'Signature',
  姓名: 'Name',
  職位: 'Post',
  時段: 'Period',
  描述: 'Descriptions',
  獎章: 'Badge',
};

export function termFor(lang, text) {
  if (lang !== 'en' || !text) return text;
  return TERMS[text] || text;
}
