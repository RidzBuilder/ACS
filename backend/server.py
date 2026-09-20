import asyncio
import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import httpx
import imageio_ffmpeg
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
ADAPTER_STATE_FILE = Path("/app/.data/video-adapter-jobs.json")
TERMINAL_STATUSES = {"completed", "failed"}

app = FastAPI(title="ACS Runtime Bridge", version="0.5.0")
adapter_state_lock = asyncio.Lock()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _load_adapter_jobs_sync():
    try:
        return json.loads(ADAPTER_STATE_FILE.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


async def _load_adapter_jobs():
    return await asyncio.to_thread(_load_adapter_jobs_sync)


async def _update_adapter_job(request_id, patch):
    async with adapter_state_lock:
        jobs = await _load_adapter_jobs()
        jobs[request_id] = {**jobs.get(request_id, {}), **patch, "updatedAt": _now()}
        ADAPTER_STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        temporary = ADAPTER_STATE_FILE.with_suffix(".tmp")
        await asyncio.to_thread(temporary.write_text, json.dumps(jobs, indent=2))
        await asyncio.to_thread(temporary.replace, ADAPTER_STATE_FILE)
        return jobs[request_id]


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


async def _get_with_retry(client, url, attempts=6):
    delay = 1
    for attempt in range(attempts):
        try:
            response = await client.get(url, headers=_fal_headers())
            if response.status_code not in {502, 503, 504}:
                response.raise_for_status()
                return response
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError):
            if attempt == attempts - 1:
                raise
        await asyncio.sleep(delay)
        delay = min(delay * 2, 16)
    raise RuntimeError("Video queue retrieval failed after transient retries")


async def _normalize_browser_video(content, artifact_id):
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    source_path = ARTIFACT_DIR / f"{artifact_id}.source.mp4"
    output_path = ARTIFACT_DIR / f"{artifact_id}.webm"
    await asyncio.to_thread(source_path.write_bytes, content)
    process = await asyncio.create_subprocess_exec(
        imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-i", str(source_path),
        "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-deadline", "good", "-cpu-used", "4",
        "-pix_fmt", "yuv420p", "-c:a", "libopus", str(output_path),
        stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()
    source_path.unlink(missing_ok=True)
    if process.returncode != 0:
        raise RuntimeError(f"Browser video normalization failed: {stderr.decode(errors='replace')[-500:]}")
    normalized = await asyncio.to_thread(output_path.read_bytes)
    if len(normalized) < 1024 or normalized[:4] != b"\x1aE\xdf\xa3":
        output_path.unlink(missing_ok=True)
        raise RuntimeError("Browser video normalization produced an invalid WebM artifact")
    return output_path


def _failed_response(job, reason):
    return {
        "contract": "acs-video-adapter-v1",
        "capability": "real_ai_video_generation",
        "status": "failed",
        "provider": "fal-media-runtime",
        "providerJobId": job["providerJobId"],
        "requestId": job["requestId"],
        "generationMode": "live",
        "artifact": None,
        "playable": False,
        "error": reason,
        "provenance": {
            "liveEvidence": False,
            "projectId": job["projectId"],
            "storyboardId": job["storyboardId"],
            "endpoint": job["endpoint"],
        },
    }


async def _process_video_job(request_id):
    jobs = await _load_adapter_jobs()
    job = jobs.get(request_id)
    if not job or job.get("status") in TERMINAL_STATUSES:
        return
    deadline = asyncio.get_running_loop().time() + 1200
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=20.0), follow_redirects=True) as client:
            while asyncio.get_running_loop().time() < deadline:
                status_response = await _get_with_retry(client, job["providerStatusUrl"])
                status_body = status_response.json()
                status = (status_body.get("status") or "").upper()
                if status in {"COMPLETED", "OK"}:
                    if status_body.get("error"):
                        response = _failed_response(job, status_body["error"])
                        await _update_adapter_job(request_id, {"status": "failed", "response": response})
                        return
                    result_response = await _get_with_retry(client, job["providerResponseUrl"])
                    result = result_response.json()
                    video = result.get("video") or result.get("data", {}).get("video")
                    if not video or not video.get("url"):
                        response = _failed_response(job, "Provider completed without a video artifact")
                        await _update_adapter_job(request_id, {"status": "failed", "response": response})
                        return
                    artifact_response = await client.get(video["url"], timeout=120)
                    artifact_response.raise_for_status()
                    content = artifact_response.content
                    if len(content) < 1024 or b"ftyp" not in content[:64]:
                        response = _failed_response(job, "Downloaded artifact was not a valid MP4 video")
                        await _update_adapter_job(request_id, {"status": "failed", "response": response})
                        return
                    artifact_id = str(uuid.uuid4())
                    await _normalize_browser_video(content, artifact_id)
                    response = {
                        "contract": "acs-video-adapter-v1",
                        "capability": "real_ai_video_generation",
                        "status": "completed",
                        "provider": "fal-media-runtime",
                        "providerJobId": job["providerJobId"],
                        "requestId": request_id,
                        "generationMode": "live",
                        "artifact": f"{APP_URL}/artifacts/{artifact_id}.webm",
                        "playable": True,
                        "provenance": {
                            "liveEvidence": True,
                            "projectId": job["projectId"],
                            "storyboardId": job["storyboardId"],
                            "endpoint": job["endpoint"],
                            "sourceArtifact": video["url"],
                            "durationSeconds": video.get("duration", job["durationSeconds"]),
                            "resolution": job["resolution"],
                            "storedArtifactId": artifact_id,
                            "playbackFormat": "webm-vp9-opus",
                        },
                    }
                    await _update_adapter_job(request_id, {"status": "completed", "response": response})
                    return
                if status in {"FAILED", "CANCELLED", "CANCELED", "ERROR"}:
                    response = _failed_response(job, f"Video generation ended with status {status}")
                    await _update_adapter_job(request_id, {"status": "failed", "response": response})
                    return
                await asyncio.sleep(3)
        response = _failed_response(job, "Video generation timed out")
        await _update_adapter_job(request_id, {"status": "failed", "response": response})
    except Exception as error:
        response = _failed_response(job, str(error))
        await _update_adapter_job(request_id, {"status": "failed", "response": response})


