import puppeteer from 'puppeteer';
import fs from 'fs';

interface GamerTrend {
    boardName: string;
    boardImage: string;
    subBoard: string;
    title: string;
    content: string;
    articleImage: string;
    gp: number; // 推
    bp: number; // 噓
    comments: number; // 留言數
    link: string;
    author: string;
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

    console.log('⏳ 載入巴哈姆特首頁...');
    await page.goto('https://www.gamer.com.tw/index.php?ad=N', {
        waitUntil: 'networkidle2',
    });

    // 等待熱門話題區塊載入
    try {
        await page.waitForSelector('#postPanel .index-list__column', { timeout: 15000 });
        console.log('✅ 找到熱門話題區塊');
    } catch (error) {
        console.log('⚠️  等待熱門話題區塊載入超時');
        await browser.close();
        return;
    }

    // 滾動到熱門話題區塊以確保內容載入
    await page.evaluate(() => {
        const postPanel = document.querySelector('#postPanel');
        if (postPanel) {
            postPanel.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // 等待一下讓內容完全載入
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const trends = await page.evaluate(() => {
        console.log('開始解析熱門話題...');

        const items = document.querySelectorAll('#postPanel .index-list__column .index-list__item');
        console.log('找到熱門話題項目數量:', items.length);

        // 如果找不到項目，嘗試其他選擇器
        if (items.length === 0) {
            console.log('找不到熱門話題項目，嘗試其他選擇器...');
            const alternativeItems = document.querySelectorAll('.index-list__item');
            console.log('替代選擇器找到項目數量:', alternativeItems.length);

            // 印出頁面結構以便調試
            const postPanel = document.querySelector('#postPanel');
            if (postPanel) {
                console.log('找到 #postPanel，HTML 結構:', postPanel.innerHTML.substring(0, 500));
            } else {
                console.log('找不到 #postPanel');
            }

            return [];
        }

        const trends: GamerTrend[] = [];

        items.forEach((item, index) => {
            try {
                console.log(`處理第 ${index + 1} 個項目...`);

                // 看板名稱 - 第一個 .index-list__name
                const boardNameElements = item.querySelectorAll('.index-list__name');
                const boardName = boardNameElements[0] ? boardNameElements[0].textContent?.trim() || '' : '';
                console.log(`   看板名稱: ${boardName}`);

                // 看板頭像
                const boardImageElement = item.querySelector('.index-list__profile img');
                const boardImage = boardImageElement ? boardImageElement.getAttribute('src') || '' : '';
                console.log(`   看板頭像: ${boardImage}`);

                // 子板名稱 - 第二個 .index-list__name
                const subBoard = boardNameElements[1] ? boardNameElements[1].textContent?.trim() || '' : '';
                console.log(`   子板名稱: ${subBoard}`);

                // 標題
                const titleElement = item.querySelector('.index-list__heading');
                const title = titleElement ? titleElement.textContent?.trim() || '' : '';
                console.log(`   標題: ${title}`);

                // 內文簡略
                const contentElement = item.querySelector('.index-list__msg');
                const content = contentElement ? contentElement.textContent?.trim() || '' : '';
                console.log(`   內文: ${content?.substring(0, 50)}...`);

                // 文章圖片
                const articleImageElement = item.querySelector('.index-list__cover img');
                const articleImage = articleImageElement ? articleImageElement.getAttribute('src') || '' : '';
                console.log(`   文章圖片: ${articleImage}`);

                // 文章連結
                const linkElement = item.querySelector('.index-list__content');
                const link = linkElement ? linkElement.getAttribute('href') || '' : '';
                console.log(`   文章連結: ${link}`);

                // 數據區塊 (推、噓、留言) - 根據HTML結構順序提取
                const dataElements = item.querySelectorAll('.index-card__data');
                console.log(`   找到數據元素數量: ${dataElements.length}`);

                let gp = 0,
                    bp = 0,
                    comments = 0;

                // 根據HTML結構，通常順序是：推、噓、留言
                if (dataElements.length >= 3) {
                    const gpElement = dataElements[0].querySelector('data');
                    const bpElement = dataElements[1].querySelector('data');
                    const commentsElement = dataElements[2].querySelector('data');

                    if (gpElement) {
                        gp = parseInt(gpElement.textContent?.trim() || '0') || 0;
                    }
                    if (bpElement) {
                        const bpValue = bpElement.textContent?.trim() || '0';
                        bp = bpValue === '-' ? 0 : parseInt(bpValue) || 0;
                    }
                    if (commentsElement) {
                        comments = parseInt(commentsElement.textContent?.trim() || '0') || 0;
                    }

                    console.log(`   順序提取 - GP: ${gp}, BP: ${bp}, 留言: ${comments}`);
                } else {
                    console.log('   數據元素不足，嘗試圖標識別方式');
                    // 備用方案：逐個檢查圖標
                    dataElements.forEach((dataEl, dataIndex) => {
                        const iconElement = dataEl.querySelector('.info__icon');
                        const dataValue = dataEl.querySelector('data');
                        const value = dataValue ? dataValue.textContent?.trim() || '0' : '0';

                        console.log(`   數據元素 ${dataIndex}: 值=${value}`);

                        if (iconElement) {
                            const classList = Array.from(iconElement.classList);
                            console.log(`   圖標類別: ${classList.join(', ')}`);

                            if (classList.includes('icon-gp') && !classList.includes('rotate')) {
                                // 推 (GP)
                                gp = parseInt(value) || 0;
                                console.log(`   設定 GP: ${gp}`);
                            } else if (classList.includes('icon-gp') && classList.includes('rotate')) {
                                // 噓 (BP)
                                bp = value === '-' ? 0 : parseInt(value) || 0;
                                console.log(`   設定 BP: ${bp}`);
                            } else if (classList.includes('icon-message')) {
                                // 留言數
                                comments = parseInt(value) || 0;
                                console.log(`   設定留言數: ${comments}`);
                            }
                        }
                    });
                }

                // 從 data-home-bookmark 屬性中提取作者資訊
                let author = boardName; // 默認使用看板名稱
                const bookmarkButton = item.querySelector('[data-home-bookmark]');
                if (bookmarkButton) {
                    const bookmarkData = bookmarkButton.getAttribute('data-home-bookmark');
                    if (bookmarkData) {
                        try {
                            const bookmarkObj = JSON.parse(bookmarkData);
                            if (bookmarkObj.userid) {
                                author = bookmarkObj.userid;
                            }
                        } catch (e) {
                            console.log('   解析 bookmark 資料失敗');
                        }
                    }
                }
                console.log(`   作者: ${author}`);

                if (title && boardName) {
                    trends.push({
                        boardName,
                        boardImage,
                        subBoard,
                        title,
                        content,
                        articleImage,
                        gp,
                        bp,
                        comments,
                        link,
                        author,
                    });

                    console.log(`✅ 找到第 ${trends.length} 個熱門話題`);
                    console.log(`   推: ${gp}, 噓: ${bp}, 留言: ${comments}`);
                }
            } catch (error) {
                console.log(`❌ 處理第 ${index + 1} 個項目時發生錯誤:`, error);
            }
        });

        console.log('總共找到:', trends.length, '個熱門話題');
        return trends;
    });

    await browser.close();

    // 儲存到 gamer-trends.json
    fs.writeFileSync(
        'data/gamer-trends.json',
        JSON.stringify(
            {
                updated: new Date(),
                trends,
            },
            null,
            2
        )
    );

    console.log('✅ 巴哈姆特熱門話題擷取完成');
    console.log('📊 總共找到', trends.length, '個熱門話題');

    if (trends.length > 0) {
        console.log('\n📋 前 3 個範例：');
        trends.slice(0, 3).forEach((trend, index) => {
            console.log(`${index + 1}. 看板：${trend.boardName} > ${trend.subBoard}`);
            console.log(`   標題：${trend.title}`);
            console.log(`   內文：${trend.content.substring(0, 50)}...`);
            console.log(`   互動：推 ${trend.gp} | 噓 ${trend.bp} | 留言 ${trend.comments}`);
            console.log(`   連結：${trend.link}`);
            console.log('');
        });
    } else {
        console.log('⚠️  沒有找到任何熱門話題資料');
    }
})();
