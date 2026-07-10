from openai import OpenAI

from app.core.config import settings

client = OpenAI(
    base_url=settings.lm_studio_base_url,
    api_key="lm-studio",  # LM Studio ignores this value, but the SDK requires something non-empty
)


class LMStudioEmbeddings:

    def embed_documents(self, texts):
        embeddings = []

        for text in texts:
            response = client.embeddings.create(
                model=settings.lm_studio_embed_model,
                input=str(text),
            )
            embeddings.append(response.data[0].embedding)

        return embeddings

    def embed_query(self, text):
        response = client.embeddings.create(
            model=settings.lm_studio_embed_model,
            input=str(text),
        )

        return response.data[0].embedding


embeddings = LMStudioEmbeddings()
