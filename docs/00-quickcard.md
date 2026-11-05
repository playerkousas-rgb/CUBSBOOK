# 00 — CUBBOOK 一頁速查卡（Quickcard）

| 項目 | 內容 |
| :--- | :--- |
| **定位** | 香港幼童軍個人隨身離線電子紀錄冊（紙本第 1–19 頁 ＋ 2026 第十版訓練綱要 ＋ `PT/67`・`PT/68`） |
| **網址路由** | `/` 封面・`/p/p01`–`/p/p19` 紙本第 1–19 頁・`/p/contents` 目錄・`/p/appendix` 數位附錄・`/forms` 官方表格（`pt67`、`pt68`、`gbac`、`all`）・`/scan` 掃描二維碼・`/print` 整本列印 |
| **本機儲存鍵** | `cubbook.book.v1`（紀錄冊主體）、`cubbook.lang`（語言 `zh`/`en`）、`cubbook.last`（上次頁面）、`cubbook.signoff.applied.v1`（已寫入核簽序號）、`cubbook.cubbadge.member.v1`（同步身分） |
| **互通格式** | `cubbadge.pending.v1`（以 `scoutId` 對齊 `L1-*`…`L4-*`、`OT-*`；送出前轉回 `cubbadge` 官方 `badgeId`） |
| **二維碼協定** | `CB1.<base64url(gzip(JSON))>`（壓縮優先）、`CB1P.`（未壓縮後備）、`CB1S.`（領袖核簽），上限 `2400` 字元 |
| **版權與聲明** | `Copyright © 2026 SCOUT SYSTEM — All Rights Reserved`（見 [`../LICENSE`](../LICENSE)）＋ 非官方獨立工具聲明，只出現於封面頁腳、數位附錄、選單「關於」 |

## 常用指令

```bash
npm run dev                                        # 本機開發（http://0.0.0.0:5173）
npm run syllabus                                   # 由 cubbadge items.json 重新產生 shared/syllabus.js
npm test                                           # 資料模型、同步、表格及介面契約測試
npm run build                                      # 建置生產版至 dist/
npm run icons                                      # 重新生成 web/public/icons/ 九件套及根目錄 favicon
node scripts/guard.mjs                             # 檔案／連結／體積／機密守衛
rm -rf dist && node scripts/final_check_v1.0.mjs   # 收工閘門
node scripts/repo_health_v1.0.mjs                  # 倉庫健康
node scripts/preflight_v1.0.mjs .                  # 開局與交付總閘門
```

## 常見排障

1. **手機提示「儲存空間不足」**：前往 `/p/appendix`（數位附錄）→「本機儲存健康」，點擊一鍵壓縮圖片與手寫墨跡，並匯出 JSON 備份。
2. **二維碼超出容量（> 2,400 字元）**：在「出示二維碼」對話框取消勾選「近照」或「領袖簽署墨跡」；完整轉移請用數位附錄的「匯出完整紀錄冊 JSON」。
3. **表格列印出現頁首網址或邊界裁切**：列印對話框選 `A4`、邊界「預設／無」、勾選「背景圖形」、取消「頁首及頁尾」；`PT/68` 兩頁按總會要求列印。
4. **同步顯示「尚未登入 cubbadge」**：在數位附錄重新輸入 SCOUT ID 與 `cubbadge` 密碼；BOOK 不會儲存密碼，只保存登入 token 於本次工作階段。
5. **輸入 SCOUT ID 後拉不到進度**：確認該旅團已在伺服器設定 `CUBBADGE_ORIGIN` 或 `TROOP_<id>_*`，且成員在 `cubbadge` 內的角色可讀取自己的進度；`pendingRequests` 不會出現在紀錄冊。
