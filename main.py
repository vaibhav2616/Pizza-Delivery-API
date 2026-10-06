import inspect
import re
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from fastapi.openapi.utils import get_openapi
from fastapi_jwt_auth import AuthJWT
from fastapi_jwt_auth.exceptions import AuthJWTException

from app.core.config import settings
from app.api.v1.auth import auth_router
from app.api.v1.orders import order_router
from app.schemas import Settings as JWTSettings
from init_db import init_db

# Static files directory
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure database schema and demo records are initialized
    init_db()
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="High-performance, secure REST API and interactive Single Page Application for gourmet pizza ordering and kitchen dispatch.",
    lifespan=lifespan
)

# Cross-Origin Resource Sharing (CORS) Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# JWT Exception Handler for consistent JSON error payloads
@app.exception_handler(AuthJWTException)
def authjwt_exception_handler(request: Request, exc: AuthJWTException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.message}
    )

# JWT Configuration callback
@AuthJWT.load_config
def get_config():
    return JWTSettings()

# OpenAPI Security Scheme customization for Swagger UI (/docs)
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title="Vesuvio Hearth Neapolitan Pizza Delivery API",
        version="2.0.0",
        description="Full REST API documentation with JWT Bearer Authentication and interactive endpoints.",
        routes=app.routes,
    )

    openapi_schema["components"]["securitySchemes"] = {
        "Bearer Auth": {
            "type": "apiKey",
            "in": "header",
            "name": "Authorization",
            "description": "Enter your token in format: **Bearer &lt;JWT_ACCESS_TOKEN&gt;**"
        }
    }

    api_routes = [route for route in app.routes if isinstance(route, APIRoute)]
    for route in api_routes:
        path = getattr(route, "path")
        endpoint = getattr(route, "endpoint")
        methods = [method.lower() for method in getattr(route, "methods", [])]

        for method in methods:
            try:
                source = inspect.getsource(endpoint)
                if (
                    re.search("jwt_required", source) or
                    re.search("get_current_user", source) or
                    re.search("get_current_staff", source)
                ):
                    if path in openapi_schema.get("paths", {}) and method in openapi_schema["paths"][path]:
                        openapi_schema["paths"][path][method]["security"] = [{"Bearer Auth": []}]
            except (OSError, TypeError):
                pass

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Mount static asset directory
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Root Route: Serves the animated Single Page Application
@app.get("/", summary="Customer UI & Ordering Portal", response_class=FileResponse)
def serve_ui():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse({
        "message": "Vesuvio Hearth Neapolitan Pizza API is running. Visit /docs for Swagger UI.",
        "version": "2.0.0"
    })

# Segregated Kitchen Command & Dispatch Center (Staff & Chefs Only)
@app.get("/kitchen", summary="Kitchen Command & Dispatch Center", response_class=FileResponse)
def serve_kitchen():
    kitchen_path = STATIC_DIR / "kitchen.html"
    if kitchen_path.exists():
        return FileResponse(str(kitchen_path))
    return JSONResponse({
        "message": "Kitchen Dispatch Center is initializing.",
        "version": "2.0.0"
    })

# System Health Check Endpoint
@app.get("/health", summary="System Health & Readiness Check")
def health_check():
    return {
        "status": "healthy",
        "service": "Vesuvio Hearth Neapolitan Pizza API",
        "version": settings.app_version
    }

# Register Routers
app.include_router(auth_router)
app.include_router(order_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

