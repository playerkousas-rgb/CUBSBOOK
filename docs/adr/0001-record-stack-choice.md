# ADR 0001：沿用 React + Vite 純前端離線優先 PWA，並以 `cubbadge` 為項目 ID 單一真相

- **日期**：2026-11-05
- **狀態**：已採納（Accepted）

## 背景

`CUBBOOK` 需要同時呈現：
1. 封面＋官方 32 頁高密度紙本《幼童軍紀錄冊》互動版面（就地縮字打字、觸控筆手寫、透明簽名壓縮、中英切換與手機單欄）；
2. 兩頁多頁官方 A4 表格（`PT/67` 1 頁、`PT/68` 2 頁）之自動帶入與精準列印；
3. 露營、遠足及旅團集會現場無網絡時仍可 100% 讀寫、簽名與產生二維碼；
4. 與姊妹專案 `cubbadge`（2026 年第十版訓練綱要）純進度雙向互通。

## 決策

1. 沿用 `VSBOOK v1.0.0` 與 `ROVERBOOK v16` 的 **React 18 + Vite** 純靜態 SPA/PWA 架構（部署 Vercel `hkg1`，輸出 `dist/`，總體積 `< 1 MB`），配合手寫零依賴 `sw.js` 實作導航 Network-First、靜態資產 Cache-First 離線快取。
2. 資料模型、2026 第十版綱要、表格映射與 `CB1` 二維碼編解碼抽離至純 ES Module `shared/`，既可被前端引用，亦可由 Node.js `node --test` 直接測試。
3. **項目 ID 不在本倉庫手寫**：`scripts/build_syllabus.mjs` 讀取上游 `cubbadge/data/items.json`（含 `items_en.json` 英文覆蓋）產生 `shared/syllabus.js` 及 `tests/fixtures/cubbadge-ids.json`，以 sha256 鎖定。BOOK 內部鍵為 `L1-*`…`L4-*`、`OT-*`，每個項目同時保留官方 `badgeId`，同步時零改名。
4. 統一成員識別碼為 `scoutId`（童軍成員編號），容忍前導零。

## 後果

- **正面**：零伺服器運維、零冷啟動、離線可用；與 `cubbadge` 共用同一套 ID，測試可即時發現上游改動。
- **取捨**：上游項目次序重整時，`BOOK` 內部鍵會按位置重新編號（官方 `badgeId` 不變），須重跑 `npm run syllabus` 並檢視 fixture 差異；`localStorage` 容量約 5 MB，故內建簽名／相片壓縮與「儲存健康」瘦身面板。
