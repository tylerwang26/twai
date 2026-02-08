import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import { uploadToR2 } from './upload.js';
import { spawnSync } from 'child_process';

const width = 1200;
const height = 2000; 

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height, 
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = 'Noto Sans CJK TC';
    }
});

function getDisplayName(ticker) {
    const map = {
        '2330.TW': '台積電 (TSMC)',
        '2408.TW': '南亞科 (Nanya Tech)',
        '8033.TW': '雷虎 (Thunder Tiger)',
        'MU': '美光科技 (Micron Technology)',
        'NVDA': '輝達 (NVIDIA Corporation)',
        'AMD': '超微半導體 (Advanced Micro Devices)',
        '2317.TW': '鴻海 (Foxconn)',
        '2317': '鴻海 (Foxconn)'
    };
    return map[ticker.toUpperCase()] || ticker;
}

function calculateMA(data, period) {
    return data.map((_, i) => i < period - 1 ? null : data.slice(i - (period - 1), i + 1).reduce((a, b) => a + b) / period);
}

function calculateMACD(prices, shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
    const ema = (data, period) => {
        const k = 2 / (period + 1);
        let emaVal = data[0];
        return data.map(val => emaVal = val * k + emaVal * (1 - k));
    };
    const ema12 = ema(prices, shortPeriod);
    const ema26 = ema(prices, longPeriod);
    const dif = ema12.map((v, i) => v - ema26[i]);
    const dea = ema(dif, signalPeriod);
    const hist = dif.map((v, i) => v - dea[i]);
    return { dif, dea, hist };
}

function calculateKD(highs, lows, closes, n = 9, m1 = 3, m2 = 3) {
    const kValues = [], dValues = [];
    let prevK = 50, prevD = 50;
    for (let i = 0; i < closes.length; i++) {
        const recentH = Math.max(...highs.slice(Math.max(0, i - n + 1), i + 1));
        const recentL = Math.min(...lows.slice(Math.max(0, i - n + 1), i + 1));
        const rsv = recentH === recentL ? 50 : ((closes[i] - recentL) / (recentH - recentL)) * 100;
        const k = (2 / m1) * prevK + (1 / m1) * rsv;
        const d = (2 / m2) * prevD + (1 / m2) * k;
        kValues.push(k); dValues.push(d);
        prevK = k; prevD = d;
    }
    return { k: kValues, d: dValues };
}

function calculateRSI(prices, period) {
    const result = [null];
    for (let i = 1; i < prices.length; i++) {
        let change = prices.slice(Math.max(0, i - period + 1), i + 1);
        let up = 0, down = 0;
        for (let j = 1; j < change.length; j++) {
            let d = change[j] - change[j - 1];
            if (d > 0) up += d; else down -= d;
        }
        if (change.length < period) result.push(null);
        else result.push(down === 0 ? 100 : 100 - (100 / (1 + up / down)));
    }
    return result;
}

