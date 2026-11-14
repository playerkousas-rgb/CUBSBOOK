/**
 * 服務平台 iframe 嵌入契約（單一真相）。
 *
 * - 部署安全標頭：`vercel.json` 以 `Content-Security-Policy: frame-ancestors` 白名單
 *   只容許 BOOK 自身及服務平台嵌入；不得再設 `X-Frame-Options`（`DENY`／`SAMEORIGIN`
 *   都會擋住跨網站嵌入）。`tests/embed_contract.test.mjs` 以此檔常數鎖死標頭內容。
 * - 相機：BOOK 回應的 `Permissions-Policy: camera=(self)` 維持不變；服務平台的
 *   `<iframe>` 須以 `allow` 屬性把相機權限委派給 BOOK（見 `IFRAME_ALLOW`）。
 * - 儲存：瀏覽器把跨網站 iframe 的 localStorage／Service Worker 快取按頂層網站分割，
 *   所以平台內的紀錄冊與獨立版互不相通，只能以備份 JSON 搬移。
 */

export const PORTAL_ORIGIN = 'https://member-portal-sigma-swart.vercel.app';

export const FRAME_ANCESTORS = `frame-ancestors 'self' ${PORTAL_ORIGIN}`;

/** 服務平台 `<iframe allow="…">` 需要委派的權限：相機掃描及「複製代碼／連結」。 */
export const IFRAME_ALLOW = 'camera; clipboard-write';

/** 嵌入模式提示條「知道了」的工作階段標記（只存於 sessionStorage）。 */
export const EMBED_ACK_KEY = 'cubbook.embed.ack.v1';

const currentWindow = () => (typeof window === 'undefined' ? null : window);

/** 是否正被其他頁面以 iframe 嵌入。讀不到頂層視窗（跨網站）時一律視為嵌入。 */
export function isEmbedded(win = currentWindow()) {
  if (!win) return false;
  try {
    return win.self !== win.top;
  } catch {
    return true;
  }
}

/** 獨立版網址（即 BOOK 自身的來源），供嵌入模式以新分頁開啟。 */
export function standaloneUrl(win = currentWindow()) {
  const origin = win?.location?.origin;
  return origin && origin !== 'null' ? `${origin}/` : '/';
}

/** 獨立版主機名稱，只用於提示文字。 */
export function standaloneHost(win = currentWindow()) {
  return win?.location?.host || '';
}
