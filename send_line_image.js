import { messagingApi } from "@line/bot-sdk";
import fs from 'fs';

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const to = "U03d92f2cc0d998fcf4c81e69735e12ee";
const filePath = process.argv[2];

if (!token || !filePath) {
    console.error("Missing token or filePath");
    process.exit(1);
}

// 注意：LINE Messaging API 不支援直接上傳本地檔案來發送圖片，
// 必須提供一個公開可存取的 URL。
// 這就是為什麼之前的 filePath 參數會失敗 (因為它是本地路徑)。

console.log("LINE Messaging API requires a public URL for images.");
console.log("Current filePath:", filePath);
process.exit(1);
