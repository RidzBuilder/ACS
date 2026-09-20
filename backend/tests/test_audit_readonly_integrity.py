import hashlib
import json
import os
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import pytest
import requests


# Read-only ACS audit coverage: AUDIT-01 artifact durability/downloadability, AUDIT-02 semantic integrity, AUDIT-03 export completeness.
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or os.environ.get("APP_BASE_URL") or "").rstrip("/")
PROJECT_ID_VIDEO = "d8c5c6a5-06ba-48e8-a496-9f4499efe231"
PROJECT_ID_AZARINE = "ccfcf412-b054-47f0-a43d-c71733e352d7"
EXPECTED_VIDEO_ARTIFACT = "f28fb089-c1a1-4d1f-8d14-e9d74ebd0229"
EXPECTED_PROVIDER_JOB_AZARINE = "01a0be89-4214-7680-81a5-8ac49b021a77"


def _with_download_params(url: str, filename: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["download"] = "1"
    query["filename"] = filename
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, urlencode(query), parsed.fragment))


@pytest.fixture(scope="session")
def api_client():
    if not BASE_URL:
        pytest.skip("REACT_APP_BACKEND_URL (or APP_BASE_URL) is required")
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def auth_headers(api_client):
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
def azarine_auth_headers():
    with open("/app/.data/state.json", "r", encoding="utf-8") as file_obj:
        state = json.load(file_obj)
    owner_id = state["projects"][PROJECT_ID_AZARINE]["ownerId"]
    token = next((value for value, session in state["sessions"].items() if session["userId"] == owner_id), None)
    assert token, "An existing read-only owner session is required for the Azarine audit fixture"
    return {"Authorization": f"Bearer {token}"}


def test_audit01_video_project_restore_and_association_stability(api_client, auth_headers):
    first = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_VIDEO}", headers=auth_headers, timeout=30)
    assert first.status_code == 200, first.text
    second = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_VIDEO}", headers=auth_headers, timeout=30)
    assert second.status_code == 200, second.text

    a = first.json()
    b = second.json()

    assert a["project"]["id"] == PROJECT_ID_VIDEO
    assert a["video"]["playable"] is True
    assert a["video"]["artifact"].endswith(f"/{EXPECTED_VIDEO_ARTIFACT}.webm")
    assert a["execution"]["regenerationCount"] == 1
    assert a["video"]["providerJobId"] == b["video"]["providerJobId"]
    assert a["storyboard"]["id"] == b["storyboard"]["id"]
    assert a["video"]["artifact"] == b["video"]["artifact"]


def test_audit01_artifact_downloadability_headers_ranges_and_byte_identity(api_client, auth_headers):
    project = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_VIDEO}", headers=auth_headers, timeout=30)
    assert project.status_code == 200
    artifact_url = project.json()["video"]["artifact"]

    head = api_client.head(artifact_url, timeout=30)
    assert head.status_code == 200
    assert head.headers.get("content-type", "").startswith("video/webm")
    assert head.headers.get("accept-ranges") == "bytes"

    download_url = _with_download_params(artifact_url, "acs-timeout-recovery-evidence.webm")
    download_head = api_client.head(download_url, timeout=30)
    assert download_head.status_code == 200
    assert download_head.headers.get("content-type", "").startswith("video/webm")
    assert "attachment" in download_head.headers.get("content-disposition", "")
    assert "acs-timeout-recovery-evidence.webm" in download_head.headers.get("content-disposition", "")

    partial = api_client.get(download_url, headers={"Range": "bytes=0-63"}, timeout=30)
    assert partial.status_code == 206
    assert partial.headers.get("content-type", "").startswith("video/webm")
    assert partial.headers.get("content-range", "").startswith("bytes 0-")
    assert partial.content[:4] == b"\x1aE\xdf\xa3"

    downloaded = api_client.get(download_url, timeout=60)
    assert downloaded.status_code == 200
    assert downloaded.headers.get("content-type", "").startswith("video/webm")

    local_path = "/app/frontend/public/artifacts/f28fb089-c1a1-4d1f-8d14-e9d74ebd0229.webm"
    with open(local_path, "rb") as file_obj:
        stored = file_obj.read()

    assert len(downloaded.content) == len(stored)
    assert hashlib.sha256(downloaded.content).hexdigest() == hashlib.sha256(stored).hexdigest()


