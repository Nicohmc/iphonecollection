# My Collection — GitHub Pages 前端

這份目錄是 **GitHub Pages 的網站前端**，延續目前的阿瑪菲配色、icon、精簡文章卡片、搜尋篩選、常用分類、隨機探索、釘選、批次管理、編輯與刪除等功能。

## 重要：這不是把 Code.gs 放到 GitHub

- `index.html`、`style.css`、`app.js`、`bridge-client.js`、`config.js`、`.nojekyll`：可上傳 GitHub。
- **不要**把 `gas-update/Code.gs` 或 `gas-update/Bridge.html` 當作 GitHub 前端檔案上傳。
- Google Sheets `Articles`、`Categories` 資料仍在 Google 帳號內，沒有複製到 GitHub。
- `config.js` 公開，絕對不要放密碼、API Token、私人資料或 Google Sheets ID。

## 上架流程

1. **先備份**目前 Google Sheets 及 GAS 專案原始碼。
2. 在 GAS 專案建立一個 HTML 檔案，名稱 `Bridge`，把 `gas-update/Bridge.html` 內容完整貼入。
3. 將 `gas-update/Code.gs` 內容更新到原本的 `Code.gs`。新版只在 `doGet(e)` 新增 `mode=bridge` 路由，原本功能仍保留。
4. 檢查 GAS 中的 `Capture.html` 是目前可輸入標題的版本；如不是，使用 `gas-update/Capture.html` 更新。
5. GAS 選「部署 → 管理部署作業 → 編輯 → 新版本 → 部署」。
6. 將本資料夾 `github-pages/` 的 **所有檔案**上傳到 GitHub 專案 `Nicohmc/iphonecollection` 的根目錄（不要多包一層資料夾）。
7. GitHub 專案 → Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save。
8. 開啟 `https://nicohmc.github.io/iphonecollection/`，確認文章能載入，先測試搜尋、分類，再測試一篇不重要文章的釘選及編輯。
9. iPhone 捷徑先保持原本 GAS `/exec?mode=save`，暫時不用改。

## 測試

- GitHub Pages 頁面可以開啟，但「讀取失敗」：請檢查 GAS 是否確實**重新部署新版本**，並確認 `Bridge.html` 是否存在。
- 如果瀏覽器阻擋第三方 iframe／Google HTML Service，橋接可能不能運作；可先回原本 GAS 網站繼續使用，之後再改成正式的身份驗證 API。此橋接不是所有瀏覽器都已實測的正式解決方案。
- 如果 `config.js` 裡的 GAS /exec 網址改變，請同步更新。

## 安全提醒，非常重要

**這個版本沒有身分驗證。** `Bridge.html` 對 GitHub 來源網域的限制只是前端訊息路由限制，並不是後端保護。你的原 GAS `doPost`、`uiCall` 及已部署的公開 `/exec` 仍可以不經登入操作資料。**不要把這份過渡方案當成安全的私人收藏系統**。正式對外使用前，應改成具 Google 登入或其他可靠權限驗證的後端。

## 現有限制

- 因為 GAS 的 HTML Service 會使用巢狀 iframe，不同瀏覽器可能阻擋跨站內嵌頁面或其功能，這份包只能視為 **GitHub Pages 遷移測試版**，未在你的實際部署環境驗證。
- `常用分類`、`排序喜好` 仍存在瀏覽器 localStorage，不會跨裝置同步。
- `Code.gs` 需要放在 GAS 專案，不能在 GitHub Pages 伺服器執行。
