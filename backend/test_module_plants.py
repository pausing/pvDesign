"""Plants are scoped to layout_config or its_design and lists do not mix."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

os.environ["PVDES_DATA_DIR"] = "/tmp/pvdes_module_plants_test"
os.environ["PV_BASE_PATH"] = "/pv"

from app.main import app  # noqa: E402

IDENTITY = {
    "X-Powerlearn-User-Id": "user-42",
    "X-Powerlearn-Email": "pablo@powerlearn.us",
    "X-Powerlearn-Admin": "true",
}


@pytest.fixture
def client():
    return TestClient(app)


def test_create_stamps_module(client):
    layout = client.post(
        "/pv/api/projects",
        json={"name": "Layout plant", "seed_catalog": False, "module": "layout_config"},
        headers=IDENTITY,
    )
    its = client.post(
        "/pv/api/projects",
        json={"name": "ITS plant", "seed_catalog": True, "module": "its_design"},
        headers=IDENTITY,
    )
    assert layout.status_code == 201
    assert its.status_code == 201
    assert layout.json()["module"] == "layout_config"
    assert its.json()["module"] == "its_design"
    assert its.json()["its_design"]["blocks"]
    assert layout.json()["its_design"]["blocks"] == []

    listed_layout = client.get("/pv/api/projects?module=layout_config").json()
    listed_its = client.get("/pv/api/projects?module=its_design").json()
    layout_ids = {p["id"] for p in listed_layout}
    its_ids = {p["id"] for p in listed_its}
    assert layout.json()["id"] in layout_ids
    assert its.json()["id"] not in layout_ids
    assert its.json()["id"] in its_ids
    assert layout.json()["id"] not in its_ids
    assert all(p["module"] == "layout_config" for p in listed_layout)
    assert all(p["module"] == "its_design" for p in listed_its)

    client.delete(f"/pv/api/projects/{layout.json()['id']}")
    client.delete(f"/pv/api/projects/{its.json()['id']}")


def test_default_module_is_layout(client):
    response = client.post(
        "/pv/api/projects",
        json={"name": "Untagged", "seed_catalog": False},
    )
    assert response.status_code == 201
    assert response.json()["module"] == "layout_config"
    client.delete(f"/pv/api/projects/{response.json()['id']}")


def test_duplicate_keeps_module(client):
    created = client.post(
        "/pv/api/projects",
        json={"name": "ITS orig", "seed_catalog": False, "module": "its_design"},
    ).json()
    clone = client.post(f"/pv/api/projects/{created['id']}/duplicate").json()
    assert clone["module"] == "its_design"
    client.delete(f"/pv/api/projects/{created['id']}")
    client.delete(f"/pv/api/projects/{clone['id']}")
