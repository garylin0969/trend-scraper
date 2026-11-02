/** 共用執行流程：收集 → 契約驗證 → 儲存；失敗時有限次重試，試跑時略過寫檔。 */
import { setTimeout as delay } from 'node:timers/promises';
import { feedSchemas, filenames, type SourceName } from '../contracts.js';
import { saveFeed } from './storage.js';
import { errorMessage, log } from './logger.js';

/** collect 僅負責取得資料；寫檔、重試及試跑行為統一由此處管理。 */
export async function runSource(
    source: SourceName,
    collect: () => Promise<unknown>,
    options: {
        /** 只收集及驗證，不寫入正式 JSON。 */
        dryRun?: boolean;
        /** 總嘗試次數（包含第一次執行），預設為兩次。 */
        attempts?: number;
        /** 覆寫重試等待毫秒數；測試使用 0 可避免真的等待。 */
        retryDelayMs?: number;
    } = {},
): Promise<void> {
    // 預設總共嘗試兩次；測試可覆寫次數與等待時間，不必真的等待兩秒。
    const attempts = options.attempts ?? 2;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const started = Date.now();
        try {
            log(source, `Starting attempt ${attempt}/${attempts}`);
            // 資料先通過公開契約才可寫入；解析空清單或型別不符會進入失敗流程。
            const feed = feedSchemas[source].parse(await collect());
            const count = 'articles' in feed ? feed.articles.length : feed.trends.length;
            // 試跑照常取得並驗證資料，但完全不寫入 /data。
            if (!options.dryRun) await saveFeed(source, feed);
            log(
                source,
                `${options.dryRun ? 'Validated (dry run)' : `Saved data/${filenames[source]}`}: ${count} items in ${Date.now() - started}ms`,
            );
            return;
        } catch (error) {
            log(source, `Attempt ${attempt} failed: ${errorMessage(error)}`);
            // 最後一次失敗必須向上拋錯，CLI 才能回傳非零退出碼。
            if (attempt === attempts) throw error;
            // 預設第一次重試前等兩秒；增加嘗試次數時，等待時間也隨次數增加。
            await delay(options.retryDelayMs ?? 2_000 * attempt);
        }
    }
}
