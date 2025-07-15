import Parser from 'rss-parser';
import fs from 'fs';

interface BBCTrend {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    guid: string;
    thumbnail?: string;
}

(async () => {
    const parser = new Parser({
        customFields: {
            item: [['media:thumbnail', 'thumbnail', { keepArray: false }]],
        },
    });

    console.log('⏳ 正在爬取BBC Chinese RSS feed...');

    try {
        const feed = await parser.parseURL('https://feeds.bbci.co.uk/zhongwen/trad/rss.xml');

        console.log('✅ RSS feed 載入完成');
        console.log(`📰 頻道標題: ${feed.title}`);
        console.log(`📝 頻道描述: ${feed.description}`);
        console.log(`🔗 頻道連結: ${feed.link}`);
        console.log(`📅 最後更新: ${feed.lastBuildDate ? new Date(feed.lastBuildDate).toISOString() : ''}`);

        const trends: BBCTrend[] = [];

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

        // 儲存到data目錄
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

        fs.writeFileSync('data/bbc-trends.json', JSON.stringify(outputData, null, 2), 'utf8');

        console.log('✅ 爬取完成');
        console.log(`📊 總共找到 ${trends.length} 篇文章`);

        if (trends.length > 0) {
            console.log('\n📋 前 3 篇文章範例：');
            trends.slice(0, 3).forEach((trend, index) => {
                console.log(`${index + 1}. 標題：${trend.title}`);
                console.log(
                    `   描述：${trend.description.substring(0, 100)}${trend.description.length > 100 ? '...' : ''}`
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
        console.error('❌ 爬取失敗:', error);
    }
})();
