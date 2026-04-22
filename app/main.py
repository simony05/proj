from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.documents import router as documents_router
from .routers.workspaces import router as workspaces_router

app = FastAPI(title="PDF RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces_router)
app.include_router(documents_router)
