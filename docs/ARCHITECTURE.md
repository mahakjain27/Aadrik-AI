# Architecture

## Request flow

```
React (Vite)
    │  axios, headers: x-api-key, x-user-id
    ▼
FastAPI (app/main.py)
    │  routers: chat, products, sessions, quotation, crm, knowledge
    ▼
Services (app/services/*)
    │
    ├── ai_service.ask_ai()
    │       ├─ resolve_session()  ─────────────► SQLite (sessions, messages)
    │       ├─ retrieve()  ───────────────────► ChromaDB (via RAG retriever)
    │       └─ LM Studio (chat completion)  ──► local OpenAI-compatible server
    │
    ├── product_service.get_catalog()  ───────► data/products.json (cached, lru_cache)
    │
    ├── quotation_pdf.generate_quotation_pdf() ► ReportLab, in-memory PDF
    │
    └── knowledge_service / knowledge.py  ────► knowledge_base/*.md (parsed on request)
```

## Backend layout

- **`app/api/`** — thin FastAPI routers. No business logic; they validate the request (via `app/schemas`), call a service, and return its result.
- **`app/services/`** — the actual logic: talking to the DB, the vector store, LM Studio, or the PDF renderer.
- **`app/database/`** — a single shared SQLite connection (WAL mode) plus a `write_lock` (SQLite allows one writer at a time; FastAPI's sync endpoints run on a threadpool, so writes are serialized explicitly). `queries.py` holds all raw SQL.
- **`app/rag/`** — the retrieval-augmented generation pipeline: `loaders.py` reads `knowledge_base/*.md` (and PDFs/docx), `splitter.py` chunks them, `embedder.py` wraps LM Studio's embedding endpoint, `vector_store.py` persists/loads a Chroma DB, `retriever.py` does similarity search at query time. `build_rag.py` (project root of `backend/`) is a standalone script that rebuilds the vector store — run it once at setup and again whenever `knowledge_base/` changes.
- **`app/middleware/auth.py`** — two FastAPI dependencies: `verify_api_key` (shared-secret via `x-api-key`, skipped entirely if `AADRIK_API_KEY` is unset — dev convenience, see [API.md](API.md#auth)) and `get_user_id` (reads the required `x-user-id` header, generated per-browser by the frontend, used to scope chat sessions).
- **`app/core/`** — `config.py` (env-based settings), `logging.py` (shared logger factory), `exceptions.py` (global exception handlers registered in `main.py`), `company.py` (static company info used in quotation PDFs).
- **`app/constants/`** — shared string enums (lead/quotation status values, roles, notification types, user-facing messages) to avoid magic strings across services.

## Data model (SQLite, `backend/database/app.db`)

- **`sessions`** — one row per chat conversation, scoped by `user_id` (the browser-generated id, not an authenticated account — there's no login yet).
- **`messages`** — chat turns, linked to `sessions` via `ON DELETE CASCADE`.
- **`quotations`** — every quotation request a customer submits. This table doubles as the **CRM lead list**: `app/api/crm.py`'s `/crm/leads` endpoints read and update the same table, using `status` (`New`, `Pending`, `Contacted`, `Quotation Sent`, `Won`, `Lost`) as the pipeline stage. There's no separate `leads` table.

The vector store (`backend/database/chroma/`) is separate from the SQLite DB and is rebuilt from `knowledge_base/`, not from user data.

## Frontend layout

- **`src/App.jsx`** is the single stateful shell — it owns chat state, session list, product catalog, and which "page" is active (`chat`, `dashboard`, `customers`, `analytics`, `policies`, `company`, `settings`), swapping the main panel accordingly. There is no router; navigation is a `page` state string set by `Sidebar`.
- **`src/pages/`** — one component per page above.
- **`src/components/`** — shared UI: chat widgets (`Chatwindow`, `ChatInput`, `MessageBubble`), modals (`ProductDetailsModal`, `QuotationModal`, `LeadDetailsModal`), CRM/analytics widgets (`AnalyticsCharts`, `NotificationBell`), layout (`Header`, `Sidebar`).
- **`src/services/api.js`** — the only place that talks to the backend (axios instance with `x-api-key`/`x-user-id` headers baked in).
- **`src/utils/`** — pure helper functions: `userId.js` (generates/persists a per-browser id in localStorage — this *is* the `x-user-id`), `groupSessions.js`/`groupProducts.js` (list grouping for the sidebar/explorer), `leadScoring.js` (client-side heuristic that produces the AI Insights priority badges), `productQuantity.js`, `followUps.js`.

## Known gaps (pre-Phase-1)

- No authentication/accounts — `x-user-id` is a random id generated per browser (`localStorage`), not tied to a real identity. There are no user roles.
- `x-api-key` auth is applied to `/chat`, `/products`, and `/sessions` only. The `/quotation`, `/crm`, and `/knowledge` routers currently have no auth dependency at all.
- Analytics is computed entirely client-side from `/crm/leads` — there's no dedicated `/analytics` endpoint.

See [ROADMAP.md](ROADMAP.md) for what closes these gaps.
