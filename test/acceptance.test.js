import test from "node:test";
import assert from "node:assert/strict";
import { executeGoldenPath, resolveVideoCapability } from "../src/domain.js";

const input = {
  projectName: "Demo ACS",
  productName: "Sample Bottle",
  productDescription: "A bottle supplied as the reference product.",
  productImages: ["reference://image-1"],
  creativeInstruction: "Demonstrate the product naturally.",
  contentType: "UGC",
  language: "id"
};

test("golden path produces all canonical stages", () => {
  const result = executeGoldenPath(input, {});
  assert.equal(result.project.productName, input.productName);
  assert.equal(result.creative.objective.length > 0, true);
  assert.equal(result.storyboard.scenes.length, 3);
  assert.equal(result.affiliatePackage.productName, input.productName);
  assert.equal(result.affiliatePackage.productDescription, input.productDescription);
  assert.notEqual(result.affiliatePackage.caption, input.creativeInstruction);
});

test("fallback is explicit and never represented as live", () => {
  const result = executeGoldenPath(input, {});
  assert.equal(result.video.generationMode, "fallback");
  assert.equal(result.video.status, "fallback");
  assert.equal(result.video.validationStatus, "not_live");
});

test("live capability is discovered only from an explicit runtime capability", () => {
  const resolved = resolveVideoCapability({ ACS_VIDEO_GENERATOR_URL: "https://example.invalid/video" });
  assert.equal(resolved.mode, "live");
  assert.equal(resolved.capability, "real_ai_video_generation");
});
