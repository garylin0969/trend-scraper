/** Google 收集器：瀏覽器負責載入動態表格，Cheerio 負責解析已取得的 HTML。 */
import { load } from 'cheerio';
import { URLS } from '../config.js';
import { type FeedMap, type GoogleTrend } from '../contracts.js';
import { navigate, withBrowser } from '../core/browser.js';

/** 從已載入的 HTML 取出熱搜表格；不啟動瀏覽器、不存檔。 */
export function parseGoogle(html: string): GoogleTrend[] {
    const $ = load(html);
    const trends: GoogleTrend[] = [];
    const seen = new Set<string>();
    // 依頁面順序解析；欄位不足代表骨架或其他無法使用的資料列。
    for (const row of $('tbody tr').toArray()) {
        const cells = $(row).find('td');
        if (cells.length < 4) continue;
        // 第二欄包含趨勢名稱與狀態標籤，排除「活躍」等非名稱文字。
        const googleTrend = cells
            .eq(1)
            .find('div')
            .toArray()
            .map((div) => $(div).text().trim())
            .find((text) => text && !/次搜尋|活躍|持續時間|·/.test(text));
        // 第三、四欄保留原本的搜尋量及繁中相對時間，避免改變消費端格式。
        const searchVolume = cells
            .eq(2)
            .text()
            .match(/\d[\d,]*\+/)?.[0];
        const started = cells
            .eq(3)
            .text()
            .match(/\d+\s*(?:小時|分鐘)前/)?.[0];
        // 必要欄位齊全才收錄，並以趨勢名稱去重；不重新排序。
        if (googleTrend && searchVolume && started && !seen.has(googleTrend)) {
            seen.add(googleTrend);
            trends.push({ googleTrend, searchVolume, started });
        }
    }
    return trends;
}
/** 使用瀏覽器載入動態資料，確認有效資料出現後才交給解析器。 */
export async function scrapeGoogle(): Promise<FeedMap['google']> {
    return withBrowser('google', async (page) => {
        await navigate(page, URLS.google);
        // 等待實際搜尋量與時間出現，避免表格骨架先載入就過早解析。
        await page.waitForFunction(() =>
            Array.from(document.querySelectorAll('tbody tr')).some((row) => {
                const cells = row.querySelectorAll('td');
                return (
                    cells.length >= 4 &&
                    /\d[\d,]*\+/.test(cells[2]?.textContent || '') &&
                    /\d+\s*(?:小時|分鐘)前/.test(cells[3]?.textContent || '')
                );
            }),
        );
        const trends = parseGoogle(await page.content());
        // 有表格卻沒有有效資料也必須失敗，讓共用流程重試並保留舊檔。
        if (!trends.length) throw new Error('Google table contains no usable trends');
        return { updated: new Date().toISOString(), trends };
    });
}
