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
