import crypto from "node:crypto";
import {VIDEO_CAPABILITY, VIDEO_ADAPTER_CONTRACT, buildVideoAdapterRequest, normalizeVideoResult} from "./video-adapter.js";

const CONTENT_TYPES = ["UGC", "Unboxing", "Reviewer"];
const LANGUAGES = ["en", "id"];
const PLATFORMS = ["TikTok", "Instagram Reels", "YouTube Shorts"];

function clean(value) { return String(value ?? "").trim(); }
function safeTag(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28); }

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
  return {
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
}

export function deriveCreative(project) {
  const isId = project.language === "id";
  const category = {
    UGC: isId ? "momen kreator yang autentik" : "an authentic creator moment",
    Unboxing: isId ? "pengungkapan produk dan detail yang terlihat" : "a reveal of the product and its visible details",
    Reviewer: isId ? "ulasan berbasis informasi produk" : "an evidence-aware product review"
  }[project.contentType];
  return {
    objective: isId ? `Membuat konten afiliasi ${project.contentType} untuk ${project.platform}.` : `Create ${project.contentType} affiliate content for ${project.platform}.`,
    targetAudience: isId ? "Audiens yang kebutuhannya sesuai konteks produk." : "An audience whose needs fit the supplied product context.",
    angle: category,
    hook: isId ? `Mulai dengan ${category}.` : `Open with ${category}.`,
    strategy: isId ? "Gunakan hanya informasi dan referensi produk yang diberikan." : "Use only supplied product information and references.",
    contentPillar: isId ? "Penemuan produk afiliasi" : "Affiliate product discovery",
    ctaStrategy: isId ? "Ajak audiens memeriksa detail produk secara alami." : "Invite the audience to explore the product details naturally.",
    internalControlApplied: Boolean(project.creativeInstruction),
    language: isId ? "Bahasa Indonesia" : "English"
  };
}

export function buildStoryboard(project, creative) {
  const total = project.targetDurationSeconds;
  const timing = total ? [Math.round(total * .3 * 10)/10, Math.round(total * .4 * 10)/10] : [null,null];
  timing.push(total ? Math.round((total - timing[0] - timing[1]) * 10)/10 : null);
  const isId = project.language === "id";
  const intents = isId
    ? ["Perkenalkan produk dan konteksnya.", "Tampilkan interaksi dan detail produk yang relevan.", "Tutup dengan CTA afiliasi yang kontekstual."]
    : ["Introduce the product and its context.", "Show product interaction and relevant visual details.", "Close with a contextual affiliate CTA."];
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
    if (!response.ok) return {
      status:"adapter_error",generationMode:"live",artifact:null,capability:VIDEO_CAPABILITY,
      adapterContract:VIDEO_ADAPTER_CONTRACT,...requestContext,
      validation:{status:"failed",reason:`Video adapter returned HTTP ${response.status}`,checkedAt:new Date().toISOString()},
      provenance:{liveEvidence:false}
    };
    return normalizeVideoResult(await response.json(),requestContext);
  } catch (error) {
    return {
      status:"adapter_unreachable",generationMode:"live",artifact:null,capability:VIDEO_CAPABILITY,
      adapterContract:VIDEO_ADAPTER_CONTRACT,...requestContext,
      validation:{status:"failed",reason:error.message,checkedAt:new Date().toISOString()},
      provenance:{liveEvidence:false}
    };
  }
}

export function buildAffiliatePackage(project, creative) {
  const isId = project.language === "id";
  const platform = project.platform || "social video";
  const caption = isId
    ? `${project.productName} hadir dalam format ${project.contentType} untuk ${platform}. Dibuat berdasarkan informasi produk yang diberikan agar kamu bisa melihat konteksnya dengan jelas.`
    : `Meet ${project.productName} through a ${project.contentType} story made for ${platform}. Built from the supplied product details so you can explore it in context.`;
  const cta = isId ? "Lihat detail produknya dan tentukan apakah sesuai dengan kebutuhanmu." : "Explore the product details and decide whether it fits your needs.";
  const categoryTag = safeTag(project.contentType);
  const productTag = safeTag(project.productName);
  return {productName:project.productName,productDescription:project.productDescription,caption,cta,hashtags:["#affiliate","#productdiscovery",`#${categoryTag}`,...(productTag ? [`#${productTag}`] : [])]};
}

export async function executeGoldenPath(input, env = process.env) {
  const project = createProject(input);
  const creative = deriveCreative(project);
  const storyboard = buildStoryboard(project,creative);
  const video = await generateVideoResult(project,storyboard,creative,env);
  const affiliatePackage = buildAffiliatePackage(project,creative);
  const isVerifiedLive = video.generationMode === "live" && video.validation?.status === "passed" && video.provenance?.liveEvidence === true;
  return {
    project:{...project,status:isVerifiedLive ? "generated" : "fallback",updatedAt:new Date().toISOString()},
    creative, storyboard, video, affiliatePackage,
    execution:{completedAt:new Date().toISOString(),restored:false,regenerationCount:1}
  };
}