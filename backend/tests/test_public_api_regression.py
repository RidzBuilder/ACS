import os
import time
import uuid

import pytest
import requests


# Public ACS API regression coverage: health, auth, generation jobs, history/archive, settings.
BASE_URL = os.environ["APP_BASE_URL"].rstrip("/")


@pytest.fixture(scope="session")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def user_context(api_client):
    email = f"acs.t1.{uuid.uuid4().hex[:10]}@local.test"
    password = "StudioPass!2026"
    payload = {"name": "ACS T1 Tester", "email": email, "password": password}
    response = api_client.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["user"]["email"] == email
    assert isinstance(data["token"], str) and len(data["token"]) > 20
    return {"email": email, "password": password, "token": data["token"], "project_id": None, "job_id": None, "result": None}


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_endpoints(api_client):
    for endpoint in ("/health", "/api/health"):
        response = api_client.get(f"{BASE_URL}{endpoint}", timeout=20)
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert "service" in data


def test_invalid_login_rejected(api_client):
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": "acs.demo@local.test", "password": "wrong-password"},
        timeout=30,
    )
    assert response.status_code == 401
    assert response.json()["error"] == "Invalid email or password."


def test_login_logout_and_session_restore(api_client, user_context):
    login = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": user_context["email"], "password": user_context["password"]},
        timeout=30,
    )
    assert login.status_code == 200
    login_data = login.json()
    token = login_data["token"]
    assert login_data["user"]["email"] == user_context["email"]

    me = api_client.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=20)
    assert me.status_code == 200
    assert me.json()["user"]["email"] == user_context["email"]

    logout = api_client.post(f"{BASE_URL}/api/auth/logout", headers=_auth_headers(token), timeout=20)
    assert logout.status_code == 200
    assert logout.json()["ok"] is True

    me_after = api_client.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(token), timeout=20)
    assert me_after.status_code == 401
    assert me_after.json()["error"] == "Authentication required."

    relogin = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": user_context["email"], "password": user_context["password"]},
        timeout=30,
    )
    assert relogin.status_code == 200
    user_context["token"] = relogin.json()["token"]


def test_capability_honest_fallback(api_client, user_context):
    response = api_client.get(
        f"{BASE_URL}/api/capabilities/video",
        headers=_auth_headers(user_context["token"]),
        timeout=20,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["capability"] == "real_ai_video_generation"
    assert data["adapterContract"] == "acs-video-adapter-v1"
    assert data["mode"] == "fallback"
    assert isinstance(data.get("reason"), str) and len(data["reason"].strip()) > 0


def test_generation_job_completes_and_payload_integrity(api_client, user_context):
    payload = {
        "projectName": "TEST Project Integrity",
        "productName": "Atlas Travel Bottle",
        "productDescription": "Reusable bottle with locking lid and slim profile for travel.",
        "productImages": [],
        "creativeInstruction": "Use soft camera movement and grounded product details.",
        "contentType": "UGC",
        "platform": "TikTok",
        "preset": "Product spotlight",
        "customPreset": "",
        "targetDurationSeconds": 15,
        "productConsistency": "balanced",
        "language": "en",
    }

    start_t = time.time()
    create_job = api_client.post(
        f"{BASE_URL}/api/generation-jobs",
        headers=_auth_headers(user_context["token"]),
        json=payload,
        timeout=30,
    )
    elapsed = time.time() - start_t
    assert create_job.status_code == 202, create_job.text
    assert elapsed < 5

    job_data = create_job.json()
    assert job_data["status"] == "running"
    user_context["job_id"] = job_data["id"]

    completed_job = None
    for _ in range(40):
        poll = api_client.get(
            f"{BASE_URL}/api/generation-jobs/{user_context['job_id']}",
            headers=_auth_headers(user_context["token"]),
            timeout=30,
        )
        assert poll.status_code == 200, poll.text
        job = poll.json()["job"]
        if job["status"] == "completed":
            completed_job = job
            break
        if job["status"] == "failed":
            pytest.fail(f"Generation job failed: {job}")
        time.sleep(0.5)

    assert completed_job is not None, "Generation polling did not reach completed state"
    result = completed_job["result"]
    user_context["project_id"] = result["project"]["id"]
    user_context["result"] = result

    assert result["creative"]["objective"]
    assert len(result["storyboard"]["scenes"]) == 3

    total = result["storyboard"]["totalDurationSeconds"]
    summed = round(sum(scene["timingSeconds"] for scene in result["storyboard"]["scenes"]), 1)
    assert round(total, 1) == summed

    assert result["video"]["generationMode"] == "fallback"
    assert result["video"]["artifact"] is None
    assert result["video"]["provenance"]["liveEvidence"] is False

    package = result["affiliatePackage"]
    assert list(package.keys()) == ["productName", "productDescription", "caption", "cta", "hashtags"]
    assert package["productDescription"].strip().lower() != package["productName"].strip().lower()
    assert payload["creativeInstruction"].lower() not in package["caption"].lower()


def test_history_restore_no_regeneration(api_client, user_context):
    project_id = user_context["project_id"]
    assert project_id

    restored = api_client.get(
        f"{BASE_URL}/api/projects/{project_id}",
        headers=_auth_headers(user_context["token"]),
        timeout=30,
    )
    assert restored.status_code == 200
    data = restored.json()
    assert data["execution"]["restored"] is True
    assert data["execution"]["regenerationCount"] == 1
    assert data["project"]["id"] == project_id


def test_project_archive_list_and_delete(api_client, user_context):
    listing = api_client.get(f"{BASE_URL}/api/projects", headers=_auth_headers(user_context["token"]), timeout=20)
    assert listing.status_code == 200
    projects = listing.json()["projects"]
    assert any(p["project"]["id"] == user_context["project_id"] for p in projects)

    delete = api_client.delete(
        f"{BASE_URL}/api/projects/{user_context['project_id']}",
        headers=_auth_headers(user_context["token"]),
        timeout=20,
    )
    assert delete.status_code == 200
    assert delete.json()["ok"] is True

    get_deleted = api_client.get(
        f"{BASE_URL}/api/projects/{user_context['project_id']}",
        headers=_auth_headers(user_context["token"]),
        timeout=20,
    )
    assert get_deleted.status_code == 404
    assert get_deleted.json()["error"] == "Project not found."


def test_settings_language_persistence(api_client, user_context):
    patch = api_client.patch(
        f"{BASE_URL}/api/settings",
        headers=_auth_headers(user_context["token"]),
        json={"language": "id"},
        timeout=20,
    )
    assert patch.status_code == 200
    assert patch.json()["user"]["preferences"]["language"] == "id"

    me = api_client.get(f"{BASE_URL}/api/auth/me", headers=_auth_headers(user_context["token"]), timeout=20)
    assert me.status_code == 200
    assert me.json()["user"]["preferences"]["language"] == "id"
