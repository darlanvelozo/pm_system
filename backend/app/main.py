from fastapi import FastAPI, Request
from app import __version__
from contextlib import asynccontextmanager
from app.services.default_user import ensure_default_user
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router
from app.api.analytical_reports import router as reports_router
from app.api.settings import router as settings_router
from app.core.config import settings
from app.core.middleware import SecurityMiddleware

cfg = settings()

@asynccontextmanager
async def lifespan(app):
    ensure_default_user()
    yield


app = FastAPI(title='BO Online 24º BPM', version=__version__, lifespan=lifespan, docs_url='/docs' if cfg.environment != 'production' else None, redoc_url=None)
app.add_middleware(SecurityMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=cfg.origins, allow_methods=['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'], allow_headers=['Authorization', 'Content-Type', 'Idempotency-Key'], expose_headers=['Content-Disposition'])
app.include_router(router)
app.include_router(reports_router)
app.include_router(settings_router)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    # Pydantic's default error includes input values; never reflect sensitive payloads.
    return JSONResponse({'detail': 'Dados inválidos', 'fields': [{'loc': list(e['loc']), 'type': e['type']} for e in error.errors()]}, 422)


@app.exception_handler(Exception)
async def server_error(request: Request, error: Exception):
    return JSONResponse({'detail': 'Não foi possível concluir a operação.'}, 500)


@app.get('/health')
def health():
    return {'status': 'ok'}
