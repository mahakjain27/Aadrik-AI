from app.rag.loaders import load_all_documents

docs = load_all_documents()

print(f"\nLoaded {len(docs)} documents\n")

for i, doc in enumerate(docs, start=1):
    print("=" * 80)
    print(f"Document {i}")
    print(doc.metadata)
    print(doc.page_content[:200])
