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
    try {
        await page.goto('https://www.gamer.com.tw/index.php?ad=N', {
            waitUntil: 'networkidle2',
            timeout: 60000, // 增加超時時間到60秒
        });
    } catch (error) {
        console.log('⚠️ 首次載入失敗，嘗試重新載入...');
        try {
            await page.goto('https://www.gamer.com.tw/index.php?ad=N', {
                waitUntil: 'domcontentloaded', // 改用更寬鬆的等待條件
                timeout: 60000,
            });
        } catch (retryError) {
            console.log('❌ 重新載入也失敗，關閉瀏覽器');
            await browser.close();
            return;
        }
    }

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

    // 等待數據完全載入 - 改用更智能的等待策略
    console.log('⏳ 等待數據完全載入...');

    // 等待數據元素載入
    try {
        await page.waitForSelector('.index-card__data-content .index-card__data', { timeout: 10000 });
        console.log('✅ 找到數據元素');
    } catch (error) {
        console.log('⚠️  等待數據元素載入超時，繼續執行...');
    }

    // 等待一段時間讓動態內容完全載入
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 滾動頁面以觸發數據載入
    await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await page.evaluate(() => {
        window.scrollTo(0, 0);
    });

    // 再次檢查數據是否載入完成
    const dataLoaded = await page.evaluate(() => {
        const dataElements = document.querySelectorAll('.index-card__data data');
        let hasValidData = false;
        let totalData = 0;

        dataElements.forEach((element) => {
            const value = element.textContent?.trim();
            totalData++;
            if (value && value !== '0' && value !== '-' && value !== 'X' && parseInt(value) > 0) {
                hasValidData = true;
            }
        });

        console.log(`檢查到 ${totalData} 個數據元素，有效數據: ${hasValidData}`);
        return hasValidData;
    });

    if (!dataLoaded) {
        console.log('⚠️  數據可能還沒完全載入，再等待3秒...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // 開始抓取數據，如果失敗則重試
    let trends: GamerTrend[] = [];
    let retryCount = 0;
    const maxRetries = 2;

    while (trends.length === 0 && retryCount < maxRetries) {
        if (retryCount > 0) {
            console.log(`🔄 第 ${retryCount + 1} 次嘗試抓取數據...`);
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        trends = await page.evaluate(() => {
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

                    // 看板頭像 - 多重選擇器策略
                    let boardImageElement = item.querySelector('.index-list__profile img');
                    if (!boardImageElement) {
                        boardImageElement = item.querySelector('.index-list__left img');
                    }
                    const boardImage = boardImageElement ? boardImageElement.getAttribute('src') || '' : '';
                    console.log(`   看板頭像: ${boardImage} (找到元素: ${!!boardImageElement})`);

                    // 子板名稱 - 第二個 .index-list__name，如果沒有則留空
                    let subBoard = '';
                    if (boardNameElements.length > 1) {
                        subBoard = boardNameElements[1].textContent?.trim() || '';
                    }
                    console.log(`   子板名稱: ${subBoard} (找到 ${boardNameElements.length} 個 name 元素)`);

                    // 標題 - 不移除【】標記，保持原始標題
                    const titleElement = item.querySelector('.index-list__heading');
                    const title = titleElement ? titleElement.textContent?.trim() || '' : '';
                    console.log(`   標題: ${title} (找到元素: ${!!titleElement})`);

                    // 內文簡略 - 多重選擇器策略
                    let contentElement = item.querySelector('.index-list__msg');
                    if (!contentElement) {
                        contentElement = item.querySelector('p.index-list__msg');
                    }
                    const content = contentElement ? contentElement.textContent?.trim() || '' : '';
                    console.log(`   內文: ${content?.substring(0, 50)}... (找到元素: ${!!contentElement})`);

                    // 文章圖片
                    const articleImageElement = item.querySelector('.index-list__cover img');
                    const articleImage = articleImageElement ? articleImageElement.getAttribute('src') || '' : '';
                    console.log(`   文章圖片: ${articleImage} (找到元素: ${!!articleImageElement})`);

                    // 文章連結 - 從 .index-list__content 取得 href
                    const linkElement = item.querySelector('.index-list__content');
                    let link = linkElement ? linkElement.getAttribute('href') || '' : '';
                    console.log(
                        `   文章連結: ${link} (找到元素: ${!!linkElement}, 有href: ${!!linkElement?.getAttribute(
                            'href'
                        )})`
                    );

                    // 如果連結為空，嘗試其他方法
                    if (!link) {
                        const altLinkElement = item.querySelector('a[href*="forum.gamer.com.tw/C.php"]');
                        const altLink = altLinkElement ? altLinkElement.getAttribute('href') || '' : '';
                        if (altLink) {
                            link = altLink;
                            console.log(`   使用備用連結: ${altLink}`);
                        }
                    }

                    // 數據區塊 (推、噓、留言) - 改進抓取邏輯
                    const dataElements = item.querySelectorAll('.index-card__data');
                    console.log(`   找到數據元素數量: ${dataElements.length}`);

                    let gp = 0,
                        bp = 0,
                        comments = 0;

                    // 檢查每個數據元素
                    dataElements.forEach((dataEl, dataIndex) => {
                        const iconElement = dataEl.querySelector('.info__icon');
                        const dataValue = dataEl.querySelector('data');

                        console.log(`   數據元素 ${dataIndex}: 找到圖標=${!!iconElement}, 找到數值=${!!dataValue}`);

                        if (dataValue && iconElement) {
                            const value = dataValue.textContent?.trim() || '';
                            const classList = Array.from(iconElement.classList);

                            console.log(`   數據元素 ${dataIndex}: 圖標=${classList.join(', ')}, 值='${value}'`);

                            if (classList.includes('icon-gp') && !classList.includes('rotate')) {
                                // 推 (GP)
                                const numValue = parseInt(value) || 0;
                                gp = numValue;
                                console.log(`   設定 GP: ${gp} (原始值: '${value}')`);
                            } else if (classList.includes('icon-gp') && classList.includes('rotate')) {
                                // 噓 (BP) - 處理 X 和 - 符號
                                if (value === 'X' || value === '-') {
                                    bp = 0;
                                } else {
                                    const numValue = parseInt(value) || 0;
                                    bp = numValue;
                                }
                                console.log(`   設定 BP: ${bp} (原始值: '${value}')`);
                            } else if (classList.includes('icon-message')) {
                                // 留言數
                                const numValue = parseInt(value) || 0;
                                comments = numValue;
                                console.log(`   設定留言數: ${comments} (原始值: '${value}')`);
                            }
                        } else {
                            console.log(`   數據元素 ${dataIndex}: 缺少必要元素`);
                        }
                    });

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
                                console.log('   解析 bookmark 資料失敗:', e);
                            }
                        }
                    }
                    console.log(`   作者: ${author}`);

                    // 詳細記錄抓取結果
                    console.log(`   最終結果 - 推: ${gp}, 噓: ${bp}, 留言: ${comments}`);
                    console.log(`   連結: ${link}`);
                    console.log(`   圖片: ${boardImage}`);

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
                    } else {
                        console.log(`❌ 第 ${index + 1} 個項目缺少必要欄位 - 標題: ${title}, 看板: ${boardName}`);
                    }
                } catch (error) {
                    console.log(`❌ 處理第 ${index + 1} 個項目時發生錯誤:`, error);
                }
            });

            console.log('總共找到:', trends.length, '個熱門話題');
            return trends;
        });

        retryCount++;
    }

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
