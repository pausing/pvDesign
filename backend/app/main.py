from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import projects
from app import storage


@asynccontextmanager
async def lifespan(_app: FastAPI):
    storage.init_store()
    yield


app = FastAPI(title="PV Design API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router)


@app.get("/api/health")
def health():
    return {"ok": True}
