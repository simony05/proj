from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceMeta(BaseModel):
    workspace_id: str
    workspace_name: str
    created_at: datetime


class WorkspaceResponse(WorkspaceMeta):
    pass


class DocumentMeta(BaseModel):
    document_id: str
    workspace_id: str
    file_path: str
    status: Literal["uploaded", "processing", "ready", "failed"]
    created_at: datetime


class DocumentResponse(DocumentMeta):
    file_name: str


class ChunkMeta(BaseModel):
    chunk_id: str
    workspace_id: str
    document_id: str
    text: str
    created_at: datetime


class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[str]
