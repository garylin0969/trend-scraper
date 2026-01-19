import { GoogleTrend } from '../types';
import { URLS } from '../config/constants';
import { sleep } from '../utils/common';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { createBrowser, configurePage } from '../utils/browser';

/**
 * Google 搜尋趨勢爬蟲腳本
 *
 * 功能：
 * 1. 使用 Puppeteer 開啟 Google Trends 台灣頁面。
 * 2. 模擬真實使用者行為 (隨機延遲)。
 * 3. 解析頁面中的表格資料，提取關鍵字、搜尋量和開始時間。
 * 4. 儲存資料為 JSON。
 */
(async () => {
    let browser;
    try {
        browser = await createBrowser();
        const page = await browser.newPage();

        await configurePage(page);

        // 隨機延遲 3~13 秒，避免行為模式一致
        const randomDelay = Math.floor(Math.random() * 10000) + 3000;
        logger.info(`隨機延遲 ${randomDelay} 毫秒...`);
        await sleep(randomDelay);

        await page.goto(URLS.GOOGLE_TRENDS, {
            waitUntil: 'domcontentloaded',
        });

        // 再次隨機延遲，模擬人類閱讀反應
        const postLoadDelay = Math.floor(Math.random() * 5000) + 3000;
        logger.info(`頁面載入後額外延遲 ${postLoadDelay} 毫秒...`);
        await sleep(postLoadDelay);

        try {
            await page.waitForSelector('td', { timeout: 10000 });
        } catch (error) {
            logger.warn('等待元素載入超時');
        }

        // 在瀏覽器環境中執行爬取邏輯
        const trends: GoogleTrend[] = await page.evaluate(() => {
            const allRows = Array.from(document.querySelectorAll('tbody tr'));
            // 過濾出有效的資料列
            const dataRows = allRows.filter((row) => {
                const cells = row.querySelectorAll('td');
                return cells.length > 3;
            });

            const tableData = dataRows
                .map((row) => {
                    const cells = Array.from(row.querySelectorAll('td'));
                    const trendCell = cells[1];
                    const countCell = cells[2];
                    const timeCell = cells[3];

                    if (trendCell && countCell && timeCell) {
                        // 提取趨勢關鍵字
                        const trendDivs = Array.from(trendCell.querySelectorAll('div'));
                        let trendText = '';
                        for (const div of trendDivs) {
                            const text = div.textContent?.trim() || '';
                            if (
                                text &&
                                !text.includes('次搜尋') &&
                                !text.includes('活躍') &&
                                !text.includes('持續時間') &&
                                !text.includes('·')
                            ) {
                                trendText = text;
                                break;
                            }
                        }

                        // 提取搜尋量
                        const countCellText = countCell.textContent?.trim() || '';
                        const countMatches = countCellText.match(/(\d+[\d,]*\+)/g) || [];
                        const searchCount = countMatches.find((match) => match.match(/^\d+[\d,]*\+$/)) || '';

                        // 提取時間
                        const timeCellText = timeCell.textContent?.trim() || '';
                        const timeMatch = timeCellText.match(/(\d+\s*[小時分鐘]+前)/);
                        const startTime = timeMatch ? timeMatch[1] : '';

                        if (trendText && searchCount && startTime) {
                            return {
                                googleTrend: trendText,
                                searchVolume: searchCount,
                                started: startTime,
                            } as any; // Cast to any to avoid TS issues inside evaluate
                        }
                    }
                    return null;
                })
                .filter((row) => row !== null);

            return tableData;
        });

        await browser.close();
        browser = null;

        saveData('google-trends.json', { trends });

        logger.success('擷取完成');
        logger.result(`總共找到 ${trends.length} 個趨勢`);

        // Log first few items
        console.log(trends.slice(0, 5));

        // 如果沒有找到任何趨勢，視為失敗
        if (trends.length === 0) {
            logger.error('沒有找到任何趨勢資料');
            process.exit(1);
        }
    } catch (error) {
        logger.error('爬取失敗:', error);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
})();
