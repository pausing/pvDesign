from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.its_design import (
    apply_hierarchy,
    default_block,
    empty_block,
    find_block,
    replace_block,
    sync_strings_from_tables,
    validate_block,
)
from app.models import ItsBlockCreate, ItsBlockPatch, ItsDesign, ItsHierarchy, ItsPvBlock, Project
from app import storage

router = APIRouter(prefix="/api/projects", tags=["its-design"])


def _require_project(project_id: str) -> Project:
    project = storage.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.its_design is None:
        project.its_design = ItsDesign()
    return project


def _require_block(project: Project, block_id: str) -> ItsPvBlock:
    block = find_block(project.its_design, block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="ITS block not found")
    return block


@router.get("/{project_id}/its-design")
def get_its_design(project_id: str):
    project = _require_project(project_id)
    return project.its_design


@router.put("/{project_id}/its-design")
def put_its_design(project_id: str, body: ItsDesign):
    project = _require_project(project_id)
    synced_blocks = [sync_strings_from_tables(block) for block in body.blocks]
    project.its_design = ItsDesign(blocks=synced_blocks)
    saved = storage.save_project(project)
    return saved.its_design


@router.post("/{project_id}/its-design/blocks", status_code=201)
def create_its_block(project_id: str, body: ItsBlockCreate):
    project = _require_project(project_id)
    name = body.name.strip() or "PV block"
    if body.seed:
        block = default_block(name=name, notes=body.notes)
        block.id = str(uuid4())
    else:
        block = empty_block(str(uuid4()), name, body.notes)
    project.its_design = replace_block(project.its_design, block)
    saved = storage.save_project(project)
    created = find_block(saved.its_design, block.id)
    return created


@router.get("/{project_id}/its-design/blocks/{block_id}")
def get_its_block(project_id: str, block_id: str):
    project = _require_project(project_id)
    return _require_block(project, block_id)


@router.patch("/{project_id}/its-design/blocks/{block_id}")
def patch_its_block(project_id: str, block_id: str, body: ItsBlockPatch):
    project = _require_project(project_id)
    existing = _require_block(project, block_id)
    data = existing.model_dump()
    data.update(body.model_dump(exclude_unset=True))
    block = ItsPvBlock.model_validate(data)
    if body.hierarchy is not None:
        block = apply_hierarchy(block, body.hierarchy)
    else:
        block = sync_strings_from_tables(block)
    project.its_design = replace_block(project.its_design, block)
    saved = storage.save_project(project)
    return find_block(saved.its_design, block_id)


@router.delete("/{project_id}/its-design/blocks/{block_id}", status_code=204)
def delete_its_block(project_id: str, block_id: str):
    project = _require_project(project_id)
    _require_block(project, block_id)
    project.its_design = ItsDesign(
        blocks=[block for block in project.its_design.blocks if block.id != block_id]
    )
    storage.save_project(project)


@router.post("/{project_id}/its-design/blocks/{block_id}/apply-hierarchy")
def apply_its_hierarchy(project_id: str, block_id: str, body: ItsHierarchy):
    project = _require_project(project_id)
    block = apply_hierarchy(_require_block(project, block_id), body)
    project.its_design = replace_block(project.its_design, block)
    saved = storage.save_project(project)
    applied = find_block(saved.its_design, block_id)
    return {"block": applied, "validation": validate_block(applied)}


@router.post("/{project_id}/its-design/blocks/{block_id}/sync-strings")
def sync_its_strings(project_id: str, block_id: str):
    project = _require_project(project_id)
    block = sync_strings_from_tables(_require_block(project, block_id))
    project.its_design = replace_block(project.its_design, block)
    saved = storage.save_project(project)
    synced = find_block(saved.its_design, block_id)
    return {"block": synced, "validation": validate_block(synced)}


@router.get("/{project_id}/its-design/blocks/{block_id}/validate")
def validate_its_block(project_id: str, block_id: str):
    project = _require_project(project_id)
    return validate_block(_require_block(project, block_id))
