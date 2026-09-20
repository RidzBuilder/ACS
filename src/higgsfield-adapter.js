import crypto from "node:crypto";

export const HIGGSFIELD_GENJUTSU_MODEL = "higgsfiled/genjutsu/motion-transfer/v1.0";
const API_BASE = "https://api.higgsfield.ai";

function credentials(env = process.env) {
  const id = String(env.HF_API_KEY_ID ?? "").trim();
  const secret = String(env.HF_API_KEY_SECRET ?? "").trim();
  return id && secret ? `Key ${id}:${secret}` : null;
}

function videoUrl(payload) {
  return payload?.video ?? payload?.result?.video ?? payload?.output?.video
    ?? payload?.result?.output?.video ?? payload?.data?.video ?? null;
}

function requestId(payload) {
  return payload?.request_id ?? payload?.requestId ?? payload?.id ?? null;
}

async function apiJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) {
    const detail = body?.error?.message ?? body?.message ?? text.slice(0, 500);
    throw new Error(`${label} HTTP ${response.status}: ${detail}`);
  }
  return body ?? {};
}

export async function executeHiggsfieldGenjutsuAdapter(input, env = process.env) {
  const auth = credentials(env);
  if (!auth) throw new Error("Higgsfield API credentials are not configured.");

  const project = input?.project ?? {};
  const storyboard = input?.storyboard ?? {};
  const referenceVideoUrl = String(
    project.referenceVideoUrl ?? env.ACS_HIGGSFIELD_REFERENCE_VIDEO_URL ?? ""
  ).trim();
  const imageUrls = Array.isArray(project.productImages)
    ? project.productImages.filter((v) => typeof v === "string" && /^https:\/\//.test(v)).slice(0, 8)
    : [];

  if (!referenceVideoUrl) {
    throw new Error("Genjutsu requires referenceVideoUrl (or ACS_HIGGSFIELD_REFERENCE_VIDEO_URL).");
  }
  if (!imageUrls.length) {
    throw new Error("Genjutsu requires at least one HTTPS product image in projectImages.");
  }

  const acsRequestId = String(input.requestId ?? "").trim() || crypto.randomUUID();
  const prompt = [
    `ACS project: ${project.productName ?? "product"}.`,
    `Content type: ${project.contentType ?? "affiliate"}.`,
    "Preserve the product identity from the supplied image references.",
    JSON.stringify(storyboard?.scenes ?? [])
  ].join(" ");

  const submitted = await apiJson(`${API_BASE}/higgsfiled/genjutsu/motion-transfer/v1.0`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      "X-ACS-Request-ID": acsRequestId
    },
    body: JSON.stringify({
      prompt,
      video_url: referenceVideoUrl,
      image_urls: imageUrls,
      resolution: String(env.ACS_HIGGSFIELD_RESOLUTION ?? "720p")
    })
  }, "Higgsfield Genjutsu submit");

  const providerJobId = requestId(submitted);
  if (!providerJobId) throw new Error("Higgsfield did not return a provider request_id.");

  const statusUrl = `${API_BASE}/requests/${encodeURIComponent(providerJobId)}/status`;
  const timeoutMs = Number(env.ACS_HIGGSFIELD_TIMEOUT_MS ?? 180000);
  const pollMs = Number(env.ACS_HIGGSFIELD_POLL_MS ?? 3000);
  const deadline = Date.now() + timeoutMs;

  let latest = submitted;
  while (Date.now() < deadline) {
    latest = await apiJson(statusUrl, {
      method: "GET",
      headers: { Authorization: auth, "Accept": "application/json" }
    }, "Higgsfield Genjutsu status");

    const artifact = videoUrl(latest);
    const status = String(latest?.status ?? latest?.state ?? "").toLowerCase();
    if (artifact && ["completed", "complete", "succeeded", "success", "done"].includes(status || "completed")) {
      return {
        provider: "higgsfield",
        providerJobId,
        requestId: acsRequestId,
        generationMode: "live",
        artifact,
        playable: true,
        provenance: {
          bridge: "acs-higgsfield-genjutsu-adapter-v1",
          model: HIGGSFIELD_GENJUTSU_MODEL,
          acsRequestId,
          providerJobId,
          providerRequestId: providerJobId,
          liveEvidence: true
        }
      };
    }
    if (["failed", "error", "canceled", "cancelled"].includes(status)) {
      throw new Error(`Higgsfield Genjutsu terminal failure: ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(`Higgsfield Genjutsu timed out after ${timeoutMs}ms; providerJobId=${providerJobId}`);
}
