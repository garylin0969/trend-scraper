import puppeteer from 'puppeteer';
import fs from 'fs';

interface KomicaTrend {
    replyCount: number;
    date: string;
    time: string;
    title: string;
    description: string;
    link: string;
    rawText: string; // 保留原始文字以備查看
}

(async () => {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ];
    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.setUserAgent(randomUserAgent);

    console.log('⏳ 載入網頁...');
    await page.goto('https://gita.komica1.org/00b/catlist.php', {
        waitUntil: 'domcontentloaded',
    });

    try {
        await page.waitForSelector('pre', { timeout: 10000 });
        console.log('✅ 找到 pre 標籤');
    } catch (error) {
        console.log('⚠️  等待 pre 元素載入超時');
    }

    const trends = await page.evaluate(() => {
        console.log('開始解析頁面...');

        // 找到所有 pre 標籤
        const preElements = document.querySelectorAll('pre');
        console.log('找到 pre 標籤數量:', preElements.length);

        // 找到包含今日熱門的 pre 標籤
        let todayThreadsPre = null;
        for (let i = 0; i < preElements.length; i++) {
            const pre = preElements[i];
            const content = pre.textContent || '';
            if (content.includes('Top 50 Threads [Today]')) {
                todayThreadsPre = pre;
                console.log('找到今日熱門區塊，索引:', i);
                break;
            }
        }

        if (!todayThreadsPre) {
            console.log('找不到今日熱門文章區塊');
            return [];
        }

        // 直接取得整個 pre 內容
        const innerHTML = todayThreadsPre.innerHTML;
        console.log('Pre 內容長度:', innerHTML.length);

        // 分割成行
        const lines = innerHTML.split('\n');
        console.log('分割後行數:', lines.length);

        const trends: KomicaTrend[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // 跳過空行
            if (!line) {
                continue;
            }

            console.log(`處理行 ${i}: ${line.substring(0, 100)}...`);

            // 檢查是否包含連結
            const linkMatch = line.match(/href="([^"]+)"/);
            if (linkMatch) {
                const link = linkMatch[1];
                // 移除 HTML 標籤，保留純文字
                let rawText = line.replace(/<[^>]*>/g, '');

                // 如果這一行包含標題，移除標題部分
                if (rawText.includes('Top 50 Threads [Today]')) {
                    rawText = rawText.replace('Top 50 Threads [Today]', '').trim();
                }

                // 確保還有內容（不是空的）
                if (rawText) {
                    // 切分文字：68|28126604|2025/07/03|11:32|無題|現在的小孩是智力太低還是邏輯太爛|在新分頁開啟
                    const parts = rawText.split('|');

                    if (parts.length >= 6) {
                        const replyCount = parseInt(parts[0].trim()) || 0;
                        // parts[1] 是 postId，不需要
                        const date = parts[2].trim();
                        const time = parts[3].trim();
                        const title = parts[4].trim();
                        const description = parts[5].trim();

                        trends.push({
                            replyCount,
                            date,
                            time,
                            title,
                            description,
                            link,
                            rawText, // 保留原始文字
                        });

                        console.log(`✅ 找到第 ${trends.length} 個趨勢`);
                        console.log(`   留言數: ${replyCount}`);
                        console.log(`   日期: ${date}`);
                        console.log(`   時間: ${time}`);
                        console.log(`   標題: ${title}`);
                        console.log(`   內文: ${description.substring(0, 30)}...`);
                        console.log(`   連結: ${link}`);
                    } else {
                        console.log(`❌ 切分欄位不足，只有 ${parts.length} 個欄位`);
                    }
                }
            }
        }

        console.log('總共找到:', trends.length, '個趨勢');
        return trends;
    });

    await browser.close();

    fs.writeFileSync(
        'data/komica-trends.json',
        JSON.stringify(
            {
                updated: new Date(),
                trends,
            },
            null,
            2
        )
    );

    console.log('✅ 擷取完成');
    console.log('📊 總共找到', trends.length, '個趨勢');

    if (trends.length > 0) {
        console.log('\n📋 前 3 個範例：');
        trends.slice(0, 3).forEach((trend, index) => {
            console.log(`${index + 1}. 留言數：${trend.replyCount}`);
            console.log(`   日期：${trend.date} ${trend.time}`);
            console.log(`   標題：${trend.title}`);
            console.log(`   內文：${trend.description}`);
            console.log(`   連結：${trend.link}`);
            console.log('');
        });
    } else {
        console.log('⚠️  沒有找到任何趨勢資料');
    }
})();
