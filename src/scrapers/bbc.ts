import Parser from 'rss-parser';
import { BBCTrend } from '../types';
import { URLS } from '../config/constants';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';

/**
 * BBC 中文網 RSS 爬蟲腳本
 *
 * 功能：
 * 1. 讀取 BBC 中文網的 RSS Feed。
 * 2. 解析 RSS XML 內容，提取新聞標題、描述、連結、發布時間和縮圖。
 * 3. 將資料標準化並儲存為 JSON 檔案。
 */
(async () => {
    // 初始化 RSS Parser，自定義提取 thumbnail 欄位
    const parser = new Parser({
        customFields: {
            item: [['media:thumbnail', 'thumbnail', { keepArray: false }]],
        },
    });

    logger.start('正在爬取BBC Chinese RSS feed...');

    try {
        const feed = await parser.parseURL(URLS.BBC_RSS);

        logger.success('RSS feed 載入完成');
        logger.info(`頻道標題: ${feed.title}`);
        logger.info(`頻道描述: ${feed.description}`);
        logger.info(`頻道連結: ${feed.link}`);
        logger.info(`最後更新: ${feed.lastBuildDate ? new Date(feed.lastBuildDate).toISOString() : ''}`);

        const trends: BBCTrend[] = [];

        // 遍歷所有 RSS 項目
        for (const item of feed.items) {
            const trend: BBCTrend = {
                title: item.title || '',
                description: item.content || item.contentSnippet || '',
                link: item.link || '',
                pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : '',
                guid: item.guid || '',
                thumbnail: item.thumbnail?.$ ? item.thumbnail.$.url : undefined,
            };

            trends.push(trend);
        }

        // 構建輸出資料結構
        const outputData = {
            updated: new Date().toISOString(),
            channel: {
                title: feed.title,
                description: feed.description,
                link: feed.link,
                lastBuildDate: feed.lastBuildDate ? new Date(feed.lastBuildDate).toISOString() : '',
                language: feed.language,
                copyright: feed.copyright,
            },
            trends,
        };

        saveData('bbc-trends.json', outputData);

        logger.success('爬取完成');
        logger.result(`總共找到 ${trends.length} 篇文章`);

        // 顯示前 3 篇文章作為範例
        if (trends.length > 0) {
            console.log('\n📋 前 3 篇文章範例：');
            trends.slice(0, 3).forEach((trend, index) => {
                console.log(`${index + 1}. 標題：${trend.title}`);
                console.log(
                    `   描述：${trend.description.substring(0, 100)}${trend.description.length > 100 ? '...' : ''}`,
                );
                console.log(`   連結：${trend.link}`);
                console.log(`   發布時間：${trend.pubDate}`);
                if (trend.thumbnail) {
                    console.log(`   縮圖：${trend.thumbnail}`);
                }
                console.log('');
            });
        }
    } catch (error) {
        logger.error('爬取失敗:', error);
        process.exit(1);
    }
})();
