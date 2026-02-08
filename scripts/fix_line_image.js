import { execSync, spawnSync } from 'child_process';
import { uploadToR2 } from './upload_r2.js';
import fs from 'fs';

const ticker = "8033.TW";
const TARGET_USER = "U03d92f2cc0d998fcf4c81e69735e12ee";

async function run() {
    console.log(`Generating Robust Daily K Chart...`);
    
    const labels = ['01/22', '01/23', '01/24', '01/27', '02/02'];
    const priceData = [140.5, 142.0, 145.5, 145.5, 137.5];

    const chartConfig = {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '雷虎 (8033.TW) 日K',
                data: priceData,
                borderColor: '#FF0000',
                backgroundColor: 'white',
                fill: false,
                borderWidth: 4
            }]
        },
        options: {
            devicePixelRatio: 2, // Increase density
            scales: { y: { beginAtZero: false } }
        }
    };

    // Use a unique filename and NO query params to avoid LINE caching issues
    const timestamp = Date.now();
    const fileName = `daily_k_fix_${timestamp}.jpg`;
    const tempFile = `/tmp/${fileName}`;
    
    const quickChartUrl = `https://quickchart.io/chart?format=jpg&bkg=white&width=800&height=500&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    
    execSync(`curl -s -o ${tempFile} "${quickChartUrl}"`);
    
    // Upload to R2
    const r2Url = await uploadToR2(tempFile);
    fs.unlinkSync(tempFile);

    console.log(`URL to send: ${r2Url}`);

    // Direct message tool call via Moltbot internal logic is often safer than CLI for attachments
    // But since I'm in an agent loop, I'll use the CLI with simplified parameters
    const msg = `【圖片顯示修正測試】日K解析度圖表。如果看到圖片請回傳 OK。 URL: ${r2Url}`;
    
    const result = spawnSync('moltbot', [
        'message', 'send',
        '--target', TARGET_USER,
        '--message', msg,
        '--media', r2Url,
        '--channel', 'line'
    ], { encoding: 'utf-8' });

    console.log(result.stdout);
}

run();
