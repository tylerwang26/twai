import { batchUpdate } from './graph_lib.mjs';

/**
 * Process extraction results and update the graph
 * @param {object} result - { nodes: [{id, type, properties}], edges: [{source, target, relation}] }
 */
export function updateGraphWithExtraction(result) {
  return batchUpdate(result);
}
