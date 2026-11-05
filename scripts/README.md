# scripts/ — 自動化守衛與工具腳本

本目錄存放由上游治理真理倉（`playerkousas-rgb/readme`）同步之零依賴品質閘門腳本，以及本專案之綱要與圖示產生器：

| 腳本 | 用途 |
| :--- | :--- |
| `preflight_v1.0.mjs` | 開局與交付總閘門（placeholder、UTF-8、語法、`guard`、`final_check`、`repo_health`、`check_skills` 等 8 項） |
| `guard.mjs` | 必備治理檔、機密外洩（A1）、大檔與 `dist < 5MB`（S6/S7/S10）、Markdown 內部連結（G10）及禁止行內版本註解（F15） |
| `final_check_v1.0.mjs` | 收工閘門（`vercel.json` 契約、機密掃描、`dist/` 大小、單檔 HTML 審計） |
| `repo_health_v1.0.mjs` | 12 項起手包結構、版權檔、機密、體積與內部連結健康度 |
| `check_skills_v1.0.mjs` | 驗證 `skills/`（如有）之 frontmatter 與索引一致性 |
| `audit_single_html_v1.0.mjs` | 單檔 HTML 之版本號、版權標記與儲存包裝審計（由 `final_check` 呼叫；本專案為 Vite 多檔建置，沒有 `dist/` 時自動跳過） |
| `build_syllabus.mjs` | 讀取上游 `cubbadge/data/items.json`（＋`items_en.json` 英文覆蓋），產生 `shared/syllabus.js` 及 `tests/fixtures/cubbadge-ids.json`；以 sha256 鎖定上游版本 |
| `generate_icons.mjs` | 純 Node.js（`node:zlib` + 自寫 PNG／ICO 編碼器）決定性生成 `web/public/icons/` 九件套及根目錄 `favicon.ico`／`favicon-32.png`／`favicon-48.png`，主題為深森林綠布面 + 幼童軍金，總體積 `<= 260 KB` |

## 綱要產生器用法

```bash
node scripts/build_syllabus.mjs --source /path/to/cubbadge/data/items.json
npm run syllabus        # 使用預設相對路徑（../cubbadge/data/items.json）
```

上游項目次序變動時，`BOOK` 內部鍵會按位置重新編號（官方 `badgeId` 保留在每個項目），請檢視 `git diff shared/syllabus.js tests/fixtures/cubbadge-ids.json` 後再提交。
