import { PttArticle } from '../types';
import { URLS } from '../config/constants';
import { sleep } from '../utils/common';
import { logger } from '../utils/logger';
import { saveData } from '../utils/file-manager';
import { createBrowser, configurePage } from '../utils/browser';

/**
 * PTT 熱門文章爬蟲 (透過 PTT Web)
 *
 * 功能：
 * 1. 訪問 PTT Web 版的今日熱門文章頁面。
 * 2. 實作智慧滾動策略，確保至少取得 20 篇熱門文章。
 * 3. 使用多種選擇器策略來適應不穩定的 DOM 結構。
 * 4. 提取文章詳細資訊 (標題、作者、看板、推文數、圖片等)。
 * 5. 儲存前 20 篇最熱門的文章。
 */
(async () => {
    let browser;
    try {
        browser = await createBrowser();
        const page = await browser.newPage();

        await configurePage(page);

        await page.goto(URLS.PTT_HOT, {
            waitUntil: 'domcontentloaded',
        });

        // 等待頁面完全載入和初始內容穩定
        await sleep(8000);

        // 等待特定元素出現
        try {
            await page.waitForSelector('.e7-container', { timeout: 15000 });
            logger.success('找到 .e7-container 元素');
        } catch (error) {
            logger.warn('等待 .e7-container 載入超時，嘗試其他方法');

            // 嘗試等待其他穩定的元素 (Fallback 策略)
            try {
                await page.waitForSelector('a[href*="/bbs/"]', { timeout: 10000 });
                logger.success('找到PTT文章連結');
            } catch (fallbackError) {
                try {
                    await page.waitForSelector('.e7-recommendScore', { timeout: 10000 });
                    logger.success('找到推文數元素');
                } catch (finalError) {
                    logger.warn('所有穩定選擇器都超時');
                }
            }
        }

        // 智能滾動策略：初始不滾動，不足20篇才慢慢滾動
        logger.info('智能滾動策略：優先保持初始順序，不足20篇才補充');

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

        logger.result(`初始頁面有 ${initialCount} 篇文章`);

        if (initialCount >= 20) {
            logger.success('初始頁面已有足夠文章，跳過滾動以保持原始順序');
            logger.info('等待頁面內容完全穩定...');
            await sleep(5000);
        } else {
            logger.info(`初始頁面只有 ${initialCount} 篇，需要慢慢滾動至20篇`);

            let currentCount = initialCount;
            let previousCount = initialCount;
            let scrollAttempt = 0;
            const maxScrollAttempts = 8;

            while (currentCount < 20 && scrollAttempt < maxScrollAttempts) {
                scrollAttempt++;
                logger.info(`第 ${scrollAttempt} 次輕微滾動...`);

                // 輕微滾動，而不是滾動到底部
                await page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight * 0.8); // 只滾動0.8個螢幕高度
                });

                // 等待內容載入
                await sleep(2000);

                // 檢查載入指示器
                const isLoading = await page.evaluate(() => {
                    const loadingIndicator = document.querySelector(
                        '.infinite-loading-container .loading-spiral',
                    ) as HTMLElement;
                    return loadingIndicator && loadingIndicator.style.display !== 'none';
                });

                if (isLoading) {
                    logger.info('偵測到載入中，額外等待...');
                    await sleep(2000);
                }

                // 記住上一次的數量
                previousCount = currentCount;

                // 重新計算文章數量
                currentCount = await page.evaluate(() => {
                    const containers = document.querySelectorAll('.e7-container');
                    let count = 0;
                    for (const container of containers) {
                        if (
                            container.querySelector('.e7-recommendScore') &&
                            container.querySelector('a[href*="/bbs/"]')
                        ) {
                            count++;
                        }
                    }
                    return count;
                });

                logger.result(`滾動後現有 ${currentCount} 篇文章`);

                // 達到20篇就立即停止
                if (currentCount >= 20) {
                    logger.success('已達到20篇文章，停止滾動');
                    break;
                }

                // 如果文章數量沒有增加，可能已到底部
                if (currentCount === previousCount) {
                    logger.warn('滾動後文章數量未增加，可能已到底部，停止滾動');
                    break;
                }
            }

            logger.result(`最終有 ${currentCount} 篇文章`);
            logger.info('滾動完成，等待內容穩定...');
            await sleep(3000);
        }

        logger.start('開始提取文章數據（按頁面順序）...');

        const articles: PttArticle[] = await page.evaluate(() => {
            // 找到所有文章容器，使用穩定的選擇器策略
            // 策略1：不篩選，直接處理所有容器
            let foundContainers = Array.from(document.querySelectorAll('.e7-container'));

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

            if (articleContainers.length === 0) {
                // 策略2：基於內容特徵的搜尋 (Fallback)
                articleContainers = Array.from(document.querySelectorAll('div')).filter((div) => {
                    // 檢查是否有PTT文章的關鍵特徵
                    const hasPttLink = div.querySelector('a[href*="/bbs/"]');
                    const hasScore =
                        div.querySelector('.e7-recommendScore') ||
                        div.querySelector('[class*="recommend"]') ||
                        div.querySelector('i[e7description="推文:"]');

                    return hasPttLink && hasScore;
                });
            }

            const articleData = articleContainers
                .map((container) => {
                    try {
                        // 檢查是否為空容器
                        const isEmpty =
                            container.children.length === 1 &&
                            (container.children[0] as HTMLElement).style?.height &&
                            !(container.children[0] as HTMLElement).classList.contains('e7-left') &&
                            !(container.children[0] as HTMLElement).classList.contains('e7-right');
                        if (isEmpty) return null;

                        // 檢查是否有基本的文章元素
                        const hasArticleLink = container.querySelector('a[href*="/bbs/"]');
                        if (!hasArticleLink) return null;

                        // 提取推文數
                        let recommendScore = '0';
                        const scoreElement =
                            container.querySelector('.e7-recommendScore') ||
                            container.querySelector('[e7description="推文:"]')?.parentElement ||
                            container.querySelector('i[e7description="推文:"]')?.parentElement ||
                            container.querySelector('[class*="recommend"][class*="Score"]');
                        if (scoreElement) {
                            const scoreText = scoreElement.textContent?.trim() || '0';
                            const scoreMatch = scoreText.match(/-?\d+/);
                            recommendScore = scoreMatch ? scoreMatch[0] : '0';
                        }

                        // 提取留言數
                        let recommendCount = '0';
                        const countElement =
                            container.querySelector('.e7-recommendCount') ||
                            container.querySelector('[e7description="回應:"]')?.parentElement ||
                            container.querySelector('i[e7description="回應:"]')?.parentElement ||
                            container.querySelector('[class*="recommend"][class*="Count"]');
                        if (countElement) {
                            const countText = countElement.textContent?.trim() || '0';
                            const countMatch = countText.match(/\d+/);
                            recommendCount = countMatch ? countMatch[0] : '0';
                        }

                        // 提取標題和連結
                        let titleLink = container.querySelector('a[href*="/bbs/"]');
                        const link = titleLink?.getAttribute('href') || '';

                        // 提取標題
                        let title = '';
                        if (titleLink) {
                            const desktopTitle = titleLink.querySelector('.e7-show-if-device-is-not-xs');
                            if (desktopTitle) {
                                title = desktopTitle.textContent?.trim() || '';
                            } else {
                                const mobileTitle = titleLink.querySelector('.e7-show-if-device-is-xs');
                                title = mobileTitle?.textContent?.trim() || '';
                            }

                            if (!title) {
                                const fullText = titleLink.textContent?.trim() || '';
                                const lines = fullText
                                    .split('\n')
                                    .map((line) => line.trim())
                                    .filter((line) => line);
                                title = lines[0] || '';
                            }
                        }

                        // 提取作者
                        let authorLink = container.querySelector('a[href*="/user/"]');
                        let author = '';

                        if (authorLink) {
                            author = authorLink.textContent?.trim() || '';
                            if (!author) {
                                const href = authorLink.getAttribute('href') || '';
                                const userMatch = href.match(/\/user\/(.+)$/);
                                if (userMatch) author = userMatch[1];
                            }
                        }

                        // 提取分類
                        let boardElement =
                            container.querySelector('.e7-boardName .e7-link-to-article') ||
                            container.querySelector('.e7-boardName') ||
                            container.querySelector('[class*="boardName"]');
                        let board = '';
                        if (boardElement) {
                            const boardText = boardElement.textContent?.trim() || '';
                            const boardMatch = boardText.match(/[[\s]*([^[\\]]+)[\]\s]*/);
                            board = boardMatch ? boardMatch[1].trim() : boardText.replace(/[[\]]/g, '').trim();
                        }

                        if (!board && link) {
                            const urlMatch = link.match(/\/bbs\/([^\/]+)\//);
                            if (urlMatch) board = urlMatch[1];
                        }

                        // 提取發文時間
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

                        // 提取照片
                        let imageUrl = '';
                        const imageElement = container.querySelector('.e7-preview img');
                        if (imageElement) {
                            imageUrl = imageElement.getAttribute('src') || '';
                        }

                        if (title && link) {
                            return {
                                recommendScore,
                                recommendCount,
                                title,
                                link,
                                author,
                                board,
                                publishTime,
                                imageUrl,
                            };
                        }
                    } catch (error) {
                        // ignore error
                    }
                    return null;
                })
                .filter((article) => article !== null);

            // 去重
            const uniqueArticles = [];
            const seenLinks = new Set();

            for (const article of articleData) {
                if (article && article.link && !seenLinks.has(article.link)) {
                    seenLinks.add(article.link);
                    uniqueArticles.push(article);

                    if (uniqueArticles.length >= Math.min(20, articleData.length)) {
                        break;
                    }
                }
            }

            return uniqueArticles;
        });

        await browser.close();
        browser = null;

        // 確保只取前20筆
        const finalArticles = articles.slice(0, Math.min(20, articles.length));

        saveData('ptt-trends.json', {
            total_found: articles.length,
            returned_count: finalArticles.length,
            articles: finalArticles,
        });

        logger.success(`擷取完成（按熱門度順序前${finalArticles.length}筆）：`);
        console.log('\n📋 前 3 篇文章範例：');
        finalArticles.slice(0, 3).forEach((article: PttArticle, index: number) => {
            console.log(`${index + 1}. ${article.title}`);
            console.log(`   推文數: ${article.recommendScore}, 留言數: ${article.recommendCount}`);
            console.log(`   作者: ${article.author}, 分類: ${article.board}`);
            console.log(`   發文時間: ${article.publishTime}`);
            console.log(`   照片: ${article.imageUrl ? '有' : '無'}`);
            console.log(`   連結: ${article.link}`);
            console.log('---');
        });
        logger.result(`總共找到 ${articles.length} 篇文章`);
        logger.info('取前20篇作為最終結果');

        if (finalArticles.length < 20) {
            logger.warn(`目標是20篇文章，但只找到 ${finalArticles.length} 篇`);
        } else {
            logger.success('成功取得前20篇文章！');
        }

        // 如果沒有找到任何文章，視為失敗
        if (finalArticles.length === 0) {
            logger.error('沒有找到任何文章');
            process.exit(1);
        }
    } catch (error) {
        logger.error('爬取失敗:', error);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
})();
