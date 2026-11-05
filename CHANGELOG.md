# CHANGELOG.md — 版本變更紀錄

本專案採用語義化版本（Semantic Versioning），每次更新同步對齊 `package.json`、`shared/book.js` 及 `web/index.html`。

## [v1.0.0] — 2026-11-05

### 新增（Added）
- **紙本第 1–19 頁完整數位紀錄冊**：逐頁對齊香港童軍總會《幼童軍紀錄冊》，涵蓋個人資料、聯絡及家長、旅團資料、童軍紀錄、轉旅及更改、會員資格續期、服務及獎勵、會員章（`L1`）、銅箭章（`L2`）、銀箭章（`L3`）、金箭章（`L4`）、金紫荊獎章（`OT-GB`）、活動徽章兩頁、頒發及宣誓紀錄、誓詞與規律、制服及徽章位置、進度總覽及使用說明，另設數位附錄。
- **深森林綠布面視覺**：`#143b28` × `#08180f` × 幼童軍金黃 `#e6a800`／`#e3c07a` 配象牙紙內頁；幼童軍黃只作底色，文字一律深炭或深綠，白字配黃在設計上禁用（對比 < 3:1）。全螢幕 `100dvh` 封面、A4 紙本內頁及 `/print` 整本 19 頁列印。
- **就地打字、手寫墨跡與透明單色簽名壓縮**：`Write` 自動縮字、雙擊放大編輯、空白欄 `.write__dot`、`SignaturePad` 去白底壓縮，以及數位附錄「本機儲存健康檢查」。
- **兩張官方表格自動帶入與 A4 列印**：`FORM PT/67 (4/2019)` 金紫荊獎章開展通知書（1 頁）、`FORM PT/68 (06/2024)` 金紫荊獎章及證書申請表（2 頁），並附 2026 新制**非官方**資料核對清單（不編造表格編號）。
- **純離線成員⇄領袖二維碼（`CB1` 協定）**：`CB1.`（gzip）、`CB1P.`（未壓縮）、`CB1S.`（領袖核簽）及 `#v=` 連結；出示前逐項剔選，預設全不選。
- **與 `cubbadge` 純進度同步（零個人資料）**：`GET /api/cubbadge` 取得旅團清單、`POST {action:'login'|'load'|'submitPending'}`；只傳 SCOUT ID、項目代號、日期；`save`／`saveOtherBadge` 一律 `403`；BOOK→BADGE 只轉發 `requestComplete`（`status: 'pending'`）。
- **項目 ID 單一真相**：`scripts/build_syllabus.mjs` 由 `cubbadge/data/items.json` 產生 `shared/syllabus.js`，72 個進度細項與 49 個活動徽章逐一對照，並以 fixture sha256 鎖定。
- **領袖模式（只讀）與普通模式嚴格分離**：`/api/leader` 以 `crypto.timingSafeEqual` 比對伺服器端 `LEADER_CODE`（不加 `VITE_` 前綴）；領袖模式解鎖後本機紀錄冊鎖為唯讀。
- **全套圖示與真理倉守衛**：`/favicon.svg`、`/favicon.ico`、`/favicon-32.png`、`/favicon-48.png` 及 `/icons/*` 九件套（總 < 260 KB）；`scripts/` 內含 `guard.mjs`、`final_check_v1.0.mjs`、`repo_health_v1.0.mjs`、`preflight_v1.0.mjs`。
- **介面與文件測試**：`node --test` 覆蓋頁數契約、項目 ID、`pending` 不可倒灌、`403` 封鎖、`CB1S.` 前綴、版權三處、WCAG 對比、圖示與 manifest 一致性。

### 已知限制（Known limitations）
- 2026 新制金紫荊獎章官方表格尚未公布，`gbac` 僅為資料核對清單。
- `cubbadge` 後端三項修正（PBKDF2 10,000 次、`pending` 去重、`OT-*` 寫入「其他獎章」）記錄於 [`docs/cubbadge-patch.md`](docs/cubbadge-patch.md)，須在 `cubbadge` 倉庫另行套用。
