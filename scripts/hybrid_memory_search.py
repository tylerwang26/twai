#!/usr/bin/env python3
"""hybrid_memory_search.py

BM25-based keyword search over the OpenClaw workspace memory markdown files.

Requirements (install):
  python3 -m pip install --break-system-packages rank-bm25 jieba

Usage:
  python3 scripts/hybrid_memory_search.py "查詢字串" --top-k 5

Search scope (by default):
  - /home/node/.openclaw/workspace/MEMORY.md (if exists)
  - /home/node/.openclaw/workspace/memory/*.md

Output:
  JSON to stdout: { query, top_k, results: [ { path, score, line_range, snippet } ] }

Notes:
  - Tokenization: Chinese via jieba, English via whitespace-ish word tokenization.
  - BM25 is computed per-file (each file is a document). Snippets are extracted
    by locating query tokens in the original file lines.
"""

from __future__ import annotations

import argparse
import glob
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

import jieba  # type: ignore
from rank_bm25 import BM25Okapi  # type: ignore

# Reduce jieba startup logs (keeps JSON output clean)
jieba.setLogLevel(20)


CJK_RE = re.compile(r"[\u4e00-\u9fff]")
WORD_RE = re.compile(r"[A-Za-z0-9_]+|[\u4e00-\u9fff]+")


@dataclass
class Doc:
    path: str
    text: str
    lines: List[str]
    tokens: List[str]
    is_binary: bool = False


def _iter_markdown_paths(root: str, include_vault: bool, include_workspace: bool = False) -> List[str]:
    paths: List[str] = []
    mem_md = os.path.join(root, "MEMORY.md")
    if os.path.isfile(mem_md):
        paths.append(mem_md)

    memory_dir = os.path.join(root, "memory")
    if os.path.isdir(memory_dir):
        paths.extend(sorted(glob.glob(os.path.join(memory_dir, "*.md"))))

        # Include archived daily logs as well
        archive_dir = os.path.join(memory_dir, "archive")
        if os.path.isdir(archive_dir):
            paths.extend(sorted(glob.glob(os.path.join(archive_dir, "*.md"))))

        # Include archived P2 temp logs (kept for forensics)
        archive_p2_dir = os.path.join(archive_dir, "p2")
        if os.path.isdir(archive_p2_dir):
            paths.extend(sorted(glob.glob(os.path.join(archive_p2_dir, "*.md"))))

    if include_vault:
        # 注意：Obsidian vault 可能很大，預設只在「auto fallback」或明確指定時才納入。
        vault = os.path.join(root, "obsidian_vault")
        if os.path.isdir(vault):
            paths.extend(sorted(glob.glob(os.path.join(vault, "**", "*.md"), recursive=True)))

        # Note: keep obsidian_TylerVaultSync as a read-only mirror; it is NOT part of the search scope here.

    if include_workspace:
        # Search other markdown notes under workspace (excluding huge/derived dirs)
        exclude_prefixes = {
            os.path.join(root, 'obsidian_vault'),
            os.path.join(root, 'obsidian_TylerVaultSync'),
            os.path.join(root, 'memory'),
            os.path.join(root, 'rag'),
            os.path.join(root, 'node_modules'),
            os.path.join(root, 'portal', 'node_modules'),
            os.path.join(root, '.git'),
        }

        for p in glob.glob(os.path.join(root, "**", "*.md"), recursive=True):
            ap = os.path.abspath(p)
            if any(ap.startswith(os.path.abspath(x) + os.sep) for x in exclude_prefixes):
                continue
            paths.append(ap)

    # de-dup while keeping order
    seen = set()
    out: List[str] = []
    for p in paths:
        ap = os.path.abspath(p)
        if ap not in seen:
            seen.add(ap)
            out.append(ap)
    return out


