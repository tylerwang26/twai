import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import { uploadToR2 } from './upload.js';
import { spawnSync } from 'child_process';
import https from 'https';

function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => reject(err));
    });
}

const width = 1200;
const height = 1500;

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, 
    height, 
    backgroundColour: 'white',
    chartCallback: (ChartJS) => {
        ChartJS.defaults.font.family = 'Noto Sans CJK TC';
    }
});

function calculateMA(data, period) {
    return data.map((_, i) => i < period - 1 ? null : data.slice(i - (period - 1), i + 1).reduce((a, b) => a + b) / period);
}

function calculateMACD(prices) {
    const ema = (data, period) => {
        const k = 2 / (period + 1);
        let emaVal = data[0];
        return data.map(val => emaVal = val * k + emaVal * (1 - k));
    };
    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const dif = ema12.map((v, i) => v - ema26[i]);
    const dea = ema(dif, 9);
    return { dif, dea, hist: dif.map((v, i) => v - dea[i]) };
}

function calculateKD(highs, lows, closes) {
    const kValues = [], dValues = [];
    let prevK = 50, prevD = 50;
    for (let i = 0; i < closes.length; i++) {
        const recentH = Math.max(...highs.slice(Math.max(0, i - 8), i + 1));
        const recentL = Math.min(...lows.slice(Math.max(0, i - 8), i + 1));
        const rsv = recentH === recentL ? 50 : ((closes[i] - recentL) / (recentH - recentL)) * 100;
        const k = (2/3) * prevK + (1/3) * rsv;
        const d = (2/3) * prevD + (1/3) * k;
        kValues.push(k); dValues.push(d);
        prevK = k; prevD = d;
    }
    return { k: kValues, d: dValues };
}

async function getTWSEData(stockNo, yearMonth) {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${stockNo}&date=${yearMonth}01`;
    const res = await fetchData(url);
    if (res.stat !== 'OK') return [];
    return res.data.map(d => ({
        t: d[0], // 日期
        o: parseFloat(d[3].replace(/,/g, '')), // 開盤
        h: parseFloat(d[4].replace(/,/g, '')), // 最高
        l: parseFloat(d[5].replace(/,/g, '')), // 最低
        c: parseFloat(d[6].replace(/,/g, '')), // 收盤
        v: parseFloat(d[1].replace(/,/g, '')), // 成交股數
    }));
}

async function run() {
    console.log("Fetching real data from TWSE...");
    const dataJan = await getTWSEData('2330', '202601');
    const dataFeb = await getTWSEData('2330', '202602');
    const fullData = [...dataJan, ...dataFeb];
    
    if (fullData.length === 0) {
        console.error("No data fetched.");
        return;
    }

    const prices = fullData.map(d => d.c);
    const highs = fullData.map(d => d.h);
    const lows = fullData.map(d => d.l);
    
    const ma5 = calculateMA(prices, 5);
    const ma20 = calculateMA(prices, 20);
    const macd = calculateMACD(prices);
    const kd = calculateKD(highs, lows, prices);
    
    const displayData = fullData.slice(-30);
    const labels = displayData.map(d => d.t);
    
    const config = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '影線', data: displayData.map(d => [d.l, d.h]), backgroundColor: displayData.map(d => d.c >= d.o ? '#ef4444' : '#10b981'), barThickness: 2, yAxisID: 'yP' },
                { label: '實體', data: displayData.map(d => [d.o, d.c]), backgroundColor: displayData.map(d => d.c >= d.o ? '#ef4444' : '#10b981'), barThickness: 15, yAxisID: 'yP' },
                { type: 'line', label: 'MA5', data: ma5.slice(-30), borderColor: '#fbbf24', pointRadius: 0, fill: false, yAxisID: 'yP' },
                { type: 'line', label: 'MA20', data: ma20.slice(-30), borderColor: '#db2777', pointRadius: 0, fill: false, yAxisID: 'yP' },
                { type: 'line', label: 'K', data: kd.k.slice(-30), borderColor: '#2563eb', pointRadius: 0, yAxisID: 'yKD' },
                { type: 'line', label: 'D', data: kd.d.slice(-30), borderColor: '#c2410c', pointRadius: 0, yAxisID: 'yKD' },
                { type: 'bar', label: 'MACD', data: macd.hist.slice(-30), backgroundColor: macd.hist.slice(-30).map(v => v >= 0 ? '#ef4444' : '#10b981'), yAxisID: 'yMACD' }
            ]
        },
        options: {
            plugins: { title: { display: true, text: '台積電 (2330.TW) 真實數據驗證 (TWSE 來源)', font: { size: 24 } } },
            scales: {
                yP: { position: 'right', stack: 's', stackWeight: 4 },
                yKD: { position: 'right', stack: 's', stackWeight: 1, min: 0, max: 100 },
                yMACD: { position: 'right', stack: 's', stackWeight: 1 }
            }
        }
    };
    
    const image = await chartJSNodeCanvas.renderToBuffer(config);
    const filePath = `/tmp/tsmc_real_${Date.now()}.jpg`;
    fs.writeFileSync(filePath, image);
    const url = await uploadToR2(filePath);
    console.log(`REAL_CHART_URL: ${url}`);
    
    // Output sample data for verification
    console.log("Verification Sample (Recent 3 days):");
    displayData.slice(-3).forEach(d => console.log(`${d.t}: O:${d.o} H:${d.h} L:${d.l} C:${d.c}`));
}

run();
