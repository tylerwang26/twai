import fs from 'fs';
import path from 'path';

const GRAPH_PATH = '/home/node/.openclaw/workspace/deep-graph-rag/graph.json';

// Ensure graph file exists
if (!fs.existsSync(GRAPH_PATH)) {
  fs.writeFileSync(GRAPH_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
}

export function loadGraph() {
  return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
}

export function saveGraph(graph) {
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2));
}

/**
 * Add a node if it doesn't exist (Local in-memory version)
 */
export function addNodeInMemory(graph, id, type, properties = {}) {
  const existing = graph.nodes.find(n => n.id === id);
  if (!existing) {
    graph.nodes.push({ id, type, properties });
    return true;
  }
  return false;
}

/**
 * Add an edge (Local in-memory version)
 */
export function addEdgeInMemory(graph, source, target, relation) {
  const existing = graph.edges.find(e => e.source === source && e.target === target && e.relation === relation);
  if (!existing) {
    graph.edges.push({ source, target, relation });
    return true;
  }
  return false;
}

/**
 * Batch update the graph
 */
export function batchUpdate(data) {
  const graph = loadGraph();
  let nodesAdded = 0;
  let edgesAdded = 0;

  if (data.nodes) {
    data.nodes.forEach(n => {
      if (addNodeInMemory(graph, n.id, n.type, n.properties)) nodesAdded++;
    });
  }

  if (data.edges) {
    data.edges.forEach(e => {
      if (addEdgeInMemory(graph, e.source, e.target, e.relation)) edgesAdded++;
    });
  }

  saveGraph(graph);
  return { nodesAdded, edgesAdded };
}
