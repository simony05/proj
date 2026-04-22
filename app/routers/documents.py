from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, status

from ..models import DocumentMeta, QueryRequest, QueryResponse
from ..rag import ingest_document, query_workspace
from ..workspace import workspace_path

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["documents"])


def _require_workspace(workspace_id: str) -> Path:
    ws_dir = workspace_path(workspace_id)
    if not ws_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws_dir


@router.post("/upload", response_model=DocumentMeta, status_code=status.HTTP_201_CREATED)
async def upload_document(workspace_id: str, file: UploadFile):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported",
        )

    ws_dir = _require_workspace(workspace_id)
    docs_dir = ws_dir / "docs"
    docs_dir.mkdir(exist_ok=True)

    file_path = docs_dir / file.filename
    file_path.write_bytes(await file.read())

    try:
        doc = ingest_document(ws_dir, workspace_id, file_path)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process document: {exc}",
        ) from exc

    return doc


@router.post("/query", response_model=QueryResponse)
def query_documents(workspace_id: str, body: QueryRequest):
    ws_dir = _require_workspace(workspace_id)
    answer, sources = query_workspace(ws_dir, body.query)
    return QueryResponse(answer=answer, sources=sources)
