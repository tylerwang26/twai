import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import { uploadToR2 } from './upload.js';
import { spawnSync } from 'child_process';

const width = 1200;
const height = 900;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height, 
    backgroundColour: 'white'
});

async function renderProCandlestick(ticker, data, targetUser) {
    console.log(`Rendering Professional Candlestick for ${ticker}...`);

    const labels = data.map(d => d.t);
    const RED = '#ef4444'; // Taiwan Red (Up)
    const GREEN = '#10b981'; // Taiwan Green (Down)

    // Data Mapping for "Box and Whisker" style Candlesticks using Bar chart
    // 1. Wick (Low to High)
    const wickData = data.map(d => [d.l, d.h]);
    // 2. Body (Open to Close)
    const bodyData = data.map(d => [d.o, d.c]);
    const bodyColors = data.map(d => d.c >= d.o ? RED : GREEN);
    
    // Moving Averages
    const ma5 = data.map(d => d.ma5);
    const ma10 = data.map(d => d.ma10);

    const configuration = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                // Wicks
                {
                    label: 'Wick',
                    data: wickData,
                    backgroundColor: bodyColors,
                    barThickness: 2,
                    yAxisID: 'yPrice',
                },
                // Bodies
                {
                    label: 'Body',
                    data: bodyData,
                    backgroundColor: bodyColors,
                    barThickness: 20,
                    yAxisID: 'yPrice',
                },
                // MA5
                {
                    type: 'line',
                    label: 'MA5',
                    data: ma5,
                    borderColor: '#3b82f6',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'yPrice',
                },
                // MA10
                {
                    type: 'line',
                    label: 'MA10',
                    data: ma10,
                    borderColor: '#f59e0b',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false,
                    yAxisID: 'yPrice',
                },
                // Volume
                {
                    type: 'bar',
                    label: 'Volume',
                    data: data.map(d => d.v),
                    backgroundColor: 'rgba(156, 163, 175, 0.2)',
                    yAxisID: 'yVol',
                }
            ]
        },
        options: {
            plugins: {
                title: { display: true, text: `${ticker} 專業日K診斷圖 (漲紅跌綠)`, font: { size: 24 } },
                legend: { position: 'bottom' }
            },
            scales: {
                yPrice: { position: 'right', title: { display: true, text: '價格' }, grid: { color: '#f3f4f6' } },
                yVol: { display: false, max: Math.max(...data.map(d => d.v)) * 4 }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    const fileName = `pro_candlestick_${Date.now()}.jpg`;
    const filePath = `/tmp/${fileName}`;
    fs.writeFileSync(filePath, image);

    const r2Url = await uploadToR2(filePath);
    fs.unlinkSync(filePath);

    const report = `【MIR 專業蠟燭圖報告】
標的：${ticker}
狀態：系統已切換至「專業渲染引擎」
特點：漲紅跌綠蠟燭圖、SMA 5/10 均線、同步成交量。
圖表：${r2Url}`;

    if (targetUser) {
        spawnSync('moltbot', [
            'message', 'send',
            '--target', targetUser,
            '--message', report,
            '--media', r2Url,
            '--channel', 'line'
        ]);
    }
    console.log(r2Url);
}

// Mock data for NVIDIA demonstration
const mockData = [
    { t: '01/20', o: 130, h: 135, l: 128, c: 132, v: 50000, ma5: 128, ma10: 125 },
    { t: '01/21', o: 132, h: 138, l: 131, c: 137, v: 62000, ma5: 130, ma10: 126 },
    { t: '01/22', o: 137, h: 145, l: 136, c: 143, v: 85000, ma5: 133, ma10: 128 },
    { t: '01/23', o: 143, h: 144, l: 139, c: 140, v: 55000, ma5: 136, ma10: 130 },
    { t: '02/02', o: 140, h: 142, l: 135, c: 137.5, v: 60000, ma5: 138, ma10: 132 },
];

const t = process.argv[2] || "NVDA";
const u = process.argv[3];
renderProCandlestick(t, mockData, u);
