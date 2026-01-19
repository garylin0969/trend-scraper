import fs from 'fs';
import path from 'path';
import { logger } from './logger';

/**
 * 將資料儲存為 JSON 檔案
 *
 * @param {string} filename - 檔案名稱 (包含副檔名，例如 'data.json')
 * @param {any} data - 要儲存的資料物件
 * @throws {Error} 如果儲存過程發生錯誤
 * @description
 * 1. 確保 'data' 目錄存在，若不存在則建立。
 * 2. 如果資料物件中沒有 'updated' 欄位，自動加入當前時間。
 * 3. 將資料序列化為 JSON 格式並寫入檔案。
 */
export const saveData = (filename: string, data: any) => {
    try {
        const dataDir = 'data';
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const filePath = path.join(dataDir, filename);

        // 確保有一致的 updated 時間戳記
        // 如果傳入的資料是物件且沒有 updated 欄位，則自動加入

        let output = data;
        if (typeof data === 'object' && data !== null && !data.updated) {
            output = {
                updated: new Date().toISOString(),
                ...data,
            };
        }

        fs.writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
        logger.success(`Data saved to ${filePath}`);
    } catch (error) {
        logger.error(`Failed to save data to ${filename}`, error);
        throw error;
    }
};
