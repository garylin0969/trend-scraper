// scripts/reddit-trends.ts - Reddit熱門文章JSON資料抓取器
// 使用puppeteer模擬瀏覽器來抓取Reddit JSON API資料

import puppeteer from 'puppeteer';
import fs from 'fs';
import { promises as fsPromises } from 'fs';

interface RedditUrl {
    url: string;
    filename: string;
    description: string;
}

const redditUrls: RedditUrl[] = [
    {
        url: 'https://www.reddit.com/r/all/hot.json?limit=50',
        filename: 'data/reddit-all-hot.json',
        description: 'Reddit r/all 熱門文章',
    },
    {
        url: 'https://www.reddit.com/r/Taiwanese/hot.json?limit=50',
        filename: 'data/reddit-taiwanese-hot.json',
        description: 'Reddit r/Taiwanese 熱門文章',
    },
    {
        url: 'https://www.reddit.com/r/China_irl/hot.json?limit=50',
        filename: 'data/reddit-china-irl-hot.json',
        description: 'Reddit r/China_irl 熱門文章',
    },
];

async function fetchRedditDataWithPuppeteer(url: string): Promise<any> {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
        ],
    });

    try {
        const page = await browser.newPage();

        // 設置更真實的用戶代理
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );

        // 設置視窗大小
        await page.setViewport({ width: 1920, height: 1080 });

        // 移除webdriver痕跡
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        console.log(`🌐 正在抓取: ${url}`);

        // 訪問JSON URL
        await page.goto(url, { waitUntil: 'networkidle2' });

        // 等待頁面載入
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 獲取JSON內容
        const jsonContent = await page.evaluate(() => {
            // 檢查是否是JSON格式的頁面
            const preElement = document.querySelector('pre');
            if (preElement) {
                return preElement.textContent;
            }

            // 如果不是pre標籤，嘗試獲取body的內容
            const bodyText = document.body.textContent || document.body.innerText;
            return bodyText;
        });

        if (!jsonContent) {
            throw new Error('無法獲取JSON內容');
        }

        // 解析JSON
        const data = JSON.parse(jsonContent);
        console.log(`✅ 成功抓取，找到 ${data.data?.children?.length || 0} 篇文章`);

        return data;
    } finally {
        await browser.close();
    }
}

async function saveJsonData(data: any, filename: string, description: string): Promise<void> {
    try {
        // 確保data目錄存在
        const dataDir = 'data';
        if (!fs.existsSync(dataDir)) {
            await fsPromises.mkdir(dataDir, { recursive: true });
        }

        // 加上抓取時間和統計資訊
        const outputData = {
            updated: new Date().toISOString(),
            source: description,
            total_posts: data.data?.children?.length || 0,
            original_data: data,
        };

        await fsPromises.writeFile(filename, JSON.stringify(outputData, null, 2), 'utf8');
        console.log(`💾 已保存到: ${filename}`);
    } catch (error) {
        console.error(`❌ 保存失敗: ${error}`);
        throw error;
    }
}

async function main(): Promise<void> {
    console.log('🚀 開始抓取Reddit JSON資料...');
    console.log(`📋 總共要抓取 ${redditUrls.length} 個來源`);

    const results = [];

    for (const { url, filename, description } of redditUrls) {
        try {
            console.log(`\n--- 處理: ${description} ---`);

            const data = await fetchRedditDataWithPuppeteer(url);
            await saveJsonData(data, filename, description);

            results.push({
                description,
                filename,
                status: 'success',
                posts: data.data?.children?.length || 0,
            });

            // 稍微延遲避免請求過於頻繁
            await new Promise((resolve) => setTimeout(resolve, 3000));
        } catch (error) {
            console.error(`❌ 處理 ${description} 時發生錯誤:`, error);
            results.push({
                description,
                filename,
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }

    console.log('\n📊 抓取結果摘要:');
    results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.description}`);
        console.log(`   狀態: ${result.status === 'success' ? '✅ 成功' : '❌ 失敗'}`);
        if (result.status === 'success') {
            console.log(`   文章數: ${result.posts}`);
            console.log(`   檔案: ${result.filename}`);
        } else {
            console.log(`   錯誤: ${result.error}`);
        }
        console.log('');
    });

    const successCount = results.filter((r) => r.status === 'success').length;
    console.log(`🎯 完成! 成功抓取 ${successCount}/${results.length} 個來源`);
}

// 執行主程式
main().catch(console.error);
