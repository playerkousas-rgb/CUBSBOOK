import { shrinkInk, shrinkPhoto } from './signature.js';

export const STORAGE_LIMIT = 5 * 1024 * 1024;

const isInk = (v) => Boolean(v && typeof v === 'object' && typeof v.ink === 'string');
const isSignature = (v) => Boolean(v && typeof v === 'object' && typeof v.png === 'string');
const isPhoto = (v) => typeof v === 'string' && v.startsWith('data:image');

function setDeep(obj, pathStr, value) {
  const keys = pathStr.split('.');
  let cur = obj;
  keys.slice(0, -1).forEach((k) => {
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
}

function labelOf(p) {
  if (p === 'member.photo') return '第 1 頁近照';
  if (p === 'holderSignature.png') return '持有人簽名';
  if (p.startsWith('progress.')) return `細項簽核 · ${p.split('.')[1]}`;
  if (p.startsWith('renewals.')) return `續期簽署 · 第 ${Number(p.split('.')[1]) + 1} 行`;
  if (p.startsWith('pages.')) return `內頁簽名／手寫 · ${p.split('.').slice(1, 3).join(' ')}`;
  return p;
}

export function scanImages(book) {
  const out = [];
  const walk = (node, p, depth = 0) => {
    if (node == null || depth > 7) return;
    if (isInk(node)) {
      out.push({ path: `${p}.ink`, type: 'ink', data: node.ink, chars: node.ink.length, label: labelOf(p) });
      return;
    }
    if (isSignature(node)) {
      out.push({ path: `${p}.png`, type: 'signature', data: node.png, chars: node.png.length, label: labelOf(`${p}.png`) });
      return;
    }
    if (isPhoto(node)) {
      out.push({ path: p, type: 'photo', data: node, chars: node.length, label: labelOf(p) });
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${p}.${i}`, depth + 1));
      return;
    }
    if (typeof node === 'object') {
      Object.keys(node).forEach((key) => walk(node[key], p ? `${p}.${key}` : key, depth + 1));
    }
  };
  walk(book, '');
  return out.sort((a, b) => b.chars - a.chars);
}

export function storageUsage(book) {
  const chars = JSON.stringify(book || {}).length;
  const bytes = chars * 2;
  return {
    chars,
    bytes,
    kb: Math.max(1, Math.round(bytes / 1024)),
    ratio: Math.min(1, bytes / STORAGE_LIMIT),
    images: scanImages(book),
  };
}

export function imageSizeLabel(chars) {
  return `${Math.max(1, Math.round((chars * 2) / 1024))} KB`;
}

export async function compressBookMedia(book) {
  const next = structuredClone(book);
  const items = scanImages(next);
  let savedChars = 0;
  for (const item of items) {
    let smaller = item.data;
    if (item.type === 'photo') {
      smaller = await shrinkPhoto(item.data, { maxW: 300, quality: 0.66 });
    } else if (item.type === 'ink') {
      smaller = await shrinkInk(item.data, { maxW: 480, maxH: 100 });
    } else {
      smaller = await shrinkInk(item.data, { maxW: 280, maxH: 84 });
    }
    if (smaller && smaller.length < item.data.length) {
      savedChars += item.data.length - smaller.length;
      setDeep(next, item.path, smaller);
    }
  }
  return { book: next, savedKB: Math.round((savedChars * 2) / 1024) };
}
