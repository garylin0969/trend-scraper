/** BBC 收集器：透過 HTTP 取得 RSS，再轉成既有的頻道與新聞資料格式。 */
import Parser from 'rss-parser';
import { URLS } from '../config.js';
import { type FeedMap } from '../contracts.js';
import { fetchText } from '../core/http.js';

// rss-parser 將 XML 屬性放在 $ 物件內，縮圖網址因此位於 thumbnail.$.url。
type ThumbnailItem = { thumbnail?: { $?: { url?: string } } };
/** 純解析函式：不連外、不寫檔，方便使用固定 RSS 樣本測試。 */
export async function parseBbc(xml: string): Promise<Omit<FeedMap['bbc'], 'updated'>> {
    const parser = new Parser<Record<string, never>, ThumbnailItem>({
        // 額外取出 media:thumbnail，保留舊版公開資料中的選用縮圖欄位。
        customFields: { item: [['media:thumbnail', 'thumbnail', { keepArray: false }]] },
    });
    const feed = await parser.parseString(xml);
    return {
        // 來源未提供的選用欄位維持省略，不補成 null 或空字串，以保留舊版行為。
        channel: {
            ...(feed.title !== undefined && { title: feed.title }),
            ...(feed.description !== undefined && { description: feed.description }),
            ...(feed.link !== undefined && { link: feed.link }),
            lastBuildDate: feed.lastBuildDate ? new Date(feed.lastBuildDate).toISOString() : '',
            ...(feed.language !== undefined && { language: feed.language }),
            ...(feed.copyright !== undefined && { copyright: feed.copyright }),
        },
        // 每篇文章轉為公開格式；發布時間轉成 ISO UTC，沒有日期時使用空字串。
        trends: feed.items.map((item) => ({
            title: item.title || '',
            description: item.content || item.contentSnippet || '',
            link: item.link || '',
            pubDate: item.pubDate ? new Date(item.pubDate).toISOString() : '',
            guid: item.guid || '',
            ...(item.thumbnail?.$?.url !== undefined && { thumbnail: item.thumbnail.$.url }),
        })),
    };
}
/** 網路收集入口：取得 RSS 後解析，最後附上本次收集成功的時間。 */
export async function scrapeBbc(): Promise<FeedMap['bbc']> {
    const feed = await parseBbc(await fetchText(URLS.bbc));
    return { updated: new Date().toISOString(), ...feed };
}
