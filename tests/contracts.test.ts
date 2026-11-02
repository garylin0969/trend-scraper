/** 介面與儲存回歸測試：確保既有 JSON 保持相容，失敗或試跑時不覆蓋正式資料。 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { feedSchemas, filenames, sourceNames } from '../src/contracts.js';
import { saveFeed } from '../src/core/storage.js';
import { runSource } from '../src/core/runner.js';

// 直接用 repository 既有資料驗證；深度比較可抓出欄位被省略、轉型或新增的情況。
for (const source of sourceNames) {
    test(`Public ${source} JSON round-trips without any field or type changes`, async () => {
        const existing: unknown = JSON.parse(
            await readFile(new URL(`../data/${filenames[source]}`, import.meta.url), 'utf8'),
        );
        assert.deepEqual(feedSchemas[source].parse(existing), existing);
    });
}
// 共用的有效 Google 輸出樣本，供驗證、寫檔與重試測試使用。
const valid = {
    updated: '2026-11-02T00:00:00.000Z',
    trends: [{ googleTrend: 'test', searchVolume: '500+', started: '3 小時前' }],
};
// 寫檔測試使用獨立暫存目錄；先留下舊內容，再確認無效資料不會覆蓋它。
test('Storage rejects empty/malformed data without changing the existing public file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'trend-storage-'));
    try {
        const path = join(dir, filenames.google);
        await writeFile(path, 'previous good data');
        await assert.rejects(saveFeed('google', { ...valid, trends: [] }, dir));
        await assert.rejects(saveFeed('google', { ...valid, extra: 'not part of the API' }, dir));
        assert.equal(await readFile(path, 'utf8'), 'previous good data');
        await saveFeed('google', valid, dir);
        assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), valid);
        assert.deepEqual(await readdir(dir), [filenames.google]);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
// 計數與清單不一致時必須拒絕，避免讀取端取得互相矛盾的資料。
test('PTT count mismatches are rejected', async () => {
    const file = JSON.parse(await readFile(new URL('../data/ptt-trends.json', import.meta.url), 'utf8'));
    assert.equal(feedSchemas.ptt.safeParse({ ...file, returned_count: 1 }).success, false);
});
// 第一次故意拋出暫時性錯誤；第二次成功，且試跑前後的正式檔案必須完全相同。
test('Runner retries transient failures and dry run never changes public data', async () => {
    const path = new URL('../data/google-trends.json', import.meta.url);
    const previous = await readFile(path, 'utf8');
    let calls = 0;
    await runSource(
        'google',
        async () => {
            calls++;
            if (calls === 1) throw new Error('temporary network failure');
            return valid;
        },
        { dryRun: true, retryDelayMs: 0 },
    );
    assert.equal(calls, 2);
    assert.equal(await readFile(path, 'utf8'), previous);
    await assert.rejects(
        runSource('google', async () => ({ ...valid, trends: [] }), { dryRun: true, attempts: 1 }),
    );
    assert.equal(await readFile(path, 'utf8'), previous);
});
