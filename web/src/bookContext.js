import { createContext, useCallback, useContext } from 'react';

export const BookCtx = createContext(null);

export function useBook() {
  const ctx = useContext(BookCtx);
  if (!ctx) throw new Error('BookCtx missing');
  return ctx;
}

export function useReadOnly() {
  const ctx = useContext(BookCtx);
  return Boolean(ctx?.readOnly);
}

export function getPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  const walk = (node, i) => {
    const key = keys[i];
    const isLast = i === keys.length - 1;
    if (Array.isArray(node)) {
      const copy = node.slice();
      const index = Number(key);
      while (copy.length <= index) copy.push(undefined);
      copy[index] = isLast ? value : walk(copy[index] ?? {}, i + 1);
      return copy;
    }
    const base = node && typeof node === 'object' ? node : {};
    const copy = { ...base };
    copy[key] = isLast ? value : walk(copy[key] ?? {}, i + 1);
    return copy;
  };
  return walk(obj, 0);
}

export function useField(path, fallback = '') {
  const { book, update, readOnly } = useBook();
  const value = getPath(book, path);
  const set = useCallback(
    (next) => {
      if (readOnly) return;
      update((b) => setPath(b, path, typeof next === 'function' ? next(getPath(b, path)) : next));
    },
    [update, path, readOnly],
  );
  return [value === undefined || value === null ? fallback : value, set];
}
