/** 命令列入口：選擇資料來源與試跑模式，再交給共用執行器處理重試和儲存。 */
import { sourceNames, type SourceName } from './contracts.js';
import { runSource } from './core/runner.js';
import { errorMessage } from './core/logger.js';

// 動態載入指定來源，避免執行 RSS 爬蟲時也載入不需要的瀏覽器模組。
const loaders = {
    bbc: async () => (await import('./sources/bbc.js')).scrapeBbc(),
    google: async () => (await import('./sources/google.js')).scrapeGoogle(),
    komica: async () => (await import('./sources/komica.js')).scrapeKomica(),
    ptt: async () => (await import('./sources/ptt.js')).scrapePtt(),
};
// 前兩個參數是 Node 與程式路徑；剩下才是來源名稱及 --dry-run。
const args = process.argv.slice(2);
const source = args[0];
// 只接受已登記的來源與選項，避免拼字錯誤造成非預期執行。
if (!sourceNames.includes(source as SourceName) || args.slice(1).some((arg) => arg !== '--dry-run')) {
    console.error('Usage: pnpm scrape <bbc|google|komica|ptt> [--dry-run]');
    process.exitCode = 1;
} else {
    try {
        await runSource(source as SourceName, loaders[source as SourceName], {
            dryRun: args.includes('--dry-run'),
        });
    } catch (error) {
        console.error(errorMessage(error));
        // 設定失敗退出碼，讓 Actions 正確標記失敗，同時允許清理作業完成。
        process.exitCode = 1;
    }
}