def test_audit02_azarine_semantic_integrity_and_migration_safety(api_client, azarine_auth_headers):
    response = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_AZARINE}", headers=azarine_auth_headers, timeout=60)
    assert response.status_code == 200, response.text
    payload = response.json()

    intelligence = payload["project"]["productIntelligence"]
    caption = payload["affiliatePackage"]["caption"]
    cta = payload["affiliatePackage"]["cta"]
    creative_instruction = payload["project"]["creativeInstruction"]

    assert intelligence["canonicalProductName"] == "Azarine Revitalizing Anti Aging Serum — Marvel Doctor Strange Edition"
    assert "facial serum" in intelligence["category"].lower()
    assert "Bakuchiol" in intelligence["ingredients"]
    assert "Peptide" in intelligence["ingredients"]
    assert any("Dermatologically" in item for item in intelligence["packagingInformation"])
    assert any("No Fragrance" in item for item in intelligence["packagingInformation"])
    assert intelligence["creatorPersona"]
    assert intelligence["hook"].startswith("Guys, aku baru nemu serum")
    assert "anti-aging" in intelligence["buyerIntent"]
    assert "anti-aging" in intelligence["ctaIntent"]
    assert len(intelligence["negativeConstraints"]) >= 8

    assert "Azarine Revitalizing Anti Aging Serum" in caption
    assert "Bakuchiol" in caption and "Peptide" in caption
    assert "UGC" in caption and "TikTok" in caption
    assert "authentic creator-style product review" in caption
    assert "anti-aging" in cta and "boleh cek" in cta.lower()
    assert creative_instruction != caption
    assert "NEGATIVE CONSTRAINTS" not in caption

    assert payload["video"]["providerJobId"] == EXPECTED_PROVIDER_JOB_AZARINE
    assert payload["video"]["artifact"].endswith(".webm")
    assert payload["execution"]["regenerationCount"] == 1
    assert payload["storyboard"]["id"] == "d8e99a45-8e8d-480d-a8cc-36a88520395f"


def test_audit03_export_contract_sections_and_large_payload_integrity(api_client, azarine_auth_headers):
    response = api_client.get(f"{BASE_URL}/api/projects/{PROJECT_ID_AZARINE}/export", headers=azarine_auth_headers, timeout=120)
    assert response.status_code == 200, response.text
    data = response.json()

    expected_sections = {
        "project",
        "productIntelligence",
        "creative",
        "storyboard",
        "video",
        "provenance",
        "affiliatePackage",
        "execution",
        "ownerId",
        "semanticSchemaVersion",
        "exportMetadata",
    }
    assert expected_sections.issubset(data.keys())

    export_meta = data["exportMetadata"]
    assert export_meta["contract"] == "acs-project-export-v1"
    assert export_meta["source"] == "canonical-project-store"
    persistence = export_meta["persistence"]
    assert persistence["storedProjectId"] == PROJECT_ID_AZARINE
    assert persistence["ownerId"] == data["ownerId"]
    assert isinstance(persistence["storedAt"], str) and persistence["storedAt"]
    assert persistence["generationJob"]["projectId"] == PROJECT_ID_AZARINE
    assert persistence["generationJob"]["status"] == "completed"
    assert persistence["generationJob"]["id"]

    assert len(response.content) >= 3_500_000
    assert len(data["project"]["productImages"]) == 4
    assert len(data["project"]["creativeInstruction"]) == 5331
    assert "Bakuchiol" in data["project"]["productDescription"]
    assert "Peptide" in data["project"]["productDescription"]
    assert "Bakuchiol" in data["affiliatePackage"]["caption"]
    assert "anti-aging" in data["affiliatePackage"]["cta"]
    assert data["video"]["artifact"].endswith(".webm")
    assert data["video"]["providerJobId"] == EXPECTED_PROVIDER_JOB_AZARINE
    assert data["execution"]["regenerationCount"] == 1


def test_provider_neutral_adapter_contract_unchanged_in_acs_core():
    with open("/app/src/video-adapter.js", "r", encoding="utf-8") as file_obj:
        adapter_src = file_obj.read()
    with open("/app/src/domain.js", "r", encoding="utf-8") as file_obj:
        domain_src = file_obj.read()

    assert 'VIDEO_CAPABILITY = "real_ai_video_generation"' in adapter_src
    assert 'VIDEO_ADAPTER_CONTRACT = "acs-video-adapter-v1"' in adapter_src
    assert "new provider" not in domain_src.lower()
