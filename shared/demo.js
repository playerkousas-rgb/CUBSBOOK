/**
 * 示範紀錄冊的單一真相（零依賴，前端與 `api/` 伺服器端共用）。
 *
 * 示範資料全部虛構，只供熟習介面及真機測試表格／全冊列印：
 *   1. 以 `book.meta.demo === true` 標記，備份及還原後仍然保留；
 *   2. 使用保留的示範 SCOUT ID（全零），正式系統不會有這個成員；
 *   3. 凡示範資料輸出的 A4 表格及列印頁一律加上「不可遞交」標示；
 *   4. 不含任何簽名圖片，簽署格只印「示範簽署」文字；
 *   5. 不可送交、匯出或錄入 CUBSBADGE（前端、共用邏輯及伺服器橋接三重封鎖）。
 */

/** 保留給示範紀錄冊的 SCOUT ID：十位全零，並非任何成員的編號。 */
export const DEMO_SCOUT_ID = '0000000000';

export const DEMO_NOTICE = {
  zh: '示範樣本，只供測試，不可遞交',
  en: 'SAMPLE ONLY — FOR TESTING — NOT FOR SUBMISSION',
  signZh: '示範簽署',
  signEn: 'SAMPLE SIGNATURE',
};

export const DEMO_SYNC_BLOCKED = {
  code: 'DEMO_BLOCKED',
  zh: '示範資料屬虛構內容，不可同步、送交或匯出至 CUBSBADGE。請先建立自己的紀錄冊。',
  en: 'Demo data is fictional and cannot be synced, submitted or exported to CUBSBADGE. Create your own record book first.',
};

const cleanId = (raw) => String(raw ?? '').trim().replace(/\s+/g, '');

/** 是否為保留的示範 SCOUT ID（容忍空白及不足十位的全零寫法；全零並非有效成員編號）。 */
export function isDemoScoutId(raw) {
  const id = cleanId(raw);
  return id.length > 0 && /^0+$/.test(id);
}

/** 是否為示範紀錄冊：有示範標記，或仍使用保留的十位全零示範 SCOUT ID。 */
export function isDemoBook(book) {
  if (!book || typeof book !== 'object') return false;
  if (book.meta?.demo === true) return true;
  const m = book.member || {};
  return cleanId(m.scoutId || m.memberNo || m.ymis) === DEMO_SCOUT_ID;
}

/** 共用守衛：示範資料（或全零編號）一律拒絕進入正式同步流程。 */
export function assertNotDemo(book) {
  const m = book?.member || {};
  if (isDemoBook(book) || isDemoScoutId(m.scoutId || m.memberNo || m.ymis)) {
    const err = new Error(DEMO_SYNC_BLOCKED.zh);
    err.code = DEMO_SYNC_BLOCKED.code;
    throw err;
  }
}
