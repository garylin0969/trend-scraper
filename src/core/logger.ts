/** 共用日誌格式：標記時間與來源，方便在 Actions 中追查單次執行的問題。 */
// ISO UTC 時間便於對照不同來源、不同執行環境的紀錄。
export const log = (source: string, message: string): void => {
    console.log(`${new Date().toISOString()} [${source}] ${message}`);
};
// catch 接到的值不一定是 Error，統一轉成可輸出的訊息。
export const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
