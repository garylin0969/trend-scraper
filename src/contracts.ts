/** 公開 JSON 契約：同時提供執行時驗證與 TypeScript 型別，供其他專案穩定讀取。 */
import { z } from 'zod';

// /data 是其他專案的固定入口：欄位名稱、型別與檔名不得任意更改。
// strictObject 會拒絕未登記欄位，避免重構時不小心改變輸出介面。
const text = z.string();
const nonempty = text.min(1);
const timestamp = z.iso.datetime();
// BBC 文章：日期可為 ISO UTC 或空字串；來源沒有縮圖時省略 thumbnail。
export const bbcTrendSchema = z.strictObject({
    title: nonempty,
    description: text,
    link: z.url(),
    pubDate: z.union([timestamp, z.literal('')]),
    guid: text,
    thumbnail: text.optional(),
});
// 搜尋量與相對時間保留原始字串，例如「2,000+」與「3 小時前」。
export const googleTrendSchema = z.strictObject({
    googleTrend: nonempty,
    searchVolume: nonempty,
    started: nonempty,
});
// Komica 只有回覆數是數字；日期、時間與原始列文字維持既有字串格式。
export const komicaTrendSchema = z.strictObject({
    replyCount: z.number().int().nonnegative(),
    date: nonempty,
    time: nonempty,
    title: text,
    description: text,
    link: z.url(),
    rawText: nonempty,
});
// PTT 推文數與回應數雖然看似數字，公開介面仍使用字串；連結也保留相對路徑。
export const pttArticleSchema = z.strictObject({
    recommendScore: text,
    recommendCount: text,
    title: nonempty,
    link: nonempty,
    author: text,
    board: text,
    publishTime: text,
    imageUrl: text,
});
// 來源白名單同時供 CLI 參數檢查與型別推導使用。
export const sourceNames = ['bbc', 'google', 'komica', 'ptt'] as const;
export type SourceName = (typeof sourceNames)[number];
// 完整檔案的頂層結構；清單至少一筆，才能避免空資料覆蓋上次成功的檔案。
export const feedSchemas = {
    bbc: z.strictObject({
        updated: timestamp,
        channel: z.strictObject({
            title: text.optional(),
            description: text.optional(),
            link: text.optional(),
            lastBuildDate: z.union([timestamp, z.literal('')]),
            language: text.optional(),
            copyright: text.optional(),
        }),
        trends: z.array(bbcTrendSchema).min(1),
    }),
    google: z.strictObject({ updated: timestamp, trends: z.array(googleTrendSchema).min(1) }),
    komica: z.strictObject({ updated: timestamp, trends: z.array(komicaTrendSchema).min(1) }),
    ptt: z
        .strictObject({
            updated: timestamp,
            total_found: z.number().int().positive().max(20),
            returned_count: z.number().int().positive().max(20),
            articles: z.array(pttArticleSchema).min(1).max(20),
        })
        // 舊版兩個計數欄位都代表實際輸出的文章數，必須與 articles 一致。
        .refine(
            (feed) =>
                feed.total_found === feed.articles.length && feed.returned_count === feed.articles.length,
            'PTT counts must match the published articles',
        ),
};
// 型別直接由 schema 推導，避免驗證規則與手寫介面各自變動而失去同步。
export type BBCTrend = z.infer<typeof bbcTrendSchema>;
export type GoogleTrend = z.infer<typeof googleTrendSchema>;
export type KomicaTrend = z.infer<typeof komicaTrendSchema>;
export type PttArticle = z.infer<typeof pttArticleSchema>;
export type FeedMap = { [K in SourceName]: z.infer<(typeof feedSchemas)[K]> };
// 公開檔名固定，新增來源應在此登記，不能因內部檔案搬移而改名。
export const filenames: Record<SourceName, string> = {
    bbc: 'bbc-trends.json',
    google: 'google-trends.json',
    komica: 'komica-trends.json',
    ptt: 'ptt-trends.json',
};
