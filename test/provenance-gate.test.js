import test from "node:test";
import assert from "node:assert/strict";
import { executeGoldenPath } from "../src/domain.js";

const input={projectName:"GAP-ACS-004 Provenance",productName:"Sample Earbuds",productDescription:"Earbuds supplied as the reference product.",productImages:["reference://earbuds"],creativeInstruction:"Reviewer-style demonstration.",contentType:"Reviewer",language:"id"};

async function adapterResponse(body) {
  return new Response(JSON.stringify(body),{status:200,headers:{"content-type":"application/json"}});
}

test("live artifact without provider provenance is rejected", async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>adapterResponse({artifact:{url:"https://example.invalid/video.mp4"},playable:true});
  try {
    const r=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://adapter.invalid"});
    assert.equal(r.video.status,"incomplete_provenance");
    assert.equal(r.video.validationStatus,"failed");
  } finally { globalThis.fetch=original; }
});

test("complete ACS-to-HeyGen provenance is accepted by the runtime gate", async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async()=>adapterResponse({
    artifact:{url:"https://example.invalid/live.mp4",format:"mp4"},
    playable:true,
    provenance:{executionOrigin:"acs-runtime",adapter:"heygen",providerVideoId:"provider-test-id"}
  });
  try {
    const r=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://adapter.invalid"});
    assert.equal(r.video.status,"ready");
    assert.equal(r.video.validationStatus,"passed");
    assert.equal(r.project.status,"generated");
    assert.equal(r.video.provenance.providerVideoId,"provider-test-id");
  } finally { globalThis.fetch=original; }
});
