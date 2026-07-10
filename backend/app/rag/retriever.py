from app.core.config import settings
from app.rag.vector_store import load_vector_store


def retrieve(query: str):
    db = load_vector_store()

    retriever = db.as_retriever(
        search_type="similarity", search_kwargs={"k": settings.retriever_k}
    )

    docs = retriever.invoke(query)

    return docs
