import http from "node:http";
import { executeGoldenPath } from "./domain.js";

const port = Number(process.env.PORT || 3000);
const projects = new Map();

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (data.length > 1_000_000) reject(new Error("payload too large")); });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error("invalid json")); }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, { ok: true, service: "acs-v3-runtime", version: "0.1.0" });
    }
    if (req.method === "POST" && req.url === "/api/projects") {
      const input = await readBody(req);
      const result = executeGoldenPath(input);
      projects.set(result.project.id, result);
      return json(res, 201, result);
    }
    const match = req.url?.match(/^\/api\/projects\/([^/]+)$/);
    if (req.method === "GET" && match) {
      const result = projects.get(match[1]);
      return result ? json(res, 200, result) : json(res, 404, { error: "project not found" });
    }
    return json(res, 404, { error: "not found" });
  } catch (error) {
    return json(res, 400, { error: error.message });
  }
});

server.listen(port, () => console.log(`ACS V3 runtime listening on :${port}`));
