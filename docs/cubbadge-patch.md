# `cubbadge` 後端修正指引（鐵律 5 ①②③ ＋ v1.2.5 級別）

`CUBBOOK` 已完成 BOOK 一側的所有配套（項目 ID 對照、`requestComplete` 送交、零個人資料清洗）。以下三項必須在**姊妹專案 `cubbadge`** 的 Apps Script `apps-script/Code.gs` 內套用，屬 BOOK 端無法代勞的部分。三項改動均向後兼容（舊前端照樣可用），可一次過部署。

> 部署方式：Google Apps Script 編輯器貼上修改 → `部署 → 管理部署 → 編輯（鉛筆）→ 版本：新版本 → 部署`。若用 `clasp`，執行 `clasp push && clasp deploy -i <deploymentId>`。
> 部署後請以 `curl` 或 `cubbadge` 前端各驗一次（見文末驗收清單）。

---

## ① `PBKDF2_ITERATIONS` 由 120000 改為 10000

**位置**：`apps-script/Code.gs` 第 440 行

```diff
-const PBKDF2_ITERATIONS=120000;
+const PBKDF2_ITERATIONS=10000;
```

**原因**：Apps Script 單次執行上限約 6 分鐘、且 `pbkdf2HmacSha256_` 以純 JS 迴圈實作，120,000 次在高負載時會令登入超時（`Exceeded maximum execution time`）。10,000 次配合既有的 5 次失敗鎖帳 15 分鐘機制，足以應付旅團規模的暴力嘗試。

**兼容性**：雜湊字串格式為 `pbkdf2$<iterations>$<salt>$<hash>`，驗證時會讀回字串內記錄的次數，因此舊密碼（120,000 次）仍可登入；使用者下次改密碼時自動升級為新設定，**毋須重設全團密碼**。

---

## ② `handleRequestComplete` 對同一 `(ymis, itemId)` 去重

**位置**：`apps-script/Code.gs` 第 2076–2082 行，整段替換為：

```javascript
function handleRequestComplete(body, requesterYmis){
  const sheet=tbl('待批完成'); if(!sheet) return jsonResponse({success:false,error:'Sheet not found'});
  const itemId=String(body.itemId||'').trim();
  if(!itemId) return jsonResponse({success:false,error:'缺少項目編號'});
  const requestedDate=String(body.requested_date||formatDate(new Date())).slice(0,10);

  // 冪等：同一成員、同一項目已有待批記錄 → 直接回傳原有申請，不再新增一列。
  // 避免 BOOK 重複按「送交」或網絡重試造成待批清單滿佈重複項。
  const data=sheet.getDataRange().getValues();
  for(let i=1;i<data.length;i++){
    if(String(data[i][1]).trim()===String(requesterYmis).trim()
       && String(data[i][3]).trim()===itemId
       && String(data[i][7]).toLowerCase()==='pending'){
      return jsonResponse({success:true,request_id:String(data[i][0]),duplicate:true});
    }
  }

  const reqId='REQ_'+Date.now()+'_'+Math.random().toString(36).substr(2,5);
  const user=getUser(requesterYmis)||{name:body.name||requesterYmis};
  sheet.appendRow([reqId,requesterYmis,user.name||body.name,itemId,body.itemName||itemId,requestedDate,body.evidence||'','pending',now(),'','','', '']);
  return jsonResponse({success:true,request_id:reqId,duplicate:false});
}
```

**BOOK 一側的配合**：`exportForBadge()` 會先讀取雲端 `pendingRequests`，同一 `(ymis, itemId)` 已待批就不再送交（見 `collectPendingForBadge`）。此處再加一層伺服器端冪等，堵住「兩個裝置同時按」與「網絡逾時後自動重試」。

---

## ③ `handleReviewRequest` 批准 `OT-*` 時寫入「其他獎章」而非「進度追蹤」

**位置**：`apps-script/Code.gs` 第 2088–2099 行，整段替換；並在其上方加入活動徽章判斷 helper：

