/**
 * 簡易日誌工具
 * 提供不同級別的日誌輸出，並帶有 emoji 前綴以便識別。
 */
export const logger = {
    /** 輸出一般資訊 */
    info: (msg: string) => console.log(`ℹ️  ${msg}`),
    /** 輸出成功訊息 */
    success: (msg: string) => console.log(`✅ ${msg}`),
    /** 輸出警告訊息 */
    warn: (msg: string) => console.log(`⚠️  ${msg}`),
    /** 輸出錯誤訊息 */
    error: (msg: string, error?: any) => console.error(`❌ ${msg}`, error || ''),
    /** 輸出開始執行訊息 */
    start: (msg: string) => console.log(`🚀 ${msg}`),
    /** 輸出結果統計訊息 */
    result: (msg: string) => console.log(`📊 ${msg}`),
};
