from langchain_chroma import Chroma

from app.rag.embedder import embeddings

VECTOR_DB = "database/chroma"


def create_vector_store(chunks):

    db = Chroma.from_documents(
        documents=chunks, embedding=embeddings, persist_directory=VECTOR_DB
    )

    return db


def load_vector_store():

    return Chroma(persist_directory=VECTOR_DB, embedding_function=embeddings)
