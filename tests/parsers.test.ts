/** 離線解析測試：使用 fixtures 中的固定樣本驗證各來源，不依賴外部網站當下狀態。 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { parseKomica } from '../src/sources/komica.js';
import { parseGoogle } from '../src/sources/google.js';
import { parsePtt } from '../src/sources/ptt.js';
import { parseBbc } from '../src/sources/bbc.js';

// 樣本路徑以測試檔位置計算，從任何工作目錄執行都能找到。
const fixture = (name: string) => readFile(new URL(`fixtures/${name}`, import.meta.url), 'utf8');

// Today 空白時應使用 All，同時驗證 rawText 保留舊版 HTML 實體格式。
test('Komica uses All when Today is empty and preserves legacy fields', async () => {
    const result = parseKomica(await fixture('komica.html'));
    assert.equal(result.source, 'All');
    assert.equal(result.trends.length, 2);
    assert.deepEqual(result.trends[0], {
        replyCount: 42,
        date: '2026/11/01',
        time: '12:34',
        title: '標題 &amp; 測試',
        description: '摘要',
        link: 'https://gita.komica1.org/00b/pixmicat.php?res=123',
        rawText: '42|123|2026/11/01|12:34|標題 &amp; 測試|摘要|在新分頁開啟',
    });
});
// 故意把 All 放在前面，證明優先順序來自解析規則，而不是 DOM 出現順序。
test('Komica prioritizes Today regardless of document order', async () => {
    const html = (await fixture('komica.html')).replace('<pre><h1>Top 50 Threads [Today]</h1></pre>', '');
    const today = html.replace('[All]', '[Today]');
    const result = parseKomica(html + today);
    assert.equal(result.source, 'Today');
    assert.equal(result.trends.length, 2);
});
// 分別覆蓋 Today 缺少、資料列損壞，以及兩個清單都無法使用的情況。
test('Komica falls back for missing or malformed Today; rejects empty pages', async () => {
    const html = (await fixture('komica.html')).replace('<pre><h1>Top 50 Threads [Today]</h1></pre>', '');
    assert.equal(parseKomica(html).source, 'All');
    assert.equal(
        parseKomica('<pre>Top 50 Threads [Today]<a href="/invalid">broken</a></pre>' + html).source,
        'All',
    );
    assert.deepEqual(parseKomica('<pre>Top 50 Threads [Today]</pre>'), { trends: [], source: null });
});
// 單筆網址格式錯誤不應中斷整次解析，仍須繼續嘗試 All。
test('Komica skips broken URLs and still uses All', async () => {
    const html = (await fixture('komica.html')).replace(
        '<pre><h1>Top 50 Threads [Today]</h1></pre>',
        '<pre>Top 50 Threads [Today]1|1|2026/11/02|10:00|broken|row|<a href="http://[invalid">open</a></pre>',
    );
    assert.equal(parseKomica(html).source, 'All');
});
// 確認搜尋量的逗號與加號、繁中相對時間都不被轉型，並忽略載入中的空列。
test('Google keeps Chinese relative times and formatted search counts', async () => {
    assert.deepEqual(parseGoogle(await fixture('google.html')), [
        { googleTrend: '搜尋趨勢', searchVolume: '2,000+', started: '3 小時前' },
        { googleTrend: '另一個趨勢', searchVolume: '500+', started: '15 分鐘前' },
    ]);
    assert.deepEqual(parseGoogle('<table><tbody><tr><td>loading</td></tr></tbody></table>'), []);
});
// 驗證桌面標題優先、相對連結、重複文章排除，以及可缺少欄位的預設空值。
test('PTT preserves order, relative URLs, string metrics and optional empty fields', async () => {
    const articles = parsePtt(await fixture('ptt.html'));
    assert.equal(articles.length, 2);
    assert.deepEqual(articles[0], {
        recommendScore: '277',
        recommendCount: '887',
        title: '[新聞] 桌面標題',
        link: '/bbs/Gossiping/M.1.A.AAA',
        author: 'tester',
        board: 'Gossiping',
        publishTime: '2026/11/01 00:54',
        imageUrl: 'https://example.com/1.jpg',
    });
    assert.deepEqual(articles[1], {
        recommendScore: '0',
        recommendCount: '0',
        title: '[討論] 第二篇',
        link: '/bbs/Tech_Job/M.2.A.BBB',
        author: '',
        board: 'Tech_Job',
        publishTime: '',
        imageUrl: '',
    });
});
// 樣本刻意不使用正式容器 class，驗證備援尋找、負推文數與前 20 篇限制。
test('PTT fallback avoids parent duplicates and caps results at 20 in source order', () => {
    const rows = Array.from(
        { length: 25 },
        (_, index) =>
            `<div><span class="e7-recommendScore">${-index}</span><a href="/bbs/Test/${index}">title ${index}</a></div>`,
    ).join('');
    const articles = parsePtt(`<div>${rows}</div>`);
    assert.equal(articles.length, 20);
    assert.equal(articles[1]?.recommendScore, '-1');
    assert.equal(articles[19]?.link, '/bbs/Test/19');
});
// 同時檢查有縮圖與無縮圖文章；缺少日期時保留空字串，縮圖欄位則省略。
test('BBC preserves channel, ISO dates and optional thumbnails', async () => {
    const feed = await parseBbc(await fixture('bbc.xml'));
    assert.equal(feed.channel.title, 'BBC Chinese');
    assert.equal(feed.channel.lastBuildDate, '2026-11-02T01:00:00.000Z');
    assert.deepEqual(feed.trends[0], {
        title: '新聞標題',
        description: '新聞摘要',
        link: 'https://www.bbc.com/news/1',
        pubDate: '2026-11-02T00:00:00.000Z',
        guid: 'story-1',
        thumbnail: 'https://example.com/image.jpg',
    });
    assert.equal(feed.trends[1]?.pubDate, '');
    assert.equal(Object.hasOwn(feed.trends[1]!, 'thumbnail'), false);
});
