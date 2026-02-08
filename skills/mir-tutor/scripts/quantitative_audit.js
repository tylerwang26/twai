/**
 * MIR Quantitative Audit Engine
 * Calculates risk-adjusted performance metrics: Sharpe Ratio, MDD, Recovery.
 */

function calculateMDD(equityCurve) {
    let peak = -Infinity;
    let maxDrawdown = 0;
    
    equityCurve.forEach(value => {
        if (value > peak) peak = value;
        const drawdown = (peak - value) / peak;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    
    return maxDrawdown * 100; // Return percentage
}

function calculateSharpe(returns, riskFreeRate = 0.02) {
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(returns.map(x => Math.pow(x - avgReturn, 2)).reduce((a, b) => a + b) / returns.length);
    return (avgReturn - (riskFreeRate / 252)) / (stdDev || 1) * Math.sqrt(252);
}

function auditStrategy(performanceData) {
    const { equity, returns } = performanceData;
    
    const mdd = calculateMDD(equity);
    const sharpe = calculateSharpe(returns);
    
    const status = (mdd < 15 && sharpe > 1.5) ? "✅ PASS" : "❌ FAIL";
    
    return {
        metrics: { mdd: mdd.toFixed(2), sharpe: sharpe.toFixed(2) },
        status,
        recommendation: status === "✅ PASS" ? "Adopt into MIR-I Framework" : "Discard (High Risk)"
    };
}

// Export for use in self-evolution loop
if (typeof process !== 'undefined' && process.argv[1] === import.meta.url) {
    // Example test case
    const mockEquity = [100, 105, 103, 110, 108, 107, 115];
    const mockReturns = [0.05, -0.02, 0.07, -0.02, -0.01, 0.08];
    console.log(JSON.stringify(auditStrategy({ equity: mockEquity, returns: mockReturns }), null, 2));
}

export { auditStrategy };
