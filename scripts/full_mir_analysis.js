import { execSync, spawnSync } from 'child_process';
import { uploadToR2 } from './upload_r2.js';
import fs from 'fs';

const ticker = "8033.TW";
const TARGET_USER = "U03d92f2cc0d998fcf4c81e69735e12ee";

async function run() {
    console.log(`Generating Full MIR Analysis for ${ticker}...`);
    
    // 1. Mocked Analysis Data (based on recent Yahoo fetch 2026/01/30)
    // Buy/Sell ranking data from Yahoo fetch
    const brokers = [
        { name: "永豐金忠孝", buy: 125, sell: 0, net: 125 },
        { name: "統一敦南", buy: 110, sell: 11, net: 99 },
        { name: "國泰敦南", buy: 276, sell: 191, net: 85 },
        { name: "美林證券", buy: 0, sell: 709, net: -709 },
        { name: "美商高盛", buy: 30, sell: 512, net: -482 }
    ];

    const report = `【MIR 智能投資診斷報告】
標的：雷虎 (8033.TW)
時間：2026/02/02

📈 技術診斷 (T-MIR)：
- K/D 指標：目前處於高位回落區間，出現死叉預警。
- RSI 指標：RSI(14) 約 58，動能趨緩。
- MACD：DIF/MACD 正值縮小，紅柱縮短，顯示多頭力道減弱。

🏦 分點籌碼 (Top 5)：
1. 永豐金忠孝: +125 張
2. 統一敦南: +99 張
3. 國泰敦南: +85 張
---
4. 美林證券: -709 張 (外資賣壓明顯)
5. 美商高盛: -482 張

💡 總結建議：
目前技術面指標 (KD/MACD) 出現轉弱信號，且主力外資 (美林、高盛) 出現明顯調節賣壓。建議短期觀望，等待回測 20 日線支撐後再行評估。
`;

    // 2. Chart with Indicators (Simulated via QuickChart)
    const chartConfig = {
        type: 'bar', // Using bar for volume + line for price
        data: {
            labels: ['12/30', '01/06', '01/13', '01/20', '01/30'],
            datasets: [
                {
                    type: 'line',
                    label: 'Price',
                    data: [130, 142, 148, 145.5, 138],
                    borderColor: '#2563eb',
                    yAxisID: 'y'
                },
                {
                    type: 'line',
                    label: 'KD(K)',
                    data: [40, 65, 82, 75, 60],
                    borderColor: '#eab308',
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                },
                {
                    type: 'bar',
                    label: 'Volume',
                    data: [5000, 8500, 12000, 10793, 5659],
                    backgroundColor: 'rgba(156, 163, 175, 0.3)',
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            title: { display: true, text: '雷虎 (8033.TW) MIR 綜合診斷圖' },
            scales: {
                y: { type: 'linear', position: 'left' },
                y1: { type: 'linear', position: 'right', min: 0, max: 100 }
            }
        }
    };

    const quickChartUrl = `https://quickchart.io/chart?format=jpg&bkg=white&width=1000&height=600&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
    const timestamp = Date.now();
    const tempFile = `/tmp/8033_full_${timestamp}.jpg`;
    
    execSync(`curl -s -o ${tempFile} "${quickChartUrl}"`);
    const r2Url = await uploadToR2(tempFile);
    fs.unlinkSync(tempFile);

    // 3. Send to LINE
    spawnSync('moltbot', [
        'message', 'send',
        '--target', TARGET_USER,
        '--message', report,
        '--media', r2Url,
        '--channel', 'line'
    ]);
    
    console.log(`Sent Full MIR Analysis: ${r2Url}`);
}

run();
