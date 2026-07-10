from app.rag.loaders import load_all_documents
from app.rag.splitter import split_documents
from app.rag.vector_store import create_vector_store


def build_rag():
    print("Loading documents...")

    docs = load_all_documents()
    print(f"{len(docs)} documents loaded")

    print("Splitting documents...")

    chunks = split_documents(docs)
    print(f"{len(chunks)} chunks created")

    print("Creating vector database...")

    create_vector_store(chunks)

    print("Done!")
