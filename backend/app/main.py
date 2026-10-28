"""FastAPI application entry point.

Run from the backend directory:

    uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import analytics, checkins, datasets, health, insights
from app.core.config import get_settings
from app.db.database import SessionLocal, init_db
from app.services import dataset_service

logger = logging.getLogger("lifelens")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed the demo dataset on first start."""
    init_db()
    session = SessionLocal()
    try:
        dataset_service.ensure_demo_loaded(session)
    except Exception:  # pragma: no cover - startup must not be fatal
        logger.exception("demo dataset could not be seeded at startup")
    finally:
        session.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Local-first behavioural analytics API for LifeLens AI. Analyses self-reported "
        "lifestyle data with K-Means clustering, correlation analysis and association-rule "
        "mining. Not a medical or diagnostic service."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Flatten Pydantic errors into one readable sentence per field."""
    messages: list[str] = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", []) if part not in ("body", "query")]
        field = ".".join(location) or "request"
        messages.append(f"{field}: {error.get('msg', 'invalid value')}")
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Never leak a stack trace or SQL to the client."""
    logger.exception("database error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. Check the backend log for details."},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."},
    )


app.include_router(health.router)
app.include_router(checkins.router)
app.include_router(datasets.router)
app.include_router(analytics.router)
app.include_router(insights.router)


@app.get("/", tags=["health"])
def root() -> dict[str, str]:
    return {
        "app": settings.app_name,
        "tagline": settings.app_tagline,
        "docs": "/docs",
        "health": "/api/health",
    }
