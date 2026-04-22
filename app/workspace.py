import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .models import WorkspaceMeta

DATA_DIR = Path("data")


def workspace_path(workspace_id: str) -> Path:
    return DATA_DIR / f"workspace_{workspace_id}"


def _metadata_path(workspace_id: str) -> Path:
    return workspace_path(workspace_id) / "metadata.json"


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


def delete_workspace(workspace_id: str) -> bool:
    ws_dir = workspace_path(workspace_id)
    if not ws_dir.exists():
        return False
    shutil.rmtree(ws_dir)
    return True
