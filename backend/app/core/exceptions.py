from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.core.logging import setup_logger

logger = setup_logger(__name__)


def register_exception_handlers(app: FastAPI):
    """
    Register global exception handlers.
    """

    @app.exception_handler(HTTPException)
    async def http_exception_handler(
        request: Request,
        exc: HTTPException,
    ):
        logger.warning(
            f"HTTPException {exc.status_code}: {exc.detail}"
        )

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": "HTTP Error",
                "message": exc.detail,
            },
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ):
        logger.warning(
            f"Validation Error: {exc.errors()}"
        )

        return JSONResponse(
            status_code=422,
            content={
                "success": False,
                "error": "Validation Error",
                "message": exc.errors(),
            },
        )

    @app.exception_handler(Exception)
    async def general_exception_handler(
        request: Request,
        exc: Exception,
    ):
        logger.exception("Unhandled exception occurred")

        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal Server Error",
                "message": "An unexpected error occurred.",
            },
        )