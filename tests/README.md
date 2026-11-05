# tests/ — 自動化單元與契約測試

使用 Node.js 內建測試執行器（`node --test`），零額外測試框架依賴：

```bash
npm test
```

## 測試範圍

- `tests/book_and_syllabus.test.mjs`
  - 官方 32 頁頁碼映射（`PRINT_PAGES` 共 32 頁、無缺頁重覆、附錄不列印）；
  - 2026 年第十版綱要與 `cubbadge/data/items.json` **逐個 ID 相同**（72 個細項、49 個活動徽章、fixture sha256）；BOOK 鍵 ⇄ 官方 `badgeId` 雙向可逆；
  - 五階獎章（會員章／銅箭／銀箭／金箭／金紫荊）項目數 `9／12／16／18／17`；興趣範疇「兩個不同類別、每類一個」；
  - `SCOUT ID` 前導零容錯、移除舊 `ymis`、身份證只保留首四碼；
  - 金紫荊 126 個月（十歲半）資格；示範紀錄冊統計與續期狀態；
  - BOOK → BADGE 匯出必須 `status: 'pending'`、`confirmed: false`、零個人資料、BOOK 鍵轉官方編號、已在雲端 pending 者不重複；BADGE → BOOK 只收已核實、`pendingRequests` 永不錄入、空白冊可同步、他人資料整份拒絕。
- `tests/forms_and_transfer.test.mjs`
  - `PT/67`・`PT/68` 官方欄位與頁數；2026 新制只提供**非官方**核對清單（不得出現 `PT/XX` 編號）；
  - 自動帶入個人資料、年齡／月齡、金紫荊細項、活動徽章列；必填檢查；
  - `CB1` 二維碼預設全不剔選、壓縮編解碼、`#v=` 連結、`CB1S.` 核簽碼、SCOUT ID 不符拒絕、套用後仍需送 BADGE 核實；
  - 列印版面契約（`.a4sheet`、`.no-print`、`@media print`、`html[data-print-preview]`、`≤740px` 單欄）。
- `tests/cubbadge_sync.test.mjs`
  - 後端來源只接受 `https`；`GET /api/cubbadge` 零金鑰旅團清單；
  - `save`／`saveOtherBadge`／`reviewRequest` 等一律 `403`，且不會接觸後端；
  - `login` 只回傳 `token` + `ymis`；`load` 過濾他人紀錄與個人資料；`submitPending` 只轉發 `requestComplete`；
  - `sanitizePendingSubmissions` 剝除 PII、轉官方編號、去重、日期合法性、200 項上限；
  - 端到端：空白冊同步、只匯入已核實、申報永不自我核實。
- `tests/parent_mode.test.mjs`
  - 家長模式（第二部手機）：鏡像獨立儲存與退出清除、由 QR 與 cubbadge 匯出、pending 不入冊、家長模組零 `fetch`、只寫家長 store、零輸入欄位、圖示改黃且不含森林綠。
- `tests/standalone_book.test.mjs`
  - 完全離線的端到端流程：建立空白冊 → 填寫 → 統計 → `PT/67`/`PT/68` → `CB1` 出示 → `CB1S` 核簽 → 32 頁列印 → JSON 備份；
  - `probeCubBadgeBridge` 對靜態主機 HTML fallback、404、壞 payload、離線、逾時、無 fetch 一律安全降級；
  - 只有可選同步卡可觸及 `/api`；第 17 頁制服清單可剔選並持久化。
- `tests/activity_levels.test.mjs`
  - 官方 7 枚分級活動徽章（A18／A26／A27／A29／A33／A35／A39 × 初／中／高）逐級同步契約；
  - BOOK → cubbadge 逐級申報（`level` 欄位、`A26-E` pending 鍵）、已核實一級不再重送；
  - cubbadge → BOOK 三種寫法（`level` 欄位／後綴鍵／`levels` 物件）均寫回正確一級且互不覆蓋；
  - `CB1` 二維碼、`CB1S` 領袖核簽碼、家長只讀鏡像同樣保留各級日期；
  - `api/cubbadge` 送交逐級去重、載入統一成「官方編號 + level」；`A25-NATURE`／`A09-CHILD-PROTECTION` 不得被誤拆成級別；
  - 領袖核簽介面（`SignoffPanel`）逐級列出活動徽章並交予核簽回傳碼；成員端 `Scan` 逐級回顧舊／新日期。
- `tests/ui_contracts.test.mjs`
  - 32 頁 + 目錄 + 附錄路由映射；版權聲明只出現三處；
  - 幼童軍黃 `#ead040` × 深墨 WCAG AA 與「禁止白字配黃」；`api/leader.js` 的 `timingSafeEqual` 與零前端密碼；
  - 領袖模式（只讀）與普通模式分離；中英分離；
  - 九件套圖示、manifest 與 Service Worker 預快取檔案全部存在；
  - `package.json`／`vite.config.js` 已完全改用 `/api/cubbadge`。