@app.on_event("startup")
async def resume_adapter_jobs():
    jobs = await _load_adapter_jobs()
    for request_id, job in jobs.items():
        if job.get("status") not in TERMINAL_STATUSES:
            asyncio.create_task(_process_video_job(request_id))


@app.get("/health")
async def health():
    return {"ok": True, "service": "acs-runtime-bridge"}


@app.post("/internal/video-adapter")
async def video_adapter(request: Request):
    payload = await request.json()
    if payload.get("contract") != "acs-video-adapter-v1" or payload.get("capability") != "real_ai_video_generation":
        return JSONResponse(status_code=400, content={"error": "Unsupported adapter contract"})
    requested = payload.get("requestedOutput", {})
    duration = int(requested.get("durationSeconds") or 5)
    if duration < 2 or duration > 15:
        return JSONResponse(status_code=422, content={"error": "Requested duration exceeds resolved capability profile"})
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

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=20.0)) as client:
        submission = await client.post(
            f"{FAL_CONTROL_URL}/proxy",
            headers=_fal_headers({"X-Fal-Target-Url": f"https://queue.fal.run/{endpoint_id}"}),
            json=generation,
        )
    if submission.status_code == 402:
        return JSONResponse(status_code=402, content={"error": "Insufficient universal media credits"})
    submission.raise_for_status()
    queued = submission.json()
    provider_job_id = queued.get("request_id") or queued.get("requestId")
    status_url = _trusted_queue_url(queued["status_url"])
    response_url = _trusted_queue_url(queued["response_url"])
    adapter_job = {
        "requestId": payload["requestId"],
        "projectId": payload["projectId"],
        "storyboardId": payload["storyboardId"],
        "provider": "fal-media-runtime",
        "providerJobId": provider_job_id,
        "endpoint": endpoint_id,
        "providerStatusUrl": status_url,
        "providerResponseUrl": response_url,
        "durationSeconds": duration,
        "resolution": generation["resolution"],
        "status": "processing",
        "createdAt": _now(),
    }
    await _update_adapter_job(payload["requestId"], adapter_job)
    asyncio.create_task(_process_video_job(payload["requestId"]))
    status_endpoint = f"{str(request.base_url).rstrip('/')}/internal/video-adapter/jobs/{payload['requestId']}"
    return JSONResponse(status_code=202, content={
        "contract": "acs-video-adapter-v1",
        "capability": "real_ai_video_generation",
        "status": "processing",
        "provider": "fal-media-runtime",
        "providerJobId": provider_job_id,
        "requestId": payload["requestId"],
        "generationMode": "live",
        "statusUrl": status_endpoint,
        "provenance": {"liveEvidence": False, "projectId": payload["projectId"], "storyboardId": payload["storyboardId"], "endpoint": endpoint_id},
    })


@app.get("/internal/video-adapter/jobs/{request_id}")
async def video_adapter_status(request_id: str):
    jobs = await _load_adapter_jobs()
    job = jobs.get(request_id)
    if not job:
        return JSONResponse(status_code=404, content={"error": "Adapter job not found"})
    if job.get("response"):
        return job["response"]
    return {
        "contract": "acs-video-adapter-v1",
        "capability": "real_ai_video_generation",
        "status": job["status"],
        "provider": job["provider"],
        "providerJobId": job["providerJobId"],
        "requestId": job["requestId"],
        "generationMode": "live",
        "provenance": {"liveEvidence": False, "projectId": job["projectId"], "storyboardId": job["storyboardId"], "endpoint": job["endpoint"]},
    }


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"])
async def proxy_api(path: str, request: Request):
    headers = {key: value for key, value in request.headers.items() if key.lower() not in {"host", "content-length", "connection"}}
    async with httpx.AsyncClient(timeout=60) as client:
        upstream = await client.request(request.method, f"{CORE_URL}/api/{path}", params=request.query_params, content=await request.body(), headers=headers)
    response_headers = {key: value for key, value in upstream.headers.items() if key.lower() not in {"content-length", "content-encoding", "transfer-encoding", "connection"}}
    return Response(content=upstream.content, status_code=upstream.status_code, headers=response_headers)