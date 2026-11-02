import { KomicaTrend } from '../types';
import { URLS } from '../config/constants';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { createBrowser, configurePage } from '../utils/browser';

/**
 * Komica (K島) 綜合版熱門討論串爬蟲
 *
 * 功能：
 * 1. 訪問 Komica 綜合版目錄頁面。
 * 2. 優先解析 Today 區塊，沒有資料時改用 All 區塊。
 * 3. 解析純文字格式的列表，提取討論串資訊 (回覆數、標題、內文摘要等)。
 * 4. 儲存為 JSON 檔案。
 */
(async () => {
    let browser;
    try {
        browser = await createBrowser();
        const page = await browser.newPage();

        await configurePage(page);

        logger.info('載入網頁...');
        // 設定較長的 timeout，因應 K島有時連線較慢
        await page.goto(URLS.KOMICA_CATLIST, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        try {
            await page.waitForSelector('pre', { timeout: 10000 });
            logger.success('找到 pre 標籤');
        } catch (error) {
            logger.warn('等待 pre 元素載入超時');
        }

        const { trends, source } = await page.evaluate(() => {
            const preElements = Array.from(document.querySelectorAll('pre'));

            for (const source of ['Today', 'All'] as const) {
                const heading = `Top 50 Threads [${source}]`;
                const threadsPre = preElements.find((pre) =>
                    (pre.textContent || '').includes(heading)
                );
                if (!threadsPre) continue;

                const innerHTML = threadsPre.innerHTML;

                // 分割成行
                const lines = innerHTML.split('\n');

                const trends: KomicaTrend[] = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();

                    if (!line) continue;

                    // 檢查是否包含連結
                    const linkMatch = line.match(/href="([^"]+)"/);
                    if (linkMatch) {
                        const link = linkMatch[1];
                        let rawText = line.replace(/<[^>]*>/g, '');

                        if (rawText.includes(heading)) {
                            rawText = rawText.replace(heading, '').trim();
                        }

                        if (rawText) {
                            // 解析 K島特有的分隔格式
                            const parts = rawText.split('|');

                            if (parts.length >= 6) {
                                const replyCount = parseInt(parts[0].trim()) || 0;
                                const date = parts[2].trim();
                                const time = parts[3].trim();
                                const title = parts[4].trim();
                                const description = parts[5].trim();

                                trends.push({
                                    replyCount,
                                    date,
                                    time,
                                    title,
                                    description,
                                    link,
                                    rawText,
                                });
                            }
                        }
                    }
                }

                if (trends.length > 0) {
                    return { trends, source };
                }
            }

            return { trends: [] as KomicaTrend[], source: null };
        });

        await browser.close();
        browser = null;

        if (trends.length === 0) {
            throw new Error('Today 與 All 都沒有找到趨勢資料，保留既有資料');
        }

        if (source === 'All') {
            logger.warn('Today 沒有可用資料，改用 All');
        }
        logger.info(`使用 ${source} 趨勢資料`);
        saveData('komica-trends.json', { trends });

        logger.success('擷取完成');
        logger.result(`總共找到 ${trends.length} 個趨勢`);

        console.log('\n📋 前 3 篇文章範例：');
        trends.slice(0, 3).forEach((trend, index) => {
            console.log(`${index + 1}. 留言數：${trend.replyCount}`);
            console.log(`   日期：${trend.date} ${trend.time}`);
            console.log(`   標題：${trend.title}`);
            console.log(`   內文：${trend.description}`);
            console.log(`   連結：${trend.link}`);
            console.log('');
        });
    } catch (error) {
        logger.error('爬取失敗:', error);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
})();