def _iter_note_paths_all_files(root: str, include_workspace: bool = False) -> List[str]:
    """Notes search scope: include all file types under obsidian_vault (not just .md).

    - Text files (.md/.txt/.json/.csv/...) will be indexed by content.
    - Binary files (pdf/docx/pptx/images/...) will be indexed by filename tokens only.

    This enables Portal /memory-search to find attachments by filename.
    """
    paths = _iter_markdown_paths(root, include_vault=True, include_workspace=include_workspace)

    vault = os.path.join(root, 'obsidian_vault')
    if os.path.isdir(vault):
        exclude_dirs = {
            os.path.join(vault, '99_Attachments', 'cache'),
            os.path.join(vault, '99_Attachments', '_text_index'),
        }
        for p in glob.glob(os.path.join(vault, '**', '*'), recursive=True):
            if os.path.isdir(p):
                continue
            ap = os.path.abspath(p)
            # Skip obvious huge/derived dirs
            if '/node_modules/' in ap or ap.endswith('.DS_Store'):
                continue
            if any(ap.startswith(os.path.abspath(x) + os.sep) for x in exclude_dirs):
                continue
            paths.append(ap)

    # de-dup while keeping order
    seen = set()
    out: List[str] = []
    for p in paths:
        ap = os.path.abspath(p)
        if ap not in seen:
            seen.add(ap)
            out.append(ap)
    return out


def _read_text(path: str) -> str:
    # Prefer utf-8, fallback to system default.
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        with open(path, "r", errors="replace") as f:
            return f.read()


def _looks_binary(path: str, max_bytes: int = 4096) -> bool:
    try:
        with open(path, 'rb') as f:
            b = f.read(max_bytes)
        # Heuristic: NUL byte usually indicates binary
        return b"\x00" in b
    except OSError:
        return True


def tokenize(text: str) -> List[str]:
    """Tokenize mixed Chinese/English text.

    Strategy:
      - Extract runs of CJK chars or ASCII word chars.
      - For CJK runs, apply jieba.cut.
      - For ASCII runs, lowercase as a whole token.

    Returns tokens suitable for BM25.
    """
    tokens: List[str] = []
    for part in WORD_RE.findall(text):
        if not part:
            continue
        if CJK_RE.search(part):
            for t in jieba.cut(part, cut_all=False):
                t = t.strip()
                if t:
                    tokens.append(t)
        else:
            t = part.strip().lower()
            if t:
                tokens.append(t)
    return tokens


_ATT_MANIFEST: Optional[dict] = None


def _load_attachment_manifest() -> dict:
    global _ATT_MANIFEST
    if _ATT_MANIFEST is not None:
        return _ATT_MANIFEST
    manifest_path = os.path.join(os.getcwd(), 'obsidian_vault', '99_Attachments', '_text_index', 'manifest.json')
    try:
        with open(manifest_path, 'r', encoding='utf-8') as f:
            _ATT_MANIFEST = json.load(f)
    except Exception:
        _ATT_MANIFEST = {}
    return _ATT_MANIFEST


def build_docs(paths: Iterable[str]) -> List[Doc]:
    docs: List[Doc] = []
    att_manifest = _load_attachment_manifest()

    for p in paths:
        # For non-text/binary files:
        # - if we have an extracted-text cache (PDF/DOCX), index by extracted content
        # - otherwise, index by filename tokens only.
        is_bin = _looks_binary(p)
        if is_bin:
            rel = os.path.relpath(p, start=os.getcwd())
            rec = att_manifest.get(rel)
            if rec and rec.get('index'):
                idx_path = os.path.join(os.getcwd(), str(rec['index']))
                try:
                    txt = _read_text(idx_path)
                except OSError:
                    txt = ''
                lines = txt.splitlines() if txt else [os.path.basename(p)]
                toks = tokenize(txt) if txt else tokenize(os.path.basename(p))
                docs.append(Doc(path=p, text=txt, lines=lines, tokens=toks, is_binary=True))
            else:
                name = os.path.basename(p)
                toks = tokenize(name)
                docs.append(Doc(path=p, text="", lines=[name], tokens=toks, is_binary=True))
            continue

        try:
            txt = _read_text(p)
        except OSError:
            continue
        lines = txt.splitlines()
        toks = tokenize(txt)
        docs.append(Doc(path=p, text=txt, lines=lines, tokens=toks, is_binary=False))
    return docs


