# ADR 0002：採用零伺服器 `CB1` 二維碼協定、純進度同步與 All Rights Reserved 版權保護

- **日期**：2026-11-05
- **狀態**：已採納（Accepted）

## 背景

1. **私隱與去中心化要求**：幼童軍紀錄冊包含未成年成員及其家長的姓名、出生日期、聯絡電話、緊急聯絡人、地址及相片。成員與領袖在集會現場核簽時，不應強制建立雲端帳號，更不應把個人資料上傳至任何中央資料庫。
2. **與 BADGE 的分工**：全團進度表由 `cubbadge` 負責；BOOK 只應傳送「已核實進度」與「待核實申報」，不應重複儲存任何個人資料。
3. **成果保護要求**：專案作者明確要求**不採用 MIT 等寬鬆開源授權**，以防外部機構未經授權複製 `SCOUT SYSTEM` 獨立研發之介面、程式碼與工具成果；同時須聲明本工具為非官方獨立工具，尊重香港童軍總會對訓練綱要及紀錄冊文字之版權。

## 決策

1. **純前端 `CB1` 二維碼與 URL Fragment 傳送**：
   - 成員出示時**預設不勾選任何欄位**，逐次剔選組別，經瀏覽器 `CompressionStream('gzip')` + Base64URL 編碼為 `CB1.<payload>`（不支援壓縮時退回 `CB1P.<payload>`），單張限制 `<= 2400` 字元。
   - `/#v=CB1...` 連結只在接收者本機解碼（URL hash 永不發送至伺服器）。
   - 領袖掃描後一次手寫簽名並勾選項目，產生 `CB1S.` 核簽回傳碼；成員掃回後由 `applySignoff` 寫入日期、主考姓名及簽名墨跡。
2. **BOOK ⇄ BADGE 純進度橋接（`/api/cubbadge`）**：
   - 允許動作僅 `login`、`logout`、`load`、`submitPending`；`save`／`saveOtherBadge`／`reviewRequest` 一律 `403`。
   - `load` 由伺服器端剝除姓名、電話、地址、家長資料、相片、其他成員紀錄及已批核的 `pendingRequests`；`submitPending` 硬性只轉發 `requestComplete`，寫入 `status: 'pending'`。
   - 旅團清單由 `CUBBADGE_ORIGIN` 的 `GET /api/troops` 取得，BOOK 不存任何 Google Sheet 網址或 API key。
3. **法務與版權雙重聲明**：
   - 根目錄 [`LICENSE`](../../LICENSE) 明訂 `Copyright © 2026 SCOUT SYSTEM — All Rights Reserved`，僅授予成員與領袖個人非商業前端使用許可。
   - 版權與非官方聲明只出現於**封面頁腳、數位附錄、選單「關於」**三處，內頁與表格不重複；`tests/ui_contracts.test.mjs` 會掃描整個 `web/src` 鎖死此規則。

## 後果

- **正面**：零私隱外洩風險、零後端維護負擔、免登入即開即用；版權歸屬與非官方邊界清晰。
- **取捨**：單張二維碼不能同時塞入高解析近照與大量墨跡，介面須顯示容量進度條並引導改用 JSON 備份；`cubbadge` 需配合三項後端修正（見 [`../cubbadge-patch.md`](../cubbadge-patch.md)）方能完全發揮。
