# CONTRIBUTING.md — 修改與貢獻守則

歡迎為 `CUBBOOK` 提交修正或改進建議。本專案採用 **All Rights Reserved** 專有版權（見 [`LICENSE`](LICENSE)），任何提交至本倉庫之貢獻均歸屬 `SCOUT SYSTEM` 統一管理及保護。

## 開發與修改流程

1. 先閱讀 [`AGENTS.md`](AGENTS.md)、[`SCOPE.md`](SCOPE.md) 及 [`GLOSSARY.md`](GLOSSARY.md)，確認改動屬於專案範圍內且使用統一詞彙。
2. 任何項目編號改動必須先在 `cubbadge/data/items.json` 落地，再執行 `npm run syllabus`，不得手改 `shared/syllabus.js`。
3. 如涉及架構、儲存格式或二維碼協定變更，請先在 [`docs/adr/README.md`](docs/adr/README.md) 新增一頁 ADR 紀錄取捨原因。
4. 如涉及介面、字級、間距、配色或列印版面變更，須在 390px（手機）、768px（平板）及 1440px（桌面）三個斷點實測，並更新 [`docs/design-review.md`](docs/design-review.md)。
5. 嚴禁引入任何將成員個人資料上傳至遠端伺服器之程式碼、第三方追蹤器或硬編碼金鑰；同步資料只可含 SCOUT ID、項目代號及日期。

## 提交前必跑檢查清單

```bash
# 1. 資料模型、同步、表格及介面契約測試（必須 0 fail）
npm test

# 2. 生產版建置與真理倉守衛
npm run build
node scripts/guard.mjs
rm -rf dist && node scripts/final_check_v1.0.mjs

# 3. 倉庫健康與開局閘門
node scripts/repo_health_v1.0.mjs
node scripts/preflight_v1.0.mjs .
```

> `dist/` 為建置產物，已列入 `.gitignore`，請勿提交。

## 雙重版本號規則（Rule V）

每次發佈使用者可見的變更時，必須同步更新以下四處並保持一致：

1. `package.json` 的 `"version"`
2. `shared/book.js` 的 `APP_VERSION`
3. `web/index.html` 的 `<meta name="app-version">` 及 `window.APP_VERSION`
4. [`CHANGELOG.md`](CHANGELOG.md) 的版本紀錄

圖示有改動時另需執行 `npm run icons`（輸出 `web/public/icons/` 九件套及根目錄 favicon）。
