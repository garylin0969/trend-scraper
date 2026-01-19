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

const MAX_RETRIES = 3;
const RETRY_DELAY = 5000;

/**
 * 使用 Puppeteer 抓取 Reddit 的 JSON API
 *
 * 注意：Reddit API 有時會擋一般的 fetch 請求，
 * 這裡使用 Puppeteer 模擬瀏覽器訪問來繞過簡單的機器人驗證。
 * 在 CI 環境中可能會被 Reddit 阻擋，會進行多次重試。
 *
 * @param {string} url - 目標 Reddit JSON URL
 * @returns {Promise<any>} 解析後的 JSON 資料
 */
async function fetchRedditDataWithPuppeteer(url: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        const browser = await createBrowser();

        try {
            const page = await browser.newPage();
            await configurePage(page);

            if (attempt > 1) {
                logger.info(`第 ${attempt}/${MAX_RETRIES} 次嘗試抓取: ${url}`);
            } else {
                logger.info(`正在抓取: ${url}`);
            }

            // 設定更長的超時和更自然的訪問模式
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000,
            });

            // 等待更長時間，讓頁面完全載入
            await sleep(3000 + Math.random() * 2000);

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

            // 檢查是否收到 HTML 而非 JSON (Reddit 阻擋頁面)
            if (
                jsonContent.includes('<!DOCTYPE') ||
                jsonContent.includes('<html') ||
                jsonContent.includes('.theme-') ||
                jsonContent.includes('cdn.reddit')
            ) {
                throw new Error('Reddit 返回了 HTML 頁面而非 JSON，可能被阻擋或需要驗證');
            }

            const data = JSON.parse(jsonContent);
            logger.success(`成功抓取，找到 ${data.data?.children?.length || 0} 篇文章`);

            return data;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            logger.warn(`嘗試 ${attempt}/${MAX_RETRIES} 失敗: ${lastError.message}`);

            if (attempt < MAX_RETRIES) {
                logger.info(`等待 ${RETRY_DELAY / 1000} 秒後重試...`);
                await sleep(RETRY_DELAY);
            }
        } finally {
            await browser.close();
        }
    }

    throw lastError || new Error('抓取失敗，已達最大重試次數');
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

    // 如果全部失敗，則以非零退出碼結束，讓 CI 知道失敗
    if (successCount === 0) {
        logger.error('所有來源都抓取失敗，請檢查 Reddit 是否阻擋了請求');
        process.exit(1);
    }
}

main().catch((error) => {
    logger.error('Main error', error);
    process.exit(1);
});
