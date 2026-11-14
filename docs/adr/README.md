# Architecture Decision Records (ADR)

本目錄記錄 `CUBBOOK` 的關鍵架構與法務技術取捨：

- [`0001-record-stack-choice.md`](0001-record-stack-choice.md) — 沿用 React + Vite 純前端離線優先 PWA 架構，並以 `cubbadge` 項目 ID 為單一真相
- [`0002-pure-client-qr-and-copyright.md`](0002-pure-client-qr-and-copyright.md) — 採用零伺服器 `CB1` 二維碼協定、`/api/cubbadge` 純進度橋接及 All Rights Reserved 專有版權保護
- [`0003-portal-iframe-embedding.md`](0003-portal-iframe-embedding.md) — 移除 `X-Frame-Options`，改以 CSP `frame-ancestors` 白名單只容許 BOOK 自身及「服務平台」iframe 嵌入；相機權限委派與分割儲存的取捨
