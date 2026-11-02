/** 管理瀏覽器的建立、關閉、導覽與失敗診斷，讓各來源只需處理頁面內容。 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { ROOT } from '../config.js';
import { log } from './logger.js';

/** 執行來源提供的頁面工作；成功回傳結果，失敗保留診斷，最後一定嘗試關閉瀏覽器。 */
export async function withBrowser<T>(source: string, work: (page: Page) => Promise<T>): Promise<T> {
    const browser = await chromium.launch({ headless: true });
    try {
        // 每次工作使用獨立瀏覽器環境；固定繁中與桌面尺寸，使選擇器及時間文字較一致。
        const context = await browser.newContext({
            locale: 'zh-TW',
            viewport: { width: 1920, height: 1080 },
        });
        // 元素等待與整頁導覽分別設定上限，避免來源卡住而耗盡排程時間。
        context.setDefaultTimeout(30_000);
        context.setDefaultNavigationTimeout(60_000);
        // 工作開始前就錄製 trace，失敗時才能回看導覽與頁面變化。
        await context.tracing.start({ screenshots: true, snapshots: true });
        const page = await context.newPage();
        try {
            const result = await work(page);
            // 成功時停止錄製但不輸出 trace，減少正常執行留下的檔案。
            await context.tracing.stop();
            return result;
        } catch (error) {
            // 每次失敗使用獨立目錄，避免重試時覆蓋前一次的診斷。
            const directory = join(ROOT, 'artifacts', source, `${Date.now()}`);
            try {
                await mkdir(directory, { recursive: true });
                // 各項診斷獨立執行；即使截圖失敗，也繼續嘗試保存 HTML 與 trace。
                await Promise.allSettled([
                    page.content().then((html) => writeFile(join(directory, 'page.html'), html)),
                    page.screenshot({ path: join(directory, 'page.png'), timeout: 5_000 }),
                    context.tracing.stop({ path: join(directory, 'trace.zip') }),
                ]);
                log(source, `Failure at ${page.url()}; diagnostics: ${directory}`);
            } catch {
                /* 診斷本身失敗時保留原始錯誤，避免掩蓋真正的爬取原因。 */
            }
            throw error;
        }
    } finally {
        // 無論成功或拋出例外都釋放程序，也會關閉所屬頁面與 context。
        await browser.close();
    }
}
/** 導覽到來源頁面；除了連線錯誤，也將 HTTP 錯誤狀態視為失敗。 */
export async function navigate(page: Page, url: string): Promise<void> {
    // DOM 就緒即可往下執行；各來源另外等待自己的資料，不等待所有外部資源載完。
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
    if (!response || !response.ok()) throw new Error(`Navigation failed: ${response?.status()} ${url}`);
}
