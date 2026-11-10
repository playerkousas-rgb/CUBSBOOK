/**
 * 偵測伺服器端 `/api/cubbadge` 橋接是否可用。
 *
 * BOOK 的設計前提：**沒有 BADGE 也要 100% 可用**。因此這裡只做「可選偵測」，
 * 任何失敗（純靜態主機、SPA fallback 回傳 HTML、404、逾時、離線）都必須安靜地
 * 回報 `available: false`，讓介面切換為「獨立模式」，而不得阻塞紀錄冊任何功能。
 */

export const BRIDGE_ENDPOINT = '/api/cubbadge';
export const DEFAULT_CUBSBADGE_URL = 'https://cubsbadge.vercel.app';

export async function probeCubBadgeBridge({
  fetchImpl = globalThis.fetch,
  timeoutMs = 6000,
} = {}) {
  if (typeof fetchImpl !== 'function') return { available: false, reason: 'no-fetch' };

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const res = await fetchImpl(BRIDGE_ENDPOINT, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!res || !res.ok) return { available: false, reason: `http-${res?.status ?? 'error'}` };

    const type = String(res.headers?.get?.('content-type') || '');
    // 靜態主機會把 /api/* 重寫成 index.html（200 text/html）→ 必須當作不可用。
    if (!type.toLowerCase().includes('json')) return { available: false, reason: 'not-json' };

    const data = await res.json().catch(() => null);
    if (!data?.success || !data.troops || typeof data.troops !== 'object' || Array.isArray(data.troops)) {
      return { available: false, reason: 'bad-payload' };
    }
    return {
      available: true,
      troops: data.troops,
      origin: data.origin || DEFAULT_CUBSBADGE_URL,
      upstreamOk: data.upstreamOk !== false,
    };
  } catch (err) {
    return { available: false, reason: err?.name === 'AbortError' ? 'timeout' : 'network' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
