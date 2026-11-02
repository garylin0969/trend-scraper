/** Komica 收集器：優先使用 HTTP；解析順序固定為 Today 優先、All 備援。 */
import { load } from 'cheerio';
import { URLS } from '../config.js';
import { komicaTrendSchema, type FeedMap, type KomicaTrend } from '../contracts.js';
import { fetchText } from '../core/http.js';
import { navigate, withBrowser } from '../core/browser.js';
import { errorMessage, log } from '../core/logger.js';

/** 純解析函式；source 只供日誌使用，不會加入公開 JSON。 */
export function parseKomica(html: string): { trends: KomicaTrend[]; source: 'Today' | 'All' | null } {
    const $ = load(html);
    // 只有前一個區塊完全沒有有效資料時，才會切換到下一個區塊。
    for (const source of ['Today', 'All'] as const) {
        const heading = `Top 50 Threads [${source}]`;
        // 目錄有多個 pre，需以標題辨識清單，不能直接取頁面第一個 pre。
        const block = $('pre')
            .filter((_, pre) => $(pre).text().includes(heading))
            .first();
        const trends: KomicaTrend[] = [];
        const seen = new Set<string>();
        // 每行是一篇討論串；逐行解析連結，可同時支援單引號與雙引號屬性。
        for (const line of (block.html() || '').split('\n')) {
            const row = load(line);
            const link = row('a[href]').first().attr('href');
            if (!link || !URL.canParse(link, URLS.komica)) continue;
            // 保留舊版 rawText 表示方式，包含 &amp; 等 HTML 實體，不在這裡解碼。
            const rawText = line
                .replace(/<[^>]*>/g, '')
                .replace(heading, '')
                .trim();
            // 原始欄位順序：回覆數｜文章 ID｜日期｜時間｜標題｜摘要｜開啟連結文字。
            const parts = rawText.split('|');
            if (parts.length < 6 || !/^\d+$/.test(parts[0]?.trim() || '')) continue;
            // 單筆格式不符時略過該列，不讓一篇異常資料中斷整份清單。
            const result = komicaTrendSchema.safeParse({
                replyCount: Number(parts[0]?.trim()),
                date: parts[2]?.trim(),
                time: parts[3]?.trim(),
                title: parts[4]?.trim(),
                description: parts[5]?.trim(),
                link: new URL(link, URLS.komica).href,
                rawText,
            });
            if (result.success && !seen.has(result.data.link)) {
                seen.add(result.data.link);
                trends.push(result.data);
            }
        }
        // 依原始熱門順序去重，最多輸出 50 筆；有資料就不再讀取備援區塊。
        if (trends.length) return { trends: trends.slice(0, 50), source };
    }
    return { trends: [], source: null };
}
/** 先嘗試較輕量的 HTTP；回應失敗或無有效資料時，再啟動瀏覽器備援。 */
export async function scrapeKomica(): Promise<FeedMap['komica']> {
    let html: string;
    try {
        html = await fetchText(URLS.komica);
        if (!parseKomica(html).trends.length) throw new Error('HTTP response has no usable threads');
    } catch (error) {
        log('komica', `${errorMessage(error)}; retrying with browser`);
        html = await withBrowser('komica', async (page) => {
            await navigate(page, URLS.komica);
            await page.locator('pre').first().waitFor({ state: 'attached' });
            const content = await page.content();
            if (!parseKomica(content).trends.length) throw new Error('Today and All are both empty');
            return content;
        });
    }
    // 公開輸出仍然只有 updated 與 trends，清單來源只記錄在日誌。
    const { trends, source } = parseKomica(html);
    log('komica', source === 'All' ? 'Today unavailable; using All' : 'Using Today');
    return { updated: new Date().toISOString(), trends };
}