```javascript
// 活動／專科徽章編號：BOOK 送交時已轉回官方 badgeId，例如 A22、A25-PLASTIC。
function isActivityBadgeId_(id){
  return /^A\d{2}(-[A-Z]+)?$/.test(String(id||'').trim());
}

function handleReviewRequest(reqId,decision,note,reviewer,confirmed_date){
  const sheet=tbl('待批完成'); if(!sheet) return jsonResponse({success:false,error:'Sheet not found'});
  const data=sheet.getDataRange().getValues(); let row=null;
  for(let i=1;i<data.length;i++){
    if(data[i][0].toString()===reqId){
      row=data[i];
      sheet.getRange(i+1,8).setValue(decision);
      sheet.getRange(i+1,10).setValue(sheetActor(reviewer));
      sheet.getRange(i+1,11).setValue(now());
      sheet.getRange(i+1,12).setValue(note||'');
      sheet.getRange(i+1,13).setValue(confirmed_date||formatDate(new Date()));
      break;
    }
  }
  if(!row) return jsonResponse({success:false,error:'找不到申請'});

  if(decision==='approved'){
    const ymis=String(row[1]).trim();
    const itemId=String(row[3]).trim();
    const itemName=String(row[4]||itemId);
    const doneDate=confirmed_date||row[5]||formatDate(new Date());

    if(isActivityBadgeId_(itemId)){
      // ===== 活動／專科徽章 → 寫入「其他獎章」（Upsert，同一成員同一徽章只保留一列）=====
      const oSheet=tbl('其他獎章');
      if(!oSheet) return jsonResponse({success:false,error:'Sheet 其他獎章 not found'});
      const oData=oSheet.getDataRange().getValues();
      let hit=-1;
      for(let i=1;i<oData.length;i++){
        if(String(oData[i][0]).trim()===ymis && String(oData[i][1]).trim()===itemId){ hit=i; break; }
      }
      if(hit>0){
        oSheet.getRange(hit+1,3).setValue(safeSheetText(itemName,120));
        oSheet.getRange(hit+1,4).setValue(formatDate(doneDate));
        if(note) oSheet.getRange(hit+1,6).setValue(safeSheetText(note,500));
        oSheet.getRange(hit+1,7).setValue(new Date());
      }else{
        oSheet.appendRow([
          ymis,
          itemId,
          safeSheetText(itemName,120),
          formatDate(doneDate),
          '',                                  // 證書編號：留空由領袖補填
          safeSheetText(note||'由申請轉入',500),
          new Date()
        ]);
      }
      return jsonResponse({success:true,message:'已批准並寫入其他獎章',target:'其他獎章'});
    }

    // ===== 進度性項目（1.x／2.x／3.x／4.x 細項）→ 寫入「進度追蹤」=====
    const pSheet=tbl('進度追蹤');
    if(!pSheet) return jsonResponse({success:false,error:'Sheet 進度追蹤 not found'});
    const pData=pSheet.getDataRange().getValues();
    for(let i=1;i<pData.length;i++){
      if(String(pData[i][0]).trim()===ymis && String(pData[i][1]).trim()===itemId){
        // Upsert：已有同一項目 → 更新日期與核實人，不重複加列
        pSheet.getRange(i+1,3).setValue(formatDate(doneDate));
        pSheet.getRange(i+1,4).setValue(new Date());
        pSheet.getRange(i+1,5).setValue(sheetActor(reviewer));
        pSheet.getRange(i+1,6).setValue('由申請轉入：'+(note||''));
        return jsonResponse({success:true,message:'已批准並更新進度',target:'進度追蹤'});
      }
    }
    pSheet.appendRow([ymis,itemId,formatDate(doneDate),new Date(),sheetActor(reviewer),'由申請轉入：'+(note||'')]);
    return jsonResponse({success:true,message:'已批准並寫入進度',target:'進度追蹤'});
  }
  return jsonResponse({success:true,message:'已拒絕'});
}
```

**為何要判斷 `OT-*`**：`進度追蹤` 工作表只供獎章細項（`1.1.1` 等）使用；活動徽章若誤寫入該表，前端「活動徽章」頁不會顯示，而 `handleGetOtherBadges` 亦讀不到，形成「已批准但消失」的資料黑洞。`CUBBOOK` 送交活動徽章時使用官方 `A22`／`A25-PLASTIC` 格式（`shared/syllabus.js` 的 `toBadgeId`），故 helper 以 `/^A\d{2}(-[A-Z]+)?$/` 判斷即可。

**「其他獎章」欄位順序**（與 `handleSaveOtherBadge` 一致）：`col1 YMIS`、`col2 獎章ID`、`col3 名稱`、`col4 完成日期`、`col5 證書編號`、`col6 備註`、`col7 更新時間`。

---

---

## ④ 活動徽章的初／中／高級（v1.2.5 新增）

官方第 21–27 頁有 7 枚活動徽章分初、中、高三行：

| 官方編號 | 徽章 |
| :-: | :--- |
| `A18` | 音樂章 |
| `A26` | 射箭章 |
| `A27` | 田徑章 |
| `A29` | 獨木舟章 |
| `A33` | 公園定向章 |
| `A35` | 體適能章 |
| `A39` | 游泳章 |

