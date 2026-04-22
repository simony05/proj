from fastapi import APIRouter, HTTPException, status

from ..models import WorkspaceCreate, WorkspaceResponse
from ..workspace import create_workspace, delete_workspace, list_workspaces

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create(body: WorkspaceCreate):
    return create_workspace(body.name)


@router.get("", response_model=list[WorkspaceResponse])
def index():
    return list_workspaces()


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete(workspace_id: str):
    if not delete_workspace(workspace_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")
