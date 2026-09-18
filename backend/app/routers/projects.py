from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import JSONResponse, Response

from app.electrical import (
    build_bt_template,
    build_mv_template,
    merge_bt,
    merge_mv,
    parse_bt_workbook,
    parse_mv_workbook,
    preview_bt,
    preview_mv,
)
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


def _require_project(project_id: str) -> Project:
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _xlsx_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


async def _read_xlsx(file: UploadFile) -> tuple[bytes, str]:
    filename = file.filename or "upload.xlsx"
    if not filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload an .xlsx workbook.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file.")
    return data, filename


@router.get("/{project_id}/electrical/templates/bt")
def download_bt_template(project_id: str, examples: bool = True):
    _require_project(project_id)
    return _xlsx_response(build_bt_template(include_examples=examples), "bt_electrical_configuration.xlsx")


@router.get("/{project_id}/electrical/templates/mv")
def download_mv_template(project_id: str, examples: bool = True):
    _require_project(project_id)
    return _xlsx_response(build_mv_template(include_examples=examples), "mv_electrical_configuration.xlsx")


@router.post("/{project_id}/electrical/bt/parse")
async def parse_bt_config(project_id: str, file: UploadFile = File(...)):
    project = _require_project(project_id)
    data, filename = await _read_xlsx(file)
    try:
        config = parse_bt_workbook(data, filename=filename, parameters=project.parameters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"preview": preview_bt(config), "config": config}


@router.post("/{project_id}/electrical/bt/import")
async def import_bt_config(
    project_id: str,
    file: UploadFile = File(...),
    mode: str = Query("replace", pattern="^(replace|merge)$"),
):
    project = _require_project(project_id)
    data, filename = await _read_xlsx(file)
    try:
        incoming = parse_bt_workbook(data, filename=filename, parameters=project.parameters)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    project.electrical_bt = (
        merge_bt(project.electrical_bt, incoming) if mode == "merge" else incoming
    )
    saved = storage.save_project(project)
    return {
        "mode": mode,
        "preview": preview_bt(saved.electrical_bt) if saved.electrical_bt else None,
        "electrical_bt": saved.electrical_bt,
        "project": saved,
    }


@router.post("/{project_id}/electrical/mv/parse")
async def parse_mv_config(project_id: str, file: UploadFile = File(...)):
    project = _require_project(project_id)
    data, filename = await _read_xlsx(file)
    try:
        config = parse_mv_workbook(data, filename=filename, bt=project.electrical_bt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {"preview": preview_mv(config), "config": config}


@router.post("/{project_id}/electrical/mv/import")
async def import_mv_config(
    project_id: str,
    file: UploadFile = File(...),
    mode: str = Query("replace", pattern="^(replace|merge)$"),
):
    project = _require_project(project_id)
    data, filename = await _read_xlsx(file)
    try:
        incoming = parse_mv_workbook(data, filename=filename, bt=project.electrical_bt)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    project.electrical_mv = (
        merge_mv(project.electrical_mv, incoming) if mode == "merge" else incoming
    )
    saved = storage.save_project(project)
    return {
        "mode": mode,
        "preview": preview_mv(saved.electrical_mv) if saved.electrical_mv else None,
        "electrical_mv": saved.electrical_mv,
        "project": saved,
    }
