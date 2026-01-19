/**
 * 使用者代理 (User Agent) 列表
 * 用於模擬不同的瀏覽器環境，避免被目標網站封鎖。
 * 包含 Windows, macOS, Linux, iPhone 等常見裝置。
 */
export const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.6312.86 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:124.0) Gecko/20100101 Firefox/124.0',
];

/**
 * 目標網站網址設定
 * 定義所有需要爬取的網站入口點。
 */
export const URLS = {
    /** BBC 中文網 RSS Feed */
    BBC_RSS: 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml',
    /** Google 台灣即時搜尋趨勢 (過去 4 小時) */
    GOOGLE_TRENDS: 'https://trends.google.com.tw/trending?geo=TW&hours=4',
    /** PTT Web 版今日熱門文章 */
    PTT_HOT: 'https://www.pttweb.cc/hot/all/today',
    /** Komica (K島) 綜合版目錄 */
    KOMICA_CATLIST: 'https://gita.komica1.org/00b/catlist.php',
    /** Reddit r/all 熱門文章 (限制 50 筆) */
    REDDIT_ALL: 'https://www.reddit.com/r/all/hot.json?limit=50',
    /** Reddit r/Taiwanese 熱門文章 (限制 50 筆) */
    REDDIT_TAIWANESE: 'https://www.reddit.com/r/Taiwanese/hot.json?limit=50',
    /** Reddit r/China_irl 熱門文章 (限制 50 筆) */
    REDDIT_CHINA_IRL: 'https://www.reddit.com/r/China_irl/hot.json?limit=50',
};