async function renderUltimateChart(ticker, fullData, targetUser, mode = 'SWING') {
    const fullPrices = fullData.map(d => d.c);
    const fullHighs = fullData.map(d => d.h);
    const fullLows = fullData.map(d => d.l);

    const ma5Full = calculateMA(fullPrices, 5);
    const ma20Full = calculateMA(fullPrices, 20);
    const ma60Full = calculateMA(fullPrices, 60);
    const macdFull = calculateMACD(fullPrices);
    const kdFull = calculateKD(fullHighs, fullLows, fullPrices);
    const rsi6Full = calculateRSI(fullPrices, 6);
    const rsi12Full = calculateRSI(fullPrices, 12);

    const displayCount = 30;
    const data = fullData.slice(-displayCount);
    const labels = data.map(d => d.t.slice(5)); 
    
    const slice = (arr) => arr.slice(-displayCount);
    const ma5 = slice(ma5Full);
    const ma20 = slice(ma20Full);
    const ma60 = slice(ma60Full);
    const dif = slice(macdFull.dif);
    const dea = slice(macdFull.dea);
    const hist = slice(macdFull.hist);
    const k = slice(kdFull.k);
    const d = slice(kdFull.d);
    const rsi6 = slice(rsi6Full);
    const rsi12 = slice(rsi12Full);

    const minPrice = Math.min(...data.map(d => d.l));
    const maxPrice = Math.max(...data.map(d => d.h));
    const pricePadding = (maxPrice - minPrice) * 0.2; 

    const RED = '#ef4444'; const GREEN = '#10b981';
    const barThickness = Math.max(4, Math.floor((width * 0.8) / displayCount));
    const wickThickness = Math.max(1, Math.floor(barThickness / 6));

    const COLORS = { MA5: '#fbbf24', MA20: '#db2777', MA60: '#0891b2', K: '#2563eb', D: '#c2410c', DIF: '#7d3aed', DEA: '#4b5563', RSI6: '#f97316', RSI12: '#059669', MARGIN: '#ec4899' };

    const configuration = {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: '影線', data: data.map(d => [d.l, d.h]), backgroundColor: data.map(d => d.c >= d.o ? RED : GREEN), barThickness: wickThickness, yAxisID: 'yPrice', order: 10, grouped: false },
                { label: '實體', data: data.map(d => [d.o, d.c]), backgroundColor: data.map(d => d.c >= d.o ? RED : GREEN), barThickness: barThickness, yAxisID: 'yPrice', order: 9, grouped: false },
                { type: 'line', label: 'MA5', data: ma5, borderColor: COLORS.MA5, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yPrice', order: 1 },
                { type: 'line', label: 'MA20', data: ma20, borderColor: COLORS.MA20, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yPrice', order: 2 },
                { type: 'line', label: 'MA60', data: ma60, borderColor: COLORS.MA60, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yPrice', order: 3 },
                { label: '外資變化', data: data.map(d => d.fi), backgroundColor: data.map(d => d.fi >= 0 ? RED : GREEN), yAxisID: 'yFI', barThickness: barThickness },
                { label: '融資變化', data: data.map(d => d.mc), backgroundColor: data.map(d => d.mc >= 0 ? RED : GREEN), yAxisID: 'yMC', barThickness: barThickness },
                { type: 'bar', label: '融資總量', data: data.map(d => d.m), backgroundColor: 'rgba(236, 72, 153, 0.6)', yAxisID: 'yMT', barThickness: barThickness },
                { type: 'line', label: 'K', data: k, borderColor: COLORS.K, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yKD' },
                { type: 'line', label: 'D', data: d, borderColor: COLORS.D, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yKD' },
                { type: 'line', label: 'DIF', data: dif, borderColor: COLORS.DIF, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yMACD' },
                { type: 'line', label: 'DEA', data: dea, borderColor: COLORS.DEA, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yMACD' },
                { type: 'bar', label: 'MACD 柱狀', data: hist, backgroundColor: hist.map(v => v >= 0 ? RED : GREEN), yAxisID: 'yMACD', barThickness: Math.floor(barThickness * 0.8) },
                { type: 'line', label: 'RSI6', data: rsi6, borderColor: COLORS.RSI6, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yRSI' },
                { type: 'line', label: 'RSI12', data: rsi12, borderColor: COLORS.RSI12, borderWidth: 2, pointRadius: 0, fill: false, yAxisID: 'yRSI' }
            ]
        },
        options: {
            responsive: false, animation: false,
            layout: { padding: { left: 30, right: 30, top: 20, bottom: 40 } },
            plugins: {
                title: { display: true, text: `${getDisplayName(ticker)} (${ticker.toUpperCase()}) 七層指標整合 (無注記純淨版)`, font: { size: 36, family: 'Noto Sans CJK TC', weight: 'bold' }, padding: { bottom: 30 } },
                legend: { position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true, boxWidth: 6 } }
            },
            scales: {
                yPrice: { type: 'linear', position: 'right', min: minPrice - pricePadding, max: maxPrice + pricePadding, stack: 'main', stackWeight: 8, grid: { color: '#f3f4f6' } },
                yFI: { type: 'linear', position: 'right', stack: 'main', stackWeight: 1.5, grid: { color: '#e5e7eb' } },
                yMC: { type: 'linear', position: 'right', stack: 'main', stackWeight: 1.5, grid: { display: false } },
                yMT: { type: 'linear', position: 'right', stack: 'main', stackWeight: 1.5, grid: { display: false }, min: (Math.min(...data.map(d => d.m)) * 0.995), max: (Math.max(...data.map(d => d.m)) * 1.005) },
                yKD: { type: 'linear', position: 'right', min: 0, max: 100, stack: 'main', stackWeight: 2, grid: { color: '#f3f4f6' } },
                yMACD: { type: 'linear', position: 'right', stack: 'main', stackWeight: 2, grid: { color: '#f3f4f6' } },
                yRSI: { type: 'linear', position: 'right', min: 0, max: 100, stack: 'main', stackWeight: 2, grid: { color: '#f3f4f6' } },
                x: { grid: { display: false } }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(configuration);
    const fileName = `ultimate_pure_${Date.now()}.jpg`;
    const filePath = `/tmp/${fileName}`;
    fs.writeFileSync(filePath, image);
    const r2Url = await uploadToR2(filePath);
    fs.unlinkSync(filePath);
    console.log(r2Url);
}

function generateData(count = 150) {
    const data = [];
    const baseData = [
        { t: "2026-02-04", o: 1785, h: 1805, l: 1775, c: 1785, fi: -2450, mc: 120, m: 21500 },
        { t: "2026-02-03", o: 1810, h: 1810, l: 1785, c: 1800, fi: 1500, mc: -50, m: 21380 },
        { t: "2026-02-02", o: 1750, h: 1765, l: 1745, c: 1765, fi: 800, mc: 200, m: 21430 }
    ];
    let lastClose = 1750;
    let marginTotal = 21000;
    for (let i = 0; i < count - 3; i++) {
        const date = new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const open = lastClose + (Math.random() - 0.4) * 15;
        const high = open + Math.random() * 20;
        const low = open - Math.random() * 10;
        const close = (high + low) / 2;
        const fiChange = (Math.random() - 0.3) * 5000;
        const marginChange = (Math.random() - 0.5) * 1000;
        marginTotal += marginChange;
        data.push({ t: date, o: open, h: high, l: low, c: close, fi: fiChange, mc: marginChange, m: marginTotal });
        lastClose = close;
    }
    return [...data, ...baseData.reverse()];
}

renderUltimateChart("2330.TW", generateData(250));
