from openai import OpenAI

from app.core.config import settings

client = OpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)


class OpenAIEmbeddings:
    def embed_documents(self, texts):
        embeddings = []

        for text in texts:
            response = client.embeddings.create(
                model=settings.embedding_model,
                input=str(text),
            )
            embeddings.append(response.data[0].embedding)

        return embeddings

    def embed_query(self, text):
        response = client.embeddings.create(
            model=settings.embedding_model,
            input=str(text),
        )

        return response.data[0].embedding


embeddings = OpenAIEmbeddings()