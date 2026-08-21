# Aadrik AI

An internal AI-powered sales platform for **Aadrik Distributors Pvt. Ltd.** (welding consumables). It combines a RAG-backed chat assistant, a product catalog, quotation generation, and a role-based CRM into one authenticated app.

## Features

- **Authentication & RBAC** — JWT login (bcrypt password hashing, per-email brute-force lockout), four roles (`admin`, `sales`, `manager`, `viewer`) enforced on every backend endpoint and gated in the frontend nav — not just hidden, actually blocked server-side.
- **User Management** — admins create/edit/disable/enable staff accounts and reset passwords from the UI; every action is recorded to the activity log.
- **AI Chat** — answers questions from the company knowledge base only (no invented pricing or specs), backed by retrieval-augmented generation.
- **Shorthand product-requirement understanding** — a message like `3.15 rasi 3 case 2.5 orbit 2 case` runs through a deterministic parsing/catalog-matching layer *before* RAG, so informal WhatsApp shorthand (merged units like `3cs`/`12kg`, any word order, multiple products in one message) resolves against the real product catalog instead of falling back to "I don't have that information." Never invents a product: an exact single match gets confirmed by its real catalog name, more than one match asks the customer to confirm the grade, and no match asks them to confirm the product/send a photo — all without an extra LLM call. A follow-up message ("add 2 case orbit 2.5") adds to what the customer already confirmed earlier in the same session rather than making them repeat it, though an unanswered ambiguous/no-match question from an earlier turn isn't re-asked forever once the conversation moves on. Shared by WhatsApp and the internal AI Chat page since both go through the same reply pipeline; falls straight through to the existing RAG pipeline, completely unchanged, for anything that isn't a product requirement.
- **Product Explorer** — browse the catalog by category/brand/grade and jump straight into a quotation request.
- **Quotation requests** — staff submit a request from chat or the product explorer, adding as many products as the customer needs to a single quotation; a branded PDF quote (one row per product, combined totals) can be generated and downloaded.
- **CRM dashboard** — every quotation request becomes a lead with a status (Pending / Contacted / Quotation Sent / Won / Lost), searchable and filterable. The Enquiries table is compact enough to fit one screen (no horizontal scroll) and shows Company, Source, Product(s), Status, and Approval — multi-product quotations show a summary like "Rasi E6013 +2 more". Each lead tracks who created it, who it's assigned to, who closed it (and when), and its source (`manual` or `whatsapp`).
- **Customers** — a company-level view aggregating each customer's quotations/leads, editable contact details, and (admin/manager only) a delete action that unlinks rather than cascades their quotation history, so past leads survive.
- **AI lead scoring** — priority score (High/Medium/Low) computed server-side from order size, recency, and repeat-customer signals, surfaced in AI Insights (not the Enquiries table, to keep it scannable). Scores a multi-product lead on its single largest line item, not a sum across lines, so one big order still outranks many small ones. Built as a list of composable signal functions so new inputs (e.g. WhatsApp engagement) can be added later without touching the rest.
- **Multi-line-item quotations** — a quotation can carry any number of products, each with its own unit price, GST%, Normal Discount (percentage or flat ₹, mutually exclusive), and Special Discount (percentage and flat ₹, both stack) — priced independently since different products are rarely discounted the same way. One shared per-line pricing function backs the API, the PDF, and the UI, plus a thin aggregator that sums lines into the quotation's combined subtotal/GST/grand total, so they can never disagree. An approved quotation's price can still be corrected (behind a confirmation prompt), with every change to an already-approved quotation recorded in a price-history audit trail (a JSON snapshot of every line's old/new price and discounts, who changed it, when).
- **No-quotation order confirmation** — for an existing customer who just wants to place an order, "Confirm Order" sends the order-received WhatsApp message and, only once it actually sends, atomically marks the lead Won with approval "Not Required" — no quotation ever gets created. The manual status dropdown and a one-time migration both guard against the same contradiction (Won with a quotation still pending approval).
- **AI Insights** — a Copilot-style summary, top-priority-lead card, and pipeline health cards on the Dashboard, driven by the same lead data.
- **Activity Log** — admin-only audit trail of user and lead lifecycle events (created, status changed, assigned, role changed, disabled, password reset).
- **Notifications** — the bell shows real overdue/due follow-ups plus a recent-activity feed, not a static badge.
- **Analytics** — win rate, lead volume by status/city/month, top products and brands.
- **Company & Policies pages** — company info and policies rendered straight from the knowledge base markdown.
- **Session history** — chats are persisted per logged-in user and resumable from the sidebar.
- **WhatsApp integration** — customers can chat with the same AI assistant over WhatsApp (Meta Cloud API webhook), browse the catalog through native interactive list menus, and get a link to a public quotation form; approved quotes can be sent back as a WhatsApp PDF document. WhatsApp conversations land in the CRM as leads with `whatsapp` as the source.
- **Sales Inbox** — a live queue (WebSocket-backed) of conversations needing a human, filterable by status (Waiting for Sales / AI Handling / Open / Closed / Archived), with reply, close/reopen, and archive actions. Replies are actually pushed to the customer's WhatsApp via the Cloud API, not just saved to the local thread. Conversations show the customer's name and company where known — the customer's own WhatsApp profile name (captured from every inbound message), the name given on a website contact form, or a matching CRM record, in that order of preference — falling back gracefully to just the phone number rather than showing nothing.
- **Message Customer** — a quotation can be messaged directly over WhatsApp without ever creating or sending a quote, reusing the same 24h-window/template-fallback logic as "+ New Conversation" below, but falling back to a separate `order_received` template (not the sales-outreach one) since this is an existing customer being contacted about an order, not cold outreach.
- **Start new WhatsApp conversations** — "+ New Conversation" in Sales Inbox lets staff message a number that hasn't messaged in (or ever). It checks Meta's 24h customer-service window automatically: if it's open, a normal free-text message is sent; if it's closed (or the number is brand new), it walks staff through sending an approved outreach template instead, since Meta doesn't allow free text outside that window.
- **WhatsApp attachments** — staff can attach a PDF/JPG/PNG (e.g. an invoice) to a reply, both from an ongoing Sales Inbox conversation and from the "+ New Conversation" flow, sent as a native WhatsApp document message.
- **Public quotation form** — an unauthenticated, mobile-friendly page (linked from WhatsApp) customers fill out directly to request a quote, no login required. Opens pre-loaded with the one product they tapped from the WhatsApp catalog, but a live search (backed by the same public product catalog) lets them add further products to the same request before submitting — no separate quote request needed per product.
- **WhatsApp number mismatch detection** — a customer can open the quote form from one WhatsApp number but type a different contact number into it; both are preserved (`phone` and `source_whatsapp_phone`) rather than one silently overwriting the other. When sending an approved quotation, if the two numbers genuinely differ (after normalizing formatting) and more than one has a live WhatsApp conversation, nothing is sent automatically — the salesperson is shown both numbers and picks the destination, and the choice is validated server-side against the quotation's own two numbers. A quotation is only ever marked "sent" once something was actually delivered — no email on file and no reachable WhatsApp conversation no longer gets silently treated as a successful send.
- **Public marketing website** (`frontend/src/website`) — Home, Products, Company, Policies, Contact, and an AI Assistant page for anonymous visitors, sharing the same backend catalog/chat/lead pipeline as the internal app. Contact-form submissions land in the CRM and trigger a WhatsApp confirmation via an approved template.
- **WhatsApp Commerce catalog feed** — `GET /catalog.csv`, a live Meta commerce-catalog CSV generated from the products table, for Commerce Manager's scheduled data-feed import so the WhatsApp Catalog tab stays in sync with the product database automatically.
- **On-page SEO** — per-page titles/meta descriptions, Open Graph tags, `Organization` structured data, `robots.txt`/`sitemap.xml`, all served from the public website.
- **Product Management (admin)** — full CRUD on the product catalog from the UI, with an automatic knowledge-base resync after every change so the AI's answers stay in sync with the catalog.
- **Knowledge Base Manager (admin)** — upload/preview/delete source documents (PDF, DOCX, etc.) that back the RAG pipeline, view indexing stats, and trigger a full vector-store rebuild from the UI.
- **Monthly reports** — a downloadable PDF summarizing enquiries, conversions, won/lost/expired deals, top products, and AI-vs-human resolution rates for a given month.

## Tech stack

**Backend:** FastAPI, SQLite (WAL mode), ChromaDB (vector store), LangChain (RAG pipeline), **OpenAI** (`gpt-4.1-mini` for chat, `text-embedding-3-small` for embeddings, via an OpenAI-compatible client so any compatible endpoint can be swapped in through `OPENAI_BASE_URL`), ReportLab (PDF generation), python-jose (JWT), passlib/bcrypt (password hashing).

**Frontend:** React 19 + Vite, React-Bootstrap, Recharts (analytics charts), Axios.

## Folder structure

```
Aadrik-AI/
├── backend/
│   ├── app/
│   │   ├── api/             # FastAPI routers (auth, users, activity, chat, products, product_admin, sessions, quotation, public_quote, public_contact, crm, customers, knowledge, knowledge_documents, notifications, reports, realtime, whatsapp_webhook, catalog, system)
│   │   ├── core/             # settings, logging, exception handlers, security (JWT/hashing), rate limiting, company info
│   │   ├── constants/        # shared enums (roles, lead/quotation status, notification types, category image paths)
│   │   ├── database/         # SQLite connection + schema + migrations + queries
│   │   ├── middleware/       # JWT auth dependency (get_current_user, require_roles)
│   │   ├── models/            # Pydantic models (quotation, user)
│   │   ├── rag/               # loaders, splitter, embedder, vector store, retriever
│   │   ├── schemas/           # Pydantic request/response schemas (auth, user, lead, customer, chat, session, product, knowledge_document, contact)
│   │   ├── services/          # business logic (auth, user, activity_log, lead_scoring, ai_service, product_service, product_admin_service, product_knowledge_sync, session_service, quotation_pdf, quotation_email, quotation_whatsapp, whatsapp_service, whatsapp_menu, contact_notifications, catalog_feed_service, customer_service, knowledge_document_service, knowledge_stats_service, monthly_report, monthly_report_pdf)
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
│       ├── pages/               # top-level views (Login, CRM Dashboard, Customers, Sales Inbox, Analytics, Product Management, Knowledge Base Manager, User Management, Activity Log, Settings, Policies, Company)
│       ├── services/            # API client (axios, with auth + 401 handling)
│       ├── utils/                # small pure helpers (permissions/RBAC, session grouping, follow-up alerts, lead scoring category rules, time-ago formatting)
│       └── website/              # public marketing site (Home, Products, Company, Policies, Contact, AI Assistant), its own layout/components/hooks, separate from the authenticated app
├── knowledge_base/            # markdown source-of-truth the AI answers from
├── data/products.json         # product catalog
└── docs/                       # ARCHITECTURE.md, API.md, ROADMAP.md, CHANGELOG.md
```

## Prerequisites

- Python 3.11+
- Node 18+
- An [OpenAI API key](https://platform.openai.com/api-keys) (or any OpenAI-compatible endpoint, configurable via `OPENAI_BASE_URL`).

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
| `OPENAI_API_KEY` | *(unset)* | OpenAI API key — **required**, chat and embeddings will not work without it |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint (swap for a local/self-hosted server if desired) |
| `CHAT_MODEL` | `gpt-4.1-mini` | Chat model name |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model name |
| `AADRIK_API_KEY` | *(unset)* | Shared-secret sent as `x-api-key` from the frontend |
| `SECRET_KEY` | *(unset)* | JWT signing secret — **required**, login will not work without it |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | How long a login session lasts before re-authentication is required |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `RETRIEVER_K` | `4` | Number of chunks retrieved per chat query |
| `WHATSAPP_ACCESS_TOKEN` | *(unset)* | Meta WhatsApp Cloud API access token — required for WhatsApp send/receive |
| `WHATSAPP_PHONE_NUMBER_ID` | *(unset)* | Meta phone number id the messages are sent from |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | *(unset)* | Meta WhatsApp Business Account id |
| `WHATSAPP_VERIFY_TOKEN` | *(unset)* | Shared secret used to verify the `/webhook/whatsapp` subscription with Meta |
| `PUBLIC_BASE_URL` | *(unset)* | Publicly reachable base URL (e.g. via `cloudflared`) used to build the `/quote` link sent to WhatsApp customers — without it, WhatsApp quotation requests are disabled |
| `SITE_BASE_URL` | `https://aadrik.co.in` | The public marketing site's origin (not this API) — used to build `link`/`image_link` in the `/catalog.csv` feed consumed by Meta's Commerce Manager for the WhatsApp catalog |
| `WHATSAPP_CONTACT_TEMPLATE_NAME` | `contact_form_received` | Approved Meta template used to confirm a website contact-form submission over WhatsApp (required because the submitter usually has no open 24h session) |
| `WHATSAPP_CONTACT_TEMPLATE_LANG` | `en_US` | Language code the contact-form template was approved under — must match exactly, or the send silently fails |
| `WHATSAPP_SALES_TEMPLATE_NAME` | `sales_introduction` | Approved Meta template Sales Inbox's "+ New Conversation" uses to business-initiate a chat outside the 24h window — a separate template from the contact-form one, since the wording differs |
| `WHATSAPP_SALES_TEMPLATE_LANG` | `en` | Language code the sales-outreach template was approved under |
| `WHATSAPP_ORDER_RECEIVED_TEMPLATE_NAME` | `order_received` | Approved Meta template used to message an existing customer about an order (e.g. via "Message Customer") once the 24h window has closed — separate from the sales-outreach template since the wording differs |
| `WHATSAPP_ORDER_RECEIVED_TEMPLATE_LANG` | `en` | Language code the order-received template was approved under |

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
| `admin` | Everything — Chat, Dashboard, Analytics, Customers, Sales Inbox, Products, Product Management, Knowledge Base Manager, Monthly Reports, Policies, Company, Settings, User Management, Activity Log |
| `manager` | Dashboard, Analytics, Customers, Sales Inbox, Products, Product Management, Knowledge Base Manager, Monthly Reports (can assign/reassign leads) |
| `sales` | Chat, Dashboard, Customers, Sales Inbox, Products |
| `viewer` | Chat, Products |

Defined in `frontend/src/utils/permissions.js` (frontend gating) and enforced independently in `backend/app/middleware/auth.py` (`require_roles`) on every endpoint — the frontend hiding a nav item is a UX nicety, not the actual security boundary.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/API.md](docs/API.md) — full endpoint reference
- [docs/ROADMAP.md](docs/ROADMAP.md) — phased build plan
- [docs/CHANGELOG.md](docs/CHANGELOG.md) — notable changes per phase

> **Note:** the docs above predate this session's authentication/RBAC/CRM-tracking/activity-log work and haven't been updated to match — treat them as historical for Phase 0, not current reference.
