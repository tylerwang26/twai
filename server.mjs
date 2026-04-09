#!/usr/bin/env node
/**
 * twai — OpenClaw AI engine entry point
 *
 * Provides HTTP API for:
 *   GET  /health
 *   POST /api/memory/search    { query, user_id, limit }
 *   POST /api/graph/query      { query }
 */

import express from 'express';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execAsync = promisify(execFile);
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 18789;
const WORKSPACE = process.env.WORKSPACE || '/home/node/.openclaw/workspace';

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'twai' }));

// Hybrid BM25 memory search (delegates to Python script)
app.post('/api/memory/search', async (req, res) => {
  const { query, limit = 5 } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });
  try {
    const { stdout } = await execAsync('python3', [
      path.join(__dirname, 'scripts/hybrid_memory_search.py'),
      query,
      '--top-k', String(limit),
      '--workspace', WORKSPACE,
    ], { timeout: 30000 });
    res.json(JSON.parse(stdout));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GraphRAG query
app.post('/api/graph/query', async (req, res) => {
  const { query } = req.body || {};
  if (!query) return res.status(400).json({ error: 'Missing query' });
  try {
    const { stdout } = await execAsync('node', [
      path.join(__dirname, 'deep-graph-rag/scripts/query_graph.mjs'),
      query,
    ], { timeout: 30000, env: { ...process.env, WORKSPACE } });
    res.json({ result: stdout });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`[twai] listening on port ${PORT}`));
