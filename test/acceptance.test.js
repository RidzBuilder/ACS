import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {executeGoldenPath,resolveVideoCapability} from "../src/domain.js";

const input={
  projectName:"Demo ACS",
  productName:"Sample Bottle",
  productDescription:"A bottle supplied as the reference product.",
  productImages:["reference://image-1"],
  creativeInstruction:"Demonstrate the product naturally.",
  contentType:"UGC",
  language:"id"
};

test("golden path",async()=>{
  const r=await executeGoldenPath(input,{});
  assert.equal(r.storyboard.scenes.length,3);
  assert.equal(r.affiliatePackage.productDescription,input.productDescription);
  assert.notEqual(r.affiliatePackage.caption,input.creativeInstruction);
});

test("fallback honest",async()=>{
  const r=await executeGoldenPath(input,{});
  assert.equal(r.video.generationMode,"fallback");
  assert.equal(r.video.validationStatus,"not_live");
});

test("live adapter unreachable is not evidence",async()=>{
  const r=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://127.0.0.1:1"});
  assert.equal(r.video.generationMode,"live");
  assert.notEqual(r.video.validationStatus,"passed");
  assert.equal(r.video.provider,undefined);
});

test("live adapter contract preserves provenance",async()=>{
  const server=http.createServer(async(req,res)=>{
    assert.equal(req.method,"POST");
    assert.equal(req.headers["x-acs-request-id"]?.length>0,true);
    const body=JSON.parse(await new Promise((resolve,reject)=>{
      let raw=""; req.on("data",c=>raw+=c); req.on("end",()=>resolve(raw)); req.on("error",reject);
    }));
    assert.equal(body.contract,"acs-video-adapter-v1");
    assert.equal(body.capability,"real_ai_video_generation");
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({
      provider:"higgsfield",
      providerJobId:"test-provider-job",
      requestId:body.requestId,
      generationMode:"live",
      artifact:"https://example.invalid/test.mp4",
      playable:true,
      provenance:{source:"contract-test-only",liveEvidence:false}
    }));
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const {port}=server.address();
  try {
    const r=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:`http://127.0.0.1:${port}`});
    assert.equal(r.video.status,"ready");
    assert.equal(r.video.validationStatus,"passed");
    assert.equal(r.video.provider,"higgsfield");
    assert.equal(r.video.providerJobId,"test-provider-job");
    assert.equal(r.video.adapterContract,"acs-video-adapter-v1");
    assert.equal(r.video.provenance.liveEvidence,false);
  } finally {
    await new Promise(resolve=>server.close(resolve));
  }
});

test("resolver",()=>{
  assert.equal(resolveVideoCapability({}).mode,"fallback");
  assert.equal(resolveVideoCapability({ACS_VIDEO_GENERATOR_URL:"x"}).mode,"live");
  assert.equal(resolveVideoCapability({ACS_VIDEO_GENERATOR_URL:"x"}).adapterContract,"acs-video-adapter-v1");
});
