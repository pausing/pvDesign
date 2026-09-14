from contextlib import asynccontextmanager
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.identity import portal_identity
from app.routers import projects
from app import storage


def _cors_origins() -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "https://portal.powerlearn.us",
    ]
    extra = os.environ.get("CORS_ORIGINS", "")
    for part in extra.split(","):
        origin = part.strip().rstrip("/")
        if origin and origin not in origins:
            origins.append(origin)
    return origins


def _resolve_static_dir() -> Optional[Path]:
    raw = os.environ.get("STATIC_DIR", "").strip()
    candidates = []
    if raw:
        candidates.append(Path(raw))
    repo_root = Path(__file__).resolve().parents[2]
    candidates.append(repo_root / "frontend" / "dist")
    candidates.append(Path("frontend/dist"))
    for path in candidates:
        if path.is_dir() and (path / "index.html").is_file():
            return path
    return None


STATIC_DIR = _resolve_static_dir()


def _base_path() -> str:
    return os.environ.get("PV_BASE_PATH", "/pv").rstrip("/")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.init_store()
    yield


BASE_PATH = _base_path()

api_app = FastAPI(title="PV Design API", version="0.1.0", lifespan=lifespan)

api_app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_app.include_router(projects.router)


@api_app.get("/api/health")
def health():
    return {"ok": True}


@api_app.get("/api/me")
def me(request: Request):
    """Portal user from ForwardAuth headers, or nulls when headers are absent."""
    return portal_identity(request)


app = FastAPI(title="PV Design", version="0.1.0")
app.mount(BASE_PATH, api_app)


def _safe_static(full_path: str) -> Optional[Path]:
    if STATIC_DIR is None or not STATIC_DIR.is_dir():
        return None
    root = STATIC_DIR.resolve()
    candidate = (root / full_path).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    if candidate.is_file():
        return candidate
    return None


if STATIC_DIR is not None and STATIC_DIR.is_dir():

    @api_app.get("/")
    def spa_root():
        return FileResponse(STATIC_DIR / "index.html")

    @api_app.get("/{full_path:path}")
    def spa_path(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        found = _safe_static(full_path)
        if found is not None:
            return FileResponse(found)
        return FileResponse(STATIC_DIR / "index.html")
