"""ITS Design API: PV-block catalog, layout items, grouping, validation."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ["PVDES_DATA_DIR"] = "/tmp/pvdes_its_test_data"
os.environ["PV_BASE_PATH"] = "/pv"

from app.its_design import default_block, sync_strings_from_tables, validate_block  # noqa: E402
from app.main import app  # noqa: E402
from app.models import ItsPlacedItem  # noqa: E402

IDENTITY = {
    "X-Powerlearn-User-Id": "user-42",
    "X-Powerlearn-Email": "pablo@powerlearn.us",
    "X-Powerlearn-Admin": "true",
}


@pytest.fixture
def client():
    return TestClient(app)


def _create_project(client: TestClient, seed: bool = False) -> str:
    response = client.post(
        "/pv/api/projects",
        json={"name": "ITS Plant", "site": "Lab", "seed_catalog": seed},
        headers=IDENTITY,
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_seeded_project_includes_its_design(client):
    project_id = _create_project(client, seed=True)
    project = client.get(f"/pv/api/projects/{project_id}").json()
    assert project["owner"] == "pablo@powerlearn.us"
    design = project["its_design"]
    assert len(design["blocks"]) == 1
    block = design["blocks"][0]
    assert block["catalog"]
    assert any(spec["kind"] == "its" for spec in block["catalog"])
    assert any(item["kind"] == "string_box" for item in block["items"])
    assert len(block["strings"]) > 0
    client.delete(f"/pv/api/projects/{project_id}")


def test_unseeded_project_has_empty_its_design(client):
    project_id = _create_project(client, seed=False)
    design = client.get(f"/pv/api/projects/{project_id}/its-design").json()
    assert design["blocks"] == []
    client.delete(f"/pv/api/projects/{project_id}")


def test_create_block_and_validate(client):
    project_id = _create_project(client, seed=False)
    created = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Block North", "seed": True},
    )
    assert created.status_code == 201
    block = created.json()
    assert block["name"] == "Block North"
    assert block["id"]
    validation = client.get(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/validate"
    )
    assert validation.status_code == 200
    body = validation.json()
    assert body["string_count"] == len(block["strings"])
    assert body["its_count"] == 1
    assert body["string_box_count"] == 8
    assert body["orphan_strings"] == 0
    assert body["overloaded_boxes"] == 0
    client.delete(f"/pv/api/projects/{project_id}")


def test_patch_assignments_and_overload_warning(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Tight box", "seed": True},
    ).json()
    first_box = next(item for item in block["items"] if item["kind"] == "string_box")
    dumped = {sid: first_box["id"] for sid in [s["id"] for s in block["strings"]]}
    patched = client.patch(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}",
        json={"assignments": {"string_to_box": dumped, "box_to_its": block["assignments"]["box_to_its"]}},
    )
    assert patched.status_code == 200
    validation = client.get(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/validate"
    ).json()
    assert validation["overloaded_boxes"] >= 1
    assert any(w["code"] == "box_overload" for w in validation["warnings"])
    client.delete(f"/pv/api/projects/{project_id}")


def test_orphan_strings_after_clearing_assignments(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Orphans", "seed": True},
    ).json()
    client.patch(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}",
        json={"assignments": {"string_to_box": {}, "box_to_its": {}}},
    )
    validation = client.get(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/validate"
    ).json()
    assert validation["orphan_strings"] == validation["string_count"]
    assert validation["orphan_boxes"] == validation["string_box_count"]
    client.delete(f"/pv/api/projects/{project_id}")


def test_sync_strings_follows_table_geometry():
    block = default_block()
    table = next(item for item in block.items if item.kind == "table")
    table.rows = 2
    table.tables_per_row = 2
    # Only keep this table
    block.items = [table, *[i for i in block.items if i.kind != "table"]]
    synced = sync_strings_from_tables(block)
    # 2×2 tables × 2 strings/tracker = 8
    table_strings = [s for s in synced.strings if s.table_id == table.id]
    assert len(table_strings) == 8
    report = validate_block(synced)
    assert report.string_count == len(synced.strings)


def test_put_its_design_and_project_patch_roundtrip(client):
    project_id = _create_project(client, seed=False)
    block = default_block(name="West").model_dump()
    put = client.put(
        f"/pv/api/projects/{project_id}/its-design",
        json={"blocks": [block]},
    )
    assert put.status_code == 200
    assert put.json()["blocks"][0]["name"] == "West"

    patched = client.patch(
        f"/pv/api/projects/{project_id}",
        json={"its_design": {"blocks": [{**block, "name": "West renamed"}]}},
    )
    assert patched.status_code == 200
    assert patched.json()["its_design"]["blocks"][0]["name"] == "West renamed"
    # Plant electrical fields remain untouched
    assert patched.json()["electrical_bt"] is None
    client.delete(f"/pv/api/projects/{project_id}")


def test_delete_block(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Temp", "seed": False},
    ).json()
    deleted = client.delete(f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}")
    assert deleted.status_code == 204
    missing = client.get(f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}")
    assert missing.status_code == 404
    client.delete(f"/pv/api/projects/{project_id}")


def test_empty_block_can_add_items_via_patch(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Blank", "seed": False},
    ).json()
    spec_id = next(s["id"] for s in block["catalog"] if s["kind"] == "tracker")
    box_id = next(s["id"] for s in block["catalog"] if s["kind"] == "string_box")
    its_id = next(s["id"] for s in block["catalog"] if s["kind"] == "its")
    items = [
        ItsPlacedItem(id="t1", name="T1", kind="table", spec_id=spec_id, rows=1, tables_per_row=1).model_dump(),
        ItsPlacedItem(id="b1", name="B1", kind="string_box", spec_id=box_id, x=200, y=80).model_dump(),
        ItsPlacedItem(id="i1", name="I1", kind="its", spec_id=its_id, x=320, y=80).model_dump(),
    ]
    patched = client.patch(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}",
        json={"items": items},
    )
    assert patched.status_code == 200
    assert len(patched.json()["strings"]) == 2
    client.delete(f"/pv/api/projects/{project_id}")


def test_unknown_block_404(client):
    project_id = _create_project(client, seed=False)
    response = client.get(f"/pv/api/projects/{project_id}/its-design/blocks/nope")
    assert response.status_code == 404
    client.delete(f"/pv/api/projects/{project_id}")


def test_apply_hierarchy_creates_instances_and_grouping(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "From specs", "seed": False},
    ).json()
    assert block["items"] == []
    assert block["strings"] == []
    applied = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/apply-hierarchy",
        json={
            "modules_per_string": 28,
            "strings_per_table": 2,
            "table_count": 8,
            "string_box_count": 4,
            "its_count": 1,
            "auto_assign": True,
        },
    )
    assert applied.status_code == 200
    body = applied.json()
    synced = body["block"]
    report = body["validation"]
    assert synced["hierarchy"]["table_count"] == 8
    assert report["string_count"] == 16
    assert report["string_box_count"] == 4
    assert report["its_count"] == 1
    assert report["assigned_strings"] == 16
    assert report["orphan_strings"] == 0
    assert report["orphan_boxes"] == 0
    assert report["overloaded_boxes"] == 0
    string_spec = next(s for s in synced["catalog"] if s["kind"] == "string")
    assert string_spec["modules_in_series"] == 28
    client.delete(f"/pv/api/projects/{project_id}")


def test_apply_hierarchy_replaces_previous_table_strings(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Resize", "seed": True},
    ).json()
    assert len(block["strings"]) == 128
    report = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/apply-hierarchy",
        json={
            "modules_per_string": 28,
            "strings_per_table": 2,
            "table_count": 8,
            "string_box_count": 4,
            "its_count": 1,
            "auto_assign": True,
        },
    ).json()["validation"]
    assert report["string_count"] == 16
    assert report["string_box_count"] == 4
    assert report["assigned_strings"] == 16
    client.delete(f"/pv/api/projects/{project_id}")


def test_apply_hierarchy_overload_when_boxes_too_few(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Tight", "seed": False},
    ).json()
    report = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/apply-hierarchy",
        json={
            "modules_per_string": 28,
            "strings_per_table": 2,
            "table_count": 16,
            "string_box_count": 1,
            "its_count": 1,
            "auto_assign": True,
        },
    ).json()["validation"]
    assert report["string_count"] == 32
    assert report["overloaded_boxes"] == 1
    client.delete(f"/pv/api/projects/{project_id}")


def test_move_hierarchy_reorders_types_without_touching_assignments(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Types only", "seed": True},
    ).json()
    before = block["assignments"]
    moved = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/move-hierarchy",
        json={"kind": "table", "parent_kind": "its", "index": 0},
    )
    assert moved.status_code == 200
    body = moved.json()["block"]
    table = next(level for level in body["hierarchy"]["levels"] if level["kind"] == "table")
    assert table["parent_kind"] == "its"
    assert body["assignments"] == before

    reloaded = client.get(f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}").json()
    table = next(level for level in reloaded["hierarchy"]["levels"] if level["kind"] == "table")
    assert table["parent_kind"] == "its"
    assert reloaded["assignments"] == before
    client.delete(f"/pv/api/projects/{project_id}")


def test_move_hierarchy_rejects_cycle(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Cycle", "seed": True},
    ).json()
    rejected = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/move-hierarchy",
        json={"kind": "its", "parent_kind": "module"},
    )
    assert rejected.status_code == 400
    assert "cycle" in rejected.json()["detail"].lower()
    client.delete(f"/pv/api/projects/{project_id}")


def test_apply_quantities_keeps_type_order_and_surviving_assignments(client):
    project_id = _create_project(client, seed=False)
    block = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks",
        json={"name": "Preserve", "seed": True},
    ).json()
    client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/move-hierarchy",
        json={"kind": "string", "parent_kind": "string_box"},
    )
    kept = client.post(
        f"/pv/api/projects/{project_id}/its-design/blocks/{block['id']}/apply-hierarchy",
        json={
            "modules_per_string": 28,
            "strings_per_table": 2,
            "table_count": 8,
            "string_box_count": 4,
            "its_count": 1,
            "auto_assign": False,
        },
    ).json()["block"]
    string = next(level for level in kept["hierarchy"]["levels"] if level["kind"] == "string")
    assert string["parent_kind"] == "string_box"
    assert kept["assignments"]["string_to_box"]
    client.delete(f"/pv/api/projects/{project_id}")
