# AGENTS.md — CUBBOOK 工作守則

開工前必讀。本倉庫遵循上游治理真理倉 `playerkousas-rgb/readme` 之 `0`（INTAKE）→ `1`（START）→ `2`（repo-setup）→ `3`（design-review）→ `4`（preflight）→ `5`（guard / final_check）流程，並與 `ROVERBOOK` `v16`、`VSBOOK` `v1.0.0` 同構。

## 1. 一句話定位

**CUBBOOK** 是香港幼童軍個人隨身離線電子紀錄冊（純前端 PWA），逐頁對應香港童軍總會《幼童軍紀錄冊》（2026 年版）官方 **32 頁**及 2026 年第十版訓練綱要，支援就地打字／手寫簽名、`PT/67`・`PT/68` 自動填表列印、純離線二維碼核簽與 `cubbadge` 純進度互通。

## 2. 關鍵路徑

- 定位與邊界：[`SCOPE.md`](SCOPE.md)、[`docs/out-of-scope/README.md`](docs/out-of-scope/README.md)
- 詞彙單一真相：[`GLOSSARY.md`](GLOSSARY.md)
- 架構決策：[`docs/adr/README.md`](docs/adr/README.md)
- 視覺巡檢：[`docs/design-review.md`](docs/design-review.md)
- `cubbadge` 後端修正：[`docs/cubbadge-patch.md`](docs/cubbadge-patch.md)
- 資料與協定核心：`shared/syllabus.js`（產生檔）、`shared/book.js`、`shared/forms.js`、`shared/transfer.js`
- 伺服器接口：`api/leader.js`、`api/cubbadge.js`
- 前端介面與離線快取：`web/index.html`、`web/src/`、`web/public/sw.js`、`web/public/icons/`
- 自動化測試與閘門：`tests/`、`scripts/`

## 3. 不可退讓底線（Non-Negotiables）

1. **BOOK 必須可獨立運作**：不得讓任何核心功能（逐頁填寫、簽名、表格、列印、二維碼、備份還原）依賴 `/api/*` 或網絡；`cubbadge` 同步只屬可選加速，偵測失敗必須安全降級為「獨立模式」並保留本機 JSON 交換。
2. **BOOK 只服務一位成員**：不設全團名冊、批量簽核工作台、多成員切換槽——那些屬 `cubbadge`（BADGE）。新增任何「一次看多位成員」的介面即屬越界。
3. **零個人資料同步**：跨系統只准傳 `SCOUT ID`／YMIS、項目代號及日期；伺服器端必須硬性剝除姓名、電話、地址、家長／監護人資料、相片及任何其他成員紀錄。`pendingRequests` **永不**錄入 BOOK。
4. **不可自我核實**：BOOK 送出的進度只可經 `requestComplete` 變成 `status: 'pending'`；`save`／`saveOtherBadge`／`reviewRequest` 一律回 `403`；只有團長在 BADGE 內按 CONFIRM 才算完成。
5. **版權擺位僅三處**：封面頁腳 `LegalLine`、數位附錄 `LegalNote`、選單「關於」`LegalNote`。其餘頁面、列印及表格不得重複。
6. **幼童軍黃是主色，且對比不可退讓**：封面為黃布面，色值＝總會《幼童軍紀錄冊》PDF 封面實測 **`#ead040`**（色階 `#f0d85e → #ead040 → #c0a21c`），黃底文字一律深墨 `#2b1a04`／`#1a1206`；深墨底可配金黃字。森林綠屬 SCOUTBOOK，酒紅屬 ROVERBOOK，兩者都不得在本書出現。**禁止白字配黃**（對比 < 3:1）。中英文完全分開，一鍵切換，不得並排塞入同一表格。家長模式（`web/src/parent.js`）是**第二部手機**的只讀鏡像：只可 `login`＋`load`（由 BADGE 匯出）或掃描孩子 `CB1`，不得加入任何輸入欄位、不得呼叫 `save`／`requestComplete`、不得改寫主紀錄冊（鏡像另存 `cubbook.parent.book.v1`）。
7. **項目 ID 單一真相**：任何 `L1-*`…`L4-*`、`OT-*` 的改動必須先在 `cubbadge/data/items.json` 落地，再執行 `npm run syllabus`，並更新 `tests/fixtures/cubbadge-ids.json`；測試會以 sha256 與清單鎖死。
8. **雙重版本號（V）與體積預算（S7 / G11）**：任何可見更新須同步遞增 `package.json`、`web/index.html`（`meta[name="app-version"]`、`window.APP_VERSION`）、`shared/book.js`（`APP_VERSION`）及 `CHANGELOG.md`；`dist/` 總體積須 `< 5 MB`，`web/public/icons/` 9 個圖示總和須 `<= 260 KB`。
9. **禁止在 `.js/.mjs/.jsx` 寫 `// v1.0` 行內版本註解（F15）**：版本號只寫在常數、HTML meta 與 `CHANGELOG.md`。
10. **`LEADER_CODE` 不得加 `VITE_` 前綴**：只在 `api/leader.js` 以 `crypto.timingSafeEqual` 比對；前端 bundle 不得出現任何密碼。

## 4. 交付前必跑指令

```bash
npm test
npm run build
node scripts/guard.mjs
rm -rf dist && node scripts/final_check_v1.0.mjs
node scripts/repo_health_v1.0.mjs
node scripts/preflight_v1.0.mjs .
```

## 5. 常用改動指引

| 想改 | 改哪裡 | 之後要跑 |
| :--- | :--- | :--- |
| 綱要項目／活動徽章 | `cubbadge/data/items.json`（上游） | `npm run syllabus && npm test` |
| 內頁版面 | `web/src/pages/Official.jsx`（`PCover`、`P01`–`P32`）+ `shared/officialPages.js` | `npm test`（頁數契約） |
| 紙本頁碼文案 | 只改 `shared/officialPages.js` 的 `PAPER_SECTIONS`；清單由 `shared/forms.js` 推導，**不得手寫頁碼** | `npm test`（頁碼契約） |
| 示範紀錄冊 | `shared/book.js` 的 `demoBook()` + `shared/demo.js`；必須保持全部虛構、零簽名圖片、每頁有標示、三層禁止同步 | `npm test`（示範契約） |
| 樣式／配色 | `web/src/styles.css`（`--cover-bg`、`--cub-yellow`、`--foil`） | `npm test`（WCAG 契約） |
| 表格欄位 | `shared/forms.js` + `web/src/pages/Forms.jsx` | `npm test` |
| 二維碼格式 | `shared/transfer.js` | `npm test`（`CB1`／`CB1S` 契約） |
| 同步契約 | `api/cubbadge.js` + `shared/book.js` | `npm test`（403／pending 契約） |
| 圖示 | `scripts/generate_icons.mjs` | `npm run icons && npm test` |
| 服務平台嵌入白名單 | `vercel.json`（`frame-ancestors`）+ `shared/embed.js` + `web/src/components/EmbedNotice.jsx`；**不得**加回 `X-Frame-Options`／`SAMEORIGIN`，`camera=(self)` 不得移除 | `npm test`（嵌入契約） |
