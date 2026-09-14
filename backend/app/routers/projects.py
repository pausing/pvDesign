from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app.identity import owner_from_identity
from app.models import CatalogPayload, Project, ProjectCreate, ProjectPatch
from app.seed import empty_project, utc_now
from app import storage

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("")
def list_projects():
    return storage.list_projects()


@router.post("", status_code=201)
def create_project(body: ProjectCreate, request: Request):
    owner, user_id = owner_from_identity(request, body.owner, body.user_id)
    project = empty_project(
        name=body.name.strip() or "Untitled project",
        site=body.site,
        notes=body.notes,
        seed_catalog=body.seed_catalog,
        owner=owner,
        user_id=user_id,
    )
    return storage.save_project(project)


@router.post("/import", status_code=201)
def import_project(body: Project):
    incoming = body.model_copy(deep=True)
    if storage.get_project(incoming.id) is not None:
        incoming.id = str(uuid4())
        incoming.name = f"{incoming.name} (imported)"
    incoming.created_at = utc_now()
    return storage.save_project(incoming)


@router.get("/{project_id}")
def get_project(project_id: str):
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}")
def put_project(project_id: str, body: Project):
    existing = storage.get_project(project_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Project not found")
    body.id = project_id
    body.created_at = existing.created_at
    return storage.save_project(body)


@router.patch("/{project_id}")
def patch_project(project_id: str, body: ProjectPatch):
    existing = storage.get_project(project_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Project not found")
    data = existing.model_dump()
    updates = body.model_dump(exclude_unset=True)
    data.update(updates)
    project = Project.model_validate(data)
    project.id = project_id
    project.created_at = existing.created_at
    return storage.save_project(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str):
    if not storage.delete_project(project_id):
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("/{project_id}/duplicate", status_code=201)
def duplicate_project(project_id: str):
    clone = storage.duplicate_project(project_id)
    if clone is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return clone


@router.get("/{project_id}/export")
def export_project(project_id: str):
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    filename = f"{project.name.replace(' ', '_')}.pvdes.json"
    return JSONResponse(
        content=project.model_dump(),
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/catalog/export")
def export_catalog(project_id: str):
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"catalog": [a.model_dump() for a in project.catalog]}


@router.post("/{project_id}/catalog/import")
def import_catalog(project_id: str, body: CatalogPayload):
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    by_id = {a.id: a for a in project.catalog}
    imported = 0
    for asset in body.catalog:
        by_id[asset.id] = asset
        imported += 1
    project.catalog = list(by_id.values())
    storage.save_project(project)
    return {"imported": imported, "catalog": project.catalog}
