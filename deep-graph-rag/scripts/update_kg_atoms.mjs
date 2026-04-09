import { updateGraphWithExtraction } from './processor.mjs';

const atomData = {
  nodes: [
    { id: "A_PRICE_ABOVE_MA", type: "Atom", properties: { text: "股價站上均線" } },
    { id: "A_MA_UPWARD", type: "Atom", properties: { text: "均線趨勢向上" } },
    { id: "A_ENTRY_SIGNAL", type: "Atom", properties: { text: "觸發買入訊號" } },
    { id: "A_CLASS_III", type: "Atom", properties: { text: "產品屬於 Class III 高風險醫材" } },
    { id: "A_REGULATORY_BARRIER", type: "Atom", properties: { text: "法規認證構成競爭護城河" } },
    { id: "A_HIGH_SWITCH_COST", type: "Atom", properties: { text: "客戶更換供應商成本極高" } }
  ],
  edges: [
    { source: "A_PRICE_ABOVE_MA", target: "A_ENTRY_SIGNAL", relation: "supports" },
    { source: "A_MA_UPWARD", target: "A_ENTRY_SIGNAL", relation: "supports" },
    { source: "A_CLASS_III", target: "A_REGULATORY_BARRIER", relation: "implies" },
    { source: "A_REGULATORY_BARRIER", target: "A_HIGH_SWITCH_COST", relation: "causes" }
  ]
};

const stats = updateGraphWithExtraction(atomData);
console.log(`Updated KG with Atoms: Added ${stats.nodesAdded} nodes and ${stats.edgesAdded} edges.`);
