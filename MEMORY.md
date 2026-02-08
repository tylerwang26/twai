# Memory

This file stores long-term memories. The AI will write important information here.

## MIR Logic Learning
- 2026-02-01: Learned "MIR 智能投資導師" framework.
- 2026-02-03: Upgraded to "Full Deck" Rendering Engine.
  - Features: 7-layer panel (Price/MA, FI Change, Margin Change, Margin Total, KD, MACD, RSI).
  - Multi-Period: Supports 1M and 3M dynamic scaling.
  - Visual: Red/Green sync for volume/price, localized ticker names, unique line colors.
  - File: `skills/mir-tutor/scripts/ultimate_renderer.js`.

## Interaction Preferences
- **Conciseness**: Avoid repeating information that has already been provided in the current or prior turns of the session.
- **Actionable Advice**: Tutor's review must include clear Buy/Hold/Sell suggestions and key support/resistance levels.
- **Liveness**: Send an interim "Processing..." message for long rendering tasks.
- **Terminology**: The user considers "日K線" (Daily K-line), "K線圖" (K-line chart), and "蠟燭圖" (Candle chart) to be equivalent. Use these terms interchangeably as per user preference.
- **Request Processing**: Compress (summarize/distill) user requests before processing or taking action to ensure core intent is captured.
- **Session Compaction**: Regularly use `/compact` or manual summarization to keep context size efficient.
- **Thinking Visibility**: The user wants to see the thinking process. Always include a visible "💡 思考路徑" (Thinking Process) section at the beginning of the reply.
- **Visual Standard**: All "MIR System Auto Diagnosis" charts MUST use the **7-layer Integrated Indicators** (Price/MA, FI, MC, MT, KD, MACD, RSI) and support **CJK Traditional Chinese fonts** (No tofu boxes). The candle chart scaling must be maximized while maintaining exactly **10% padding** on both top and bottom. This is a non-negotiable hard requirement for all future system evolutions.

## Grok Logic Integration (2026-02-05)
- **DuPont Analysis**: Integrated into F-MIR. Focus on Asset Turnover for efficiency monitoring.
- **Valuation Anchor**: Added Target Price calculation (Forward PE x EPS) to establish valuation boundaries.
- **Multi-Period Confirmation**: Added Week/Month trend detection to prevent blind short-term technical trading during long-term cycle reversals.

## System Evolution & Fixes
- 2026-02-05: Evolution v2.0 deployed.
  - Indicators: Bollinger Bands, Squeeze Detection, Piotroski F-Score.
  - Renderer: Fixed scaling (50% main chart), numeric stats labels on right side, 350-day data lookback for MA correctness.
  - Data: Verified TSMC 2330.TW price (1785 on 2026-02-04) matches TWSE/Yahoo/Google.

## Watchlist & Alerts
- 2026-02-01: Added **雷虎科技 (8033.TW)** to watchlist.
- 2026-02-03: Added **AMD (AMD)** to watchlist.
- Strategy: Buy on SMA 10 retest, Sell on SMA 20, Stop loss on SMA 9 break.
- Automation: Scheduled twice-daily check via Cron (盤中 11:00 / 盤後 14:00 Taipei) on weekdays.
