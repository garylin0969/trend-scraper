// scripts/ptt-trends.ts - PTT熱門文章爬蟲
// 使用穩定選擇器策略，完全避免依賴動態生成的CSS類名
//
// ⚠️ 為什麼要避免動態類名：
// Vue.js會自動生成 data-v-xxxxx 這樣的類名來實現 scoped CSS
// 這些類名在每次網站更新時都可能改變，導致爬蟲失效
//
// 🛡️ 穩定性策略：
// 1. 優先使用語義化的類名（如 .e7-container、.e7-recommendScore）
// 2. 使用屬性選擇器（如 [e7description="推文:"]）
// 3. 使用結構特徵（如 a[href*="/bbs/"]）
// 4. 避免使用動態生成的類名（如 data-v-xxxxx）
// 5. 提供多層備用選擇器確保穩定性
// 6. 從URL中提取信息作為最後備用方案
//
// 📊 新增功能：
// - 智能滾動策略：初始不滾動保持順序，不足20篇才輕微滾動補充
// - 提取照片URL（如果有的話）
// - 完整的去重機制
// - 詳細的調試信息
import puppeteer from 'puppeteer';
import fs from 'fs';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
        ],
    });
    const page = await browser.newPage();

    // 設置更真實的用戶代理和視窗大小
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1920, height: 1080 });

    // 移除webdriver痕跡
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    await page.goto('https://www.pttweb.cc/hot/all/today', {
        waitUntil: 'domcontentloaded',
    });

    // 等待頁面完全載入和初始內容穩定
    await new Promise((resolve) => setTimeout(resolve, 8000));

    // 等待特定元素出現
    try {
        await page.waitForSelector('.e7-container', { timeout: 15000 });
        console.log('✅ 找到 .e7-container 元素');
    } catch (error) {
        console.log('⚠️  等待 .e7-container 載入超時，嘗試其他方法');

        // 嘗試等待其他穩定的元素
        try {
            await page.waitForSelector('a[href*="/bbs/"]', { timeout: 10000 });
            console.log('✅ 找到PTT文章連結');
        } catch (fallbackError) {
            try {
                await page.waitForSelector('.e7-recommendScore', { timeout: 10000 });
                console.log('✅ 找到推文數元素');
            } catch (finalError) {
                console.log('⚠️  所有穩定選擇器都超時');
            }
        }
    }

    // 智能滾動策略：初始不滾動，不足20篇才慢慢滾動
    console.log('🎯 智能滾動策略：優先保持初始順序，不足20篇才補充');

    // 檢查當前頁面文章數量
    const initialCount = await page.evaluate(() => {
        const containers = document.querySelectorAll('.e7-container');
        let count = 0;
        for (const container of containers) {
            if (container.querySelector('.e7-recommendScore') && container.querySelector('a[href*="/bbs/"]')) {
                count++;
            }
        }
        return count;
    });

    console.log(`📊 初始頁面有 ${initialCount} 篇文章`);

    if (initialCount >= 20) {
        console.log('✅ 初始頁面已有足夠文章，跳過滾動以保持原始順序');

        // 額外等待確保頁面完全穩定
        console.log('⏳ 等待頁面內容完全穩定...');
        await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
        console.log(`📈 初始頁面只有 ${initialCount} 篇，需要慢慢滾動至20篇`);

        let currentCount = initialCount;
        let previousCount = initialCount;
        let scrollAttempt = 0;
        const maxScrollAttempts = 8;

        while (currentCount < 20 && scrollAttempt < maxScrollAttempts) {
            scrollAttempt++;
            console.log(`🔄 第 ${scrollAttempt} 次輕微滾動...`);

            // 輕微滾動，而不是滾動到底部
            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight * 0.8); // 只滾動0.8個螢幕高度
            });

            // 等待內容載入
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 檢查載入指示器
            const isLoading = await page.evaluate(() => {
                const loadingIndicator = document.querySelector(
                    '.infinite-loading-container .loading-spiral'
                ) as HTMLElement;
                return loadingIndicator && loadingIndicator.style.display !== 'none';
            });

            if (isLoading) {
                console.log('⏳ 偵測到載入中，額外等待...');
                await new Promise((resolve) => setTimeout(resolve, 2000));
            }

            // 記住上一次的數量
            previousCount = currentCount;

            // 重新計算文章數量
            currentCount = await page.evaluate(() => {
                const containers = document.querySelectorAll('.e7-container');
                let count = 0;
                for (const container of containers) {
                    if (container.querySelector('.e7-recommendScore') && container.querySelector('a[href*="/bbs/"]')) {
                        count++;
                    }
                }
                return count;
            });

            console.log(`📊 滾動後現有 ${currentCount} 篇文章`);

            // 達到20篇就立即停止
            if (currentCount >= 20) {
                console.log('🎯 已達到20篇文章，停止滾動');
                break;
            }

            // 如果文章數量沒有增加，可能已到底部
            if (currentCount === previousCount) {
                console.log('⚠️ 滾動後文章數量未增加，可能已到底部，停止滾動');
                break;
            }
        }

        console.log(`📊 最終有 ${currentCount} 篇文章`);

        // 滾動完成後，等待內容穩定
        console.log('⏳ 滾動完成，等待內容穩定...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    console.log('🔍 開始提取文章數據（按頁面順序）...');

    const articles = await page.evaluate(() => {
        console.log('開始分析頁面內容...');

        // 找到所有文章容器，使用穩定的選擇器策略
        console.log('🔍 使用穩定選擇器策略尋找文章容器...');

        // 策略1：不篩選，直接處理所有容器，但先檢查是否有頭部容器
        let foundContainers = Array.from(document.querySelectorAll('.e7-container'));
        console.log(`找到 ${foundContainers.length} 個 .e7-container 元素`);

        // 檢查是否有些容器在 .mt-4 區域內（這可能是第一個真正的文章）
        const mtContainers = Array.from(document.querySelectorAll('.mt-4 .e7-container'));
        console.log(`在 .mt-4 區域找到 ${mtContainers.length} 個容器`);

        // 合併所有容器並去重，確保順序正確
        const seenContainers = new Set();
        let articleContainers = [];

        // 先加入所有容器
        for (const container of foundContainers) {
            if (!seenContainers.has(container)) {
                seenContainers.add(container);
                articleContainers.push(container);
            }
        }

        console.log(`策略1（不篩選）最終找到 ${articleContainers.length} 個文章容器`);

        if (articleContainers.length === 0) {
            // 策略2：基於內容特徵的搜尋
            articleContainers = Array.from(document.querySelectorAll('div')).filter((div) => {
                // 檢查是否有PTT文章的關鍵特徵
                const hasPttLink = div.querySelector('a[href*="/bbs/"]');
                const hasScore =
                    div.querySelector('.e7-recommendScore') ||
                    div.querySelector('[class*="recommend"]') ||
                    div.querySelector('i[e7description="推文:"]');

                return hasPttLink && hasScore;
            });
            console.log(`策略2（內容特徵）找到 ${articleContainers.length} 個容器`);
        }

        if (articleContainers.length === 0) {
            // 策略3：最基本的搜尋
            articleContainers = Array.from(document.querySelectorAll('div')).filter((div) => {
                // 只要有PTT文章連結且包含一些文字內容
                const hasPttLink = div.querySelector('a[href*="/bbs/"]');
                const hasContent = div.textContent && div.textContent.trim().length > 10;

                return hasPttLink && hasContent;
            });
            console.log(`策略3（基本搜尋）找到 ${articleContainers.length} 個容器`);
        }

        // 先顯示找到的前幾個文章容器來調試順序和篩選
        console.log('🔍 調試：前5個文章容器的標題:');
        articleContainers.slice(0, 5).forEach((container, index) => {
            const titleLink = container.querySelector('a[href*="/bbs/"]');
            const title = titleLink?.textContent?.trim().substring(0, 50) || '無標題';
            const scoreElement = container.querySelector('.e7-recommendScore');
            const score = scoreElement?.textContent?.trim() || '0';
            console.log(`${index + 1}. 推文數: ${score}, 標題: ${title}...`);
        });

        // 檢查所有容器，看看第一個是否被篩選掉
        console.log('🔍 檢查所有容器的篩選情況:');
        const debugContainers = document.querySelectorAll('.e7-container');
        console.log(`總共找到 ${debugContainers.length} 個 .e7-container 元素`);

        debugContainers.forEach((container, index) => {
            const hasRecommendScore = container.querySelector('.e7-recommendScore');
            const hasArticleLink = container.querySelector('a[href*="/bbs/"]');
            const hasTitle = container.querySelector('.e7-title') || container.querySelector('a[href*="/bbs/"]');
            const hasLeftArea = container.querySelector('.e7-left');

            const titleLink = container.querySelector('a[href*="/bbs/"]');
            const title = titleLink?.textContent?.trim().substring(0, 30) || '無標題';
            const link = titleLink?.getAttribute('href') || '無連結';

            // 檢查是否為空容器（只有高度設定）
            const isEmpty = container.children.length === 1 && (container.children[0] as HTMLElement).style?.height;

            console.log(
                `容器 ${
                    index + 1
                }: 推文數=${!!hasRecommendScore}, 連結=${!!hasArticleLink}, 標題=${!!hasTitle}, 左側=${!!hasLeftArea}, 空容器=${isEmpty}`
            );
            console.log(`  標題: "${title}"`);
            console.log(`  連結: "${link}"`);

            if (isEmpty) {
                console.log(`  ⚠️ 容器 ${index + 1} 是空容器，跳過`);
            } else if (!hasRecommendScore || !hasArticleLink || !hasTitle || !hasLeftArea) {
                console.log(`  ⚠️ 容器 ${index + 1} 被篩選掉的原因:`);
                console.log(
                    `    推文數=${!!hasRecommendScore}, 連結=${!!hasArticleLink}, 標題=${!!hasTitle}, 左側=${!!hasLeftArea}`
                );

                // 更詳細的調試信息
                if (!hasRecommendScore) {
                    console.log(`    - 找不到推文數元素 (.e7-recommendScore)`);
                }
                if (!hasArticleLink) {
                    console.log(`    - 找不到文章連結 (a[href*="/bbs/"])`);
                }
                if (!hasTitle) {
                    console.log(`    - 找不到標題元素`);
                }
                if (!hasLeftArea) {
                    console.log(`    - 找不到左側區域 (.e7-left)`);
                }
            } else {
                console.log(`  ✅ 容器 ${index + 1} 通過篩選`);
            }
        });

        const articleData = articleContainers
            .map((container, index) => {
                try {
                    console.log(`處理第 ${index + 1} 個容器...`);

                    // 檢查是否為空容器（只有高度設定，沒有實際內容）
                    const isEmpty =
                        container.children.length === 1 &&
                        (container.children[0] as HTMLElement).style?.height &&
                        !(container.children[0] as HTMLElement).classList.contains('e7-left') &&
                        !(container.children[0] as HTMLElement).classList.contains('e7-right');
                    if (isEmpty) {
                        console.log(`容器 ${index + 1} 是空容器，跳過`);
                        return null;
                    }

                    console.log(`容器 ${index + 1} 不是空容器，子元素數量: ${container.children.length}`);

                    // 檢查是否有基本的文章元素
                    const hasArticleLink = container.querySelector('a[href*="/bbs/"]');
                    if (!hasArticleLink) {
                        console.log(`容器 ${index + 1} 沒有文章連結，跳過`);
                        return null;
                    }

                    // 提取推文數：使用穩定的選擇器策略，允許為0或不存在
                    let recommendScore = '0';
                    const scoreElement =
                        container.querySelector('.e7-recommendScore') ||
                        container.querySelector('[e7description="推文:"]')?.parentElement ||
                        container.querySelector('i[e7description="推文:"]')?.parentElement ||
                        container.querySelector('[class*="recommend"][class*="Score"]');
                    if (scoreElement) {
                        const scoreText = scoreElement.textContent?.trim() || '0';
                        // 提取數字，包含負數，如果沒有數字就是0
                        const scoreMatch = scoreText.match(/-?\d+/);
                        recommendScore = scoreMatch ? scoreMatch[0] : '0';
                    } else {
                        // 如果完全沒有推文數元素，可能是新文章或特殊情況
                        console.log(`容器 ${index + 1} 沒有找到推文數元素，設為0`);
                        recommendScore = '0';
                    }

                    // 提取留言數：使用穩定的選擇器策略，允許為0或不存在
                    let recommendCount = '0';
                    const countElement =
                        container.querySelector('.e7-recommendCount') ||
                        container.querySelector('[e7description="回應:"]')?.parentElement ||
                        container.querySelector('i[e7description="回應:"]')?.parentElement ||
                        container.querySelector('[class*="recommend"][class*="Count"]');
                    if (countElement) {
                        const countText = countElement.textContent?.trim() || '0';
                        // 提取數字
                        const countMatch = countText.match(/\d+/);
                        recommendCount = countMatch ? countMatch[0] : '0';
                    } else {
                        // 如果完全沒有留言數元素，可能是新文章或特殊情況
                        console.log(`容器 ${index + 1} 沒有找到留言數元素，設為0`);
                        recommendCount = '0';
                    }

                    // 提取標題和連結：先找到連結元素
                    let titleLink = container.querySelector('a[href*="/bbs/"]');
                    const link = titleLink?.getAttribute('href') || '';

                    // 提取標題：優先選擇桌面版標題，避免重複
                    let title = '';
                    if (titleLink) {
                        // 先嘗試桌面版標題
                        const desktopTitle = titleLink.querySelector('.e7-show-if-device-is-not-xs');
                        if (desktopTitle) {
                            title = desktopTitle.textContent?.trim() || '';
                        } else {
                            // 如果沒有桌面版，使用手機版
                            const mobileTitle = titleLink.querySelector('.e7-show-if-device-is-xs');
                            title = mobileTitle?.textContent?.trim() || '';
                        }

                        // 如果還是沒有，就用整個連結的文字但清理重複
                        if (!title) {
                            const fullText = titleLink.textContent?.trim() || '';
                            // 移除重複的部分（通常是因為桌面版和手機版都被抓到）
                            const lines = fullText
                                .split('\n')
                                .map((line) => line.trim())
                                .filter((line) => line);
                            title = lines[0] || '';
                        }
                    }

                    // 提取作者：使用穩定的方式
                    let authorLink = container.querySelector('a[href*="/user/"]');
                    let author = '';

                    if (authorLink) {
                        // 先嘗試從文本內容提取
                        author = authorLink.textContent?.trim() || '';

                        // 如果沒找到作者，嘗試從URL中提取
                        if (!author) {
                            const href = authorLink.getAttribute('href') || '';
                            const userMatch = href.match(/\/user\/(.+)$/);
                            if (userMatch) {
                                author = userMatch[1];
                            }
                        }
                    }

                    // 提取分類：使用穩定的方式
                    let boardElement =
                        container.querySelector('.e7-boardName .e7-link-to-article') ||
                        container.querySelector('.e7-boardName') ||
                        container.querySelector('[class*="boardName"]');
                    let board = '';
                    if (boardElement) {
                        const boardText = boardElement.textContent?.trim() || '';
                        // 提取方括號中的看板名稱
                        const boardMatch = boardText.match(/\[\s*([^[\]]+)\s*\]/);
                        board = boardMatch ? boardMatch[1].trim() : boardText.replace(/[\[\]]/g, '').trim();
                    }

                    // 如果從boardElement找不到，嘗試從文章連結URL中提取
                    if (!board && link) {
                        const urlMatch = link.match(/\/bbs\/([^\/]+)\//);
                        if (urlMatch) {
                            board = urlMatch[1];
                        }
                    }

                    // 提取發文時間：尋找日期格式
                    const timeElements = container.querySelectorAll('.e7-grey-text, .text-no-wrap');
                    let publishTime = '';
                    for (const timeElement of timeElements) {
                        const timeText = timeElement.textContent?.trim() || '';
                        const dateMatch = timeText.match(/(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2})/);
                        if (dateMatch) {
                            publishTime = dateMatch[1];
                            break;
                        }
                    }

                    // 提取照片：在e7-preview中的圖片
                    let imageUrl = '';
                    const imageElement = container.querySelector('.e7-preview img');
                    if (imageElement) {
                        imageUrl = imageElement.getAttribute('src') || '';
                    }

                    console.log(`容器 ${index + 1} 提取結果:`, {
                        推文數: recommendScore,
                        留言數: recommendCount,
                        標題: title.substring(0, 50) + '...',
                        連結: link,
                        作者: author,
                        分類: board,
                        發文時間: publishTime,
                        照片: imageUrl ? '有照片' : '無照片',
                    });

                    // 只要有標題和連結就視為有效文章（推文數和留言數可以為0）
                    if (title && link) {
                        return {
                            recommendScore: recommendScore,
                            recommendCount: recommendCount,
                            title: title,
                            link: link,
                            author: author,
                            board: board,
                            publishTime: publishTime,
                            imageUrl: imageUrl,
                        };
                    } else {
                        console.log(`容器 ${index + 1} 無效: 標題="${title}", 連結="${link}"`);
                    }
                } catch (error) {
                    console.log(`處理容器 ${index + 1} 時出錯:`, error);
                }

                return null;
            })
            .filter((article) => article !== null);

        // 去重：根據連結去除重複的文章，保持順序
        const uniqueArticles = [];
        const seenLinks = new Set();

        for (const article of articleData) {
            if (article && article.link && !seenLinks.has(article.link)) {
                seenLinks.add(article.link);
                uniqueArticles.push(article);

                // 達到目標數量就停止收集（最多20篇，如果不夠就全部收集）
                if (uniqueArticles.length >= Math.min(20, articleData.length)) {
                    console.log(`📊 已收集到前 ${uniqueArticles.length} 篇文章，停止收集`);
                    break;
                }
            }
        }

        console.log(`去重前: ${articleData.length} 篇文章, 去重後: ${uniqueArticles.length} 篇文章`);

        return uniqueArticles;
    });

    // 如果沒有找到文章，保存調試信息
    if (articles.length === 0) {
        console.log('⚠️  沒有找到任何文章，保存頁面截圖進行調試...');
        await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });

        // 獲取頁面HTML內容
        const htmlContent = await page.content();
        console.log('頁面標題:', await page.title());
        console.log('頁面URL:', page.url());
        console.log('HTML內容長度:', htmlContent.length);

        // 檢查是否有任何div元素
        const divCount = await page.evaluate(() => document.querySelectorAll('div').length);
        console.log('頁面中div元素數量:', divCount);
    }

    await browser.close();

    // 確保只取前20筆（如果有的話），保持順序
    const finalArticles = articles.slice(0, Math.min(20, articles.length));

    // 修正輸出檔案名稱 - 只保存前20筆
    fs.writeFileSync(
        'data/ptt-trends.json',
        JSON.stringify(
            {
                updated: new Date(),
                total_found: articles.length,
                returned_count: finalArticles.length,
                articles: finalArticles,
            },
            null,
            2
        )
    );

    console.log(`✅ 擷取完成（按熱門度順序前${finalArticles.length}筆）：`);
    finalArticles.slice(0, 3).forEach((article, index) => {
        console.log(`${index + 1}. ${article.title}`);
        console.log(`   推文數: ${article.recommendScore}, 留言數: ${article.recommendCount}`);
        console.log(`   作者: ${article.author}, 分類: ${article.board}`);
        console.log(`   發文時間: ${article.publishTime}`);
        console.log(`   照片: ${article.imageUrl ? '有' : '無'}`);
        console.log(`   連結: ${article.link}`);
        console.log('---');
    });
    console.log('📊 總共找到', articles.length, '篇文章');
    console.log('🎯 取前20篇作為最終結果');

    // 檢查是否達到目標數量
    if (finalArticles.length < 20) {
        console.log(`⚠️  目標是20篇文章，但只找到 ${finalArticles.length} 篇`);
        console.log('💡 可能需要：');
        console.log('   1. 增加滾動次數');
        console.log('   2. 延長等待時間');
        console.log('   3. 檢查網站是否有變化');
    } else {
        console.log('🎯 成功取得前20篇文章！');
    }
})();
