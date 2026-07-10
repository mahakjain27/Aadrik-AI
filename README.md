# Aadrik AI

An internal AI-powered sales assistant for **Aadrik Distributors Pvt. Ltd.** (welding consumables). It combines a RAG-backed chat assistant, a product catalog, quotation generation, and a lightweight CRM into one app.

## Features

- **AI Chat** — answers questions from the company knowledge base only (no invented pricing or specs), backed by retrieval-augmented generation.
- **Product Explorer** — browse the catalog by category/brand/grade and jump straight into a quotation request.
- **Quotation requests** — customers submit a request from chat or the product explorer; staff can generate a branded PDF quote.
- **CRM dashboard** — every quotation request becomes a lead with a status (Pending / Contacted / Quotation Sent / Won / Lost), searchable and filterable.
- **Analytics** — win rate, lead volume by status/city/month, top products and brands, computed client-side from CRM data.
- **AI lead scoring** — heuristic priority score (High/Medium/Low) per lead, shown in the CRM table.
- **Company & Policies pages** — company info and policies rendered straight from the knowledge base markdown.
- **Session history** — chats are persisted per browser (via a generated `x-user-id`) and resumable from the sidebar.

## Tech stack

**Backend:** FastAPI, SQLite (WAL mode), ChromaDB (vector store), LangChain (RAG pipeline), OpenAI-compatible client against a **local LM Studio** server (embeddings + chat completion — zero API cost, runs offline), ReportLab (PDF generation).

**Frontend:** React 19 + Vite, React-Bootstrap, Recharts (analytics charts), Axios.

## Folder structure

```
Aadrik-AI/
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI routers (chat, products, sessions, quotation, crm, knowledge)
│   │   ├── core/            # settings, logging, exception handlers, company info
│   │   ├── constants/       # shared enums (roles, lead/quotation status, notification types)
│   │   ├── database/        # SQLite connection + schema + queries
│   │   ├── middleware/      # API-key + user-id auth dependencies
│   │   ├── models/          # Pydantic models for quotations
│   │   ├── rag/              # loaders, splitter, embedder, vector store, retriever
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── services/         # business logic (ai_service, product_service, session_service, quotation_pdf, knowledge_service)
│   │   └── main.py
│   ├── build_rag.py         # one-off script: builds the Chroma vector store from knowledge_base/
│   ├── run.py                # dev entrypoint (uvicorn)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/       # reusable UI (modals, charts, chat widgets, CRM widgets)
│       ├── pages/             # top-level views (CRM, Customers, Analytics, Settings, Policies, Company)
│       ├── services/          # API clients (axios)
│       └── utils/             # small pure helpers (session grouping, lead scoring, user id)
├── knowledge_base/           # markdown source-of-truth the AI answers from
├── data/products.json        # product catalog
└── docs/                      # ARCHITECTURE.md, API.md, ROADMAP.md, CHANGELOG.md
```

## Prerequisites

- Python 3.11+
- Node 18+
- [LM Studio](https://lmstudio.ai/) running locally with an embedding model and a chat model loaded (see `backend/app/core/config.py` for the expected model names/URL — configurable via env vars).

## Running the backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt

# build the vector store once (and again whenever knowledge_base/ changes)
python build_rag.py

python run.py                 # http://127.0.0.1:8000
```

Environment variables (create `backend/app/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | LM Studio's OpenAI-compatible endpoint |
| `LM_STUDIO_EMBED_MODEL` | `text-embedding-nomic-embed-text-v1.5` | Embedding model name |
| `LM_STUDIO_CHAT_MODEL` | `llama-3.2-3b-instruct` | Chat model name |
| `AADRIK_API_KEY` | *(unset)* | Shared-secret for `x-api-key`. If unset, auth is skipped (dev only — see [docs/API.md](docs/API.md)) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `RETRIEVER_K` | `4` | Number of chunks retrieved per chat query |

## Running the frontend

```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173
```

Environment variables (`frontend/.env`):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend base URL |
| `VITE_AADRIK_API_KEY` | Must match `AADRIK_API_KEY` on the backend |

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/API.md](docs/API.md) — full endpoint reference
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased build plan
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — notable changes per phase
