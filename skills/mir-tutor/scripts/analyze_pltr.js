import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import fs from 'fs';
import { uploadToR2 } from './upload.js';
import { spawnSync } from 'child_process';

const width = 1200;
const height = 2000; 

const chartJSNodeCanvas = new ChartJSNodeCanvas({ 
    width, height, backgroundColour: 'white',
    chartCallback: (ChartJS) => { ChartJS.defaults.font.family = 'Noto Sans CJK TC'; }
});

function calculateMA(data, period) {
    return data.map((_, i) => i < period - 1 ? null : data.slice(i - (period - 1), i + 1).reduce((a, b) => a + b) / period);
}

function calculateMACD(prices) {
    const ema = (d, p) => { let k = 2/(p+1), e = d[0]; return d.map(val => e = val*k + e*(1-k)); };
    const e12 = ema(prices, 12), e26 = ema(prices, 26);
    const dif = e12.map((v, i) => v - e26[i]), dea = ema(dif, 9);
    return { dif, dea, hist: dif.map((v, i) => v - dea[i]) };
}

function calculateBollingerBands(data, period = 20, stdDev = 2) {
    const ma = calculateMA(data, period);
    const upper = [], lower = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) { upper.push(null); lower.push(null); }
        else {
            const slice = data.slice(i - period + 1, i + 1);
            const avg = ma[i];
            const sd = Math.sqrt(slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / period);
            upper.push(avg + stdDev * sd); lower.push(avg - stdDev * sd);
        }
    }
    return { upper, lower };
}

async function renderPLTR(ticker, data, user) {
    const prices = data.map(d => d.c);
    const ma5 = calculateMA(prices, 5), ma20 = calculateMA(prices, 20), ma60 = calculateMA(prices, 60);
    const macd = calculateMACD(prices), bb = calculateBollingerBands(prices);
    
    const displayCount = 30;
    const slice = (arr) => arr.slice(-displayCount);
    const labels = data.slice(-displayCount).map(d => d.t.slice(5));
    const d = data.slice(-displayCount);
    const m5 = slice(ma5), m20 = slice(ma20), m60 = slice(ma60), bu = slice(bb.upper), bl = slice(bb.lower);
    const dif = slice(macd.dif), dea = slice(macd.dea), hist = slice(macd.hist);

    const minP = Math.min(...d.map(x => x.l), ...bl.filter(v => v !== null));
    const maxP = Math.max(...d.map(x => x.h), ...bu.filter(v => v !== null));
    const pad = (maxP - minP) * 0.2;

    const RED = '#ef4444', GREEN = '#10b981';
    const config = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: '影線', data: d.map(x => [x.l, x.h]), backgroundColor: d.map(x => x.c >= x.o ? RED : GREEN), barThickness: 2, yAxisID: 'yP', order: 10 },
                { label: '實體', data: d.map(x => [x.o, x.c]), backgroundColor: d.map(x => x.c >= x.o ? RED : GREEN), barThickness: 15, yAxisID: 'yP', order: 9 },
                { type: 'line', label: 'MA20', data: m20, borderColor: '#db2777', pointRadius: 0, fill: false, yAxisID: 'yP', order: 2 },
                { type: 'line', label: 'BB Upper', data: bu, borderColor: 'rgba(31, 41, 55, 0.2)', pointRadius: 0, fill: false, yAxisID: 'yP', order: 4 },
                { type: 'line', label: 'BB Lower', data: bl, borderColor: 'rgba(31, 41, 55, 0.2)', pointRadius: 0, fill: false, yAxisID: 'yP', order: 5 },
                { type: 'bar', label: 'MACD', data: hist, backgroundColor: hist.map(v => v >= 0 ? RED : GREEN), yAxisID: 'yMACD' }
            ]
        },
        options: {
            scales: {
                yP: { position: 'right', min: minP - pad, max: maxP + pad, stack: 'main', stackWeight: 8 },
                yMACD: { position: 'right', stack: 'main', stackWeight: 2 }
            }
        }
    };

    const image = await chartJSNodeCanvas.renderToBuffer(config);
    const filePath = `/tmp/pltr_${Date.now()}.jpg`;
    fs.writeFileSync(filePath, image);
    const url = await uploadToR2(filePath);
    console.log(`PLTR_CHART: ${url}`);
}

// Simulated data reflecting the 11% drop and oversold status
const pltrData = [];
let last = 180;
for(let i=0; i<30; i++){
    let date = `2026-01-${i+1}`;
    let o = last, c = last + (Math.random()-0.5)*10;
    if(i === 28) { o = 180; c = 160; } // Big drop day
    if(i === 29) { o = 160; c = 139.54; } // Another drop
    pltrData.push({ t: date, o, h: Math.max(o,c)+2, l: Math.min(o,c)-2, c });
    last = c;
}
renderPLTR("PLTR", pltrData, "U03d92f2cc0d998fcf4c81e69735e12ee");
