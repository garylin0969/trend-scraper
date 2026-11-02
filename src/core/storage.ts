/** 公開資料寫入層：先驗證內容，再原子替換檔案，避免讀取端拿到寫入一半的 JSON。 */
import { mkdir, rename, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ROOT } from '../config.js';
import { feedSchemas, filenames, type SourceName } from '../contracts.js';

/** 正式資料固定寫入專案的 data；測試可傳入暫存目錄，避免碰到公開檔案。 */
export async function saveFeed(
    source: SourceName,
    input: unknown,
    dataDir = join(ROOT, 'data'),
): Promise<void> {
    // 在任何寫檔動作之前驗證，空資料或格式錯誤時保留上次成功結果。
    const feed = feedSchemas[source].parse(input);
    await mkdir(dataDir, { recursive: true });
    const destination = join(dataDir, filenames[source]);
    // 暫存檔與目標放在同一目錄，讓 rename 可進行原子替換；UUID 避免撞名。
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
        // wx 表示只建立新檔，不覆蓋已存在的同名暫存檔。
        await writeFile(temporary, JSON.stringify(feed, null, 2), { encoding: 'utf8', flag: 'wx' });
        // 等整份 JSON 寫完才替換正式檔，讀取端只會看到完整的新檔或舊檔。
        await rename(temporary, destination);
    } finally {
        // 成功後暫存路徑已不存在；失敗時則清掉尚未替換的殘留檔案。
        await rm(temporary, { force: true });
    }
}
