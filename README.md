# CUBBOOK · 幼童軍電子紀錄冊

> **幼童軍個人隨身離線電子紀錄冊** —— 逐頁對應香港童軍總會《幼童軍紀錄冊》第 1–19 頁及 2026 年第十版《幼童軍訓練綱要》，支援就地打字／手寫簽名、一鍵生成及列印 `PT/67`・`PT/68` 官方表格、成員⇄領袖純離線二維碼核簽，以及與 `cubbadge` 旅團進度表的**純進度、零個人資料**雙向同步。

- **目前版本**：`v1.0.0`（2026-11-05）
- **架構形態**：離線優先 PWA（React + Vite + Service Worker，`localStorage` 本機儲存，零帳號、零雲端上傳；可選配 Vercel `/api/leader` 與 `/api/cubbadge` 伺服器端接口）
- **設計主題**：對齊 `ROVERBOOK` `v16`／`VSBOOK` `v1.0.0` 的介面、安全區與版權規範，改用**深森林綠布面燙金封面**（`#143b28` × `#08180f` × 幼童軍金黃 `#e6a800`／`#e3c07a` × 象牙內頁 `#f7f2e7`）。幼童軍黃**只作底色或裝飾**，文字一律深炭或深綠，確保 WCAG AA（白字配 `#e6a800` 對比僅約 2.0:1，設計上禁止使用）。
- **一句話**：BOOK 是「這一位成員」的口袋紀錄冊；全團名冊、批量簽核、多成員切換一律留在 `cubbadge`。

---

## 30 秒開始

```bash
npm install          # 安裝依賴
npm run dev          # 啟動本機開發伺服器（0.0.0.0:5173）
npm test             # 執行資料模型、表格、二維碼及介面契約測試（node --test）
npm run syllabus     # 由 cubbadge data/items.json 重新產生 shared/syllabus.js
npm run build        # 打包生產版靜態檔案至 dist/
```

品質閘門（對齊 `playerkousas-rgb/readme` 真理倉）：

```bash
node scripts/guard.mjs
rm -rf dist && node scripts/final_check_v1.0.mjs
node scripts/repo_health_v1.0.mjs
node scripts/preflight_v1.0.mjs .
```

> `dist/` 是建置產物，**不要 commit**；`final_check` 與 `preflight` 請在沒有 `dist/` 的狀態執行。

---

## 七大不可退讓規則（Iron Rules）

| # | 規則 | 在本倉庫的落地方式 |
| :-: | :--- | :--- |
| 1 | **BOOK ≠ BADGE** | 只做單一成員的 19 頁紀錄冊、進度獎章、活動徽章與官方表格。**不做**全團名冊、批量簽核、多成員切換槽（屬 `cubbadge`）。 |
| 2 | **全螢幕＝一本實體書 + 幼童軍黃對比陷阱** | `100dvh` 布面封面與紙本內頁、無卡片框線陰影；空白欄只顯示小圓點 `.write__dot`（列印自動隱藏）；就地打字自動縮字；簽名壓縮為單色透明 PNG。封面／按鈕用深綠配金，不用白字配黃。中英文完全分開，一鍵 `中文 / EN`。 |
| 3 | **BOOK ⇄ BADGE 純進度同步** | 只傳 `SCOUT ID`、項目代號、日期。空白簿輸入 SCOUT ID + `cubbadge` 密碼即可綁定並拉取已核實進度；`pendingRequests` **永不**錄入；`save`／`saveOtherBadge` 一律 `403`；BOOK→BADGE 只轉發 `requestComplete`，寫入 `status: 'pending'`。旅團下拉由 `CUBBADGE_ORIGIN` 伺服器端取得，BOOK 不存 Google Sheet 網址或 API key。 |
| 4 | **領袖模式（只讀）與普通模式嚴格分離** | 普通模式不能讀取他人紀錄冊，只能貼上領袖簽發的 `CB1S.` 核簽碼；出示 QR（`CB1.`）預設全不剔選。領袖模式以伺服器端 `LEADER_CODE`（**不加 `VITE_`**、`crypto.timingSafeEqual` 比對）解鎖後，本機紀錄冊鎖為唯讀，只可當面掃描及簽發 `CB1S.`。 |
| 5 | **項目 ID 單一真相** | `shared/syllabus.js` 由 `cubbadge/data/items.json` 產生，72 個進度細項 + 49 個活動徽章逐一對照，測試以 fixture 的 sha256 與 ID 清單鎖定。 |
| 6 | **官方表格自動帶入 + A4 忠實列印** | `PT/67`（1 頁）、`PT/68`（2 頁）自動填入；2026 新制只提供**明確標示非官方**的資料核對清單，不自行編造表格編號。桌面／平板維持 A4 比例，`≤740px` 手機自動單欄、無水平捲軸。 |
| 7 | **版權擺位與全套圖示** | `Copyright © 2026 SCOUT SYSTEM` 與非官方聲明只出現於**封面頁腳、數位附錄、選單「關於」**三處；齊備 `/favicon.svg`、`/favicon.ico`、`/favicon-32.png`、`/favicon-48.png` 及 `/icons/*` 九件套；內含真理倉四支守衛腳本。 |

