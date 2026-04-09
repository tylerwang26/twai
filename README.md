# twai

OpenClaw AI engine: GraphRAG + RAG + BM25 hybrid memory search.

Extracted from the Portal monolith as Service #1.

## Stack

- **Backend**: Node.js / Express (`server.mjs`)
- **GraphRAG**: `deep-graph-rag/` — `graph.json` (3.1MB) + 7 `.mjs` scripts
- **RAG build**: `scripts/rag_build_lancedb.py` (LanceDB, gitignored data)
- **Memory search**: `scripts/hybrid_memory_search.py` (BM25 + jieba)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `18789` | HTTP port |
| `WORKSPACE` | `/home/node/.openclaw/workspace` | Data directory |
| `OPENAI_API_KEY` | — | Required for RAG build and agent |

## Zeabur

- GitHub: `tylerwang26/twai`
- Service ID: `service-69d36f3d93577fe0061de61d`
- Internal: `openclaw-twai.zeabur.internal:18789`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/api/memory/search` | BM25 hybrid search `{query, limit}` |
| POST | `/api/graph/query` | GraphRAG query `{query}` |

## Local Dev

```bash
npm install
pip3 install -r requirements.txt
node server.mjs
```

## Notes

- `rag/lancedb/` is gitignored (124MB). Rebuild with `npm run rag:build`.
- `deep-graph-rag/graph.json` (3.1MB) is committed and updated via `obsidian_scanner.mjs`.
