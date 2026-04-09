#!/usr/bin/env python3
"""rag_build_lancedb.py

Build / refresh a LanceDB vector index over:
- MEMORY.md + memory/ + memory/archive/
- obsidian_vault/
- obsidian_TylerVaultSync/

Embeddings: OpenAI (default endpoint: https://api.openai.com/v1/embeddings)

This script is designed to be runnable from /mb daily cron.
It is conservative:
- Skips huge/binary files
- Chunks markdown into ~800-1200 char chunks
- Stores enough metadata (path, mtime, chunk_id) for incremental rebuild later

NOTE: First iteration is full rebuild (safe + simple).
"""

from __future__ import annotations

import os
import re
import json
import time
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Dict, Any, Optional, Tuple

import requests
# lancedb may be installed inside a workspace venv (e.g. .venv_lancedb).
# Try normal import first; if it fails, attempt to add workspace .venv_lancedb site-packages to sys.path and retry.
import sys
try:
    import lancedb
except Exception:
    try:
        # scripts/ is at WORKSPACE/scripts; derive WORKSPACE reliably from this file location
        here = Path(__file__).resolve()
        workspace_dir = here.parents[1]
        venv_path = workspace_dir / ".venv_lancedb"
        site_pkgs = venv_path / "lib" / f"python{sys.version_info.major}.{sys.version_info.minor}" / "site-packages"
        if site_pkgs.exists():
            sys.path.insert(0, str(site_pkgs))
        # also try common alternative (venv/lib/site-packages)
        alt_site = venv_path / "lib" / "site-packages"
        if alt_site.exists():
            sys.path.insert(0, str(alt_site))
    except Exception:
        pass
    try:
        import lancedb
    except Exception as e:
        raise
import pyarrow as pa

WORKSPACE = Path("/home/node/.openclaw/workspace")
DB_DIR = WORKSPACE / "rag" / "lancedb"
TABLE_NAME = "docs"

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
OPENAI_ENDPOINT = os.environ.get("OPENAI_EMBEDDINGS_ENDPOINT", "https://api.openai.com/v1/embeddings")
OPENAI_MODEL = os.environ.get("OPENAI_EMBEDDINGS_MODEL", "text-embedding-3-small")

# Fallback providers
MINIMAX_API_KEY = os.environ.get("MINIMAX_API_KEY")

# Local model (sentence-transformers)
LOCAL_MODEL_NAME = os.environ.get("LOCAL_EMBED_MODEL", "all-MiniLM-L6-v2")
_local_model = None

def get_embedding_provider():
    """Determine which embedding provider to use."""
    global _local_model
    
    # Check if local model is preferred (highest priority - free + offline)
    if os.environ.get("USE_LOCAL_EMBED", "false").lower() == "true":
        return "local"
    
    if OPENAI_API_KEY:
        try:
            # Test OpenAI first
            resp = requests.get("https://api.openai.com/v1/models", 
                              headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}, 
                              timeout=5)
            if resp.status_code == 200:
                return "openai"
        except:
            pass
    
    if MINIMAX_API_KEY:
        return "minimax"
    
    # Default to local if no API keys work
    return "local"

def load_local_model():
    """Load sentence-transformers model (lazy load)."""
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        print(f"[RAG] Loading local model: {LOCAL_MODEL_NAME}")
        _local_model = SentenceTransformer(LOCAL_MODEL_NAME)
    return _local_model

def local_embed(texts: List[str]) -> List[List[float]]:
    """Local embedding using sentence-transformers."""
    model = load_local_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    return [emb.tolist() for emb in embeddings]

CHUNK_TARGET = 1000  # chars
CHUNK_OVERLAP = 120
MAX_FILE_BYTES = 2_500_000  # 2.5MB

MD_EXTS = {".md", ".markdown"}


def iter_md_files() -> List[Path]:
    roots = [
        WORKSPACE / "MEMORY.md",
        WORKSPACE / "memory",
        WORKSPACE / "memory" / "archive",
        WORKSPACE / "obsidian_vault",
        WORKSPACE / "obsidian_TylerVaultSync",
    ]

    out: List[Path] = []

    for r in roots:
        if r.is_file() and r.suffix.lower() in MD_EXTS:
            out.append(r)
        elif r.is_dir():
            for p in r.rglob("*"):
                if p.is_file() and p.suffix.lower() in MD_EXTS:
                    out.append(p)

    # de-dup + stable sort
    seen = set()
    uniq: List[Path] = []
    for p in sorted(out):
        ap = str(p.resolve())
        if ap in seen:
            continue
        seen.add(ap)
        uniq.append(p)
    return uniq


def read_text(path: Path) -> Optional[str]:
    try:
        if path.stat().st_size > MAX_FILE_BYTES:
            return None
        return path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return path.read_text(errors="replace")
    except Exception:
        return None


def chunk_text(text: str, target: int = CHUNK_TARGET, overlap: int = CHUNK_OVERLAP) -> List[str]:
    # Normalize a bit
    t = re.sub(r"\r\n", "\n", text)
    t = re.sub(r"\n{3,}", "\n\n", t)
    t = t.strip()
    if not t:
        return []

    chunks: List[str] = []
    i = 0
    n = len(t)
    while i < n:
        end = min(n, i + target)
        # Try to break at paragraph boundary
        cut = t.rfind("\n\n", i, end)
        if cut != -1 and cut > i + int(target * 0.6):
            end = cut
        chunk = t[i:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= n:
            break
        i = max(0, end - overlap)
    return chunks


def openai_embed(texts: List[str]) -> List[List[float]]:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set")

    payload = {
        "model": OPENAI_MODEL,
        "input": texts,
    }
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }

    r = requests.post(OPENAI_ENDPOINT, headers=headers, data=json.dumps(payload), timeout=60)
    r.raise_for_status()
    data = r.json()

    if isinstance(data, dict) and isinstance(data.get("data"), list):
        out: List[List[float]] = []
        for it in data["data"]:
            if isinstance(it, dict) and "embedding" in it:
                out.append(it["embedding"])
        if out:
            return out

    raise RuntimeError(f"Unexpected embeddings response: {str(data)[:200]}")


