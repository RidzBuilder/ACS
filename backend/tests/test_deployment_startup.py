import os
import json
import subprocess
import sys
import time
import socket
from pathlib import Path
from urllib.parse import urlparse

import pytest
import requests


def _free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _wait_until_ready(base_url, timeout_seconds=20):
    deadline = time.time() + timeout_seconds
    last_error = None
    while time.time() < deadline:
        try:
            response = requests.get(f"{base_url}/health", timeout=2)
            if response.status_code == 200:
                return
        except Exception as error:  # pragma: no cover - transient startup behavior
            last_error = error
        time.sleep(0.25)
    raise AssertionError(f"Node runtime failed to become ready at {base_url}: {last_error}")


def test_backend_imports_without_app_url():
    environment = os.environ.copy()
    environment.pop("APP_URL", None)
    result = subprocess.run(
        [sys.executable, "-c", "import server; assert server.APP_URL == ''"],
        cwd="/app/backend",
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr


def test_python_dependency_supplies_node_cli():
    result = subprocess.run(
        [sys.executable, "-m", "nodejs_wheel", "--version"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip().startswith("v22.")


def test_frontend_start_script_is_production_safe():
    package = json.loads(Path("/app/frontend/package.json").read_text())
    assert package["scripts"]["start"] == "node ../src/server.js"
    assert "--watch" not in package["scripts"]["start"]
    assert "--env-file" not in package["scripts"]["start"]


def test_frontend_env_uses_production_url():
    content = Path("/app/frontend/.env").read_text()
    assert "REACT_APP_BACKEND_URL=https://emergent-acs-v3.emergent.host" in content
    assert ".preview.emergentagent.com" not in content


def test_public_endpoints_and_config_portability():
    base_url = (os.environ.get("APP_BASE_URL") or "").rstrip("/")
    if not base_url:
        pytest.skip("APP_BASE_URL is required for public endpoint checks")

    root = requests.get(f"{base_url}/", timeout=30)
    assert root.status_code == 200
    assert "<html" in root.text.lower()

    for endpoint in ("/health", "/api/health"):
        response = requests.get(f"{base_url}{endpoint}", timeout=30)
        assert response.status_code == 200
        payload = response.json()
        assert payload["ok"] is True

    config = requests.get(f"{base_url}/config.js", timeout=30)
    assert config.status_code == 200
    assert "window.__ACS_CONFIG__" in config.text
    parsed = urlparse(base_url)
    expected_origin = f"{parsed.scheme}://{parsed.netloc}"
    assert f'"apiRoot":"{expected_origin}"' in config.text


def test_frontend_standard_start_from_frontend_dir_uses_preseeded_env_value():
    # Validate standard launch command from /app/frontend and env precedence over frontend/.env defaults.
    port = _free_port()
    env = os.environ.copy()
    env.update(
        {
            "PORT": str(port),
            "ACS_DATA_FILE": f"/tmp/acs_state_deploy_iter6_{port}.json",
            "REACT_APP_BACKEND_URL": "https://custom-backend.example/base",
        }
    )

    process = subprocess.Popen(
        ["node", "../src/server.js"],
        cwd="/app/frontend",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    base_url = f"http://127.0.0.1:{port}"
    try:
        _wait_until_ready(base_url)
        config = requests.get(
            f"{base_url}/config.js",
            headers={"Host": "custom-backend.example", "X-Forwarded-Proto": "https"},
            timeout=10,
        )
        assert config.status_code == 200
        assert '"apiRoot":"https://custom-backend.example/base"' in config.text
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)