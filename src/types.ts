/**
 * BBC 趨勢資料介面
 *
 * @interface BBCTrend
 * @property {string} title - 新聞標題
 * @property {string} description - 新聞摘要描述
 * @property {string} link - 新聞連結網址
 * @property {string} pubDate - 發布日期時間
 * @property {string} guid - 全域唯一識別碼
 * @property {string} [thumbnail] - 縮圖網址 (選填)
 */
export interface BBCTrend {
    title: string;
    description: string;
    link: string;
    pubDate: string;
    guid: string;
    thumbnail?: string;
}

/**
 * Google 搜尋趨勢資料介面
 *
 * @interface GoogleTrend
 * @property {string} googleTrend - 關鍵字或話題名稱
 * @property {string} searchVolume - 搜尋量 (例如: "2,000+")
 * @property {string} started - 開始趨勢的時間 (例如: "2 小時前")
 */
export interface GoogleTrend {
    googleTrend: string;
    searchVolume: string;
    started: string;
}

/**
 * PTT 文章資料介面
 *
 * @interface PttArticle
 * @property {string} recommendScore - 推文分數
 * @property {string} recommendCount - 推文總數
 * @property {string} title - 文章標題
 * @property {string} link - 文章連結
 * @property {string} author - 作者 ID
 * @property {string} board - 看板名稱
 * @property {string} publishTime - 發文時間
 * @property {string} imageUrl - 預覽圖片網址
 */
export interface PttArticle {
    recommendScore: string;
    recommendCount: string;
    title: string;
    link: string;
    author: string;
    board: string;
    publishTime: string;
    imageUrl: string;
}

/**
 * Komica (K島) 趨勢資料介面
 *
 * @interface KomicaTrend
 * @property {number} replyCount - 回覆數量
 * @property {string} date - 發文日期
 * @property {string} time - 發文時間
 * @property {string} title - 文章標題 (通常為 "無題")
 * @property {string} description - 文章內容摘要
 * @property {string} link - 討論串連結
 * @property {string} rawText - 原始解析文本
 */
export interface KomicaTrend {
    replyCount: number;
    date: string;
    time: string;
    title: string;
    description: string;
    link: string;
    rawText: string;
}

/**
 * Reddit 資料介面
 *
 * @interface RedditData
 * @property {string} updated - 資料更新時間
 * @property {string} source - 資料來源描述
 * @property {number} total_posts - 總貼文數
 * @property {any} original_data - Reddit API 回傳的原始資料
 */
export interface RedditData {
    updated: string;
    source: string;
    total_posts: number;
    original_data: any;
}
