# 🔥 Hot Now 爬蟲專案

為 [Hot Now](https://hotnow.garylin.dev) 收集熱門話題與新聞，透過 GitHub Actions 定期更新，並由 GitHub Pages 提供 JSON 資料。

## 📊 資料來源

| 平台                                                           | 收集內容                          | 更新頻率   | JSON 資料                                                                                 |
| -------------------------------------------------------------- | --------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| [PTT](https://www.pttweb.cc/hot/all/today)                     | 24 小時熱門文章，最多 20 篇       | 每 10 分鐘 | [ptt-trends.json](https://garylin0969.github.io/trend-scraper/data/ptt-trends.json)       |
| [Google](https://trends.google.com.tw/trending?geo=TW&hours=4) | 台灣近 4 小時熱搜                 | 每 30 分鐘 | [google-trends.json](https://garylin0969.github.io/trend-scraper/data/google-trends.json) |
| [Komica（K 島）](https://gita.komica1.org/00b/catlist.php)     | 今日熱門 Top 50，無資料時改抓 All | 每 30 分鐘 | [komica-trends.json](https://garylin0969.github.io/trend-scraper/data/komica-trends.json) |
| [BBC 中文](https://feeds.bbci.co.uk/zhongwen/trad/rss.xml)     | 最新 RSS 新聞                     | 每 30 分鐘 | [bbc-trends.json](https://garylin0969.github.io/trend-scraper/data/bbc-trends.json)       |

**`data/` 的檔名與 JSON 格式是固定的對外介面。** 所有檔案都有 `updated` 更新時間；詳細欄位可直接查看 [data/](data/) 與 [格式定義](src/contracts.ts)。抓取失敗或資料為空時，保留上次成功的結果。

## 🚀 本地開發

環境：**Node.js 24 LTS**、**pnpm 12.16.1**。

```bash
# 取得專案
git clone https://github.com/garylin0969/trend-scraper.git
cd trend-scraper

# 尚未安裝指定版本的 pnpm 時執行
npm install --global pnpm@12.16.1

# 依鎖定版本安裝專案套件
pnpm install --frozen-lockfile

# 安裝爬蟲需要的 Chromium 瀏覽器
pnpm exec playwright install chromium
```

Linux 環境請將最後一行改為 `pnpm exec playwright install --with-deps chromium`，一併安裝系統依賴。只執行 BBC 爬蟲時不需安裝瀏覽器。

### 執行爬蟲

```bash
pnpm scrape:ptt       # PTT 熱門文章
pnpm scrape:google    # Google 熱搜
pnpm scrape:komica    # K 島熱門文章
pnpm scrape:bbc       # BBC 中文新聞

# 試抓並驗證，不改寫 data/；來源可換成 ptt、google 或 bbc
pnpm scrape komica --dry-run
```

### 程式檢查

```bash
pnpm check           # 型別檢查、離線測試、格式檢查
pnpm format          # 自動整理程式格式
```

## 🏗️ 專案結構

使用 TypeScript、Playwright、Cheerio 與 RSS Parser。Google／PTT 由瀏覽器載入；Komica 優先直接取得 HTML，必要時使用瀏覽器備援；BBC 直接讀取 RSS。

```text
src/
├── cli.ts           指令入口
├── config.ts        來源網址與設定
├── contracts.ts     固定檔名、JSON 格式與型別
├── core/            瀏覽器、HTTP、重試、驗證與寫檔
└── sources/         各平台的抓取與解析
data/               對外提供的 JSON 資料
tests/              解析、資料相容性與發布測試
scripts/            Git 資料發布腳本
.github/workflows/  排程與自動檢查
```

## 🤖 自動更新與除錯

- 四個 `update-*.yml` 各自設定排程，共用 `scrape.yml` 收集並提交資料。Actions 排程可能延遲。
- 手動執行：進入 **Actions → 選擇來源 → Run workflow**；勾選 `dry_run` 可只驗證、不發布。
- 瀏覽器抓取失敗時，診斷檔放在本機 `artifacts/`；Actions 的 diagnostics artifact 可下載 HTML、截圖與 trace，保留 7 天。

## 🔗 相關連結

[Hot Now 網站](https://hotnow.garylin.dev) · [主專案](https://github.com/garylin0969/hot-now) · [Chrome 擴充功能](https://chromewebstore.google.com/detail/hot-now%EF%BD%9C%E7%86%B1%E9%96%80%E8%A9%B1%E9%A1%8C%E4%B8%80%E6%8A%8A%E6%8A%93/pcgkeopgenagbemoagdogljeapjhapch)
