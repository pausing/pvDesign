from __future__ import annotations

import json
from pathlib import Path
from threading import Lock
from typing import Optional
from uuid import uuid4

from app.models import Project, ProjectSummary
from app.seed import demo_project, utc_now

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROJECTS_DIR = DATA_DIR / "projects"
INDEX_PATH = DATA_DIR / "index.json"

_lock = Lock()


def _ensure_dirs() -> None:
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)


def _read_index() -> list[dict]:
    if not INDEX_PATH.exists():
        return []
    return json.loads(INDEX_PATH.read_text(encoding="utf-8"))


def _write_index(items: list[dict]) -> None:
    INDEX_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


def _project_path(project_id: str) -> Path:
    return PROJECTS_DIR / f"{project_id}.json"


def _summary(project: Project) -> dict:
    return ProjectSummary(
        id=project.id,
        name=project.name,
        site=project.site,
        updated_at=project.updated_at,
        created_at=project.created_at,
    ).model_dump()


def init_store() -> None:
    _ensure_dirs()
    with _lock:
        items = _read_index()
        if items:
            return
        project = demo_project()
        _project_path(project.id).write_text(project.model_dump_json(indent=2), encoding="utf-8")
        _write_index([_summary(project)])


def list_projects() -> list[ProjectSummary]:
    with _lock:
        items = _read_index()
    items.sort(key=lambda p: p.get("updated_at", ""), reverse=True)
    return [ProjectSummary.model_validate(i) for i in items]


def get_project(project_id: str) -> Optional[Project]:
    path = _project_path(project_id)
    if not path.exists():
        return None
    with _lock:
        data = json.loads(path.read_text(encoding="utf-8"))
    return Project.model_validate(data)


def save_project(project: Project) -> Project:
    project.updated_at = utc_now()
    with _lock:
        _ensure_dirs()
        _project_path(project.id).write_text(project.model_dump_json(indent=2), encoding="utf-8")
        items = [i for i in _read_index() if i.get("id") != project.id]
        items.append(_summary(project))
        _write_index(items)
    return project


def delete_project(project_id: str) -> bool:
    path = _project_path(project_id)
    if not path.exists():
        return False
    with _lock:
        path.unlink(missing_ok=True)
        items = [i for i in _read_index() if i.get("id") != project_id]
        _write_index(items)
    return True


def duplicate_project(project_id: str) -> Optional[Project]:
    original = get_project(project_id)
    if original is None:
        return None
    clone = original.model_copy(deep=True)
    clone.id = str(uuid4())
    clone.name = f"{original.name} copy"
    clone.created_at = utc_now()
    return save_project(clone)
