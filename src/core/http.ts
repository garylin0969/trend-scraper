/** 提供有時間上限的文字請求，適用於靜態 HTML 與 RSS，不需要啟動瀏覽器。 */
import { HTTP_USER_AGENT } from '../config.js';

/** 保留 HTTP 狀態碼與最終網址，供日誌判斷封鎖、來源失效等問題。 */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        url: string,
    ) {
        super(`HTTP ${status}: ${url}`);
    }
}
/** 取得文字內容；網路或 HTTP 錯誤交由上層決定重試或切換瀏覽器。 */
export async function fetchText(url: string): Promise<string> {
    const response = await fetch(url, {
        // 請求逾時即取消，避免單次連線無限等待。
        signal: AbortSignal.timeout(30_000),
        headers: { 'User-Agent': HTTP_USER_AGENT, 'Accept-Language': 'zh-TW,zh;q=0.9,en;q=0.8' },
    });
    // fetch 不會因 403、404、500 自動拋錯，必須明確檢查狀態。
    if (!response.ok) throw new HttpError(response.status, response.url);
    return response.text();
}
