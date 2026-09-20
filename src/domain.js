import crypto from "node:crypto";
import {VIDEO_CAPABILITY, VIDEO_ADAPTER_CONTRACT, buildVideoAdapterRequest, normalizeVideoResult} from "./video-adapter.js";

const CONTENT_TYPES = ["UGC", "Unboxing", "Reviewer"];
const LANGUAGES = ["en", "id"];
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"];

function clean(value) { return String(value ?? "").trim(); }
function phrase(value) { return clean(value).replace(/[\s.!?,;:]+$/g,""); }
function safeTag(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28); }
function values(value) { return Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value) ? [clean(value)] : []; }
function unique(items) { return [...new Set(items.map(clean).filter(Boolean))]; }
function promptField(text,label) {
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return clean(text.match(new RegExp(`${escaped}\\s*:\\s*(?:\\n\\s*)?([^\\n]+)`,"i"))?.[1]);
}
function promptSection(text,label) {
  const lines=String(text||"").replace(/\r/g,"").split("\n"),start=lines.findIndex(line=>line.trim().toUpperCase().replace(/:$/,'')===label.toUpperCase());
  if(start<0)return [];
  const collected=[];
  for(let index=start+1;index<lines.length;index+=1){
    const line=lines[index].trim();
    if(line&&(/^[A-Z][A-Z0-9 /&()_—-]{2,}:?$/.test(line)||/^SCENE \d+/i.test(line)))break;
    if(line&&!/^Example:?$/i.test(line))collected.push(line.replace(/^[-*]\s*/,""));
  }
  return collected.filter(Boolean);
}
function dialogues(text) { return [...String(text||"").matchAll(/Dialogue:\s*\n\s*["“]([^"”]+)["”]/gi)].map(match=>clean(match[1])); }

export function deriveProductIntelligence(source) {
  const explicit=source?.productIntelligence||{},instruction=clean(source?.creativeInstruction),description=clean(source?.productDescription),spoken=dialogues(instruction);
  const descriptionIngredients=description.match(/(?:mengandung|contains)(?: beberapa bahan utama)?(?: seperti)?\s+([^\.]+)/i)?.[1]?.split(/,|\s+dan\s+|\s+and\s+/i)||[];
  const keyIngredients=promptSection(instruction,"KEY INGREDIENTS SHOWN ON PACKAGING");
  const name=clean(explicit.canonicalProductName||source?.canonicalProductName||promptField(instruction,"Name")||source?.productName);
  const buyerMatch=(spoken.at(-1)||instruction).match(/(?:lagi mencari|lagi cari|looking for)\s+([^,."”]+)/i)?.[1];
  return {
    canonicalProductName:name,
    category:clean(explicit.category||source?.productCategory||promptField(instruction,"Category")),
    verifiedAttributes:unique([...values(explicit.verifiedAttributes||source?.productAttributes),...promptSection(instruction,"VISIBLE PRODUCT CLAIMS")]),
    ingredients:unique([...values(explicit.ingredients||source?.ingredients),...keyIngredients,...descriptionIngredients]).slice(0,12),
    visibleClaims:unique([...values(explicit.visibleClaims||source?.visibleClaims),...promptSection(instruction,"VISIBLE PRODUCT CLAIMS")]),
    packagingInformation:unique([...values(explicit.packagingInformation||source?.packagingInformation),...promptSection(instruction,"PACKAGING INFORMATION")]),
    creatorPersona:clean(explicit.creatorPersona||source?.creatorPersona||promptSection(instruction,"CREATOR PERSONA").join(" ")),
    tone:unique([...values(explicit.tone||source?.tone),...promptSection(instruction,"TONE")]).map(phrase).filter(Boolean).slice(0,8),
    contentAngle:clean(explicit.contentAngle||source?.contentAngle||promptSection(instruction,"VIDEO TYPE")[0]),
    hook:clean(explicit.hook||source?.hook||spoken[0]),
    buyerIntent:clean(explicit.buyerIntent||source?.buyerIntent||buyerMatch),
    ctaIntent:clean(explicit.ctaIntent||source?.ctaIntent||spoken.at(-1)),
    negativeConstraints:unique([...values(explicit.negativeConstraints||source?.negativeConstraints),...promptSection(instruction,"NEGATIVE CONSTRAINTS"),...promptSection(instruction,"DO NOT")]).filter(value=>!/^do not:?$/i.test(value)),
    sourceDescription:description
  };
}

export function validateProjectInput(input) {
  const required = ["projectName", "productName", "productDescription", "contentType", "language"];
  const missing = required.filter((key) => !clean(input?.[key]));
  if (missing.length) return {ok:false, missing};
  if (!CONTENT_TYPES.includes(input.contentType)) return {ok:false,error:"Unsupported contentType"};
  if (!LANGUAGES.includes(input.language)) return {ok:false,error:"Unsupported language"};
  if (input.platform && !PLATFORMS.includes(input.platform)) return {ok:false,error:"Unsupported platform"};
  if (clean(input.productDescription).toLowerCase() === clean(input.productName).toLowerCase()) return {ok:false,error:"Product description must add meaningful product information"};
  return {ok:true};
}

export function createProject(input) {
  const check = validateProjectInput(input);
  if (!check.ok) throw new Error(JSON.stringify(check));
  const now = new Date().toISOString();
  const target = Number(input.targetDurationSeconds);
  const project={
    id: crypto.randomUUID(),
    projectName: clean(input.projectName),
    productName: clean(input.productName),
    productDescription: clean(input.productDescription),
    productImages: Array.isArray(input.productImages) ? input.productImages.slice(0, 6) : [],
    creativeInstruction: clean(input.creativeInstruction),
    productConsistency: ["strict", "balanced", "exploratory"].includes(input.productConsistency) ? input.productConsistency : "balanced",
    contentType: input.contentType,
    platform: input.platform || "TikTok",
    preset: clean(input.preset) || "Product spotlight",
    customPreset: clean(input.customPreset),
    targetDurationSeconds: Number.isFinite(target) && target > 0 ? target : null,
    aspectRatio: clean(input.aspectRatio) || "9:16",
    language: input.language,
    createdAt: now,
    updatedAt: now,
    status: "draft"
  };
  project.productIntelligence=deriveProductIntelligence({...input,...project});
  return project;
}

export function deriveCreative(project) {
  const isId = project.language === "id";
  const intelligence=project.productIntelligence||deriveProductIntelligence(project);
  const category = {
    UGC: isId ? "momen kreator yang autentik" : "an authentic creator moment",
    Unboxing: isId ? "pengungkapan produk dan detail yang terlihat" : "a reveal of the product and its visible details",
    Reviewer: isId ? "ulasan berbasis informasi produk" : "an evidence-aware product review"
  }[project.contentType];
  return {
    objective: isId ? `Membuat konten afiliasi ${project.contentType} untuk ${project.platform}.` : `Create ${project.contentType} affiliate content for ${project.platform}.`,
    targetAudience: intelligence.buyerIntent || (isId ? "Audiens yang kebutuhannya sesuai konteks produk." : "An audience whose needs fit the supplied product context."),
    angle: intelligence.contentAngle || category,
    hook: intelligence.hook || (isId ? `Mulai dengan ${category}.` : `Open with ${category}.`),
    strategy: isId ? "Gunakan hanya informasi dan referensi produk yang diberikan." : "Use only supplied product information and references.",
    contentPillar: isId ? "Penemuan produk afiliasi" : "Affiliate product discovery",
    ctaStrategy: intelligence.ctaIntent || (isId ? "Ajak audiens memeriksa detail produk secara alami." : "Invite the audience to explore the product details naturally."),
    creatorPersona:intelligence.creatorPersona,
    tone:intelligence.tone,
    internalControlApplied: Boolean(project.creativeInstruction),
    language: isId ? "Bahasa Indonesia" : "English"
  };
}

export function buildStoryboard(project, creative) {
  const total = project.targetDurationSeconds;
  const timing = total ? [Math.round(total * .3 * 10)/10, Math.round(total * .4 * 10)/10] : [null,null];
  timing.push(total ? Math.round((total - timing[0] - timing[1]) * 10)/10 : null);
  const isId = project.language === "id";
  const intelligence=project.productIntelligence||deriveProductIntelligence(project),detail=intelligence.ingredients.slice(0,2).join(isId?" dan ":" and ")||intelligence.verifiedAttributes[0];
  const intents = [
    creative.hook || (isId?"Perkenalkan produk dan konteksnya.":"Introduce the product and its context."),
    detail ? (isId?`Tunjukkan detail produk yang relevan: ${detail}.`:`Show the relevant product detail: ${detail}.`) : (isId?"Tampilkan interaksi dan detail produk yang relevan.":"Show product interaction and relevant visual details."),
    creative.ctaStrategy || (isId?"Tutup dengan CTA afiliasi yang kontekstual.":"Close with a contextual affiliate CTA.")
  ];
  const visuals = isId
    ? ["Pembukaan produk memakai referensi yang diberikan.", "Interaksi produk memakai detail yang dapat diamati.", "Bidikan penutup alami dengan CTA kontekstual."]
    : ["Product opening using supplied references.", "Product interaction using observable details.", "Natural closing shot with contextual CTA."];
  return {
    id: crypto.randomUUID(),
    totalDurationSeconds: total,
    scenes: intents.map((intent,index)=>({
      id:`scene-${index+1}`,
      intent,
      visual:visuals[index],
      actionMotion:index === 0 ? "Establish product and creator context." : index === 1 ? "Demonstrate observable product details." : "Settle into a clear closing frame.",
      timingSeconds:timing[index]
    }))
  };
}

export function resolveVideoCapability(env = process.env) {
  if (!env.ACS_VIDEO_GENERATOR_URL) return {
    capability:VIDEO_CAPABILITY,
    adapterContract:VIDEO_ADAPTER_CONTRACT,
    mode:"fallback",
    reason:env.ACS_VIDEO_DISABLED_REASON || "No conforming live video adapter is configured in this environment.",
    profile:{asyncJobs:false,durations:[],aspectRatios:[],resolutions:[]}
  };
  let profile = {};
  try { profile = JSON.parse(env.ACS_VIDEO_CAPABILITY_PROFILE || "{}"); } catch { profile = {}; }
  return {capability:VIDEO_CAPABILITY,adapterContract:VIDEO_ADAPTER_CONTRACT,mode:"live",profile};
}

function wait(milliseconds) {
  return new Promise((resolve)=>setTimeout(resolve,milliseconds));
}

function adapterError(payload, requestContext, reason) {
  return {
    status:"adapter_error",generationMode:"live",artifact:null,capability:VIDEO_CAPABILITY,
    adapterContract:VIDEO_ADAPTER_CONTRACT,...requestContext,
    provider:payload?.provider??null,providerJobId:payload?.providerJobId??null,
    validation:{status:"failed",reason,checkedAt:new Date().toISOString()},
    provenance:payload?.provenance??{liveEvidence:false}
  };
}

async function pollVideoAdapter(initialPayload, resolution, requestContext, env) {
  const adapterOrigin = new URL(env.ACS_VIDEO_GENERATOR_URL).origin;
  const statusUrl = new URL(initialPayload.statusUrl);
  if (statusUrl.origin !== adapterOrigin) return adapterError(initialPayload,requestContext,"Adapter status URL origin mismatch");
  const timeoutSeconds = Number(env.ACS_VIDEO_POLL_TIMEOUT_SECONDS);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) return adapterError(initialPayload,requestContext,"ACS_VIDEO_POLL_TIMEOUT_SECONDS is required for asynchronous video jobs");
  const pollIntervalMs = Number(env.ACS_VIDEO_POLL_INTERVAL_MS);
  if (!Number.isFinite(pollIntervalMs) || pollIntervalMs <= 0) return adapterError(initialPayload,requestContext,"ACS_VIDEO_POLL_INTERVAL_MS is required for asynchronous video jobs");
  const deadline = Date.now() + timeoutSeconds * 1000;
  let transientFailures = 0;
  while (Date.now() < deadline) {
    await wait(pollIntervalMs);
    try {
      const response = await fetch(statusUrl,{headers:{"x-acs-request-id":requestContext.requestId}});
      if (!response.ok) {
        transientFailures += 1;
        if (transientFailures < 5 && response.status >= 500) continue;
        return adapterError(initialPayload,requestContext,`Video adapter status returned HTTP ${response.status}`);
      }
      transientFailures = 0;
      const payload = await response.json();
      if (payload.status === "failed") return adapterError(payload,requestContext,payload.error||"Video adapter job failed");
      if (payload.status === "completed" || payload.artifact) return normalizeVideoResult(payload,requestContext);
    } catch (error) {
      transientFailures += 1;
      if (transientFailures >= 5) return adapterError(initialPayload,requestContext,error.message);
    }
  }
  return adapterError(initialPayload,requestContext,"Video adapter polling timed out");
}

export async function generateVideoResult(project, storyboard, creative, env = process.env) {
  const resolution = resolveVideoCapability(env);
  if (resolution.mode === "fallback") return {
    status:"fallback", generationMode:"fallback", artifact:null,
    capability:VIDEO_CAPABILITY, adapterContract:VIDEO_ADAPTER_CONTRACT,
    projectId:project.id, storyboardId:storyboard.id,
    validation:{status:"not_live",reason:resolution.reason,checkedAt:new Date().toISOString()},
    provenance:{liveEvidence:false,reason:resolution.reason}
  };

  const requestId = crypto.randomUUID();
  const requestContext = {requestId,projectId:project.id,storyboardId:storyboard.id};
  try {
    const response = await fetch(env.ACS_VIDEO_GENERATOR_URL, {
      method:"POST",
      headers:{"content-type":"application/json","x-acs-request-id":requestId},
      body:JSON.stringify(buildVideoAdapterRequest({requestId,project,storyboard,creative,capabilityProfile:resolution.profile}))
    });
    const payload=await response.json().catch(()=>({}));
    if (!response.ok) return adapterError(payload,requestContext,payload.error||`Video adapter returned HTTP ${response.status}`);
    if (response.status===202||["queued","processing"].includes(payload.status)) return pollVideoAdapter(payload,resolution,requestContext,env);
    return normalizeVideoResult(payload,requestContext);
  } catch (error) {
    return {
      status:"adapter_unreachable",generationMode:"live",artifact:null,capability:VIDEO_CAPABILITY,
      adapterContract:VIDEO_ADAPTER_CONTRACT,...requestContext,
      validation:{status:"failed",reason:error.message,checkedAt:new Date().toISOString()},
      provenance:{liveEvidence:false}
    };
  }
}

export function buildAffiliatePackage(project, creative, storyboard) {
  const isId = project.language === "id";
  const platform = project.platform || "social video";
  const intelligence=project.productIntelligence||deriveProductIntelligence(project),identity=intelligence.canonicalProductName||project.productName;
  const ingredients=intelligence.ingredients.slice(0,2).join(isId?" dan ":" and "),claim=intelligence.visibleClaims[0]||intelligence.verifiedAttributes[0];
  const firstDescription=project.productDescription.split(/\n|(?<=[.!?])\s/)[0].slice(0,220),detail=ingredients||claim||firstDescription;
  const hook=intelligence.hook&&intelligence.hook.length<180?intelligence.hook:(isId?`Kenalan dengan ${identity}.`:`Meet ${identity}.`);
  const tone=intelligence.tone.slice(0,2).map(phrase).join(isId?" dan ":" and "),rawAngle=phrase(intelligence.contentAngle||creative?.angle),angle=rawAngle.replace(new RegExp(`^${project.contentType}\\s*[/—:-]?\\s*`,"i"),"");
  const sceneContext=phrase(storyboard?.scenes?.[1]?.intent);
  const caption = isId
    ? `${hook} ${identity} menonjolkan ${detail}. ${tone?`Dibawakan dengan nuansa ${tone.toLowerCase()} melalui`:`Dikemas melalui`} ${project.contentType}${angle?` dengan pendekatan ${angle.toLowerCase()}`:""} untuk ${platform}${sceneContext?` dengan fokus ${sceneContext.toLowerCase()}`:""}.`
    : `${hook} ${identity} highlights ${detail}. ${tone?`Presented with a ${tone.toLowerCase()} tone through`:`Presented through`} ${project.contentType}${angle?` with a ${angle.toLowerCase()} approach`:""} for ${platform}${sceneContext?` with a focus on ${sceneContext.toLowerCase()}`:""}.`;
  const cta = intelligence.ctaIntent || (intelligence.buyerIntent
    ? (isId?`Kalau kamu sedang mencari ${intelligence.buyerIntent}, cek detail ${identity} dan lihat apakah sesuai dengan rutinitasmu.`:`If you are looking for ${intelligence.buyerIntent}, explore ${identity} and see whether it fits your routine.`)
    : (isId ? `Lihat detail ${identity} dan tentukan apakah sesuai dengan kebutuhanmu.` : `Explore ${identity} and decide whether it fits your needs.`));
  const categoryTag = safeTag(project.contentType);
  const productTag = safeTag(identity),contextTag=safeTag(intelligence.category||intelligence.ingredients[0]);
  return {productName:identity,productDescription:project.productDescription,caption,cta,hashtags:["#affiliate","#productdiscovery",`#${categoryTag}`,...(contextTag?[`#${contextTag}`]:[]),...(productTag ? [`#${productTag}`] : [])]};
}

export function upgradePersistedResult(result) {
  if(!result?.project||result.semanticSchemaVersion===4)return result;
  const project={...result.project,productIntelligence:deriveProductIntelligence(result.project)};
  return {...result,semanticSchemaVersion:4,project,affiliatePackage:buildAffiliatePackage(project,result.creative||deriveCreative(project),result.storyboard)};
}

export async function executeGoldenPath(input, env = process.env) {
  const project = createProject(input);
  const creative = deriveCreative(project);
  const storyboard = buildStoryboard(project,creative);
  const video = await generateVideoResult(project,storyboard,creative,env);
  const affiliatePackage = buildAffiliatePackage(project,creative,storyboard);
  const isVerifiedLive = video.generationMode === "live" && video.validation?.status === "passed" && video.provenance?.liveEvidence === true;
  return {
    project:{...project,status:isVerifiedLive ? "generated" : "fallback",updatedAt:new Date().toISOString()},
    semanticSchemaVersion:4,creative, storyboard, video, affiliatePackage,
    execution:{completedAt:new Date().toISOString(),restored:false,regenerationCount:1}
  };
}