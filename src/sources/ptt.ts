/** PTT 收集器：解析熱門文章、必要時補充滾動，依頁面順序保留最多 20 篇不重複文章。 */
import { load } from 'cheerio';
import { URLS } from '../config.js';
import { type FeedMap, type PttArticle } from '../contracts.js';
import { navigate, withBrowser } from '../core/browser.js';
import { log } from '../core/logger.js';

/** 依 HTML 順序解析文章，保留相對連結及字串計數，方便離線測試。 */
export function parsePtt(html: string): PttArticle[] {
    const $ = load(html);
    let containers = $('.e7-container').toArray();
    if (!containers.length) {
        // 正式容器找不到時，從文章連結向上尋找最近的推文容器，避免把整頁當成文章。
        const candidates = $('a[href*="/bbs/"]')
            .toArray()
            .map((anchor) =>
                $(anchor)
                    .parents('div')
                    .toArray()
                    .find(
                        (div) =>
                            $(div).find('.e7-recommendScore, [e7description="推文:"], [class*="recommend"]')
                                .length,
                    ),
            );
        containers = [...new Set(candidates.filter((div) => div !== undefined))];
    }
    const articles: PttArticle[] = [];
    const seen = new Set<string>();
    for (const element of containers) {
        const container = $(element);
        const titleLink = container.find('a[href*="/bbs/"]').first();
        const link = titleLink.attr('href') || '';
        // 桌面標題優先，其次手機標題，最後使用連結文字的第一個有效行。
        const title =
            titleLink.find('.e7-show-if-device-is-not-xs').first().text().trim() ||
            titleLink.find('.e7-show-if-device-is-xs').first().text().trim() ||
            titleLink
                .text()
                .trim()
                .split('\n')
                .map((line) => line.trim())
                .find(Boolean) ||
            '';
        if (!link || !title || seen.has(link)) continue;
        // 優先使用專用 class，再找推文／回應圖示的父元素，最後使用相似 class 備援。
        // 推文數允許負值；缺少資訊時仍依舊版格式回傳字串「0」。
        const metric = (name: 'Score' | 'Count', label: string): string => {
            const direct = container.find(`.e7-recommend${name}`).first();
            const icon = container.find(`[e7description="${label}:"]`).first();
            const value = direct.length
                ? direct.text()
                : icon.length
                  ? icon.parent().text()
                  : container.find(`[class*="recommend"][class*="${name}"]`).first().text();
            return value.match(name === 'Score' ? /-?\d+/ : /\d+/)?.[0] || '0';
        };
        // 作者可從顯示文字或 /user/ 路徑取得；看板可從標籤或文章網址取得。
        const authorLink = container.find('a[href*="/user/"]').first();
        const boardText =
            container.find('.e7-boardName .e7-link-to-article').first().text().trim() ||
            container.find('.e7-boardName, [class*="boardName"]').first().text().trim();
        // 只接受既有的 YYYY/MM/DD HH:mm 字串；找不到時維持空字串。
        const publishTime =
            container
                .find('.e7-grey-text, .text-no-wrap')
                .toArray()
                .map(
                    (time) =>
                        $(time)
                            .text()
                            .match(/\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}/)?.[0],
                )
                .find(Boolean) || '';
        articles.push({
            recommendScore: metric('Score', '推文'),
            recommendCount: metric('Count', '回應'),
            title,
            link,
            author: authorLink.text().trim() || authorLink.attr('href')?.match(/\/user\/(.+)$/)?.[1] || '',
            board: boardText.replace(/[\[\]]/g, '').trim() || link.match(/\/bbs\/([^/]+)\//)?.[1] || '',
            publishTime,
            imageUrl: container.find('.e7-preview img').first().attr('src') || '',
        });
        // 以連結去重，滿 20 篇即停止，維持來源熱門順序而不額外依分數排序。
        seen.add(link);
        if (articles.length === 20) break;
    }
    return articles;
}
/** 先解析初始畫面，篇數不足才補充滾動；最後保留舊版計數欄位。 */
export async function scrapePtt(): Promise<FeedMap['ptt']> {
    return withBrowser('ptt', async (page) => {
        await navigate(page, URLS.ptt);
        await page.locator('a[href*="/bbs/"]').first().waitFor({ state: 'attached' });
        let articles = parsePtt(await page.content());
        // 每次只捲動 0.8 個畫面，最多八次，避免無限滾動或破壞原始排序。
        for (let attempt = 0; attempt < 8 && articles.length < 20; attempt++) {
            const previous = articles.length;
            const previousLinks = await page.locator('a[href*="/bbs/"]').count();
            await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
            try {
                // 等文章連結數增加，代表可能有新資料；最長等五秒後重新解析。
                await page.waitForFunction(
                    (count) => document.querySelectorAll('a[href*="/bbs/"]').length > count,
                    previousLinks,
                    { timeout: 5_000 },
                );
            } catch (error) {
                // 載入逾時可視為沒有新文章；其他瀏覽器錯誤仍須向上拋出，不能當成正常結束。
                if (!(error instanceof Error) || error.name !== 'TimeoutError') throw error;
            }
            articles = parsePtt(await page.content());
            // 新的有效文章數沒有增加就停止，不繼續反覆等待。
            if (articles.length === previous) break;
        }
        if (!articles.length) throw new Error('PTT page contains no usable articles');
        if (articles.length < 20) log('ptt', `Only ${articles.length} articles available (target: 20)`);
        // 兩個計數欄位都維持「實際輸出篇數」的舊版定義。
        return {
            updated: new Date().toISOString(),
            total_found: articles.length,
            returned_count: articles.length,
            articles,
        };
    });
}
