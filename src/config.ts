/** 集中管理來源網址與共用設定；公開資料的路徑固定以專案根目錄為基準。 */
import { fileURLToPath } from 'node:url';

// 從目前模組位置換算專案根目錄，不使用可能因啟動方式而改變的工作目錄。
export const ROOT = fileURLToPath(new URL('../', import.meta.url));
// 各來源入口；更換網址時也要確認對應解析器是否仍適用。
export const URLS = {
    bbc: 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml',
    google: 'https://trends.google.com.tw/trending?geo=TW&hours=4',
    komica: 'https://gita.komica1.org/00b/catlist.php',
    ptt: 'https://www.pttweb.cc/hot/all/today',
} as const;
// HTTP 請求固定使用桌面版識別，降低來源因裝置差異回傳不同 HTML 的機會。
export const HTTP_USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
