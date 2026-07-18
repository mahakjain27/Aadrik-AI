import threading

from app.database.connection import get_conn, write_lock
from app.rag.loaders import load_all_documents
from app.rag.splitter import split_documents
from app.rag.vector_store import create_vector_store

# create_vector_store() resets then repopulates the whole collection - two
# rebuilds running concurrently (e.g. two quick product saves) can interleave
# their reset/add calls and corrupt the collection down to zero documents.
# This serializes rebuilds instead; a burst of triggers just runs them one
# after another rather than racing.
_rebuild_lock = threading.Lock()


def build_rag():
    with _rebuild_lock:
        print("Loading documents...")

        docs = load_all_documents()
        print(f"{len(docs)} documents loaded")

        print("Splitting documents...")

        chunks = split_documents(docs)
        print(f"{len(chunks)} chunks created")

        print("Creating vector database...")

        create_vector_store(chunks)

        conn = get_conn()
        with write_lock:
            conn.execute(
                """
                UPDATE knowledge_base_state
                SET last_rebuilt_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
                WHERE id = 1
                """
            )
            conn.commit()

        print("Done!")