CUBBOOK 由 v1.2.5 起**逐級申報**：同一枚 `A26` 的初級與中級是兩項獨立的 `requestComplete`，
payload 額外帶 `level: 'E' | 'I' | 'A'`（`E` 初級、`I` 中級、`A` 高級）。

### 需要的改動

1. **「其他獎章」工作表加一欄 `級別`**（建議 col8，值 `E`/`I`/`A`；舊列留空 = 整個徽章）。
2. `handleRequestComplete`：讀 `body.level`，冪等鍵改為 `(ymis, itemId, level)`。
3. `handleReviewRequest`：批准的 upsert 鍵同樣改為 `(ymis, itemId, level)`；寫入時一併寫 `級別`。
4. `handleGetOtherBadges`（或 `/api/proxy?action=load`）：回傳
   `otherBadges[ymis]['A26-E'] = { date, cert }` **或** `otherBadges[ymis]['A26'] = { date, cert, level: 'E' }`，
   兩者 CUBBOOK 都認；同一枚徽章多級時請用**後綴鍵**（物件只有一個 `A26` 鍵，會覆蓋）。
5. BADGE 的活動徽章頁對這 7 枚顯示初／中／高三個子行。

> 向後兼容：未帶 `level` 的舊資料、舊前端完全照舊；CUBBOOK 收到沒有級別的已核實紀錄時，
> 會當作整個徽章核實（不再逐級申報）。

### 後綴編號只作傳輸用

`A26-E` 這類寫法**只出現在同步 payload／HTTPS 回應**，`data/items.json` 毋須新增 21 個編號；
CUBBOOK 內部的單一真相仍是 `A26` + `level`。若你在 `items.json` 加編號，請通知 CUBBOOK 重跑
`npm run syllabus`（fixture 以 sha256 鎖死）。

---

## 驗收清單（部署後逐項確認）

| # | 動作 | 預期 |
| :-: | :--- | :--- |
| 1 | 以正確密碼登入 10 次 | 每次都 < 3 秒回應，無 `Exceeded maximum execution time` |
| 2 | 同一成員連續兩次送交同一項目 | 第二次回 `{success:true, duplicate:true}`，「待批完成」只有一列 |
| 3 | 批准一個 `1.2.2` 申請 | 「進度追蹤」新增或更新該列；「其他獎章」不變 |
| 4 | 批准一個 `A22` 申請 | 「其他獎章」新增一列（日期正確、名稱中文）；「進度追蹤」不變 |
| 5 | 再次批准同一 `A22` | 「其他獎章」仍只有一列（日期更新，不重複） |
| 6 | `GET /api/proxy?action=load`（BOOK 經 `/api/cubbadge`） | 回傳的 `pendingRequests` 不含已批准項目；已批准 `A22` 出現在 `otherBadges` |
| 7 | BOOK 端按「重新整理已核實進度」 | 該 `A22` 顯示「cubbadge · 已核實」印章，日期與 BADGE 一致 |
| 8 | 批准 `A09-CHILD-PROTECTION` | 寫入「其他獎章」，**不是**「進度追蹤」（見下方正則修正） |
| 9 | 批准 `A26` 初級，再送中級 | 「其他獎章」兩列（`級別` 分別為 E、I），日期各自正確 |
| 10 | 同一 `(ymis, A26, E)` 重複送交 | 回 `{success:true, duplicate:true}`，待批只有一列 |
| 11 | BOOK 匯入後 | 射箭章初級與中級同時顯示，互不覆蓋（`levels.E`／`levels.I`） |
| 12 | 舊資料（無 `級別`） | 照舊顯示為單一徽章，不報錯 |

---

## ⑤ 正則修正：6 枚 `A09-*` 徽章會被錯誤分流

第③項的 `/^A\d{2}(-[A-Z]+)?$/` 認不到連字符內嵌的官方編號，會令以下 6 枚批准後誤寫入「進度追蹤」
（BADGE 活動徽章頁看不到、`handleGetOtherBadges` 讀不到，形成「批准完但消失」）：

`A09-ANTI-DECEPTION`、`A09-ANTI-DRUG`、`A09-CHILD-PROTECTION`、`A09-COMMUNITY-EMERGENCY`、
`A09-GREEN-PIONEER`、`A09-EM-PIONEER`

改用：

```javascript
function isActivityBadgeId_(id){
  return /^A\d{2}(-[A-Z0-9]+)*$/.test(String(id || '').trim());
}
```

（`A25-PLASTIC`／`A25-NATURE`／`A25-SOLAR` 及 `A01`–`A42` 本來已通過。）

> 注意：`tbl()` 有 `_sheetCache` 快取；同一次執行內新增工作表不會被看到。上述測試請用新的請求（每次 `doPost` 都是獨立執行），毋須手動清快取。
