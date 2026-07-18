# Aadrik AI

An internal AI-powered sales platform for **Aadrik Distributors Pvt. Ltd.** (welding consumables). It combines a RAG-backed chat assistant, a product catalog, quotation generation, and a role-based CRM into one authenticated app.

## Features

- **Authentication & RBAC** — JWT login (bcrypt password hashing, per-email brute-force lockout), four roles (`admin`, `sales`, `manager`, `viewer`) enforced on every backend endpoint and gated in the frontend nav — not just hidden, actually blocked server-side.
- **User Management** — admins create/edit/disable/enable staff accounts and reset passwords from the UI; every action is recorded to the activity log.
- **AI Chat** — answers questions from the company knowledge base only (no invented pricing or specs), backed by retrieval-augmented generation.
- **Product Explorer** — browse the catalog by category/brand/grade and jump straight into a quotation request.
- **Quotation requests** — staff submit a request from chat or the product explorer; a branded PDF quote can be generated and downloaded.
- **CRM dashboard** — every quotation request becomes a lead with a status (Pending / Contacted / Quotation Sent / Won / Lost), searchable and filterable. Each lead tracks who created it, who it's assigned to, who closed it (and when), and its source (`manual` today; ready for `whatsapp`/`website` once those channels exist).
- **AI lead scoring** — priority score (High/Medium/Low) computed server-side from order size, recency, and repeat-customer signals, shown in the CRM table and AI Insights. Built as a list of composable signal functions so new inputs (e.g. WhatsApp engagement) can be added later without touching the rest.
- **AI Insights** — a Copilot-style summary, top-priority-lead card, and pipeline health cards on the Dashboard, driven by the same lead data.
- **Activity Log** — admin-only audit trail of user and lead lifecycle events (created, status changed, assigned, role changed, disabled, password reset).
- **Notifications** — the bell shows real overdue/due follow-ups plus a recent-activity feed, not a static badge.
- **Analytics** — win rate, lead volume by status/city/month, top products and brands.
- **Company & Policies pages** — company info and policies rendered straight from the knowledge base markdown.
- **Session history** — chats are persisted per logged-in user and resumable from the sidebar.

## Tech stack

**Backend:** FastAPI, SQLite (WAL mode), ChromaDB (vector store), LangChain (RAG pipeline), OpenAI-compatible client against a **local LM Studio** server (embeddings + chat completion — zero API cost, runs offline), ReportLab (PDF generation), python-jose (JWT), passlib/bcrypt (password hashing).

**Frontend:** React 19 + Vite, React-Bootstrap, Recharts (analytics charts), Axios.

## Folder structure

```
Aadrik-AI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, users, activity, chat, products, sessions, quotation, crm, knowledge)
│   │   ├── core/             # settings, logging, exception handlers, security (JWT/hashing), rate limiting, company info
│   │   ├── constants/        # shared enums (roles, lead/quotation status, notification types)
│   │   ├── database/         # SQLite connection + schema + migrations + queries
│   │   ├── middleware/       # JWT auth dependency (get_current_user, require_roles)
│   │   ├── models/            # Pydantic models (quotation, user)
│   │   ├── rag/               # loaders, splitter, embedder, vector store, retriever
│   │   ├── schemas/           # Pydantic request/response schemas (auth, user, lead, chat, session, product)
│   │   ├── services/          # business logic (auth, user, activity_log, lead_scoring, ai_service, product_service, session_service, quotation_pdf, knowledge_service)
│   │   └── main.py
│   ├── scripts/
│   │   ├── build_rag.py      # one-off script: builds the Chroma vector store from knowledge_base/
│   │   └── create_admin.py   # creates the first login (run this before anything else - see below)
│   ├── run.py                 # dev entrypoint (uvicorn)
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/        # reusable UI (modals, charts, chat widgets, CRM widgets, notification bell)
│       ├── context/            # AuthContext (login state, JWT storage)
│       ├── pages/               # top-level views (Login, CRM Dashboard, Customers, Analytics, User Management, Activity Log, Settings, Policies, Company)
│       ├── services/            # API client (axios, with auth + 401 handling)
│       └── utils/                # small pure helpers (permissions/RBAC, session grouping, follow-up alerts, lead scoring category rules)
├── knowledge_base/            # markdown source-of-truth the AI answers from
├── data/products.json         # product catalog
└── docs/                       # ARCHITECTURE.md, API.md, ROADMAP.md, CHANGELOG.md
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
python -m scripts.build_rag

# create your first login - there's no public signup, so this is required
# before you can use the app at all
python -m scripts.create_admin

python run.py                 # http://127.0.0.1:8000
```

Environment variables (create `backend/app/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `LM_STUDIO_BASE_URL` | `http://127.0.0.1:1234/v1` | LM Studio's OpenAI-compatible endpoint |
| `LM_STUDIO_EMBED_MODEL` | `text-embedding-nomic-embed-text-v1.5` | Embedding model name |
| `LM_STUDIO_CHAT_MODEL` | `llama-3.2-3b-instruct` | Chat model name |
| `AADRIK_API_KEY` | *(unset)* | Shared-secret sent as `x-api-key` from the frontend |
| `SECRET_KEY` | *(unset)* | JWT signing secret — **required**, login will not work without it |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | How long a login session lasts before re-authentication is required |
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

## Roles

| Role | Access |
|---|---|
| `admin` | Everything — Chat, Dashboard, Analytics, Customers, Products, Policies, Company, Settings, User Management, Activity Log |
| `manager` | Dashboard, Analytics, Customers, Products (can assign/reassign leads) |
| `sales` | Chat, Dashboard, Customers, Products |
| `viewer` | Chat, Products |

Defined in `frontend/src/utils/permissions.js` (frontend gating) and enforced independently in `backend/app/middleware/auth.py` (`require_roles`) on every endpoint — the frontend hiding a nav item is a UX nicety, not the actual security boundary.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/API.md](docs/API.md) — full endpoint reference
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased build plan
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — notable changes per phase

> **Note:** the docs above predate this session's authentication/RBAC/CRM-tracking/activity-log work and haven't been updated to match — treat them as historical for Phase 0, not current reference.
