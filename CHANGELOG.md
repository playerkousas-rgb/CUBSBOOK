# CHANGELOG.md — 版本變更紀錄

本專案採用語義化版本（Semantic Versioning），每次更新同步對齊 `package.json`、`shared/book.js` 及 `web/index.html`。

## [v1.1.0] — 2026-11-05

### 更改（Changed · 家長模式重新定義）
- **家長模式 = 第二部手機**（一個 cubbadge 後端、兩部 BOOK 前端）。孩子在自己手機填寫；家長在自己手機取得同一成員的**只讀鏡像**，明白「一本簿 ≠ 一部手機」。
- 兩條取得資料的路徑，皆為單向下載：
  - **A. 連接 cubbadge**：旅團＋孩子的 SCOUT ID＋密碼 → `login` → `load` → 匯出全部「領袖已核實」進度；`pendingRequests` 一律略過。
  - **B. 掃描孩子 `CB1` 二維碼**：免登入、可離線；分享的進度可「存為家長只讀副本」。
- **只讀鐵律**：家長端無任何輸入欄位、不能核簽、不能掃描他人、不能向 cubbadge 匯入或提交（`requestComplete`／`save` 完全不出現）；同步卡在家長模式改為提示，不做任何寫入。
- **獨立鏡像**：家長資料存於 `cubbook.parent.book.v1`，不覆蓋這部手機原有的成員紀錄冊；退出家長模式即清除鏡像與 token。
- 新增 `/parent/connect` 連線頁、`/parent` 總覽頁（來源、匯出項目數、最後更新時間、由 BADGE／QR 更新、列印、出示 QR、退出）。
- 掃描頁支援家長模式：標題與說明改為家長版本，`withSignoff=false`，只可讀取快照。
- 上一版「同一部手機只讀」已移除。

### 更改（Changed · 顏色）
- **CUBSBOOK 圖示全面轉黃**：9 個圖示、根目錄 favicon、`favicon.svg` 及 OG 圖改為幼童軍黃（`#ffd23f → #f2b705 → #dca700`）配暖炭底（`#14100a`）及深墨徽號；**森林綠不再用於 CUBSBOOK**，留給未來的 `SCOUTBOOK`。
- PWA `background_color` 改為 `#14100a`（`theme_color` 已是 `#f2b705`）。

### 測試（Tests）
- 重寫 `tests/parent_mode.test.mjs`（7 項）：鏡像獨立儲存／退出即清除、QR 與 BADGE 兩條路徑的匯出內容、pending 不入冊、家長模組零 `fetch`、App 只寫家長 store、家長零輸入欄位、圖示與 favicon 不含森林綠。
- 全套 **44/44** 通過；guard 16 項全綠。

## [v1.0.2] — 2026-11-05

### 新增（Added）
- **家長模式（只讀）**：新增 `web/src/parent.js` 與 `web/src/pages/ParentView.jsx`。封面「家長查看」或選單「家長模式（只讀查看）」一按進入，`readOnly` 與領袖模式共用同一鎖，所有欄位、簽名、剔選、備份匯入、示範載入及同步一律停用。家長毋須填寫任何個人資料，亦不需要帳號、密碼或網絡。
- **家長總覽頁 `/parent`**：成員姓名／旅團／童軍編號、綱要進度、已獲獎章、活動徽章數、會員資格、各獎章進度條及頒發日期、制服清單完成度、最近完成項目；可翻開紀錄冊、列印／存 PDF、出示 QR、一按退出家長模式。
- **工具列「家長 · 只讀」晶片＋提示條**：任何一頁都清楚顯示目前為只讀，並可返回總覽或退出。

### 更改（Changed）
- **幼童軍黃成為主色**：封面由深綠／酒紅布面改為幼童軍黃布面（`#ffd84a → #f2b705 → #dca700`）配深綠燙印；主要按鈕、工具列 CTA、進度條同樣改用幼童軍黃；`theme-color` 及 PWA 主色同步為 `#f2b705`。黃底文字一律深綠 `#123420`／深炭 `#1a1206`，白字配黃仍然全面禁止。
- **家長模式與領袖模式分家**：領袖模式仍需伺服器端 `LEADER_CODE`（`timingSafeEqual`）；家長模式只是本機只讀切換，不提供任何跨成員或授權能力。

### 測試（Tests）
- 新增 `tests/parent_mode.test.mjs`（5 項）：開關旗標與事件、全域只讀與零輸入欄位、三個入口與退出、領袖／家長變數名稱分離、幼童軍黃對比公式。
- 全套 **42/42** 通過；UI 契約同步改為驗證 `#f2b705` theme-color。

## [v1.0.1] — 2026-11-05

### 修正（Fixed / Standalone-first）
- **BOOK 完全獨立運作**：所有核心功能（逐頁填寫、簽名、`PT/67`・`PT/68`、A4 列印、`CB1` 二維碼、JSON 備份）毋須 `cubbadge`、毋須帳號、毋須網絡。`cubbadge` 同步改為明確標示「可選」。
- **同步卡優雅降級**：新增 `web/src/cubadgeBridge.js` 探測 `/api/cubbadge`（拒絕純靜態主機的 HTML fallback、404、壞 payload、逾時），失敗時顯示「現時以獨立模式運作」面板與重試鍵，並隱藏登入表單，不再讓使用者卡在錯誤畫面。
- **空白簿一鍵開始**：歡迎頁新增「以空白紀錄冊開始」，可先填寫、後補個人資料；`cubbadge` 登入時自動以 SCOUT ID 綁定空白簿。
- **第 17 頁制服及徽章清單**：7 項改為可剔選並持久化（`pages.p17.uniform`），加進度條，列印亦反映狀態。
- **進度總覽更準確**：`allStats().earned` 同時計入「已完成」與「已填頒發日期」的獎章，避免已宣誓／已頒發仍顯示未完成。
- **列印尾頁**：最後一頁不再留下空白分頁。
- **文字修正**：統一「cubbadge」品牌串法（多處誤植為 `cubadge`）。
- **測試**：新增 `tests/standalone_book.test.mjs`（5 個契約），總數 37 個全綠。

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
