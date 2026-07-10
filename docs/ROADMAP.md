# Roadmap

## ✅ Phase 0 — Architecture & Codebase
- Backend/frontend folder structure, separation of concerns (api / services / database / rag layers)
- RAG pipeline: LM Studio (local, zero-cost) + ChromaDB + knowledge base in markdown
- Centralized logging (`app/core/logging.py`) and global exception handling (`app/core/exceptions.py`)
- Shared constants (`app/constants/`) instead of magic strings
- Code cleanup: dead code removed, imports organized (isort/black), consistent naming, lint-clean (ruff/eslint)
- Core features working end-to-end: AI Chat, Product Explorer, Quotations + PDF, CRM dashboard, Analytics, AI lead scoring, Company/Policies pages, session history

## ⬜ Phase 1 — Authentication & User Roles
- Real accounts (replace the per-browser `x-user-id` with authenticated identity)
- JWT-based auth, protected routes
- Role-based access (e.g. sales rep vs. admin) — `app/constants/roles.py` already stubs this out
- Extend `x-api-key`-style protection to `/quotation`, `/crm`, and `/knowledge` (currently unauthenticated — see [ARCHITECTURE.md](ARCHITECTURE.md#known-gaps-pre-phase-1))

## ⬜ Phase 2 — WhatsApp Business API
- Bring the chat assistant to WhatsApp, reusing `ai_service.ask_ai()`

## ⬜ Phase 3 — AI Sales Agent
- Move beyond Q&A: proactive follow-ups, lead qualification, nudges (there's already a `followUps.js` util and `leadScoring.js` heuristic on the frontend — this phase is likely where that logic moves server-side and gets smarter)

## ⬜ Phase 4 — ERP Integration
- Sync quotations/leads with an external ERP instead of SQLite being the system of record

## ⬜ Phase 5 — Email Automation
- Automated quotation delivery, follow-up sequences

## ⬜ Phase 6 — Deployment
- Docker + Nginx, moving off local LM Studio to a hosted or containerized inference setup for production

## ⬜ Phase 7 — Multi-company SaaS
- Multi-tenancy: today `COMPANY` info (`app/core/company.py`) and the knowledge base are hardcoded to one company
