# GLOSSARY.md — 統一詞彙表

全倉程式碼、介面文案、測試與文件統一使用下列名稱，嚴禁混用同義舊稱。

| 繁體中文（標準名稱） | English (Canonical) | 程式碼鍵名／常數 | 定義與備註 |
| :--- | :--- | :--- | :--- |
| **幼童軍紀錄冊** | Cub Scout Record Book | `CUBBOOK` | 香港童軍總會幼童軍支部個人紀錄冊（官方 2026 年版共 32 頁，第 1–32 頁），逐頁照官方排列，另設數位附錄。 |
| **童軍成員編號** | Scout ID | `scoutId`（同步 `memberNo`） | 成員唯一編號，與 `cubbadge` 統一；容忍前導零（`0012345678` ≡ `12345678`）。 |
| **幼童軍團** | Cub Scout Unit / Pack | `pack` / `unit` / `group` | 成員所屬幼童軍單位（隸屬地域 `region`、區 `district`、旅 `group`）。 |
| **幼童軍團長** | Cub Scout Leader (CSL) | `csl` | 負責領導幼童軍團、按年簽署續期及核實進度之成人領袖。 |
| **旅長** | Group Scout Leader (GSL) | `gsl` | 所屬童軍旅之領袖，可與團長共同提名 `PT/68` 申請。 |
| **會員章** | Membership Badge | `L1` | 進度性獎章第一階（第 8 頁，9 項：`L1-A`…`L1-I`）。 |
| **銅箭章（體驗章）** | Bronze Arrow | `L2`（`legacyZh: 銅箭章`） | 第二階（第 9 頁，4 個章別共 12 項）。官方名稱「幼童軍體驗章」。 |
| **銀箭章（歷奇章）** | Silver Arrow | `L3` | 第三階（第 10 頁，16 項 + 興趣範疇）。官方名稱「幼童軍歷奇章」。 |
| **金箭章（高級歷奇章）** | Gold Arrow | `L4` | 第四階（第 11 頁，18 項 + 興趣範疇）。官方名稱「幼童軍高級歷奇章」。 |
| **金紫荊獎章** | Golden Bauhinia Award | `OT-GB` | 幼童軍支部最高獎章（第 12 頁，17 項 + 興趣範疇）；須年滿十歲半（126 個月）方可完成最後一項。 |
| **興趣範疇** | Interest Areas | `L3-INTEREST` / `L4-INTEREST` / `OT-GB-INTEREST` | 從「多元創藝」、「科學與大自然」、「運動與愛好」選兩個不同類別，各完成一個指定活動徽章；已用於較低階獎章者不得重複。 |
| **活動徽章／專科徽章** | Activity / Specialist Badge | `OT-A01`…`OT-A42`（49 種） | 2026 年第十版目錄；BOOK 鍵為 `OT-*`，同步時轉回 `cubbadge` 官方 `badgeId`（如 `A22`）。 |
| **金紫荊獎章開展通知書** | Application for Assessment (`FORM PT/67`) | `pt67` | 官方表格 `FORM PT/67 (4/2019)`（1 頁），開始考驗前經區會遞交。 |
| **金紫荊獎章及證書申請表** | Golden Bauhinia Award Application (`FORM PT/68`) | `pt68` | 官方表格 `FORM PT/68 (06/2024)`（2 頁）；每年 8 月 31 日或以前交抵地域辦事處，方可於同年大會操獲嘉許。 |
| **2026 新制資料核對清單** | 2026 Scheme Unofficial Data Checklist | `gbac` | **非官方**（`official: false`）；官方表格編號待總會公布，不設模擬批核欄。 |
| **成員二維碼傳送碼** | Member Transfer QR | `CB1.` / `cubbook/member` | 成員自選欄位後經 gzip + Base64URL 編碼之離線二維碼字串；未壓縮時為 `CB1P.`。 |
| **領袖核簽回傳碼** | Leader Sign-off Return QR | `CB1S.` / `cubbook/signoff` | 領袖掃描成員紀錄並一次簽名後產生之輕量回傳二維碼，供成員掃回寫入紀錄冊。 |
| **待領袖核實** | Pending leader confirmation | `status: 'pending'` | BOOK 送交 `cubbadge` 的唯一狀態；必須由團長在 BADGE 按 CONFIRM 方為完成。 |
| **已核實進度** | Leader-confirmed progress | `confirmedByBadge: true` | 只可來自 `cubbadge` 已核實資料；BOOK 不可自行設定。 |
| **領袖模式** | Leader Mode (Read-Only) | `LEADER_CODE` / `/api/leader` | 伺服器端密碼解鎖；本機紀錄冊鎖為唯讀，只可掃描及簽發 `CB1S.`。 |
