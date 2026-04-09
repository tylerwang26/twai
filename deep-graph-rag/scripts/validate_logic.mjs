import fs from 'fs';
import path from 'path';

const GRAPH_PATH = '/home/node/.openclaw/workspace/deep-graph-rag/graph.json';
const ATOMS_PATH = '/home/node/.openclaw/workspace/deep-graph-rag/logical_atoms.json';

export function validatePath(pathIds) {
  const graph = JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8'));
  const atoms = JSON.parse(fs.readFileSync(ATOMS_PATH, 'utf8'));
  
  // Flatten atoms for lookup
  const allAtoms = Object.values(atoms).flat();
  
  let validSteps = 0;
  const trace = [];

  for (let i = 0; i < pathIds.length; i++) {
    const currentId = pathIds[i];
    const atom = allAtoms.find(a => a.id === currentId) || { text: currentId };
    
    if (i === 0) {
      validSteps++;
      trace.push(atom.text);
      continue;
    }

    const prevId = pathIds[i-1];
    // Check if there is an edge in the graph connecting prev and current
    const hasEdge = graph.edges.some(e => 
      (e.source === prevId && e.target === currentId) || 
      (e.target === prevId && e.source === currentId)
    );

    // For now, if we can't find direct ID link, we check if they are "related" conceptually
    // In a real RLVR, this would be stricter.
    if (hasEdge) {
      validSteps++;
    }
    trace.push(atom.text);
  }

  const alignmentScore = Math.round((validSteps / pathIds.length) * 100);
  return {
    score: alignmentScore,
    path: trace.join(' -> ')
  };
}

// CLI usage
if (process.argv[1].endsWith('validate_logic.mjs')) {
  const ids = process.argv.slice(2);
  if (ids.length > 0) {
    console.log(JSON.stringify(validatePath(ids), null, 2));
  }
}
