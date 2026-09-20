export const GOOGLE_VEO_DEFAULT_MODEL = "veo-3.1-generate-preview";
export const GOOGLE_VEO_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

export function getGoogleVeoConfig(env = process.env) {
  return {
    apiKeyConfigured: Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
    apiKeyEnv: env.GEMINI_API_KEY ? "GEMINI_API_KEY" : env.GOOGLE_API_KEY ? "GOOGLE_API_KEY" : null,
    model: env.GOOGLE_VEO_MODEL || GOOGLE_VEO_DEFAULT_MODEL,
    baseUrl: env.GOOGLE_VEO_BASE_URL || GOOGLE_VEO_BASE_URL,
    aspectRatio: env.GOOGLE_VEO_ASPECT_RATIO || "9:16",
    durationSeconds: env.GOOGLE_VEO_DURATION_SECONDS || "8",
    resolution: env.GOOGLE_VEO_RESOLUTION || "720p"
  };
}

export function validateGoogleVeoConfig(config) {
  const errors = [];
  if (!config.apiKeyConfigured) errors.push("Missing GEMINI_API_KEY or GOOGLE_API_KEY");
  if (!["16:9", "9:16"].includes(config.aspectRatio)) errors.push("Unsupported aspect ratio");
  if (!["4", "6", "8"].includes(String(config.durationSeconds))) errors.push("Unsupported Veo durationSeconds");
  if (!["720p", "1080p", "4k"].includes(config.resolution)) errors.push("Unsupported Veo resolution");
  if (config.resolution !== "720p" && String(config.durationSeconds) !== "8") errors.push("1080p/4k require 8 seconds");
  return { ok: errors.length === 0, errors };
}

export function buildGoogleVeoPrompt({project, storyboard}) {
  const scenes = storyboard?.scenes ?? [];
  const sceneText = scenes.map(scene => `${scene.id}: ${scene.visual} ${scene.actionMotion}`).join(" ");
  return [
    `Product: ${project?.productName ?? "unknown product"}.`,
    `Product context: ${project?.productDescription ?? ""}`,
    `Content style: ${project?.contentType ?? "UGC"}.`,
    `Language: ${project?.language === "id" ? "Bahasa Indonesia" : "English"}.`,
    `Storyboard: ${sceneText}`,
    "Create a natural affiliate creator-style vertical video. Use only supplied product information; do not invent product claims."
  ].join(" ");
}

export function buildGoogleVeoRequest({requestId, project, storyboard, env = process.env}) {
  const config = getGoogleVeoConfig(env);
  return {
    model: config.model,
    instances: [{ prompt: buildGoogleVeoPrompt({project, storyboard}) }],
    parameters: {
      aspectRatio: config.aspectRatio,
      durationSeconds: String(config.durationSeconds),
      resolution: config.resolution
    },
    requestId
  };
}

export function buildGoogleVeoEndpoint({operationName, env = process.env}) {
  const config = getGoogleVeoConfig(env);
  return `${config.baseUrl.replace(/\/$/, "")}/${operationName}`;
}

async function googleFetch(url, options, env) {
  const key = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "x-goog-api-key": key,
      "content-type": "application/json"
    }
  });
}

export async function generateGoogleVeoVideo({requestId, project, storyboard, env = process.env, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))}) {
  const config = getGoogleVeoConfig(env);
  const configCheck = validateGoogleVeoConfig(config);
  if (!configCheck.ok) throw new Error(configCheck.errors.join("; "));

  const startUrl = `${config.baseUrl.replace(/\/$/, "")}/models/${config.model}:predictLongRunning`;
  const startResponse = await googleFetch(startUrl, {
    method: "POST",
    body: JSON.stringify(buildGoogleVeoRequest({requestId, project, storyboard, env}))
  }, env);

  if (!startResponse.ok) throw new Error(`Google Veo start failed HTTP ${startResponse.status}: ${await startResponse.text()}`);

  const startPayload = await startResponse.json();
  if (!startPayload.name) throw new Error("Google Veo start response did not contain operation name");

  let operation = startPayload;
  while (!operation.done) {
    await sleep(Number(env.GOOGLE_VEO_POLL_MS || 10000));
    const statusResponse = await googleFetch(buildGoogleVeoEndpoint({operationName: operation.name, env}), {method:"GET"}, env);
    if (!statusResponse.ok) throw new Error(`Google Veo operation poll failed HTTP ${statusResponse.status}: ${await statusResponse.text()}`);
    operation = await statusResponse.json();
  }

  if (operation.error) throw new Error(`Google Veo operation failed: ${JSON.stringify(operation.error)}`);

  const sample = operation.response?.generateVideoResponse?.generatedSamples?.[0];
  const uri = sample?.video?.uri;
  if (!uri) throw new Error("Google Veo completed without a video URI");

  return {
    contract: "acs-video-adapter-v1",
    requestId,
    capability: "real_ai_video_generation",
    provider: "google-veo",
    providerJobId: operation.name,
    generationMode: "live",
    artifact: uri,
    playable: true,
    provenance: {
      adapter: "google-veo-adapter-v1",
      model: config.model,
      aspectRatio: config.aspectRatio,
      durationSeconds: String(config.durationSeconds),
      resolution: config.resolution
    }
  };
}
