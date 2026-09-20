import http from "node:http";
import crypto from "node:crypto";
import {generateGoogleVeoVideo, getGoogleVeoConfig, validateGoogleVeoConfig} from "./google-veo-adapter.js";

const port = Number(process.env.GOOGLE_VEO_ADAPTER_PORT || 3010);

function json(res, status, body) {
  res.writeHead(status, {"content-type":"application/json; charset=utf-8"});
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => {
      data += chunk;
      if (data.length > 1000000) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid json")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      const config = getGoogleVeoConfig();
      const check = validateGoogleVeoConfig(config);
      return json(res, check.ok ? 200 : 503, {
        ok: check.ok,
        adapter: "google-veo-adapter-v1",
        capability: "real_ai_video_generation",
        apiKeyConfigured: config.apiKeyConfigured,
        config: {model:config.model, aspectRatio:config.aspectRatio, durationSeconds:config.durationSeconds, resolution:config.resolution},
        errors: check.errors
      });
    }

    if (req.method === "POST" && req.url === "/adapter") {
      const input = await readBody(req);
      const requestId = input.requestId || req.headers["x-acs-request-id"] || crypto.randomUUID();
      const result = await generateGoogleVeoVideo({requestId, project:input.project, storyboard:input.storyboard});
      return json(res, 200, result);
    }

    return json(res, 404, {error:"not found"});
  } catch (error) {
    return json(res, 502, {
      contract:"acs-video-adapter-v1",
      requestId:req.headers["x-acs-request-id"] || null,
      generationMode:"live",
      error:error.message
    });
  }
});

server.listen(port, () => console.log(`Google Veo adapter listening on :${port}`));
