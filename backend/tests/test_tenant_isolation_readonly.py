import json
import os

import pytest
import requests


# Read-only tenant isolation + persistence checks for fixed Azarine access pattern.
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("APP_BASE_URL") or "").rstrip("/")
PROJECT_ID_AZARINE = "ccfcf412-b054-47f0-a43d-c71733e352d7"
PROJECT_ID_VIDEO = "d8c5c6a5-06ba-48e8-a496-9f4499efe231"


@pytest.fixture(scope="session")
def api_client():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL (or APP_BASE_URL) is required")
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def demo_auth_headers(api_client):
    email = os.environ.get("ACS_TEST_EMAIL", "acs.demo@local.test")
    password = os.environ.get("ACS_TEST_PASSWORD", "StudioPass!2026")
    login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert login.status_code == 200, login.text
    token = login.json().get("token")
    assert isinstance(token, str) and len(token) > 20
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def azarine_owner_auth_headers():
    with open("/app/.data/state.json", "r", encoding="utf-8") as file_obj:
        state = json.load(file_obj)
    owner_id = state["projects"][PROJECT_ID_AZARINE]["ownerId"]
    token = next((value for value, session in state["sessions"].items() if session["userId"] == owner_id), None)
    assert token, "Existing read-only Azarine owner session is required"
    return {"Authorization": f"Bearer {token}"}


def test_demo_user_is_blocked_from_other_tenant_azarine_project(api_client, demo_auth_headers):
    response = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_AZARINE}", headers=demo_auth_headers, timeout=30)
    assert response.status_code == 404
    data = response.json()
    assert data["error"] == "Project not found."


def test_azarine_owner_session_can_read_project_and_export(api_client, azarine_owner_auth_headers):
    project = api_client.get(
        f"{BASE_URL}/api/projects/{PROJECT_ID_AZARINE}", headers=azarine_owner_auth_headers, timeout=60
    )
    assert project.status_code == 200, project.text
    payload = project.json()
    assert payload["project"]["id"] == PROJECT_ID_AZARINE
    assert payload["execution"]["regenerationCount"] == 1

    export = api_client.get(
        f"{BASE_URL}/api/projects/{PROJECT_ID_AZARINE}/export", headers=azarine_owner_auth_headers, timeout=120
    )
    assert export.status_code == 200, export.text
    data = export.json()
    assert "productIntelligence" in data
    assert "provenance" in data
    assert len(export.content) >= 3_500_000
    assert len(data["project"]["productImages"]) == 4
    assert len(data["project"]["creativeInstruction"]) == 5331


def test_video_restore_and_artifact_reads_do_not_regenerate(api_client, demo_auth_headers):
    before = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_VIDEO}", headers=demo_auth_headers, timeout=30)
    assert before.status_code == 200, before.text
    before_payload = before.json()

    artifact_url = before_payload["video"]["artifact"]
    head = api_client.head(artifact_url, timeout=30)
    assert head.status_code == 200
    assert head.headers.get("content-type", "").startswith("video/webm")

    range_read = api_client.get(artifact_url, headers={"Range": "bytes=0-127"}, timeout=30)
    assert range_read.status_code == 206
    assert range_read.content[:4] == b"\x1aE\xdf\xa3"

    after = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_VIDEO}", headers=demo_auth_headers, timeout=30)
    assert after.status_code == 200, after.text
    after_payload = after.json()

    assert after_payload["execution"]["regenerationCount"] == before_payload["execution"]["regenerationCount"] == 1
    assert after_payload["video"]["providerJobId"] == before_payload["video"]["providerJobId"]
    assert after_payload["storyboard"]["id"] == before_payload["storyboard"]["id"]
    assert after_payload["video"]["artifact"] == before_payload["video"]["artifact"]
