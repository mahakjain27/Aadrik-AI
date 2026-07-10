# Changelog

## v0.1 — Phase 0: Architecture & Codebase

**Added**
- AI Chat with RAG (LM Studio + ChromaDB + markdown knowledge base)
- Product Explorer / catalog browsing
- Quotation requests with branded PDF generation
- CRM dashboard (lead list, status pipeline, search/filter)
- Analytics (win rate, leads by status/city/month, top products/brands)
- AI-assisted lead priority scoring
- Company & Policies pages sourced from the knowledge base
- Per-browser session history for chat

**Changed**
- Reorganized backend into `api` / `services` / `database` / `rag` / `schemas` / `constants` layers
- Centralized logging and global FastAPI exception handlers
- Cleaned up dead code, unused imports, and inconsistent formatting across backend and frontend; fixed a broken import path in `quotation.py` (was crashing the PDF-download endpoint) and in `Analytics.jsx` (was breaking the production build)
