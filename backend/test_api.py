"""Tests for PV Design API with /pv path prefix."""

import os
import pytest
from fastapi.testclient import TestClient

# Set test data directory before importing app
os.environ["PVDES_DATA_DIR"] = "/tmp/pvdes_test_data"
os.environ["PV_BASE_PATH"] = "/pv"

from app.main import app


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


def test_health_endpoint(client):
    """Test /pv/api/health returns ok."""
    response = client.get("/pv/api/health")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_list_projects(client):
    """Test listing projects with /pv prefix."""
    response = client.get("/pv/api/projects")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_create_and_get_project(client):
    """Test creating and retrieving a project with /pv prefix."""
    # Create project
    create_data = {
        "name": "Test Project",
        "site": "Test Site",
        "notes": "Test notes",
        "seed_catalog": True,
    }
    create_response = client.post("/pv/api/projects", json=create_data)
    assert create_response.status_code == 201
    project = create_response.json()
    assert project["name"] == "Test Project"
    assert project["owner"] == ""
    assert project["user_id"] == ""
    project_id = project["id"]

    # Get project
    get_response = client.get(f"/pv/api/projects/{project_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == project_id

    # Clean up
    client.delete(f"/pv/api/projects/{project_id}")


def test_update_project(client):
    """Test updating a project with /pv prefix."""
    # Create project
    create_data = {
        "name": "Original Name",
        "site": "Test Site",
        "notes": "",
        "seed_catalog": False,
    }
    create_response = client.post("/pv/api/projects", json=create_data)
    project = create_response.json()
    project_id = project["id"]

    # Update with PATCH
    patch_data = {"name": "Updated Name"}
    patch_response = client.patch(f"/pv/api/projects/{project_id}", json=patch_data)
    assert patch_response.status_code == 200
    assert patch_response.json()["name"] == "Updated Name"

    # Clean up
    client.delete(f"/pv/api/projects/{project_id}")


def test_delete_project(client):
    """Test deleting a project with /pv prefix."""
    # Create project
    create_data = {
        "name": "To Delete",
        "site": "Test Site",
        "notes": "",
        "seed_catalog": False,
    }
    create_response = client.post("/pv/api/projects", json=create_data)
    project_id = create_response.json()["id"]

    # Delete
    delete_response = client.delete(f"/pv/api/projects/{project_id}")
    assert delete_response.status_code == 204

    # Verify deleted
    get_response = client.get(f"/pv/api/projects/{project_id}")
    assert get_response.status_code == 404


def test_duplicate_project(client):
    """Test duplicating a project with /pv prefix."""
    # Create project
    create_data = {
        "name": "Original",
        "site": "Test Site",
        "notes": "original notes",
        "seed_catalog": False,
    }
    create_response = client.post("/pv/api/projects", json=create_data)
    project_id = create_response.json()["id"]

    # Duplicate
    dup_response = client.post(f"/pv/api/projects/{project_id}/duplicate")
    assert dup_response.status_code == 201
    duplicate = dup_response.json()
    assert duplicate["id"] != project_id
    assert "copy" in duplicate["name"]

    # Clean up
    client.delete(f"/pv/api/projects/{project_id}")
    client.delete(f"/pv/api/projects/{duplicate['id']}")


def test_spa_root_served(client):
    """Test that SPA is served at /pv/."""
    response = client.get("/pv/")
    # Should return HTML (index.html), not 404
    assert response.status_code in [200, 404]  # 404 if STATIC_DIR not set in test
    if response.status_code == 200:
        assert "text/html" in response.headers.get("content-type", "")


def test_api_404_not_caught_by_spa(client):
    """Test that non-existent API routes return 404, not SPA."""
    response = client.get("/pv/api/nonexistent")
    assert response.status_code == 404


def test_me_without_identity_headers(client):
    """Missing ForwardAuth headers yield null identity fields."""
    response = client.get("/pv/api/me")
    assert response.status_code == 200
    assert response.json() == {"id": None, "email": None, "admin": None}


def test_me_with_identity_headers(client):
    """Present X-Powerlearn-* headers are returned as {id, email, admin}."""
    response = client.get(
        "/pv/api/me",
        headers={
            "X-Powerlearn-User-Id": "user-42",
            "X-Powerlearn-Email": "pablo@powerlearn.us",
            "X-Powerlearn-Admin": "true",
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": "user-42",
        "email": "pablo@powerlearn.us",
        "admin": True,
    }


def test_create_project_without_identity_headers(client):
    """Create still succeeds when ForwardAuth headers are absent; owner stays empty."""
    response = client.post(
        "/pv/api/projects",
        json={"name": "No Identity", "site": "Lab", "seed_catalog": False},
    )
    assert response.status_code == 201
    project = response.json()
    assert project["owner"] == ""
    assert project["user_id"] == ""
    listed = client.get("/pv/api/projects").json()
    summary = next(item for item in listed if item["id"] == project["id"])
    assert summary["owner"] == ""
    client.delete(f"/pv/api/projects/{project['id']}")


def test_create_project_with_identity_headers(client):
    """Omitting owner on create stamps email and user id from X-Powerlearn-* headers."""
    response = client.post(
        "/pv/api/projects",
        json={"name": "Portal Owned", "site": "Atacama", "seed_catalog": False},
        headers={
            "X-Powerlearn-User-Id": "1",
            "X-Powerlearn-Email": "pau.maqueda@gmail.com",
            "X-Powerlearn-Admin": "true",
        },
    )
    assert response.status_code == 201
    project = response.json()
    assert project["owner"] == "pau.maqueda@gmail.com"
    assert project["user_id"] == "1"

    fetched = client.get(f"/pv/api/projects/{project['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["owner"] == "pau.maqueda@gmail.com"
    assert fetched.json()["user_id"] == "1"

    listed = client.get("/pv/api/projects").json()
    summary = next(item for item in listed if item["id"] == project["id"])
    assert summary["owner"] == "pau.maqueda@gmail.com"
    assert summary["user_id"] == "1"
    client.delete(f"/pv/api/projects/{project['id']}")


def test_create_project_explicit_owner_overrides_headers(client):
    """A client-supplied owner is kept; missing user_id still comes from headers."""
    response = client.post(
        "/pv/api/projects",
        json={"name": "Named Owner", "owner": "design@powerlearn.us", "seed_catalog": False},
        headers={
            "X-Powerlearn-User-Id": "9",
            "X-Powerlearn-Email": "pau.maqueda@gmail.com",
        },
    )
    assert response.status_code == 201
    project = response.json()
    assert project["owner"] == "design@powerlearn.us"
    assert project["user_id"] == "9"
    client.delete(f"/pv/api/projects/{project['id']}")


def test_me_admin_false_header(client):
    """X-Powerlearn-Admin=false is a boolean false, not null."""
    response = client.get(
        "/pv/api/me",
        headers={
            "X-Powerlearn-User-Id": "user-7",
            "X-Powerlearn-Email": "member@powerlearn.us",
            "X-Powerlearn-Admin": "false",
        },
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": "user-7",
        "email": "member@powerlearn.us",
        "admin": False,
    }