def _find_snippet(lines: List[str], query_tokens: List[str], context_lines: int) -> Tuple[Tuple[int, int], str]:
    """Find a best-effort snippet by first occurrence of any query token.

    Returns:
      ((start_line, end_line), snippet_text)
    Line numbers are 1-indexed and end_line is inclusive.
    """
    if not lines:
        return (1, 1), ""

    lowered_tokens = [t.lower() for t in query_tokens if t]

    hit_idx: Optional[int] = None
    for i, line in enumerate(lines):
        line_l = line.lower()
        # simple containment check; for Chinese, lower() is no-op.
        for t in lowered_tokens:
            if t and t in line_l:
                hit_idx = i
                break
        if hit_idx is not None:
            break

    if hit_idx is None:
        # fallback: top of file
        start = 0
        end = min(len(lines), 1 + 2 * context_lines)
        snippet = "\n".join(lines[start:end]).strip("\n")
        return (start + 1, end), snippet

    start = max(0, hit_idx - context_lines)
    end = min(len(lines), hit_idx + context_lines + 1)
    snippet = "\n".join(lines[start:end]).strip("\n")
    return (start + 1, end), snippet


def _filename_score(doc_path: str, query_tokens: List[str], raw_query: str) -> float:
    name = os.path.basename(doc_path).lower()
    score = 0.0
    q = raw_query.strip().lower()
    if q and q in name:
        score += 3.0
    for t in query_tokens:
        tt = (t or '').lower()
        if not tt:
            continue
        if tt in name:
            score += 1.0
    return score


def search(query: str, docs: List[Doc], top_k: int, context_lines: int) -> List[dict]:
    if not query.strip():
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    corpus_tokens = [d.tokens for d in docs]
    bm25 = BM25Okapi(corpus_tokens)
    scores = bm25.get_scores(query_tokens)

    ranked = sorted(
        [(i, float(scores[i])) for i in range(len(docs))],
        key=lambda x: x[1],
        reverse=True,
    )

    results: List[dict] = []
    for i, score in ranked:
        if len(results) >= max(0, top_k):
            break
        # Skip non-matching docs (BM25 can return 0.0 for unrelated files)
        if score <= 0:
            continue
        d = docs[i]
        (start_line, end_line), snippet = _find_snippet(d.lines, query_tokens, context_lines)
        results.append(
            {
                "path": os.path.relpath(d.path, start=os.getcwd()),
                "score": score,
                "line_range": [start_line, end_line],
                "snippet": snippet,
            }
        )

    return results


