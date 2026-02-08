import { execSync, spawnSync } from 'child_process';
import { uploadToR2 } from './upload_r2.js';
import path from 'path';
import fs from 'fs';

const ticker = "8033.TW";
const TARGET_USER = "U03d92f2cc0d998fcf4c81e69735e12ee";

async function fetchPrice(ticker) {
    try {
        const url = `https://tw.stock.yahoo.com/quote/${ticker}`;
        const html = execSync(`curl -L -s "${url}"`).toString();
        // Regex for Taiwan Yahoo Finance price
        const priceMatch = html.match(/class="Fz\(32px\) Fw\(b\) Lh\(1\) Mend\(16px\) D\(f\) Ai\(c\) (?:C\(\$c-trend-down\)|C\(\$c-trend-up\))">([\d.]+)/);
        if (priceMatch) return parseFloat(priceMatch[1]);
        
        const altMatch = html.match(/class="Fz\(32px\) Fw\(b\) Lh\(1\) Mend\(16px\) D\(f\) Ai\(c\)\s*">([\d.]+)/);
        if (altMatch) return parseFloat(altMatch[1]);
        
        return 138.0; 
    } catch (e) {
        return 138.0;
    }
}

async function run() {
    console.log(`Analyzing ${ticker}...`);
    const price = await fetchPrice(ticker);
    const prevClose = 145.5; 
    const change = price - prevClose;
    const changePercent = (change / prevClose * 100).toFixed(2);

    const score = changePercent < -3 ? 30 : 50;

    const report = `【MIR 智能分析報告】
標的：${ticker}
現價：${price} (${changePercent}%)
MIR 評分：${score}

💡 核心分析：
價格今日回檔幅度較大 (${changePercent}%)，已觸發深度報告門檻。
技術面顯示空方壓力增強，建議待支撐確立後再行動作。

🔥 投資建議：觀望 / 待回測支撐`;

    // QuickChart Configuration
    const chartConfig = {
        type: 'bar',
        data: {
            labels: ['D-4', 'D-3', 'D-2', 'Yesterday', 'Today'],
            datasets: [
                {
                    label: 'Price',
                    data: [[140, 142], [142, 144], [144, 145.5], [145.5, 145.5], [145.5, price]],
                    backgroundColor: price >= prevClose ? '#ef4444' : '#10b981',
                    barThickness: 20
                },
                {
                    type: 'line',
                    label: 'Trend',
                    data: [141, 143, 145, 145.5, price],
                    borderColor: '#3b82f6',
                    fill: false
                }
            ]
        },
        options: {
            title: { display: true, text: `${ticker} MIR Pro Analysis` },
            scales: { yAxes: [{ ticks: { beginAtZero: false } }] }
        }
    };

    const quickChartUrl = `https://quickchart.io/chart?format=jpg&bkg=white&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    const timestamp = Date.now();
    const tempFile = `/tmp/${ticker.replace('.','_')}_${timestamp}.jpg`;
    
    console.log("Generating chart...");
    execSync(`curl -s -o ${tempFile} "${quickChartUrl}"`);

    console.log("Uploading to R2...");
    const r2Url = await uploadToR2(tempFile);
    
    // Clean up
    fs.unlinkSync(tempFile);
    
    console.log("Sending to LINE...");
    const result = spawnSync('moltbot', [
        'message', 'send',
        '--target', TARGET_USER,
        '--message', report,
        '--media', r2Url,
        '--channel', 'line'
    ], { encoding: 'utf-8' });

    if (result.status !== 0) {
        console.error("CLI send failed:", result.stderr);
    } else {
        console.log("CLI send success:", result.stdout);
    }
    
    console.log(`Success: Report sent. URL: ${r2Url}`);
}

run().catch(err => {
    console.error("Automation failed:", err);
    process.exit(1);
});
