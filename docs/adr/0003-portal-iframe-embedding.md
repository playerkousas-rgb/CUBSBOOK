# ADR 0003：以 `frame-ancestors` 白名單容許「服務平台」iframe 嵌入

- **日期**：2026-11-14
- **狀態**：已採納（Accepted）

## 背景

1. 「服務平台」（`https://member-portal-sigma-swart.vercel.app`）需要在同一個畫面內以 `<iframe>` 開啟各支部 BOOK。
2. `vercel.json` 原本對全站回應 `X-Frame-Options: DENY`，任何網站（包括服務平台）都不能嵌入。`X-Frame-Options` 只有 `DENY`／`SAMEORIGIN` 兩個有效值，沒有辦法指定「某一個外部來源」；改成 `SAMEORIGIN` 同樣會擋住跨網站嵌入。
3. BOOK 存有未成年成員的個人資料及手寫簽名，不能因此變成任何網站都可嵌入（點擊劫持風險）。

## 決策

1. **移除 `X-Frame-Options`，改用 CSP 白名單**。全站（`/(.*)`）回應：

   ```
   Content-Security-Policy: frame-ancestors 'self' https://member-portal-sigma-swart.vercel.app
   ```

   只列 BOOK 自身及服務平台正式網址，不使用萬用字元。常數集中於 [`shared/embed.js`](../../shared/embed.js)，`tests/embed_contract.test.mjs` 鎖死 `vercel.json` 內容，並禁止 `X-Frame-Options`／`SAMEORIGIN` 重新出現。
2. **`Permissions-Policy: camera=(self), microphone=(), geolocation=()` 維持不變**。跨來源 iframe 的相機權限由嵌入方委派：服務平台的 `<iframe>` 必須帶 `allow="camera; clipboard-write"`，且服務平台自身的 `Permissions-Policy`（如有）不可把 `camera` 設為 `()`。
3. **不嘗試共用獨立版的本機資料**。瀏覽器把跨網站 iframe 的 `localStorage`、Service Worker 及其快取按頂層網站分割（Chrome 115+、Firefox、Safari）；`vercel.app` 屬公共後綴，服務平台與 BOOK 是兩個不同網站。BOOK 維持「零帳號、零伺服器儲存」，資料搬移一律經使用者自行匯出／匯入備份 JSON。
4. **嵌入時在介面講清楚**（`web/src/components/EmbedNotice.jsx`，只在 `window.self !== window.top` 時渲染）：歡迎頁列出備份／還原步驟；已有紀錄冊時頂部提示條提供「匯出備份」；選單以「開啟獨立版（新分頁）」取代「加到手機主畫面」。

## 後果

- **正面**：服務平台可嵌入；其他網站仍被瀏覽器攔截；獨立版行為（相機、離線、安裝到主畫面）完全不變。
- **取捨**：
  - 平台內的紀錄冊與獨立版是兩份資料，舊資料不會自動出現，須以備份 JSON 搬移一次。
  - Safari（包括 iPhone／iPad 上所有瀏覽器）把第三方 iframe 的 `localStorage` 設為短暫儲存，關閉瀏覽器後可能清除；平台內填寫後必須匯出備份，長期紀錄建議使用獨立版。
  - 平台內不能「加到主畫面」；平台內的離線快取要在該裝置於平台內連網開啟一次後才建立，而且只有服務平台頁面本身仍然開著（或平台自身支援離線）時才用得上。
  - 服務平台如為 `<iframe>` 加上 `sandbox`，必須同時列出 `allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads`，否則儲存、確認對話框、備份下載及「開啟獨立版」會失效。
  - 服務平台網址如有更改，須同步更新 `vercel.json`、`shared/embed.js` 及本文件，再重新部署。
