import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {executeGoldenPath,resolveVideoCapability} from "../src/domain.js";

const input={projectName:"Demo ACS",productName:"Sample Bottle",productDescription:"A bottle supplied as the reference product.",productImages:["reference://image-1"],creativeInstruction:"Demonstrate the product naturally.",contentType:"UGC",platform:"TikTok",targetDurationSeconds:15,language:"id"};

test("golden path builds canonical output without leaking internal instruction",async()=>{
  const result=await executeGoldenPath(input,{});
  assert.equal(result.storyboard.scenes.length,3);
  assert.equal(result.storyboard.totalDurationSeconds,15);
  assert.equal(result.affiliatePackage.productDescription,input.productDescription);
  assert.equal(result.affiliatePackage.caption.includes(input.creativeInstruction),false);
  assert.deepEqual(Object.keys(result.affiliatePackage),["productName","productDescription","caption","cta","hashtags"]);
});

test("fallback is explicit and honest",async()=>{
  const result=await executeGoldenPath(input,{});
  assert.equal(result.video.generationMode,"fallback");
  assert.equal(result.video.validation.status,"not_live");
  assert.equal(result.video.artifact,null);
  assert.equal(result.video.provenance.liveEvidence,false);
});

test("live adapter unreachable is not evidence",async()=>{
  const result=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:"http://127.0.0.1:1"});
  assert.equal(result.video.generationMode,"live");
  assert.equal(result.video.validation.status,"failed");
  assert.equal(result.video.provenance.liveEvidence,false);
});

test("adapter contract preserves causal identity and refuses unverified evidence",async()=>{
  const adapter=http.createServer(async(req,res)=>{
    const body=JSON.parse(await new Promise((resolve,reject)=>{let raw="";req.on("data",c=>raw+=c);req.on("end",()=>resolve(raw));req.on("error",reject);}));
    assert.equal(body.contract,"acs-video-adapter-v1");
    assert.equal(body.capability,"real_ai_video_generation");
    assert.equal(body.projectId.length>0,true);
    assert.equal(body.storyboardId.length>0,true);
    res.writeHead(200,{"content-type":"application/json"});
    res.end(JSON.stringify({contract:body.contract,capability:body.capability,provider:"contract-test-adapter",providerJobId:"contract-test-job",requestId:body.requestId,generationMode:"live",artifact:"https://example.invalid/test.mp4",playable:true,provenance:{liveEvidence:false}}));
  });
  await new Promise(resolve=>adapter.listen(0,"127.0.0.1",resolve));
  try {
    const {port}=adapter.address(),result=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:`http://127.0.0.1:${port}`});
    assert.equal(result.video.adapterContract,"acs-video-adapter-v1");
    assert.equal(result.video.status,"unverified");
    assert.equal(result.video.validation.status,"unverified");
    assert.equal(result.project.status,"fallback");
  } finally {await new Promise(resolve=>adapter.close(resolve));}
});

test("async adapter job is polled without holding the submit request",async()=>{
  let statusChecks=0;
  const adapter=http.createServer(async(req,res)=>{
    if(req.method==="POST"){
      const body=JSON.parse(await new Promise((resolve,reject)=>{let raw="";req.on("data",c=>raw+=c);req.on("end",()=>resolve(raw));req.on("error",reject);}));
      const address=adapter.address();
      res.writeHead(202,{"content-type":"application/json"});
      return res.end(JSON.stringify({contract:"acs-video-adapter-v1",capability:"real_ai_video_generation",status:"processing",provider:"async-test-adapter",providerJobId:"async-job",requestId:body.requestId,generationMode:"live",statusUrl:`http://127.0.0.1:${address.port}/status`,provenance:{liveEvidence:false}}));
    }
    statusChecks+=1;
    res.writeHead(200,{"content-type":"application/json"});
    if(statusChecks===1)return res.end(JSON.stringify({status:"processing"}));
    return res.end(JSON.stringify({contract:"acs-video-adapter-v1",capability:"real_ai_video_generation",status:"completed",provider:"async-test-adapter",providerJobId:"async-job",requestId:req.headers["x-acs-request-id"],generationMode:"live",artifact:"https://example.invalid/async.mp4",playable:true,provenance:{liveEvidence:true}}));
  });
  await new Promise(resolve=>adapter.listen(0,"127.0.0.1",resolve));
  try {
    const {port}=adapter.address();
    const result=await executeGoldenPath(input,{ACS_VIDEO_GENERATOR_URL:`http://127.0.0.1:${port}`,ACS_VIDEO_POLL_TIMEOUT_SECONDS:"2",ACS_VIDEO_POLL_INTERVAL_MS:"5"});
    assert.equal(result.video.status,"ready");
    assert.equal(result.video.providerJobId,"async-job");
    assert.equal(result.video.provenance.liveEvidence,true);
    assert.equal(result.project.status,"generated");
    assert.equal(statusChecks,2);
  } finally {await new Promise(resolve=>adapter.close(resolve));}
});

test("resolver remains provider-neutral",()=>{
  assert.equal(resolveVideoCapability({}).mode,"fallback");
  const live=resolveVideoCapability({ACS_VIDEO_GENERATOR_URL:"https://adapter.invalid",ACS_VIDEO_CAPABILITY_PROFILE:'{"asyncJobs":true,"durations":[5]}' });
  assert.equal(live.mode,"live");
  assert.equal(live.adapterContract,"acs-video-adapter-v1");
  assert.equal(live.profile.asyncJobs,true);
  assert.equal("provider" in live,false);
});