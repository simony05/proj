import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
import pypdf

from .embeddings import EMBEDDING_DIM, complete, embed_texts
from .models import ChunkMeta, DocumentMeta


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, target_size: int = 500, overlap: int = 100) -> list[str]:
    words = text.split()
    if not words:
        return []

    chunks: list[str] = []
    start = 0

    while start < len(words):
        end = start
        length = 0

        while end < len(words):
            # +1 for the space separator, except for the very first word
            addition = len(words[end]) + (1 if end > start else 0)
            if length + addition > target_size and end > start:
                break
            length += addition
            end += 1

        chunks.append(" ".join(words[start:end]))

        if end >= len(words):
            break

        # Walk back from `end` until we've accumulated ~overlap chars to find next start
        overlap_chars = 0
        new_start = end
        for i in range(end - 1, start - 1, -1):
            overlap_chars += len(words[i]) + 1
            if overlap_chars >= overlap:
                new_start = i
                break

        # Guard: always make forward progress
        start = new_start if new_start > start else end

    return chunks


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _load_index(ws_dir: Path) -> faiss.Index:
    path = ws_dir / "index.faiss"
    if path.exists():
        return faiss.read_index(str(path))
    return faiss.IndexFlatL2(EMBEDDING_DIM)


def _save_index(index: faiss.Index, ws_dir: Path) -> None:
    faiss.write_index(index, str(ws_dir / "index.faiss"))


def _load_json(path: Path) -> list:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else []


def _save_json(data: list, path: Path) -> None:
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

def ingest_document(ws_dir: Path, workspace_id: str, file_path: Path) -> DocumentMeta:
    doc = DocumentMeta(
        document_id=str(uuid.uuid4()),
        workspace_id=workspace_id,
        file_path=str(file_path),
        status="processing",
        created_at=datetime.now(timezone.utc),
    )

    docs_list = _load_json(ws_dir / "documents.json")
    docs_list.append(doc.model_dump(mode="json"))
    _save_json(docs_list, ws_dir / "documents.json")

    try:
        reader = pypdf.PdfReader(str(file_path))
        full_text = "\n".join(page.extract_text() or "" for page in reader.pages)

        raw_chunks = chunk_text(full_text)
        if not raw_chunks:
            raise ValueError("No extractable text found in PDF")

        embeddings = embed_texts(raw_chunks)

        now = datetime.now(timezone.utc)
        chunk_records = [
            ChunkMeta(
                chunk_id=str(uuid.uuid4()),
                workspace_id=workspace_id,
                document_id=doc.document_id,
                text=text,
                created_at=now,
            )
            for text in raw_chunks
        ]

        index = _load_index(ws_dir)
        index.add(np.array(embeddings, dtype=np.float32))
        _save_index(index, ws_dir)

        existing_chunks = _load_json(ws_dir / "chunks.json")
        existing_chunks.extend(c.model_dump(mode="json") for c in chunk_records)
        _save_json(existing_chunks, ws_dir / "chunks.json")

        doc = doc.model_copy(update={"status": "ready"})

    except Exception:
        doc = doc.model_copy(update={"status": "error"})
        raise

    finally:
        docs_list = _load_json(ws_dir / "documents.json")
        docs_list = [
            doc.model_dump(mode="json") if d["document_id"] == doc.document_id else d
            for d in docs_list
        ]
        _save_json(docs_list, ws_dir / "documents.json")

    return doc


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

def query_workspace(ws_dir: Path, query: str, k: int = 3) -> tuple[str, list[str]]:
    index = _load_index(ws_dir)
    if index.ntotal == 0:
        return "No documents have been uploaded to this workspace yet.", []

    query_vec = np.array(embed_texts([query]), dtype=np.float32)
    k = min(k, index.ntotal)
    _, indices = index.search(query_vec, k)

    chunks = _load_json(ws_dir / "chunks.json")
    sources = [chunks[i]["text"] for i in indices[0] if i < len(chunks)]

    context = "\n\n---\n\n".join(sources)
    prompt = (
        "Answer the question using only the context below. "
        "Be concise and factual. If the answer is not in the context, say so.\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {query}"
    )

    answer = complete(prompt)
    return answer, sources
