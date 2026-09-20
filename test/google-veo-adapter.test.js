import test from "node:test";
import assert from "node:assert/strict";
import {getGoogleVeoConfig, validateGoogleVeoConfig, buildGoogleVeoRequest, buildGoogleVeoEndpoint} from "../src/google-veo-adapter.js";

test("Google Veo configuration is implementation-level and provider-specific", () => {
  const config = getGoogleVeoConfig({
    GEMINI_API_KEY:"present",
    GOOGLE_VEO_MODEL:"veo-3.1-generate-preview",
    GOOGLE_VEO_ASPECT_RATIO:"9:16",
    GOOGLE_VEO_DURATION_SECONDS:"8",
    GOOGLE_VEO_RESOLUTION:"720p"
  });
  assert.equal(config.apiKeyConfigured, true);
  assert.equal(config.model, "veo-3.1-generate-preview");
  assert.equal(config.aspectRatio, "9:16");
});

test("Google Veo configuration validation is non-generative", () => {
  const check = validateGoogleVeoConfig(getGoogleVeoConfig({GEMINI_API_KEY:"present"}));
  assert.equal(check.ok, true);
});

test("Google Veo adapter request maps through acs-video-adapter-v1 semantics", () => {
  const payload = buildGoogleVeoRequest({
    requestId:"req-1",
    project:{productName:"Test Product", productDescription:"Supplied description", contentType:"UGC", language:"id"},
    storyboard:{scenes:[{id:"scene-1",visual:"Product shot",actionMotion:"Camera moves naturally"}]},
    env:{GEMINI_API_KEY:"present"}
  });
  assert.equal(payload.instances.length, 1);
  assert.equal(payload.parameters.aspectRatio, "9:16");
  assert.equal(payload.parameters.durationSeconds, "8");
  assert.match(payload.instances[0].prompt, /Test Product/);
});

test("Google Veo operation URL remains an implementation concern", () => {
  const url = buildGoogleVeoEndpoint({operationName:"operations/abc", env:{GEMINI_API_KEY:"present"}});
  assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/operations/abc");
});