def minimax_embed(texts: List[str]) -> List[List[float]]:
    """MiniMax embedding API fallback."""
    if not MINIMAX_API_KEY:
        raise RuntimeError("MINIMAX_API_KEY not set")
    
    # Try different MiniMax endpoints
    endpoints = [
        ("https://api.minimax.chat/v1/embeddings/text_embedding", "embo-01"),
        ("https://api.minimax.chat/v1/text/embeddings", "embo-01"),
    ]
    
    headers = {
        "Authorization": f"Bearer {MINIMAX_API_KEY}",
        "Content-Type": "application/json",
    }
    
    for url, model in endpoints:
        try:
            payload = {"model": model, "texts": texts}
            r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=60)
            if r.status_code == 200:
                data = r.json()
                if isinstance(data, dict) and "data" in data:
                    out = []
                    for item in data["data"]:
                        if "embedding" in item:
                            out.append(item["embedding"])
                    if out:
                        return out
        except Exception as e:
            print(f"[WARN] MiniMax endpoint {url} failed: {e}")
            continue
    
    raise RuntimeError("All MiniMax embedding endpoints failed")


def sha1(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8", errors="ignore")).hexdigest()


def build_rows(files: List[Path]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []

    for p in files:
        txt = read_text(p)
        if not txt:
            continue

        rel = str(p.resolve()).replace(str(WORKSPACE.resolve()) + "/", "")
        mtime = int(p.stat().st_mtime)

        chunks = chunk_text(txt)
        for idx, ch in enumerate(chunks):
            chunk_id = f"{rel}::#{idx}"
            rows.append(
                {
                    "id": sha1(chunk_id),
                    "path": rel,
                    "mtime": mtime,
                    "chunk_index": idx,
                    "text": ch,
                }
            )

    return rows


def main() -> int:
    DB_DIR.mkdir(parents=True, exist_ok=True)

    files = iter_md_files()
    print(f"[RAG] Files: {len(files)}")

    rows = build_rows(files)
    print(f"[RAG] Chunks: {len(rows)}")
    if not rows:
        print("[RAG] No rows. Abort.")
        return 0

    # Embed in batches
    vectors: List[List[float]] = []
    # Local embeddings are fast; use larger batch to reduce overhead.
    provider = get_embedding_provider()
    default_batch = 256 if provider == "local" else 64
    batch = int(os.environ.get("RAG_EMBED_BATCH", str(default_batch)))
    total = len(rows)
    print(f"[RAG] Using embedding provider: {provider} (batch={batch})")

    for i in range(0, total, batch):
        texts = [r["text"] for r in rows[i : i + batch]]
        try:
            if provider == "local":
                vecs = local_embed(texts)
            elif provider == "minimax":
                vecs = minimax_embed(texts)
            else:
                vecs = openai_embed(texts)
        except Exception as e:
            print(f"[WARN] {provider} embed failed: {e}")
            # Fallback to local if API fails
            if provider != "local":
                print("[RAG] Falling back to local model...")
                try:
                    vecs = local_embed(texts)
                except Exception as e2:
                    print(f"[ERROR] Local fallback failed: {e2}")
                    vectors = []
                    break
            else:
                print("[ERROR] All embedding providers failed, skipping RAG...")
                vectors = []
                break
        
        # Check if vecs is empty/invalid
        if not vecs or len(vecs) == 0:
            print("[ERROR] Empty embedding result, skipping RAG...")
            vectors = []
            break
            
        vectors.extend(vecs)
        done = min(i + batch, total)
        print(f"[RAG] Embedding: {done}/{total}", flush=True)
        # Avoid artificial sleeps for local embeddings (keep cron fast).
        if provider != "local":
            time.sleep(0.2)
    
    # Skip LanceDB write if no vectors
    if not vectors:
        print("[RAG] No vectors generated, skipping LanceDB write")
        return 0

    if len(vectors) != len(rows):
        raise RuntimeError(f"Embedding size mismatch: {len(vectors)} vs {len(rows)}")

    # Write LanceDB
    db = lancedb.connect(str(DB_DIR))

    schema = pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("path", pa.string()),
            pa.field("mtime", pa.int64()),
            pa.field("chunk_index", pa.int64()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32())),
        ]
    )

    data = []
    for r, v in zip(rows, vectors):
        data.append(
            {
                "id": r["id"],
                "path": r["path"],
                "mtime": r["mtime"],
                "chunk_index": r["chunk_index"],
                "text": r["text"],
                "vector": [float(x) for x in v],
            }
        )

    # Full rebuild: drop + recreate
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    tbl = db.create_table(TABLE_NAME, data=data, schema=schema)
    print(f"[RAG] LanceDB table created: {TABLE_NAME} rows={tbl.count_rows()}")

    # Save manifest
    manifest = {
        "db_dir": str(DB_DIR),
        "table": TABLE_NAME,
        "files": len(files),
        "chunks": len(rows),
        "model": OPENAI_MODEL,
        "endpoint": OPENAI_ENDPOINT,
        "built_at": int(time.time()),
    }
    (DB_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[RAG] manifest.json written")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
