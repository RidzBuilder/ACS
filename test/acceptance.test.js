import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {executeGoldenPath,resolveVideoCapability,createProject,deriveCreative,buildStoryboard,buildAffiliatePackage,upgradePersistedResult} from "../src/domain.js";

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

test("rich product intelligence propagates into creative, storyboard, caption, and CTA",()=>{
  const project=createProject({
    projectName:"Azarine semantic audit",productName:"serum retinol",
    productDescription:"Azarine Revitalizing Anti Aging Serum — Marvel Doctor Strange Edition adalah serum wajah dengan Bakuchiol dan Peptide untuk pengguna yang mencari perawatan anti-aging.",
    creativeInstruction:'Name:\nAzarine Revitalizing Anti Aging Serum — Marvel Doctor Strange Edition\n\nCategory:\nFacial serum / anti-aging skincare\n\nKEY INGREDIENTS SHOWN ON PACKAGING:\n- Bakuchiol\n- Peptide\n\nCREATOR PERSONA\nRelatable everyday skincare user.\n\nTONE\nNatural.\nWarm.\n\nVIDEO TYPE\nUGC / authentic creator-style product review.\n\nDialogue:\n"Guys, aku baru nemu serum yang konsepnya menarik banget."\n\nDialogue:\n"Kalau kamu lagi cari serum buat perawatan anti-aging, boleh cek yang ini."',
    contentType:"UGC",platform:"TikTok",targetDurationSeconds:10,language:"id"
  });
  const creative=deriveCreative(project),storyboard=buildStoryboard(project,creative),pkg=buildAffiliatePackage(project,creative,storyboard);
  assert.equal(project.productIntelligence.ingredients.includes("Bakuchiol"),true);
  assert.equal(project.productIntelligence.ingredients.includes("Peptide"),true);
  assert.match(creative.hook,/baru nemu serum/i);
  assert.match(storyboard.scenes[1].intent,/Bakuchiol/i);
  assert.match(pkg.caption,/Bakuchiol/i);
  assert.match(pkg.caption,/Peptide/i);
  assert.match(pkg.caption,/TikTok/i);
  assert.match(pkg.cta,/anti-aging/i);
  assert.equal(pkg.caption.includes(project.creativeInstruction),false);
  const other=createProject({...input,productName:"Atlas Travel Bottle",productDescription:"A reusable travel bottle with a locking lid and slim profile.",creativeInstruction:"",language:"en"});
  const otherCreative=deriveCreative(other),otherPackage=buildAffiliatePackage(other,otherCreative,buildStoryboard(other,otherCreative));
  assert.notEqual(pkg.caption,otherPackage.caption);
  assert.notEqual(pkg.cta,otherPackage.cta);
});

test("semantic migration preserves video provenance and regeneration metadata",()=>{
  const legacy={project:createProject(input),creative:{angle:"legacy"},storyboard:{id:"storyboard-1",scenes:[]},video:{requestId:"request-1",providerJobId:"job-1",artifact:"https://example.invalid/video.webm"},affiliatePackage:{caption:"generic"},execution:{regenerationCount:1}};
  delete legacy.project.productIntelligence;
  const upgraded=upgradePersistedResult(legacy);
  assert.equal(upgraded.semanticSchemaVersion,4);
  assert.deepEqual(upgraded.video,legacy.video);
  assert.deepEqual(upgraded.storyboard,legacy.storyboard);
  assert.equal(upgraded.execution.regenerationCount,1);
  assert.notEqual(upgraded.affiliatePackage.caption,"generic");
});