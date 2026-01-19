import puppeteer from 'puppeteer';
import { URLS } from '../config/constants';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { createBrowser, configurePage } from '../utils/browser';
import { sleep } from '../utils/common';

interface RedditUrl {
    url: string;
    filename: string;
    description: string;
}

/**
 * Reddit 爬取目標列表
 */
const redditUrls: RedditUrl[] = [
    {
        url: URLS.REDDIT_ALL,
        filename: 'reddit-all-hot.json',
        description: 'Reddit r/all 熱門文章',
    },
    {
        url: URLS.REDDIT_TAIWANESE,
        filename: 'reddit-taiwanese-hot.json',
        description: 'Reddit r/Taiwanese 熱門文章',
    },
    {
        url: URLS.REDDIT_CHINA_IRL,
        filename: 'reddit-china-irl-hot.json',
        description: 'Reddit r/China_irl 熱門文章',
    },
];

/**
 * 使用 Puppeteer 抓取 Reddit 的 JSON API
 * 
 * 注意：Reddit API 有時會擋一般的 fetch 請求，
 * 這裡使用 Puppeteer 模擬瀏覽器訪問來繞過簡單的機器人驗證。
 * 
 * @param {string} url - 目標 Reddit JSON URL
 * @returns {Promise<any>} 解析後的 JSON 資料
 */
async function fetchRedditDataWithPuppeteer(url: string): Promise<any> {
    const browser = await createBrowser();

    try {
        const page = await browser.newPage();
        await configurePage(page);

        logger.info(`正在抓取: ${url}`);

        await page.goto(url, { waitUntil: 'networkidle2' });
        await sleep(2000);

        // 提取頁面內容 (瀏覽器會直接顯示 JSON 字串)
        const jsonContent = await page.evaluate(() => {
            const preElement = document.querySelector('pre');
            if (preElement) {
                return preElement.textContent;
            }
            const bodyText = document.body.textContent || document.body.innerText;
            return bodyText;
        });

        if (!jsonContent) {
            throw new Error('無法獲取JSON內容');
        }

        const data = JSON.parse(jsonContent);
        logger.success(`成功抓取，找到 ${data.data?.children?.length || 0} 篇文章`);

        return data;
    } finally {
        await browser.close();
    }
}

/**
 * Reddit 整合爬蟲主程式
 * 依序爬取定義在 redditUrls 中的所有來源。
 */
async function main(): Promise<void> {
    logger.start('開始抓取Reddit JSON資料...');
    logger.info(`總共要抓取 ${redditUrls.length} 個來源`);

    const results = [];

    for (const { url, filename, description } of redditUrls) {
        try {
            console.log(`
--- 處理: ${description} ---
`);

            const data = await fetchRedditDataWithPuppeteer(url);
            
            // 格式化輸出資料
            const outputData = {
                source: description,
                total_posts: data.data?.children?.length || 0,
                original_data: data,
            };
            
            saveData(filename, outputData);

            results.push({
                description,
                filename,
                status: 'success',
                posts: data.data?.children?.length || 0,
            });

            await sleep(3000);
        } catch (error) {
            logger.error(`處理 ${description} 時發生錯誤:`, error);
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
    logger.result(`完成! 成功抓取 ${successCount}/${results.length} 個來源`);
}

main().catch(error => logger.error('Main error', error));