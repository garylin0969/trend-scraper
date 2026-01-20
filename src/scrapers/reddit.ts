import { RedditPost, RedditData } from '../types';
import { URLS } from '../config/constants';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { sleep } from '../utils/common';
import { createBrowser, configurePage } from '../utils/browser';

/**
 * Reddit 爬取目標設定
 */
interface RedditTarget {
    url: string;
    filename: string;
    description: string;
}

/**
 * Reddit 爬取目標列表
 */
const redditTargets: RedditTarget[] = [
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
 * 將 Reddit API 原始資料轉換為標準化格式
 *
 * @param {any} rawData - Reddit API 回傳的原始資料
 * @returns {RedditPost[]} 標準化後的貼文列表
 */
function parseRedditPosts(rawData: any): RedditPost[] {
    const children = rawData?.data?.children || [];

    return children.map((child: any) => {
        const post = child.data;
        return {
            id: post.id || '',
            title: post.title || '',
            author: post.author || '',
            subreddit: post.subreddit || '',
            score: post.score || 0,
            upvoteRatio: post.upvote_ratio || 0,
            numComments: post.num_comments || 0,
            permalink: `https://www.reddit.com${post.permalink || ''}`,
            url: post.url || '',
            createdUtc: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : '',
            thumbnail:
                post.thumbnail && !['self', 'default', 'nsfw'].includes(post.thumbnail) ? post.thumbnail : undefined,
            isVideo: post.is_video || false,
            isOriginalContent: post.is_original_content || false,
        };
    });
}

/**
 * 使用 Puppeteer 抓取 Reddit JSON API
 *
 * 透過真實瀏覽器模擬來繞過 Reddit 的阻擋機制。
 *
 * @param {import('puppeteer').Page} page - Puppeteer 頁面物件
 * @param {string} url - 目標 Reddit JSON URL
 * @returns {Promise<any>} 解析後的 JSON 資料
 */
async function fetchRedditData(page: import('puppeteer').Page, url: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            logger.info(`正在抓取: ${url} (嘗試 ${attempt}/${MAX_RETRIES})`);

            // 使用 Puppeteer 導航到 Reddit JSON URL
            const response = await page.goto(url, {
                waitUntil: 'networkidle0',
                timeout: 30000,
            });

            if (!response) {
                throw new Error('無法取得回應');
            }

            const status = response.status();
            if (status !== 200) {
                throw new Error(`HTTP ${status}: ${response.statusText()}`);
            }

            // 取得頁面內容並解析 JSON
            const content = await page.content();

            // 嘗試從 <pre> 標籤中提取 JSON (瀏覽器可能會將 JSON 包裝在 pre 中)
            const jsonMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            let jsonText = '';

            if (jsonMatch) {
                // 解碼 HTML entities
                jsonText = jsonMatch[1]
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
            } else {
                // 如果沒有 pre 標籤，嘗試直接從 body 取得
                jsonText = await page.evaluate(() => document.body.innerText);
            }

            if (!jsonText.trim().startsWith('{')) {
                throw new Error('回應不是有效的 JSON 格式');
            }

            const data = JSON.parse(jsonText);
            logger.success(`成功抓取 ${url}`);
            return data;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            logger.warn(`嘗試 ${attempt} 失敗: ${lastError.message}`);

            if (attempt < MAX_RETRIES) {
                logger.info(`等待 ${RETRY_DELAY / 1000} 秒後重試...`);
                await sleep(RETRY_DELAY);
            }
        }
    }

    throw lastError || new Error('抓取失敗，已達最大重試次數');
}

/**
 * Reddit 整合爬蟲
 *
 * 功能：
 * 1. 使用 Puppeteer 模擬真實瀏覽器行為。
 * 2. 依序爬取定義在 redditTargets 中的所有來源。
 * 3. 使用 old.reddit.com JSON API 取得熱門文章。
 * 4. 將資料標準化並儲存為 JSON 檔案。
 */
(async () => {
    logger.start('正在爬取 Reddit JSON 資料...');

    let browser;
    let successCount = 0;

    try {
        browser = await createBrowser();
        const page = await browser.newPage();

        await configurePage(page);

        // 隨機延遲 2~5 秒，模擬人類行為
        const randomDelay = Math.floor(Math.random() * 3000) + 2000;
        logger.info(`隨機延遲 ${randomDelay} 毫秒...`);
        await sleep(randomDelay);

        for (const { url, filename, description } of redditTargets) {
            try {
                logger.info(`處理 ${description}...`);
                const rawData = await fetchRedditData(page, url);
                const posts = parseRedditPosts(rawData);

                const outputData: RedditData = {
                    updated: new Date().toISOString(),
                    source: description,
                    total_posts: posts.length,
                    posts,
                };

                saveData(filename, outputData);
                successCount++;
                logger.success(`${description}: 成功抓取 ${posts.length} 篇文章`);

                // 每次請求間隔，避免被限流 (2~4 秒)
                const interval = 2000 + Math.random() * 2000;
                logger.info(`等待 ${Math.round(interval / 1000)} 秒後繼續...`);
                await sleep(interval);
            } catch (error) {
                logger.error(`處理 ${description} 時發生錯誤:`, error);
            }
        }

        await browser.close();
        browser = null;
    } catch (error) {
        logger.error('瀏覽器初始化失敗:', error);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }

    if (successCount === 0) {
        logger.error('所有來源都抓取失敗');
        process.exit(1);
    }

    logger.success('爬取完成');
    logger.result(`成功抓取 ${successCount}/${redditTargets.length} 個來源`);
})();
