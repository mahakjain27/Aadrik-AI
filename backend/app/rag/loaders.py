from pathlib import Path

from langchain_community.document_loaders import (
    DirectoryLoader,
    PyPDFLoader,
    TextLoader,
    UnstructuredWordDocumentLoader,
)

BASE_DIR = Path(__file__).resolve().parents[3]
KNOWLEDGE_BASE = BASE_DIR / "knowledge_base"


def load_markdown():
    loader = DirectoryLoader(
        str(KNOWLEDGE_BASE),
        glob="**/*.md",
        loader_cls=TextLoader,
    )
    return loader.load()


def load_pdf():
    loader = DirectoryLoader(
        str(KNOWLEDGE_BASE),
        glob="**/*.pdf",
        loader_cls=PyPDFLoader,
    )
    return loader.load()


def load_docx():
    loader = DirectoryLoader(
        str(KNOWLEDGE_BASE),
        glob="**/*.docx",
        loader_cls=UnstructuredWordDocumentLoader,
    )
    return loader.load()


def load_all_documents():
    documents = []

    documents.extend(load_markdown())

    try:
        documents.extend(load_pdf())
    except Exception:
        pass

    try:
        documents.extend(load_docx())
    except Exception:
        pass

    return documents
