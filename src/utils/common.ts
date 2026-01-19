/**
 * 暫停執行指定的時間
 *
 * @param {number} ms - 暫停的毫秒數
 * @returns {Promise<void>}
 */
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 從列表中隨機取得一個 User Agent
 *
 * @param {string[]} userAgents - User Agent 字串陣列
 * @returns {string} 隨機選取的 User Agent
 */
export const getRandomUserAgent = (userAgents: string[]) => {
    return userAgents[Math.floor(Math.random() * userAgents.length)];
};
