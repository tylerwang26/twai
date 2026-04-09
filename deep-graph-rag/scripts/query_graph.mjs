import fs from 'fs';

const GRAPH_PATH = '/home/node/.openclaw/workspace/deep-graph-rag/graph.json';

export function queryGraph(startNodeId, maxDepth = 2) {
  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const visited = new Set();
  const resultNodes = [];
  const resultEdges = [];

  function traverse(currentId, depth) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const node = graph.nodes.find(n => n.id === currentId);
    if (node) resultNodes.push(node);

    const relatedEdges = graph.edges.filter(e => e.source === currentId || e.target === currentId);
    for (const edge of relatedEdges) {
      resultEdges.push(edge);
      const nextId = edge.source === currentId ? edge.target : edge.source;
      traverse(nextId, depth + 1);
    }
  }

  traverse(startNodeId, 0);
  return { nodes: resultNodes, edges: [...new Set(resultEdges)] };
}

// CLI usage
if (process.argv[1].endsWith('query_graph.mjs')) {
  const startNode = process.argv[2];
  if (startNode) {
    console.log(JSON.stringify(queryGraph(startNode), null, 2));
  }
}
