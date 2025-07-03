import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:124.0) Gecko/20100101 Firefox/124.0',
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    // 設定隨機 User-Agent
    await page.setUserAgent(randomUserAgent);

    // 隨機延遲 3~13 秒，避免行為模式一致
    const randomDelay = Math.floor(Math.random() * 10000) + 3000;
    console.log(`⏳ 隨機延遲 ${randomDelay} 毫秒...`);
    await new Promise((resolve) => setTimeout(resolve, randomDelay));

    await page.goto('https://trends.google.com.tw/trending?geo=TW&hours=4', {
        waitUntil: 'domcontentloaded',
    });

    // 再次隨機延遲，模擬人類閱讀反應
    const postLoadDelay = Math.floor(Math.random() * 5000) + 3000;
    console.log(`⏳ 頁面載入後額外延遲 ${postLoadDelay} 毫秒...`);
    await new Promise((resolve) => setTimeout(resolve, postLoadDelay));

    try {
        await page.waitForSelector('td', { timeout: 10000 });
    } catch (error) {
        console.log('⚠️  等待元素載入超時');
    }

    const trends = await page.evaluate(() => {
        const allRows = Array.from(document.querySelectorAll('tbody tr'));
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

                    const countCellText = countCell.textContent?.trim() || '';
                    const countMatches = countCellText.match(/(\d+[\d,]*\+)/g) || [];
                    const searchCount = countMatches.find((match) => match.match(/^\d+[\d,]*\+$/)) || '';

                    const timeCellText = timeCell.textContent?.trim() || '';
                    const timeMatch = timeCellText.match(/(\d+\s*[小時分鐘]+前)/);
                    const startTime = timeMatch ? timeMatch[1] : '';

                    if (trendText && searchCount && startTime) {
                        return {
                            googleTrend: trendText,
                            searchVolume: searchCount,
                            started: startTime,
                        };
                    }
                }
                return null;
            })
            .filter((row) => row !== null);

        return tableData;
    });

    await browser.close();

    fs.writeFileSync(
        'data/google-trends.json',
        JSON.stringify(
            {
                updated: new Date(),
                trends,
            },
            null,
            2
        )
    );

    console.log('✅ 擷取完成：', trends.slice(0, 5));
    console.log('📊 總共找到', trends.length, '個趨勢');
})();