---

## 核心功能

1. **19 頁紙本逐頁對應**：p01 個人資料、p02 聯絡及家長、p03 旅團資料、p04 童軍紀錄、p05 轉旅／遷移／更改、p06 會員資格續期、p07 服務及獎勵、p08 會員章、p09 銅箭章（體驗章）、p10 銀箭章（歷奇章）、p11 金箭章（高級歷奇章）、p12 金紫荊獎章、p13–p14 活動徽章、p15 頒發及宣誓紀錄、p16 誓詞與規律、p17 制服及徽章位置、p18 進度總覽、p19 使用說明，另設**數位附錄**（同步、備份、示範與重設）。
2. **就地打字與手寫**：空白欄只顯示 `.write__dot`，一按即寫、字多自動縮字；簽名以單色透明 PNG 壓縮儲存，可直接嵌入二維碼。
3. **A4 紙本原貌**：桌面／平板 A4 比例與裝訂陰影；手機自動展開單欄。`/print` 一次過列印全本 19 頁。
4. **官方表格**：
   - `FORM PT/67 (4/2019)` 金紫荊獎章開展通知書（1 頁）
   - `FORM PT/68 (06/2024)` 金紫荊獎章及證書申請表（2 頁）
   - **2026 新制資料核對清單**（非官方，1 頁；官方表格編號待總會公布）
5. **純離線二維碼**：`CB1.`（gzip）／`CB1P.`（未壓縮）／`CB1S.`（領袖核簽）＋ `#v=` 連結，上限 2,400 字元；出示前逐項剔選，預設全不選。
6. **`cubbadge` 純進度同步**：見規則 3；登入只回傳 `token` 與 `ymis`，不帶姓名、電話、地址、家長資料、相片。

### Vercel 環境變數

在 Vercel → **Project → Settings → Environment Variables** 設定（**請勿加 `VITE_` 前綴**，前端 bundle 不會拿到任何值）：

| 變數 | 必填 | 說明 |
| :--- | :--: | :--- |
| `LEADER_CODE` | 是（否則隱藏領袖模式） | 領袖模式密碼，於 `/api/leader` 以 `crypto.timingSafeEqual` 比對。本機未設定時預設 `1234` 方便測試。 |
| `CUBBADGE_ORIGIN` | 否（預設 `https://cubbadge.vercel.app`） | 只用於伺服器端組出 `GET /api/troops` 及 `POST /api/proxy`。 |
| `TROOP_<id>_NAME` / `_EN` / `_BACKEND` / `_APIKEY` | 否 | 個別旅團覆寫（`_BACKEND` 必須是 `script.google.com/macros/s/…/exec`）。 |
| `CUBBOOK_PROXY_TEST` | 否 | 僅本機開發設 `1`，允許 `127.0.0.1` 測試後端。 |

---

## 倉庫導航

| 路徑 | 說明 |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | Agent 工作守則、關鍵路徑與不可退讓底線 |
| [`SCOPE.md`](SCOPE.md) | 專案邊界（In Scope / Out of Scope）及同類產品參考 |
| [`GLOSSARY.md`](GLOSSARY.md) | 幼童軍支部、獎章、表格及系統中英統一詞彙表 |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | 修改流程、提交前檢查清單與雙重版本規範 |
| [`CHANGELOG.md`](CHANGELOG.md) | 版本變更紀錄 |
| [`LICENSE`](LICENSE) | 版權保留與個人前端使用聲明（All Rights Reserved） |
| [`docs/00-quickcard.md`](docs/00-quickcard.md) | 一頁速查卡（日常運作與除錯） |
| [`docs/design-review.md`](docs/design-review.md) | 390 / 768 / 1440 三斷點視覺與互動巡檢紀錄 |
| [`docs/cubbadge-patch.md`](docs/cubbadge-patch.md) | `cubbadge` `Code.gs` 規則五修正指引（PBKDF2 10000、pending 去重、`OT-*` 寫入「其他獎章」） |
| [`docs/adr/README.md`](docs/adr/README.md) | 架構決策紀錄（技術棧、純前端 QR 與版權保護） |
| [`docs/out-of-scope/README.md`](docs/out-of-scope/README.md) | 明確不做事項及姊妹專案分工 |
| `shared/` | 資料模型 `book.js`、第十版綱要 `syllabus.js`、官方表格 `forms.js`、`CB1` 二維碼協定 `transfer.js` |
| `api/` | `leader.js`（領袖密碼）與 `cubbadge.js`（零金鑰純進度橋接） |
| `web/` | React + Vite 前端、PWA `sw.js`、`web/public/icons/` 九件套 |
| [`scripts/README.md`](scripts/README.md) | 真理倉守衛腳本、綱要產生器與圖示產生器說明 |
| [`tests/README.md`](tests/README.md) | 資料模型、同步、表格及介面契約測試 |

---

## 授權與聲明

`Copyright © 2026 SCOUT SYSTEM`。本專案為**非官方獨立工具**，旨在方便成員整理個人紀錄，與香港童軍總會並無任何官方從屬關係；所有表格及紀錄冊格式之最終依據，以香港童軍總會最新公布版本為準。
