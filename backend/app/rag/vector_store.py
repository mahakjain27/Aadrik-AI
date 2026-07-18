from langchain_chroma import Chroma

from app.rag.embedder import embeddings

VECTOR_DB = "database/chroma"


def create_vector_store(chunks):
    # Chroma.add_documents() (what from_documents() calls under the hood)
    # only ever appends - re-running this against an existing collection
    # without clearing it first would duplicate every unchanged document on
    # top of itself each time. Reset so a rebuild always reflects exactly
    # the current knowledge_base/ contents, not history + current.
    db = Chroma(persist_directory=VECTOR_DB, embedding_function=embeddings)
    db.reset_collection()
    db.add_documents(chunks)

    return db


def load_vector_store():

    return Chroma(persist_directory=VECTOR_DB, embedding_function=embeddings)
