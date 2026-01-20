import { RedditPost, RedditData } from '../types';
import { URLS, USER_AGENTS } from '../config/constants';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { sleep, getRandomUserAgent } from '../utils/common';

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
 * 使用原生 fetch 抓取 Reddit JSON API
 *
 * 使用 old.reddit.com 搭配適當的 headers 來降低被阻擋的機率。
 *
 * @param {string} url - 目標 Reddit JSON URL
 * @returns {Promise<any>} 解析後的 JSON 資料
 */
async function fetchRedditData(url: string): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': getRandomUserAgent(USER_AGENTS),
                    Accept: 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Accept-Encoding': 'gzip, deflate, br',
                    Connection: 'keep-alive',
                    'Cache-Control': 'no-cache',
                    Pragma: 'no-cache',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const text = await response.text();
                if (text.includes('<!DOCTYPE') || text.includes('<html')) {
                    throw new Error('Reddit 返回了 HTML 頁面而非 JSON，可能被阻擋');
                }
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error('無法解析回應為 JSON');
                }
            }

            return await response.json();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            if (attempt < MAX_RETRIES) {
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
 * 1. 依序爬取定義在 redditTargets 中的所有來源。
 * 2. 使用 old.reddit.com JSON API 取得熱門文章。
 * 3. 將資料標準化並儲存為 JSON 檔案。
 */
(async () => {
    logger.start('正在爬取 Reddit JSON 資料...');

    let successCount = 0;

    for (const { url, filename, description } of redditTargets) {
        try {
            const rawData = await fetchRedditData(url);
            const posts = parseRedditPosts(rawData);

            const outputData: RedditData = {
                updated: new Date().toISOString(),
                source: description,
                total_posts: posts.length,
                posts,
            };

            saveData(filename, outputData);
            successCount++;

            // 每次請求間隔，避免被限流
            await sleep(2000 + Math.random() * 2000);
        } catch (error) {
            logger.error(`處理 ${description} 時發生錯誤:`, error);
        }
    }

    if (successCount === 0) {
        logger.error('所有來源都抓取失敗');
        process.exit(1);
    }

    logger.success('爬取完成');
    logger.result(`成功抓取 ${successCount}/${redditTargets.length} 個來源`);
})();
