import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .models import DocumentMeta, WorkspaceMeta

DATA_DIR = Path("data")


def workspace_path(workspace_id: str) -> Path:
    return DATA_DIR / f"workspace_{workspace_id}"


def _metadata_path(workspace_id: str) -> Path:
    return workspace_path(workspace_id) / "metadata.json"


def documents_path(workspace_id: str) -> Path:
    return workspace_path(workspace_id) / "documents.json"


def create_workspace(name: str) -> WorkspaceMeta:
    workspace_id = str(uuid.uuid4())
    meta = WorkspaceMeta(
        workspace_id=workspace_id,
        workspace_name=name,
        created_at=datetime.now(timezone.utc),
    )

    ws_dir = workspace_path(workspace_id)
    (ws_dir / "docs").mkdir(parents=True, exist_ok=True)

    _metadata_path(workspace_id).write_text(
        meta.model_dump_json(indent=2), encoding="utf-8"
    )
    return meta


def list_workspaces() -> list[WorkspaceMeta]:
    if not DATA_DIR.exists():
        return []

    workspaces: list[WorkspaceMeta] = []
    for path in sorted(DATA_DIR.iterdir()):
        meta_file = path / "metadata.json"
        if meta_file.exists():
            workspaces.append(WorkspaceMeta(**json.loads(meta_file.read_text(encoding="utf-8"))))

    return workspaces


def list_documents(workspace_id: str) -> list[DocumentMeta]:
    path = documents_path(workspace_id)
    if not path.exists():
        return []
    return [DocumentMeta(**item) for item in json.loads(path.read_text(encoding="utf-8"))]


def save_documents(workspace_id: str, documents: list[DocumentMeta]) -> None:
    documents_path(workspace_id).write_text(
        json.dumps([doc.model_dump(mode="json") for doc in documents], indent=2),
        encoding="utf-8",
    )


def add_document(workspace_id: str, document: DocumentMeta) -> None:
    documents = list_documents(workspace_id)
    documents.append(document)
    save_documents(workspace_id, documents)


def get_document(workspace_id: str, document_id: str) -> DocumentMeta | None:
    for document in list_documents(workspace_id):
        if document.document_id == document_id:
            return document
    return None


def delete_workspace(workspace_id: str) -> bool:
    ws_dir = workspace_path(workspace_id)
    if not ws_dir.exists():
        return False
    shutil.rmtree(ws_dir)
    return True
