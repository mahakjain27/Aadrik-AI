from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.activity import router as activity_router
from app.api.chat import router as chat_router
from app.api.crm import router as crm_router
from app.api.customers import router as customers_router
from app.api.knowledge import router as knowledge_router
from app.api.knowledge_documents import router as knowledge_documents_router
from app.api.notifications import router as notifications_router
from app.api.product_admin import router as product_admin_router
from app.api.products import router as products_router
from app.api.public_contact import router as public_contact_router
from app.api.public_quote import router as public_quote_router
from app.api.quotation import router as quotation_router
from app.api.realtime import router as realtime_router
from app.api.reports import router as reports_router
from app.api.sessions import router as sessions_router
from app.api.system import router as system_router
from app.api.users import router as users_router
from app.api.whatsapp_webhook import router as whatsapp_webhook_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.database.connection import init_db
from app.api.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield



app = FastAPI(
    title="Aadrik AI",
    version=settings.app_version,
    lifespan=lifespan,
)
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(products_router)
app.include_router(sessions_router)
app.include_router(quotation_router)
app.include_router(crm_router)
app.include_router(knowledge_router)
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(activity_router)
app.include_router(realtime_router)
app.include_router(whatsapp_webhook_router)
app.include_router(public_quote_router)
app.include_router(public_contact_router)
app.include_router(system_router)
app.include_router(customers_router)
app.include_router(product_admin_router)
app.include_router(knowledge_documents_router)
app.include_router(notifications_router)
app.include_router(reports_router)

@app.get("/")
def home():
    return {"project": "Aadrik AI", "status": "Running \U0001f680"}
