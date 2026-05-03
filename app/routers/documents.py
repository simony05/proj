import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from ..models import DocumentMeta, DocumentResponse, QueryRequest, QueryResponse
from ..queue import enqueue_document_job
from ..rag import delete_document_and_rebuild, query_workspace
from ..workspace import add_document, get_document, list_documents, workspace_path

router = APIRouter(prefix="/workspaces/{workspace_id}", tags=["documents"])


def _require_workspace(workspace_id: str) -> Path:
    ws_dir = workspace_path(workspace_id)
    if not ws_dir.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return ws_dir


def _to_document_response(document: DocumentMeta) -> DocumentResponse:
    return DocumentResponse(
        **document.model_dump(),
        file_name=Path(document.file_path).name,
    )


@router.get("/documents", response_model=list[DocumentResponse])
def list_workspace_documents(workspace_id: str):
    _require_workspace(workspace_id)
    documents = sorted(
        list_documents(workspace_id),
        key=lambda document: document.created_at,
        reverse=True,
    )
    return [_to_document_response(document) for document in documents]


@router.get("/documents/{document_id}/download")
def download_document(workspace_id: str, document_id: str):
    _require_workspace(workspace_id)
    document = get_document(workspace_id, document_id)
    if document is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    file_path = Path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        filename=file_path.name,
        content_disposition_type="inline",
    )


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(workspace_id: str, document_id: str):
    ws_dir = _require_workspace(workspace_id)
    if not delete_document_and_rebuild(ws_dir, workspace_id, document_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")


@router.post("/upload", response_model=list[DocumentResponse], status_code=status.HTTP_201_CREATED)
async def upload_document(workspace_id: str, files: list[UploadFile] = File(...)):
    ws_dir = _require_workspace(workspace_id)
    docs_dir = ws_dir / "docs"
    docs_dir.mkdir(exist_ok=True)

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one PDF file is required",
        )

    created_documents: list[DocumentMeta] = []
    for file in files:
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are supported",
            )

        document = DocumentMeta(
            document_id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            file_path="",
            status="uploaded",
            created_at=datetime.now(timezone.utc),
        )

        safe_name = Path(file.filename or f"{document.document_id}.pdf").name
        file_dir = docs_dir / document.document_id
        file_dir.mkdir(exist_ok=True)
        file_path = file_dir / safe_name
        file_path.write_bytes(await file.read())

        document = document.model_copy(update={"file_path": str(file_path)})
        add_document(workspace_id, document)
        enqueue_document_job(
            {
                "workspace_id": workspace_id,
                "document_id": document.document_id,
                "file_path": document.file_path,
            }
        )
        created_documents.append(document)

    return [_to_document_response(document) for document in created_documents]


@router.post("/query", response_model=QueryResponse)
def query_documents(workspace_id: str, body: QueryRequest):
    ws_dir = _require_workspace(workspace_id)
    answer, sources = query_workspace(ws_dir, body.query)
    return QueryResponse(answer=answer, sources=sources)
