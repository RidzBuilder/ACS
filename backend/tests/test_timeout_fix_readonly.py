import os

import pytest
import requests


# Read-only ACS timeout fix regression: auth, completed async job, provenance chain, artifact HTTP semantics.
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("APP_BASE_URL")
EXPECTED_JOB_ID = "c2ac8f38-439a-47a3-836b-354b49cc9f4b"
EXPECTED_PROJECT_ID = "d8c5c6a5-06ba-48e8-a496-9f4499efe231"
EXPECTED_REQUEST_ID = "e90ec23a-b172-4225-a677-97cc581e2374"
EXPECTED_STORYBOARD_ID = "7b883de9-c23f-4bea-aeab-3e999fb5259c"
EXPECTED_PROVIDER_JOB_ID = "01a0be69-c850-7670-bc0d-4510c85cc94f"


@pytest.fixture(scope="session")
def api_client():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL (or APP_BASE_URL) is required")
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def auth_token(api_client):
    email = os.environ.get("ACS_TEST_EMAIL", "acs.demo@local.test")
    password = os.environ.get("ACS_TEST_PASSWORD", "StudioPass!2026")
    response = api_client.post(
        f"{BASE_URL.rstrip('/')}/api/auth/login",
        json={"email": email, "password": password},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data.get("token"), str) and len(data["token"]) > 20
    return data["token"]


def _auth_headers(token: str):
    return {"Authorization": f"Bearer {token}"}


def test_completed_generation_job_and_result_identity(api_client, auth_token):
    response = api_client.get(
        f"{BASE_URL.rstrip('/')}/api/generation-jobs/{EXPECTED_JOB_ID}",
        headers=_auth_headers(auth_token),
        timeout=30,
    )
    assert response.status_code == 200, response.text
    job = response.json()["job"]
    assert job["id"] == EXPECTED_JOB_ID
    assert job["status"] == "completed"
    assert job["projectId"] == EXPECTED_PROJECT_ID

    result = job["result"]
    video = result["video"]
    assert result["project"]["status"] == "generated"
    assert result["project"]["id"] == EXPECTED_PROJECT_ID
    assert result["storyboard"]["id"] == EXPECTED_STORYBOARD_ID
    assert video["requestId"] == EXPECTED_REQUEST_ID
    assert video["providerJobId"] == EXPECTED_PROVIDER_JOB_ID
    assert video["adapterContract"] == "acs-video-adapter-v1"
    assert video["capability"] == "real_ai_video_generation"
    assert video["validation"]["status"] == "passed"
    assert video["provenance"]["liveEvidence"] is True


def test_project_restore_preserves_regeneration_count(api_client, auth_token):
    response = api_client.get(
        f"{BASE_URL.rstrip('/')}/api/projects/{EXPECTED_PROJECT_ID}",
        headers=_auth_headers(auth_token),
        timeout=30,
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["project"]["id"] == EXPECTED_PROJECT_ID
    assert payload["execution"]["restored"] is True
    assert payload["execution"]["regenerationCount"] == 1
    assert payload["video"]["status"] == "ready"
    assert payload["video"]["artifact"].endswith(".webm")


def test_provenance_chain_matches_expected_values(api_client, auth_token):
    response = api_client.get(
        f"{BASE_URL.rstrip('/')}/api/projects/{EXPECTED_PROJECT_ID}",
        headers=_auth_headers(auth_token),
        timeout=30,
    )
    assert response.status_code == 200
    data = response.json()
    video = data["video"]
    provenance = video["provenance"]

    assert video["requestId"] == EXPECTED_REQUEST_ID
    assert data["storyboard"]["id"] == EXPECTED_STORYBOARD_ID
    assert video["providerJobId"] == EXPECTED_PROVIDER_JOB_ID
    assert video["adapterContract"] == "acs-video-adapter-v1"
    assert video["capability"] == "real_ai_video_generation"
    assert video["validation"]["status"] == "passed"
    assert provenance["liveEvidence"] is True
    assert provenance["projectId"] == EXPECTED_PROJECT_ID
    assert provenance["storyboardId"] == EXPECTED_STORYBOARD_ID
    assert isinstance(video["artifact"], str) and video["artifact"].startswith("https://")


def test_artifact_head_and_range_support(api_client, auth_token):
    project = api_client.get(
        f"{BASE_URL.rstrip('/')}/api/projects/{EXPECTED_PROJECT_ID}",
        headers=_auth_headers(auth_token),
        timeout=30,
    )
    assert project.status_code == 200
    artifact_url = project.json()["video"]["artifact"]

    head = api_client.head(artifact_url, timeout=30)
    assert head.status_code == 200
    assert head.headers.get("content-type", "").startswith("video/webm")
    assert head.headers.get("accept-ranges") == "bytes"
    assert int(head.headers.get("content-length", "0")) > 1024

    partial = api_client.get(artifact_url, headers={"Range": "bytes=0-63"}, timeout=30)
    assert partial.status_code == 206
    assert partial.headers.get("content-type", "").startswith("video/webm")
    assert partial.headers.get("content-range", "").startswith("bytes 0-")
    assert partial.content[:4] == b"\x1aE\xdf\xa3"
