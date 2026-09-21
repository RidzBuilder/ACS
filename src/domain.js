import crypto from "node:crypto";
import {VIDEO_CAPABILITY,VIDEO_ADAPTER_CONTRACT,buildVideoAdapterRequest,validateVideoAdapterPayload} from "./video-adapter.js";

export function validateProjectInput(input) {
  const required=["projectName","productName","productDescription","contentType","language"];
  const missing=required.filter((key)=>!String(input?.[key]??"").trim());
  if(missing.length)return {ok:false,missing};
  if(!["UGC","Unboxing","Reviewer"].includes(input.contentType))return {ok:false,error:"Unsupported contentType"};
  if(!["en","id"].includes(input.language))return {ok:false,error:"Unsupported language"};
  return {ok:true};
}

export function createProject(input){
  const check=validateProjectInput(input);
  if(!check.ok)throw new Error(JSON.stringify(check));
  const now=new Date().toISOString();
  return {id:crypto.randomUUID(),projectName:input.projectName.trim(),productName:input.productName.trim(),productDescription:input.productDescription.trim(),productImages:Array.isArray(input.productImages)?input.productImages:[],creativeInstruction:String(input.creativeInstruction??"").trim(),contentType:input.contentType,language:input.language,createdAt:now,updatedAt:now,status:"draft"};
}

export function deriveCreative(project){
  return {objective:project.contentType==="UGC"?"Create authentic creator-style affiliate content.":project.contentType==="Unboxing"?"Create an unboxing-led affiliate story.":"Create a reviewer-style affiliate story.",targetAudience:"Audience inferred from supplied product context.",angle:project.contentType,hook:project.contentType==="UGC"?"Show the product in a natural creator moment.":project.contentType==="Unboxing"?"Reveal the product and its visible details.":"Explain the product through an evidence-aware review.",strategy:"Use supplied product information only; avoid unsupported claims.",contentPillar:"Affiliate product discovery",ctaStrategy:"Invite the viewer to explore the product naturally.",language:project.language==="id"?"Bahasa Indonesia":"English",sceneIntent:[{id:"scene-1",intent:"Introduce the product and context.",timingSeconds:3},{id:"scene-2",intent:"Show product interaction and relevant visual details.",timingSeconds:4},{id:"scene-3",intent:"Close with a contextual affiliate CTA.",timingSeconds:3}]};
}

export function buildStoryboard(project,creative){
  return {scenes:creative.sceneIntent.map((s,i)=>({id:s.id,visual:i===0?"Product introduction using supplied references.":i===1?"Product interaction using observable details.":"Natural closing shot with contextual CTA.",actionMotion:i===0?"Camera establishes product and creator context.":i===1?"Creator interacts with or demonstrates the product.":"Camera settles while CTA is delivered.",timingSeconds:s.timingSeconds}))};
}

export function resolveVideoCapability(env=process.env){
  if(!env.ACS_VIDEO_GENERATOR_URL)return {capability:VIDEO_CAPABILITY,mode:"fallback",reason:"No usable live video generator configured."};
  return {capability:VIDEO_CAPABILITY,mode:"live",endpoint:env.ACS_VIDEO_GENERATOR_URL,adapterContract:VIDEO_ADAPTER_CONTRACT};
}

export async function generateVideoResult(project,storyboard,env=process.env){
  const resolution=resolveVideoCapability(env);
  if(resolution.mode==="fallback")return {status:"fallback",generationMode:"fallback",artifact:null,validationStatus:"not_live",capability:VIDEO_CAPABILITY,reason:resolution.reason,storyboardSceneCount:storyboard.scenes.length};
  const requestId=crypto.randomUUID();
  try{
    const response=await fetch(resolution.endpoint,{method:"POST",headers:{"content-type":"application/json","x-acs-request-id":requestId},body:JSON.stringify(buildVideoAdapterRequest({requestId,project,storyboard}))});
    if(!response.ok)return {status:"adapter_error",generationMode:"live",artifact:null,validationStatus:"failed",capability:VIDEO_CAPABILITY,requestId,error:"Video adapter returned HTTP "+response.status};
    const payload=await response.json(),validation=validateVideoAdapterPayload(payload);
    if(!validation.ok)return {status:"invalid_live_artifact",generationMode:"live",artifact:payload?.artifact??null,validationStatus:"failed",capability:VIDEO_CAPABILITY,requestId,provider:payload?.provider??null,providerJobId:payload?.providerJobId??null,error:validation.error};
    return {status:"ready",generationMode:"live",artifact:payload.artifact,playable:payload.playable,validationStatus:"passed",capability:VIDEO_CAPABILITY,storyboardSceneCount:storyboard.scenes.length,adapterContract:VIDEO_ADAPTER_CONTRACT,requestId,provider:payload.provider,providerJobId:payload.providerJobId,provenance:payload.provenance??null};
  }catch(error){return {status:"adapter_unreachable",generationMode:"live",artifact:null,validationStatus:"failed",capability:VIDEO_CAPABILITY,requestId,error:error.message};}
}

export function buildAffiliatePackage(project,creative){
  const description=project.productDescription.trim();
  const caption=project.language==="id"?"Konten "+project.contentType+" untuk "+project.productName+", dibuat dari informasi produk yang diberikan. "+creative.ctaStrategy:project.contentType+" content for "+project.productName+", based on the supplied product information. "+creative.ctaStrategy;
  const cta=project.language==="id"?"Lihat detail produk dan pilih sesuai kebutuhanmu.":"Explore the product details and decide if it fits your needs.";
  return {productName:project.productName,productDescription:description,caption,cta,hashtags:["#affiliate","#productdiscovery","#"+project.contentType.toLowerCase()]};
}

export async function executeGoldenPath(input,env=process.env){
  const project=createProject(input),creative=deriveCreative(project),storyboard=buildStoryboard(project,creative),video=await generateVideoResult(project,storyboard,env),affiliatePackage=buildAffiliatePackage(project,creative);
  return {project:{...project,status:video.generationMode==="live"&&video.validationStatus==="passed"?"generated":"fallback"},creative,storyboard,video,affiliatePackage};
}
