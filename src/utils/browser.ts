import puppeteer, { Browser, Page } from 'puppeteer';
import { USER_AGENTS } from '../config/constants';
import { getRandomUserAgent } from './common';

/**
 * 建立並啟動 Puppeteer 瀏覽器實例
 * 
 * @returns {Promise<Browser>} 回傳啟動的瀏覽器實例
 * @description
 * 啟動一個無頭模式 (Headless) 的 Chromium 瀏覽器。
 * 使用了一些參數來禁用沙盒模式並隱藏自動化特徵，以降低被偵測的風險。
 */
export const createBrowser = async (): Promise<Browser> => {
    return await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-features=VizDisplayCompositor',
        ],
    });
};

/**
 * 設定頁面參數以模擬真實使用者
 * 
 * @param {Page} page - Puppeteer 頁面物件
 * @returns {Promise<void>}
 * @description
 * 1. 設定隨機的 User Agent。
 * 2. 設定視窗大小為 1920x1080。
 * 3. 移除 navigator.webdriver 屬性，隱藏自動化工具的特徵。
 */
export const configurePage = async (page: Page): Promise<void> => {
    await page.setUserAgent(getRandomUserAgent(USER_AGENTS));
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Remove webdriver traces
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });
};