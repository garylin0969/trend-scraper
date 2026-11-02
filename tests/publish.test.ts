/** 發布整合測試：以暫存 Git 倉庫模擬兩個排程先後推送，不會連到真正的 GitHub。 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// 呼叫正式發布腳本，但將工作目錄與遠端都指向測試建立的本機倉庫。
const publish = fileURLToPath(new URL('../scripts/publish-data.sh', import.meta.url));
const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
test('Publishing from a stale checkout preserves another source update through rebase', async () => {
    const root = await mkdtemp(join(tmpdir(), 'trend-publish-'));
    try {
        // bare 倉庫扮演遠端；兩份 clone 模擬不同來源的 Actions checkout。
        const remote = join(root, 'remote.git');
        const first = join(root, 'first');
        const second = join(root, 'second');
        git(root, 'init', '--bare', '--initial-branch=main', remote);
        git(root, 'clone', remote, first);
        git(first, 'config', 'user.name', 'Test');
        git(first, 'config', 'user.email', 'test@example.com');
        await mkdir(join(first, 'data'));
        await writeFile(join(first, 'data/google-trends.json'), 'google initial');
        await writeFile(join(first, 'data/ptt-trends.json'), 'ptt initial');
        git(first, 'add', '.');
        git(first, 'commit', '-m', 'initial');
        git(first, 'push', 'origin', 'main');
        // 第二份 checkout 停留在舊版狀態；第一份先發布 Google 更新。
        git(root, 'clone', remote, second);
        await writeFile(join(first, 'data/google-trends.json'), 'google updated');
        execFileSync('bash', [publish, 'google'], { cwd: first, stdio: 'pipe' });
        // 第二份發布 PTT 時必須先 rebase，完成後遠端要同時保有兩個來源的新內容。
        await writeFile(join(second, 'data/ptt-trends.json'), 'ptt updated');
        execFileSync('bash', [publish, 'ptt'], { cwd: second, stdio: 'pipe' });
        assert.equal(git(remote, 'show', 'main:data/google-trends.json'), 'google updated');
        assert.equal(git(remote, 'show', 'main:data/ptt-trends.json'), 'ptt updated');
        assert.equal(await readFile(join(second, 'data/google-trends.json'), 'utf8'), 'google updated');
        // 再次發布未變更的資料應直接結束，不建立空提交；非法來源名稱也應拒絕。
        const head = git(second, 'rev-parse', 'HEAD');
        execFileSync('bash', [publish, 'ptt'], { cwd: second, stdio: 'pipe' });
        assert.equal(
            git(second, 'rev-parse', 'HEAD'),
            head,
            'unchanged output must not create another commit',
        );
        assert.throws(() => execFileSync('bash', [publish, '../bad'], { cwd: second, stdio: 'pipe' }));
    } finally {
        // 無論測試成功或失敗，都清理暫存倉庫。
        await rm(root, { recursive: true, force: true });
    }
});
