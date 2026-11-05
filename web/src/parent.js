/* ==========================================================================
   家長模式（Parent Mode · 純讀取）
   --------------------------------------------------------------------------
   - 一部裝置、一本紀錄冊：孩子負責填寫，家長只需「查看」。
   - 家長模式只把介面鎖為只讀（`readOnly`），不會修改任何資料，亦**毋須**
     填寫任何個人資料，更不需要帳號、密碼、網絡或 cubbadge。
   - 與領袖模式（伺服器密碼驗證）不同，家長模式只是同一部裝置上的
     顯示切換，不含任何授權或跨成員讀取能力。
   ========================================================================== */

const KEY = 'cubbook.parent.v1';

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function isParent() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function enterParentMode() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* private mode: 只鎖記憶體狀態，重新載入即失效 */
  }
  emit();
}

export function exitParentMode() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
  emit();
}

export function onParentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
