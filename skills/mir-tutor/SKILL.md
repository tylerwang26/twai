---
name: mir-tutor
description: MIR 智能投資導師。提供專業的個股診斷、技術指標分析、自動化圖表產生並上傳 R2，以及 LINE 通知推播。當用戶要求進行股票分析、技術診斷、或查看觀察清單時使用。
---

# MIR 智能投資導師 (mir-tutor)

本技能基於 Machine Insight Rating (MIR) 框架，提供自動化股票分析工作流。

## 核心功能

1.  **個股深度診斷**：使用 `scripts/engine.js` 進行數據抓取與分析。
2.  **終極 1M 圖表**：使用 `scripts/ultimate_renderer.js` 產生包含一個月日 K 蠟燭圖、均線與 MACD 指標的專業圖表。
3.  **視覺化圖表**：自動產生具備漲紅跌綠配色、日 K 解析度的專業圖表。
3.  **雲端託管**：將圖表上傳至 Cloudflare R2 並產生公開連結。
4.  **自動化推播**：整合 LINE 通知，將診斷結果第一時間送達。

## 使用指南

### 1. 進行個股分析
當用戶要求分析特定股票（如：雷虎、2330）時：
- **【金律】**：不要撰寫任何繪圖程式碼。直接呼叫 `node skills/mir-tutor/scripts/ultimate_renderer.js <ticker> [target_user_id]`。
- 該工具會自動處理：一個月日 K 蠟燭圖、MA5/10、MACD 指標、20% 比例縮放、以及思源黑體顯示。
- 根據工具回傳的結果，給予 EMBA 風格的簡短決策建議。

### 2. 基本面框架 (F-MIR)
參考 `references/framework.md` 進行「90後PM」風格的深度基本面拆解。

### 3. 圖表渲染
如需單獨產生圖表或上傳檔案：
- 使用 `scripts/upload.js` 將本地圖檔上傳至 R2。

## 注意事項
- 確保環境變數（`R2_ENDPOINT` 等）已正確配置。
- 優先使用日 K 解析度進行技術面判定。
- 報告語氣需維持專業、嚴謹（EMBA 風格）。
