import os
import asyncio
import uuid
from pathlib import Path
from urllib.parse import urlparse

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response

load_dotenv(Path(__file__).with_name(".env"))
CORE_URL = os.environ["ACS_CORE_URL"].rstrip("/")
INTEGRATION_PROXY_URL = os.environ["INTEGRATION_PROXY_URL"].rstrip("/")
EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
APP_URL = os.environ["APP_URL"].rstrip("/")
VIDEO_IMAGE_ENDPOINT_ID = "fal-ai/wan/v2.7/image-to-video"
VIDEO_TEXT_ENDPOINT_ID = "fal-ai/wan/v2.7/text-to-video"
FAL_CONTROL_URL = f"{INTEGRATION_PROXY_URL}/api/v1/fal"
ARTIFACT_DIR = Path("/app/frontend/public/artifacts")

app = FastAPI(title="ACS Runtime Bridge", version="0.4.0")


@app.get("/health")
async def health():
    return {"ok": True, "service": "acs-runtime-bridge", "core": CORE_URL}


def _fal_headers(extra=None):
    headers = {"Authorization": f"Bearer {EMERGENT_LLM_KEY}", "Content-Type": "application/json"}
    if os.environ.get("job_id"):
        headers["X-App-ID"] = os.environ["job_id"]
        headers["X-Job-ID"] = os.environ["job_id"]
    if os.environ.get("run_id"):
        headers["X-Environment-ID"] = os.environ["run_id"]
    if extra:
        headers.update(extra)
    return headers


def _trusted_queue_url(value):
    candidate = urlparse(value)
    expected = urlparse(f"{FAL_CONTROL_URL}/queue")
    if candidate.scheme != expected.scheme or candidate.netloc != expected.netloc or not candidate.path.startswith(expected.path + "/"):
        raise ValueError("Video service returned an untrusted queue URL")
    return value


def _video_prompt(payload):
    project = payload["project"]
    scenes = payload["storyboard"]["scenes"]
    scene_text = " ".join(f"Scene {index + 1}: {scene['visual']} Motion: {scene['actionMotion']}" for index, scene in enumerate(scenes))
    instruction = project.get("creativeInstruction") or "Natural product-focused camera movement."
    return (
        f"Create a vertical affiliate video for {project['productName']}. "
        f"Known product context: {project['productDescription']} "
        f"Format: {project['contentType']} for {project.get('platform', 'social video')}. "
        f"Direction: {instruction} {scene_text} "
        "Keep the product visually consistent with the reference when one is supplied. "
        "Do not add labels, claims, features, materials, or accessories not present in the supplied context."
    )[:5000]


@app.post("/internal/video-adapter")
async def video_adapter(request: Request):
    payload = await request.json()
    if payload.get("contract") != "acs-video-adapter-v1" or payload.get("capability") != "real_ai_video_generation":
        return Response(content='{"error":"Unsupported adapter contract"}', status_code=400, media_type="application/json")
    requested = payload.get("requestedOutput", {})
    duration = int(requested.get("durationSeconds") or 5)
    if duration < 2 or duration > 15:
        return Response(content='{"error":"Requested duration exceeds resolved capability profile"}', status_code=422, media_type="application/json")
    references = payload["project"].get("productImages") or []
    has_reference = bool(references and (references[0].startswith("https://") or references[0].startswith("data:image/")))
    endpoint_id = VIDEO_IMAGE_ENDPOINT_ID if has_reference else VIDEO_TEXT_ENDPOINT_ID
    generation = {
        "prompt": _video_prompt(payload),
        "duration": duration,
        "resolution": "720p",
        "enable_prompt_expansion": True,
        "enable_safety_checker": True,
    }
    if has_reference:
        generation["image_url"] = references[0]
    else:
        generation["aspect_ratio"] = "9:16"

    timeout = httpx.Timeout(60.0, connect=20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        submission = await client.post(
            f"{FAL_CONTROL_URL}/proxy",
            headers=_fal_headers({"X-Fal-Target-Url": f"https://queue.fal.run/{endpoint_id}"}),
            json=generation,
        )
        if submission.status_code == 402:
            return Response(content='{"error":"Insufficient universal media credits"}', status_code=402, media_type="application/json")
        submission.raise_for_status()
        queued = submission.json()
        provider_job_id = queued.get("request_id") or queued.get("requestId")
        status_url = _trusted_queue_url(queued["status_url"])
        response_url = _trusted_queue_url(queued["response_url"])
        deadline = asyncio.get_running_loop().time() + 900

        async def get_with_retry(url):
            delay = 1
            for attempt in range(5):
                try:
                    response = await client.get(url, headers=_fal_headers())
                    if response.status_code not in {502, 503, 504}:
                        response.raise_for_status()
                        return response
                except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError):
                    if attempt == 4:
                        raise
                await asyncio.sleep(delay)
                delay *= 2
            raise RuntimeError("Video queue retrieval failed after transient retries")

        while asyncio.get_running_loop().time() < deadline:
            status_response = await get_with_retry(status_url)
            status_body = status_response.json()
            status = (status_body.get("status") or "").upper()
            if status in {"COMPLETED", "OK"}:
                if status_body.get("error"):
                    return JSONResponse(status_code=502, content={"error": status_body["error"], "providerJobId": provider_job_id})
                result_response = await get_with_retry(response_url)
                result = result_response.json()
                video = result.get("video") or result.get("data", {}).get("video")
                if not video or not video.get("url"):
                    return Response(content='{"error":"Provider completed without a video artifact"}', status_code=502, media_type="application/json")
                artifact_response = await client.get(video["url"], timeout=120)
                artifact_response.raise_for_status()
                if len(artifact_response.content) < 1024:
                    return Response(content='{"error":"Downloaded video artifact was empty"}', status_code=502, media_type="application/json")
                artifact_id = str(uuid.uuid4())
                ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
                artifact_path = ARTIFACT_DIR / f"{artifact_id}.mp4"
                artifact_path.write_bytes(artifact_response.content)
                return {
                    "contract": "acs-video-adapter-v1",
                    "capability": "real_ai_video_generation",
                    "provider": "fal-media-runtime",
                    "providerJobId": provider_job_id,
                    "requestId": payload["requestId"],
                    "generationMode": "live",
                    "artifact": f"{APP_URL}/artifacts/{artifact_id}.mp4",
                    "playable": True,
                    "provenance": {
                        "liveEvidence": True,
                        "projectId": payload["projectId"],
                        "storyboardId": payload["storyboardId"],
                        "endpoint": endpoint_id,
                        "sourceArtifact": video["url"],
                        "durationSeconds": video.get("duration", duration),
                        "resolution": generation["resolution"],
                        "storedArtifactId": artifact_id,
                    },
                }
            if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
                return Response(content=f'{{"error":"Video generation ended with status {status}"}}', status_code=502, media_type="application/json")
            await asyncio.sleep(2)
    return Response(content='{"error":"Video generation timed out"}', status_code=504, media_type="application/json")


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"])
async def proxy_api(path: str, request: Request):
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in {"host", "content-length", "connection"}
    }
    async with httpx.AsyncClient(timeout=1000) as client:
        upstream = await client.request(
            request.method,
            f"{CORE_URL}/api/{path}",
            params=request.query_params,
            content=await request.body(),
            headers=headers,
        )
    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in {"content-length", "content-encoding", "transfer-encoding", "connection"}
    }
    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)