def search_notes(query: str, docs: List[Doc], top_k: int, context_lines: int) -> List[dict]:
    """Search notes with deterministic sort:

    Sort key (desc):
      1) mtime
      2) filename match score
      3) content match score (BM25)

    This matches Tyler's requirement for the '找之前的筆記' UX.
    """
    if not query.strip():
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return []

    bm25 = BM25Okapi([d.tokens for d in docs])
    scores = bm25.get_scores(query_tokens)

    ranked = []
    for i, d in enumerate(docs):
        content_score = float(scores[i])
        fname_score = _filename_score(d.path, query_tokens, query)

        # Include docs if either:
        # - content matches (BM25 > 0), OR
        # - filename matches (fname_score > 0)
        # This is important for queries like full filenames.
        if content_score <= 0 and fname_score <= 0:
            continue

        try:
            mtime = os.path.getmtime(d.path)
        except OSError:
            mtime = 0.0

        ranked.append((i, mtime, fname_score, content_score))

    ql = query.strip().lower()
    is_filename_query = (
        '/' in ql
        or any(ql.endswith(ext) for ext in ['.pdf', '.docx', '.pptx', '.csv', '.json', '.txt', '.md', '.png', '.jpg', '.jpeg'])
        or ('.' in ql and len(ql) <= 120)
    )

    # Default (Tyler's UX): newest notes first.
    # But if the query looks like a filename, prioritize filename matches first.
    if is_filename_query:
        ranked.sort(key=lambda x: (x[2], x[1], x[3]), reverse=True)
    else:
        ranked.sort(key=lambda x: (x[1], x[2], x[3]), reverse=True)

    out: List[dict] = []
    for i, mtime, fname_score, content_score in ranked[: max(0, top_k)]:
        d = docs[i]
        (start_line, end_line), snippet = _find_snippet(d.lines, query_tokens, context_lines)
        display_score = content_score if content_score > 0 else fname_score
        out.append(
            {
                "path": os.path.relpath(d.path, start=os.getcwd()),
                "mtime": mtime,
                "filename_score": fname_score,
                "content_score": content_score,
                "score": display_score,
                "line_range": [start_line, end_line],
                "snippet": snippet,
            }
        )

    return out


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="BM25 search over MEMORY.md, memory/, notes vaults, and (optional) workspace markdown")
    parser.add_argument(
        "--mode",
        choices=["memory", "notes"],
        default="memory",
        help="memory=只搜 MEMORY.md + memory/*；notes=給『找之前的筆記』用（obsidian_vault + workspace），並使用 mtime→檔名→內容 的排序規則",
    )
    parser.add_argument("query", help="Query string")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results to return")
    parser.add_argument(
        "--root",
        type=str,
        default="/home/node/.openclaw/workspace",
        help="Workspace root containing MEMORY.md, memory/, obsidian_vault/",
    )
    parser.add_argument(
        "--context-lines",
        type=int,
        default=2,
        help="How many context lines to include before/after the matching line",
    )
    parser.add_argument(
        "--vault-mode",
        choices=["off", "auto", "on"],
        default="auto",
        help="搜尋 Obsidian vault 的模式：off=不搜；on=一開始就搜；auto=前段找不到才加搜",
    )
    parser.add_argument(
        "--include-workspace",
        choices=["off", "on"],
        default="off",
        help="是否將 workspace 其它 .md 也納入搜尋（會排除 vault/memory/node_modules 等大目錄）",
    )

    args = parser.parse_args(argv)

    root = os.path.abspath(args.root)

    # Ensure stable relpath behavior: chdir to root
    try:
        os.chdir(root)
    except OSError:
        pass

    vault_used = False

    if args.mode == "notes":
        # Notes mode: always include obsidian_vault + (optionally) other workspace markdown
        vault_used = True
        include_workspace = args.include_workspace == "on"
        paths = _iter_note_paths_all_files(root, include_workspace=include_workspace)
        docs = build_docs(paths)
        results = search_notes(args.query, docs, top_k=args.top_k, context_lines=args.context_lines)
    else:
        include_vault_initial = args.vault_mode == "on"
        paths = _iter_markdown_paths(root, include_vault=include_vault_initial)
        docs = build_docs(paths)
        results = search(args.query, docs, top_k=args.top_k, context_lines=args.context_lines)

        # auto fallback: if nothing found in memory layer, expand to vaults
        if args.vault_mode == "auto" and len(results) == 0:
            vault_used = True
            paths = _iter_markdown_paths(root, include_vault=True)
            docs = build_docs(paths)
            results = search(args.query, docs, top_k=args.top_k, context_lines=args.context_lines)

        if args.vault_mode == "on":
            vault_used = True

    out = {
        "query": args.query,
        "top_k": args.top_k,
        "mode": args.mode,
        "include_workspace": args.include_workspace,
        "doc_count": len(docs),
        "vault_mode": args.vault_mode,
        "vault_used": vault_used,
        "results": results,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
