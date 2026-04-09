import { updateGraphWithExtraction } from './processor.mjs';

const initialData = {
  nodes: [
    { id: "Spirit Fox Strategy", type: "Strategy", properties: { description: "Main Taiwan stock strategy" } },
    { id: "Rule 5", type: "Rule", properties: { description: "Moving average based trend following" } },
    { id: "20MA", type: "Indicator", properties: { window: 20, type: "Simple Moving Average" } },
    { id: "10MA", type: "Indicator", properties: { window: 10, type: "Simple Moving Average" } },
    { id: "Swift Fox Tactics", type: "Tactics", properties: { description: "Aggressive competition mode" } },
    { id: "Qun Yi Competition", type: "Event", properties: { name: "Top Trader Competition", start: "2026-02-23" } },
    { id: "MULA Logic", type: "Framework", properties: { name: "Multivariate Unconditional Logistic Regression Analysis" } },
    { id: "Sage4 Framework", type: "Framework", properties: { domain: "Biomed R&D" } }
  ],
  edges: [
    { source: "Spirit Fox Strategy", target: "Rule 5", relation: "implements" },
    { source: "Rule 5", target: "20MA", relation: "standard_indicator" },
    { source: "Swift Fox Tactics", target: "10MA", relation: "aggressive_indicator" },
    { source: "Swift Fox Tactics", target: "Spirit Fox Strategy", relation: "tactical_variant" },
    { source: "Swift Fox Tactics", target: "Qun Yi Competition", relation: "optimized_for" },
    { source: "MULA Logic", target: "EMBA Case Analysis", relation: "used_in" }
  ]
};

const stats = updateGraphWithExtraction(initialData);
console.log(`Initialized KG: Added ${stats.nodesAdded} nodes and ${stats.edgesAdded} edges.`);
