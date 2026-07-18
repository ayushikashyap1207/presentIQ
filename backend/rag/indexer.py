"""
RAG Indexer for PresentIQ
Builds a ChromaDB vector store from the knowledge_base/ markdown files.
Uses the all-MiniLM-L6-v2 sentence-transformer model (CPU-compatible, no API key required).
"""

import os
import pathlib
from typing import List, Dict, Any

import chromadb
from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
_THIS_DIR = pathlib.Path(__file__).parent.resolve()
_KNOWLEDGE_BASE_DIR = _THIS_DIR / "knowledge_base"
_VECTOR_STORE_DIR = _THIS_DIR / "vector_store"

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────
COLLECTION_NAME = "presentiq_coaching"
EMBEDDING_MODEL = "all-MiniLM-L6-v2"
CHUNK_SIZE_WORDS = 400
CHUNK_OVERLAP_WORDS = 50


# ──────────────────────────────────────────────
# Internal helpers
# ──────────────────────────────────────────────

def _get_client() -> chromadb.PersistentClient:
    """Return a ChromaDB PersistentClient pointed at the vector_store directory."""
    _VECTOR_STORE_DIR.mkdir(parents=True, exist_ok=True)
    return chromadb.PersistentClient(path=str(_VECTOR_STORE_DIR))


def _get_embedding_function() -> SentenceTransformerEmbeddingFunction:
    """Return the sentence-transformer embedding function (CPU-safe)."""
    return SentenceTransformerEmbeddingFunction(model_name=EMBEDDING_MODEL)


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE_WORDS, overlap: int = CHUNK_OVERLAP_WORDS) -> List[str]:
    """
    Split text into overlapping chunks of approximately `chunk_size` words.

    Args:
        text:       The full document text to split.
        chunk_size: Target number of words per chunk (default: 400).
        overlap:    Number of words to repeat at the start of each new chunk (default: 50).

    Returns:
        A list of text chunks as strings.
    """
    words = text.split()
    chunks: List[str] = []
    start = 0

    while start < len(words):
        end = start + chunk_size
        chunk_words = words[start:end]
        chunks.append(" ".join(chunk_words))

        # Advance by (chunk_size - overlap) so the next chunk reuses `overlap` words
        start += chunk_size - overlap

        # Avoid an infinite loop if overlap >= chunk_size (misconfiguration guard)
        if chunk_size <= overlap:
            break

    return chunks


def _read_knowledge_base() -> List[Dict[str, Any]]:
    """
    Read every .md file in the knowledge_base/ directory.

    Returns:
        A list of dicts with keys:
            - 'filename' (str): basename of the file
            - 'content'  (str): full text content
    """
    docs = []
    for md_file in sorted(_KNOWLEDGE_BASE_DIR.glob("*.md")):
        content = md_file.read_text(encoding="utf-8").strip()
        if content:
            docs.append({"filename": md_file.name, "content": content})
    return docs


# ──────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────

def get_collection() -> chromadb.Collection:
    """
    Return the ChromaDB collection object (creates it if it doesn't exist).
    The collection uses cosine distance for similarity search.
    """
    client = _get_client()
    embedding_fn = _get_embedding_function()

    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=embedding_fn,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def build_index() -> None:
    """
    Build (or refresh) the vector index from the knowledge_base/ markdown files.

    This function is idempotent: if the collection already contains documents,
    it returns immediately without re-indexing.

    Steps:
        1. Check if the collection already has data → return early if so.
        2. Read every .md file from knowledge_base/.
        3. Split each file into overlapping 400-word chunks with 50-word overlap.
        4. Add all chunks to the ChromaDB collection with metadata:
               {source: <filename>, chunk: <chunk_index>}
        5. Print the total number of chunks indexed.
    """
    collection = get_collection()

    # ── Idempotency check ──
    if collection.count() > 0:
        print(
            f"[RAG Indexer] Collection '{COLLECTION_NAME}' already contains "
            f"{collection.count()} chunks. Skipping re-index."
        )
        return

    # ── Read documents ──
    docs = _read_knowledge_base()
    if not docs:
        print(f"[RAG Indexer] No .md files found in {_KNOWLEDGE_BASE_DIR}. Nothing to index.")
        return

    # ── Chunk and collect ──
    all_documents: List[str] = []
    all_ids: List[str] = []
    all_metadatas: List[Dict[str, Any]] = []

    for doc in docs:
        chunks = _chunk_text(doc["content"])
        for chunk_idx, chunk_text in enumerate(chunks):
            chunk_id = f"{doc['filename']}__chunk_{chunk_idx}"
            all_documents.append(chunk_text)
            all_ids.append(chunk_id)
            all_metadatas.append({
                "source": doc["filename"],
                "chunk": chunk_idx,
            })

    # ── Add to ChromaDB in a single batch ──
    collection.add(
        documents=all_documents,
        ids=all_ids,
        metadatas=all_metadatas,
    )

    total_chunks = len(all_documents)
    print(
        f"[RAG Indexer] Successfully indexed {total_chunks} chunks "
        f"from {len(docs)} documents into collection '{COLLECTION_NAME}'."
    )


# ──────────────────────────────────────────────
# CLI entry point (for manual testing)
# ──────────────────────────────────────────────
if __name__ == "__main__":
    build_index()
    col = get_collection()
    print(f"[RAG Indexer] Collection '{COLLECTION_NAME}' now contains {col.count()} chunks.")
