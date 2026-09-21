import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {executeGoldenPath,resolveVideoCapability} from "../src/domain.js";

const input={projectName:"Demo ACS",productName:"Sample Bottle",productDescription:"A bottle supplied as the reference product.",productImages:["reference://image-1"],creativeInstruction:"Demonstrate the product naturally.",contentType:"UGC",language:"id"};

test("golden path preserves semantic stages",async()=>{
  const result=await executeGoldenPath(input,{});
  assert.equal(result.storyboard.scenes.length,3);
  assert.equal(result.affiliatePackage.productDescription,input.productDescription);
  assert.notEqual(result.affiliatePackage.caption,input.creativeInstruction);
});

test("fallback is explicit and honest",async()=>{
  const result=await executeGoldenPath(input,{});
  assert.equal(result.video.generationMode,"fallback");
  assert.equal(result.video.validationStatus,"not_live");
});

test("unreachable live adapter is not live evidence",async()=>{
  const result=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://127.0.0.1:1"});
  assert.equal(result.video.generationMode,"live");
  assert.notEqual(result.video.validationStatus,"passed");
});

test("provider-neutral adapter contract preserves provenance",async()=>{
  const adapter=http.createServer(async(req,res)=>{
    const body=JSON.parse(await new Promise((resolve,reject)=>{let raw="";req.on("data",(chunk)=>raw+=chunk);req.on("end",()=>resolve(raw));req.on("error",reject);}));
    assert.equal(req.method,"POST");
    assert.equal(req.headers["x-acs-request-id"]?.length>0,true);
    assert.equal(body.contract,"acs-video-adapter-v1");
    assert.equal(body.capability,"real_ai_video_generation");
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({provider:"test-provider",providerJobId:"test-provider-job",requestId:body.requestId,generationMode:"live",artifact:"https://example.invalid/test.mp4",playable:true,provenance:{source:"contract-test-only",liveEvidence:false}}));
  });
  await new Promise(resolve=>adapter.listen(0,"127.0.0.1",resolve));
  const port=adapter.address().port;
  try{
    const result=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://127.0.0.1:"+port});
    assert.equal(result.video.status,"ready");
    assert.equal(result.video.validationStatus,"passed");
    assert.equal(result.video.adapterContract,"acs-video-adapter-v1");
    assert.equal(result.video.provenance.liveEvidence,false);
  }finally{await new Promise(resolve=>adapter.close(resolve));}
});

test("resolver distinguishes live configuration from fallback",()=>{
  assert.equal(resolveVideoCapability({}).mode,"fallback");
  assert.equal(resolveVideoCapability({ACS_VIDEO_GENERATOR_URL:"x"}).mode,"live");
});
