from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.crm import router as crm_router
from app.api.knowledge import router as knowledge_router
from app.api.products import router as products_router
from app.api.quotation import router as quotation_router
from app.api.sessions import router as sessions_router
from app.core.config import settings
from app.core.exceptions import register_exception_handlers
from app.database.connection import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Aadrik AI",
    version="1.0.0",
    lifespan=lifespan,
)
register_exception_handlers(app)

_allowed_origins = {settings.frontend_origin}
if "localhost" in settings.frontend_origin:
    _allowed_origins.add(settings.frontend_origin.replace("localhost", "127.0.0.1"))
elif "127.0.0.1" in settings.frontend_origin:
    _allowed_origins.add(settings.frontend_origin.replace("127.0.0.1", "localhost"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_allowed_origins),
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


@app.get("/")
def home():
    return {"project": "Aadrik AI", "status": "Running \U0001f680"}
