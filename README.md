# 🔥 Hot Now 爬蟲專案

這是為 [Hot Now](https://hotnow.garylin.dev) 網站提供資料的爬蟲專案，負責收集各種熱門內容的最新資訊。

## 🌟 專案簡介

Hot Now 是一個整合各大平台熱門內容的資訊聚合網站，讓使用者能夠一站式瀏覽各種熱門話題。

-   **網站連結**: [https://hotnow.garylin.dev](https://hotnow.garylin.dev)
-   **主專案**: [https://github.com/garylin0969/hot-now](https://github.com/garylin0969/hot-now)
-   **Chrome 擴充功能**: [Hot Now ｜熱門話題一把抓](https://chromewebstore.google.com/detail/hot-now%EF%BD%9C%E7%86%B1%E9%96%80%E8%A9%B1%E9%A1%8C%E4%B8%80%E6%8A%8A%E6%8A%93/pcgkeopgenagbemoagdogljeapjhapch)

## 🎯 Chrome 擴充功能

Hot Now 提供了 Chrome 擴充功能，讓你每次開啟新分頁時都能即時掌握最受歡迎的熱門網路討論話題。

### 特色

-   開啟新分頁即可瀏覽熱門話題
-   不收集個人身份資訊
-   僅使用 Google Analytics 進行匿名使用行為分析

## 📊 支援平台

Hot Now 整合了以下平台的熱門內容：

| 平台             | 內容類型     | 資料來源方式                     | 負責專案   |
| ---------------- | ------------ | -------------------------------- | ---------- |
| **YouTube**      | 發燒影片     | Google Cloud YouTube Data API v3 | 主專案     |
| **PTT**          | 24H 熱門文章 | 爬蟲                             | **本專案** |
| **Google**       | 熱搜榜       | 爬蟲                             | **本專案** |
| **巴哈姆特**     | 熱門話題     | 官方 API                         | 主專案     |
| **Reddit**       | 熱門文章     | 爬蟲 (JSON API)                  | **本專案** |
| **Komica(K 島)** | 熱門文章     | 爬蟲                             | **本專案** |
| **BBC 中文**     | 熱門新聞     | RSS 爬蟲                         | **本專案** |

## 🕷️ 本專案負責的爬蟲

本專案專門負責以下四個平台的資料爬取：

### 1. PTT 熱門文章

-   **目標網站**: https://www.pttweb.cc/hot/all/today
-   **資料內容**: 24 小時熱門文章
-   **爬蟲頻率**: **每 10 分鐘** (一天 144 次)
-   **執行時間**: 每小時第 1、11、21、31、41、51 分鐘
-   **儲存位置**: `data/ptt-trends.json`

### 2. Google 熱搜榜

-   **目標網站**: https://trends.google.com.tw/trending?geo=TW&hours=4
-   **資料內容**: 台灣 4 小時內熱搜關鍵字
-   **爬蟲頻率**: **每 30 分鐘** (一天 48 次)
-   **執行時間**: 每小時第 5、35 分鐘
-   **儲存位置**: `data/google-trends.json`

### 3. Komica(K 島) 熱門文章

-   **目標網站**: https://gita.komica1.org/00b/catlist.php
-   **資料內容**: 今日熱門文章 Top 50
-   **爬蟲頻率**: **每 30 分鐘** (一天 48 次)
-   **執行時間**: 每小時第 18、48 分鐘
-   **儲存位置**: `data/komica-trends.json`

### 4. Reddit 熱門文章

-   **目標網站**: Reddit JSON API
-   **資料內容**: 多個子版塊熱門文章 (r/all、r/Taiwanese、r/China_irl)
-   **爬蟲頻率**: **每 30 分鐘** (一天 48 次)
-   **執行時間**: 每小時第 28、58 分鐘
-   **儲存位置**: `data/reddit-all-hot.json`, `data/reddit-taiwanese-hot.json`, `data/reddit-china-irl-hot.json`

### 5. BBC 中文新聞

-   **目標網站**: https://feeds.bbci.co.uk/zhongwen/trad/rss.xml
-   **資料內容**: BBC 中文網最新新聞文章
-   **爬蟲頻率**: **每 30 分鐘** (一天 48 次)
-   **執行時間**: 每小時第 15、45 分鐘
-   **儲存位置**: `data/bbc-trends.json`

## 🏗️ 技術架構

### 技術棧

-   **執行環境**: Node.js 18
-   **程式語言**: TypeScript
-   **網頁爬蟲**: Puppeteer
-   **RSS 解析**: RSS Parser
-   **部署平台**: GitHub Page
-   **自動化**: GitHub Actions
-   **包管理器**: pnpm

### 專案結構

```
trend-scraper/
├── scripts/                      # 爬蟲腳本
│   ├── bbc-trends.ts             # BBC中文新聞爬蟲
│   ├── google-trends.ts          # Google熱搜爬蟲
│   ├── komica-trends.ts          # K島熱門文章爬蟲
│   ├── ptt-trends.ts             # PTT熱門文章爬蟲
│   └── reddit-trends.ts          # Reddit熱門文章爬蟲
├── data/                         # 爬蟲資料儲存
│   ├── bbc-trends.json           # BBC中文新聞資料
│   ├── google-trends.json        # Google熱搜資料
│   ├── komica-trends.json        # K島熱門資料
│   ├── ptt-trends.json           # PTT熱門資料
│   ├── reddit-all-hot.json       # Reddit r/all熱門資料
│   ├── reddit-taiwanese-hot.json # Reddit r/Taiwanese熱門資料
│   └── reddit-china-irl-hot.json # Reddit r/China_irl熱門資料
├── .github/workflows/            # GitHub Actions工作流程
│   ├── bbc-google.yml            # BBC中文新聞自動更新
│   ├── update-google.yml         # Google熱搜自動更新
│   ├── update-komica.yml         # K島自動更新
│   ├── update-ptt.yml            # PTT自動更新
│   └── update-reddit.yml         # Reddit自動更新
├── package.json                  # 專案設定
├── tsconfig.json                # TypeScript設定
└── pnpm-lock.yaml               # 依賴鎖定檔
```

## 🚀 本地開發

### 環境需求

-   Node.js 18+
-   pnpm

### 安裝步驟

```bash
# 克隆專案
git clone https://github.com/garylin0969/trend-scraper.git
cd trend-scraper

# 安裝依賴
pnpm install

# 安裝 Puppeteer Chromium
npx puppeteer browsers install chrome
```

### 執行爬蟲

```bash
# 爬取 BBC 中文新聞
pnpm scrape:bbc

# 爬取 Google 熱搜
pnpm scrape:google

# 爬取 PTT 熱門文章
pnpm scrape:ptt

# 爬取 K島 熱門文章
pnpm scrape:komica

# 爬取 Reddit 熱門文章
pnpm scrape:reddit
```

## 🤖 自動化部署

本專案使用 GitHub Actions 實現自動化爬蟲，每個平台都有獨立的工作流程：

### BBC 中文新聞自動更新

-   **檔案**: `.github/workflows/bbc-google.yml`
-   **執行頻率**: 每小時第 15、45 分鐘
-   **cron 表達式**: `15,45 * * * *`

### Google 熱搜自動更新

-   **檔案**: `.github/workflows/update-google.yml`
-   **執行頻率**: 每小時第 5、35 分鐘
-   **cron 表達式**: `5,35 * * * *`

### K 島自動更新

-   **檔案**: `.github/workflows/update-komica.yml`
-   **執行頻率**: 每小時第 18、48 分鐘
-   **cron 表達式**: `18,48 * * * *`

### PTT 自動更新

-   **檔案**: `.github/workflows/update-ptt.yml`
-   **執行頻率**: 每 10 分鐘
-   **cron 表達式**: `1,11,21,31,41,51 * * * *`

### Reddit 自動更新

-   **檔案**: `.github/workflows/update-reddit.yml`
-   **執行頻率**: 每小時第 28、58 分鐘
-   **cron 表達式**: `28,58 * * * *`

## 📋 爬蟲特色

### BBC 爬蟲

-   使用 RSS Parser 解析 BBC 中文網 RSS feed
-   支援縮圖圖片 URL 提取
-   完整的頻道資訊保存
-   標準化的日期格式處理

### PTT 爬蟲

-   智慧滾動策略，保持文章熱門度順序
-   多層備用選擇器，確保穩定性
-   支援圖片 URL 提取
-   完整的去重機制

### Google 熱搜爬蟲

-   隨機 User-Agent 避免被偵測
-   隨機延遲模擬人類行為
-   精準提取搜尋量和時間資訊

### K 島爬蟲

-   解析 HTML 結構
-   提取完整的討論串資訊
-   支援回覆數量統計

### Reddit 爬蟲

-   使用 Puppeteer 模擬瀏覽器存取 JSON API
-   支援多個子版塊同時抓取
-   智慧型反反爬蟲機制避免 403/429 錯誤
-   完整的錯誤處理和重試機制

## 🛡️ 反爬蟲策略

為了確保爬蟲穩定運作，本專案採用了多種反偵測技術：

-   **隨機 User-Agent**: 模擬不同瀏覽器和設備
-   **隨機延遲**: 避免規律性存取模式
-   **穩定選擇器**: 避免依賴動態 CSS 類名
-   **多層備用方案**: 確保在網站更新時仍能正常運作
-   **Headless 瀏覽器**: 使用 Puppeteer 模擬真實瀏覽器行為

## 🌐 資料 API

本專案使用 GitHub Pages 提供即時的 JSON 資料 API，任何人都可以透過以下端點取得最新資料：

### API 端點

| 平台                   | API 端點                                                                   | 更新頻率   |
| ---------------------- | -------------------------------------------------------------------------- | ---------- |
| **BBC 中文新聞**       | https://garylin0969.github.io/trend-scraper/data/bbc-trends.json           | 每 30 分鐘 |
| **PTT 熱門文章**       | https://garylin0969.github.io/trend-scraper/data/ptt-trends.json           | 每 10 分鐘 |
| **Google 熱搜榜**      | https://garylin0969.github.io/trend-scraper/data/google-trends.json        | 每 30 分鐘 |
| **K 島熱門文章**       | https://garylin0969.github.io/trend-scraper/data/komica-trends.json        | 每 30 分鐘 |
| **Reddit r/all**       | https://garylin0969.github.io/trend-scraper/data/reddit-all-hot.json       | 每 30 分鐘 |
| **Reddit r/Taiwanese** | https://garylin0969.github.io/trend-scraper/data/reddit-taiwanese-hot.json | 每 30 分鐘 |
| **Reddit r/China_irl** | https://garylin0969.github.io/trend-scraper/data/reddit-china-irl-hot.json | 每 30 分鐘 |

### CORS 支援

所有 API 端點都支援 CORS，可以直接在前端應用程式中使用，無需額外的代理服務。

## 📈 資料格式

### BBC 中文新聞

```json
{
    "updated": "2025-07-15T07:41:30.769Z",
    "channel": {
        "title": "BBC Chinese",
        "description": "BBC Chinese - BBC News , 中文 - 主頁",
        "link": "https://www.bbc.com/zhongwen/trad",
        "lastBuildDate": "2025-07-15T07:41:16.000Z",
        "language": "zh-hant",
        "copyright": "英國廣播公司 版權所有 "
    },
    "trends": [
        {
            "title": "「魷魚遊戲」下結業潮來襲，香港餐飲業能重返「美食天堂」嗎？",
            "description": "BBC中文訪問研究飲食文化及經濟學者，以及業內人士，剖析香港餐飲業結業潮的癥結。",
            "link": "https://www.bbc.com/zhongwen/articles/c1k8ge4zjw0o/trad",
            "pubDate": "2025-07-15T01:10:24.000Z",
            "guid": "https://www.bbc.com/zhongwen/articles/c1k8ge4zjw0o/trad#0",
            "thumbnail": "https://ichef.bbci.co.uk/ace/ws/240/cpsprodpb/ed09/live/e6eda9f0-5dbe-11f0-8328-5fcabfbdb3e1.jpg"
        }
    ]
}
```

### PTT 熱門文章

```json
{
    "updated": "2025-07-05T09:53:34.781Z",
    "total_found": 20,
    "returned_count": 20,
    "articles": [
        {
            "recommendScore": "673",
            "recommendCount": "1018",
            "title": "[問卦] 北檢撐法治，我們撐北檢！",
            "link": "/bbs/Gossiping/M.1751680585.A.4E1",
            "author": "ambitious",
            "board": "Gossiping",
            "publishTime": "2025/07/05 01:56",
            "imageUrl": "https://cache.pttweb.cc/imgur/Y4T1d9a/s/..."
        }
    ]
}
```

### Google 熱搜

```json
{
    "updated": "2025-07-05T09:47:00.588Z",
    "trends": [
        {
            "googleTrend": "段宜恩",
            "searchVolume": "500+",
            "started": "3 小時前"
        }
    ]
}
```

### K 島 熱門文章

```json
{
    "updated": "2025-07-05T09:39:36.119Z",
    "trends": [
        {
            "replyCount": 130,
            "date": "2025/07/05",
            "time": "00:25",
            "title": "中國水世界 夏日季節活動",
            "description": "6月26日貴州榕江縣上游水庫洩洪，河水暴",
            "link": "https://gita.komica1.org/00b/pixmicat.php?res=28143559",
            "rawText": "130|28143559|2025/07/05|00:25|中國水世界 夏日季節活動|6月26日貴州榕江縣上游水庫洩洪，河水暴|在新分頁開啟"
        }
    ]
}
```

### Reddit 熱門文章

```json
{
    "updated": "2025-07-05T10:25:00.000Z",
    "source": "Reddit r/all 熱門文章",
    "total_posts": 50,
    "original_data": {
        "kind": "Listing",
        "data": {
            "children": [
                {
                    "kind": "t3",
                    "data": {
                        "subreddit": "AskReddit",
                        "title": "What is something that everyone should know?",
                        "score": 15420,
                        "num_comments": 2348,
                        "author": "example_user",
                        "created_utc": 1625567890,
                        "url": "https://www.reddit.com/r/AskReddit/comments/...",
                        "selftext": "Just curious what life tips you have..."
                    }
                }
            ]
        }
    }
}
```

## 🔗 相關連結

-   **Hot Now 網站**: https://hotnow.garylin.dev
-   **Hot Now 主專案**: https://github.com/garylin0969/hot-now
-   **資料 API (GitHub Pages)**: https://garylin0969.github.io/trend-scraper/
-   **API 配額資訊**:
    -   YouTube Data API v3: 10,000 Queries/day, 1,800,000 Queries/minute
