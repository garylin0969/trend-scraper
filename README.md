# Trend Scraper

以 GitHub Actions 定期收集 BBC 中文新聞、Google 台灣熱搜、Komica 與 PTT 熱門文章，透過 GitHub Pages 提供 JSON。

## 公開資料介面

**`data/` 是提供其他專案使用的固定入口。檔名、JSON 欄位名稱和型別保持相容。**

| 路徑                      | 頂層欄位                                               | 更新排程（UTC，每小時）  |
| ------------------------- | ------------------------------------------------------ | ------------------------ |
| `data/bbc-trends.json`    | `updated`, `channel`, `trends`                         | 15、45 分                |
| `data/google-trends.json` | `updated`, `trends`                                    | 5、35 分                 |
| `data/komica-trends.json` | `updated`, `trends`                                    | 18、48 分                |
| `data/ptt-trends.json`    | `updated`, `total_found`, `returned_count`, `articles` | 1、11、21、31、41、51 分 |

公開網址的基底是 [GitHub Pages](https://garylin0969.github.io/trend-scraper/)，例如 [Komica JSON](https://garylin0969.github.io/trend-scraper/data/komica-trends.json)。Actions 排程可能延遲，並非準點保證。

- `updated`：本次成功收集資料的 ISO 8601 UTC 時間，不代表每篇文章的發布時間。
- BBC `channel`：`title`, `description`, `link`, `lastBuildDate`, `language`, `copyright`。來源未提供的選用欄位沿用省略行為。
- BBC `trends[]`：`title`, `description`, `link`, `pubDate`, `guid`，選用 `thumbnail`。日期轉為 ISO UTC；沒有發布日期時為空字串。
- Google `trends[]`：`googleTrend`, `searchVolume`, `started`，皆為字串，保留 `2,000+`、`3 小時前` 等格式。
- Komica `trends[]`：數字 `replyCount`，以及字串 `date`, `time`, `title`, `description`, `link`, `rawText`。
- PTT `articles[]`：`recommendScore`, `recommendCount`, `title`, `link`, `author`, `board`, `publishTime`, `imageUrl`，皆為字串。保留相對連結、頁面原始熱門順序，去重後最多 20 篇；兩個計數欄位都等於輸出篇數。
- Komica 優先使用 `Today`；不存在、清單空白或無法解析時改用 `All`。使用哪個清單只寫入日誌，不增加公開 JSON 欄位。`All` 的文章可能較舊。
- 所有來源先驗證再以原子方式寫檔。失敗、空資料或格式不符時保留上次成功資料，執行程序回傳非零狀態。

公開契約定義在 `src/contracts.ts`。測試會檢查 repository 既有四份 JSON 能完整通過驗證，不丟失或轉換欄位。

## 環境與安裝

使用 **Node.js 24 LTS**（`.node-version`）、**pnpm 12.16.1**（`package.json`），依賴以 `pnpm-lock.yaml` 鎖定。

```bash
npm install --global pnpm@12.16.1
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
```

Linux / GitHub Actions 安裝 Chromium 與系統依賴：

```bash
pnpm exec playwright install --with-deps chromium
```

單獨執行 BBC 不需要安裝瀏覽器。`pnpm-workspace.yaml` 只允許 `esbuild` 必要的安裝腳本。

## 執行

舊有指令保留：

```bash
pnpm scrape:bbc
pnpm scrape:google
pnpm scrape:komica
pnpm scrape:ptt
```

統一入口也可執行任何來源。試抓時加上 `--dry-run`：仍然連線、解析並驗證資料，但不更新 `data/`。

```bash
pnpm scrape komica --dry-run
pnpm scrape google --dry-run
```

輸出目錄以專案位置計算，不受啟動時工作目錄影響。每個來源最多執行兩次，第一次失敗等待 2 秒再重試；HTTP 請求上限 30 秒，瀏覽器導覽上限 60 秒，主要資料等待上限 30 秒。PTT 最多補充滾動 8 次，每次等待新連結最多 5 秒。

## 架構

```text
src/
  cli.ts                 統一命令入口與退出狀態
  config.ts              來源網址、專案根目錄與 HTTP 設定
  contracts.ts           公開 JSON schema、型別、固定檔名
  core/
    browser.ts           Playwright 生命週期與失敗診斷
    http.ts              有逾時限制的 HTTP 請求與狀態檢查
    logger.ts            帶時間與來源的日誌
    runner.ts            重試、輸出驗證、dry-run 與儲存流程
    storage.ts           驗證後原子替換 JSON
  sources/
    bbc.ts               HTTP + RSS Parser
    google.ts            Playwright 載入 + Cheerio 解析
    komica.ts            HTTP + Cheerio；必要時使用 Playwright
    ptt.ts               Playwright 載入／補充滾動 + Cheerio 解析
scripts/
  publish-data.sh         提交單一來源、rebase 與有限次推送重試
tests/
  fixtures/              離線 HTML／RSS 範例
  *.test.ts              解析、契約、儲存保護與 Git 發布整合測試
```

動態頁面使用一致的桌面瀏覽器設定與 `zh-TW` 語系，等待有效資料出現，避免以隨機 User-Agent 或固定長時間休眠決定解析時機。解析函式可以獨立測試，不必啟動瀏覽器。

## 驗證與維護

```bash
pnpm check          # 型別、離線測試、格式
pnpm typecheck
pnpm test
pnpm format
```

測試不連外、不修改正式資料，使用 Node 內建測試框架與暫存目錄。新增來源或更換選擇器時，加入對應 fixture；對外介面變更須先與使用者協調。

## GitHub Actions

四個 `update-*.yml` 保留既有工作流程名稱和排程，共用 `scrape.yml`：

1. Node 24 與鎖定的 pnpm / 依賴。
2. 除 BBC 外安裝 Chromium（Komica 瀏覽器 fallback 仍需準備）。
3. 收集、驗證並寫入對應 JSON。
4. 只提交該來源檔案，先 commit 再 rebase，推送失敗最多重試 5 次，避免不同來源同時更新時互相覆蓋。
5. 上傳瀏覽器失敗診斷，保留 7 天。

同來源透過 workflow concurrency 避免並行執行，不同來源可並行。手動 **Run workflow** 可勾選 `dry_run`，驗證來源而不提交資料。

`check.yml` 在 PR 與程式／設定變更時執行 `pnpm check`，純資料自動更新不觸發 push 檢查。Dependabot 每週提出套件與 Actions 更新。

瀏覽器失敗時，本機 `artifacts/<source>/<timestamp>/` 包含 HTML、截圖與 `trace.zip`；Actions 可下載對應 diagnostics artifact。用以下指令檢查 trace：

```bash
pnpm exec playwright show-trace artifacts/<source>/<timestamp>/trace.zip
```

HTTP 失敗會記錄狀態或錯誤原因；若瀏覽器尚未啟動就失敗，可能沒有頁面診斷檔。診斷檔不進版控，也不放入公開 `data/`。
