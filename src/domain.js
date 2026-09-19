import crypto from "node:crypto";

export const VIDEO_CAPABILITY = "real_ai_video_generation";

export function validateProjectInput(input) {
  const required = ["projectName", "productName", "productDescription", "contentType", "language"];
  const missing = required.filter((key) => !String(input?.[key] ?? "").trim());
  if (missing.length) return { ok: false, missing };
  if (!["UGC", "Unboxing", "Reviewer"].includes(input.contentType)) {
    return { ok: false, error: "Unsupported contentType" };
  }
  if (!["en", "id"].includes(input.language)) {
    return { ok: false, error: "Unsupported language" };
  }
  return { ok: true };
}

export function createProject(input) {
  const check = validateProjectInput(input);
  if (!check.ok) throw new Error(JSON.stringify(check));
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    projectName: input.projectName.trim(),
    productName: input.productName.trim(),
    productDescription: input.productDescription.trim(),
    productImages: Array.isArray(input.productImages) ? input.productImages : [],
    creativeInstruction: String(input.creativeInstruction ?? "").trim(),
    contentType: input.contentType,
    language: input.language,
    createdAt: now,
    updatedAt: now,
    status: "draft"
  };
}

export function deriveCreative(project) {
  const language = project.language === "id" ? "Bahasa Indonesia" : "English";
  const objective = project.contentType === "UGC"
    ? "Create authentic creator-style affiliate content."
    : project.contentType === "Unboxing"
      ? "Create an unboxing-led affiliate story."
      : "Create a reviewer-style affiliate story.";
  return {
    objective,
    targetAudience: "Audience inferred from the supplied product context.",
    angle: project.contentType,
    hook: project.contentType === "UGC" ? "Show the product in a natural creator moment." :
      project.contentType === "Unboxing" ? "Reveal the product and its visible details." :
      "Explain the product through an evidence-aware review.",
    strategy: "Use supplied product information only; avoid unsupported claims.",
    contentPillar: "Affiliate product discovery",
    ctaStrategy: "Invite the viewer to explore the product naturally.",
    sceneIntent: [
      { id: "scene-1", intent: "Introduce the product and context.", timingSeconds: 3 },
      { id: "scene-2", intent: "Show product interaction and relevant visual details.", timingSeconds: 4 },
      { id: "scene-3", intent: "Close with a contextual affiliate CTA.", timingSeconds: 3 }
    ],
    language
  };
}

export function buildStoryboard(project, creative) {
  return {
    scenes: creative.sceneIntent.map((s, i) => ({
      id: s.id,
      visual: i === 0 ? "Product introduction using supplied references." :
        i === 1 ? "Product interaction using observable details." :
        "Natural closing shot with contextual CTA.",
      actionMotion: i === 0 ? "Camera establishes product and creator context." :
        i === 1 ? "Creator interacts with or demonstrates the product." :
        "Camera settles while CTA is delivered.",
      timingSeconds: s.timingSeconds
    }))
  };
}

export function resolveVideoCapability(env = process.env) {
  if (env.ACS_VIDEO_GENERATOR_URL) {
    return { capability: VIDEO_CAPABILITY, mode: "live", endpoint: env.ACS_VIDEO_GENERATOR_URL };
  }
  return { capability: VIDEO_CAPABILITY, mode: "fallback", reason: "No usable live video generator configured." };
}

export function generateVideoResult(project, storyboard, env = process.env) {
  const resolution = resolveVideoCapability(env);
  if (resolution.mode === "live") {
    return {
      status: "ready_for_live_adapter",
      generationMode: "live",
      artifact: null,
      validationStatus: "pending",
      capability: resolution.capability,
      adapterEndpoint: resolution.endpoint,
      storyboardSceneCount: storyboard.scenes.length
    };
  }
  return {
    status: "fallback",
    generationMode: "fallback",
    artifact: null,
    validationStatus: "not_live",
    capability: resolution.capability,
    reason: resolution.reason,
    storyboardSceneCount: storyboard.scenes.length
  };
}

export function buildAffiliatePackage(project, creative) {
  const description = project.productDescription.trim();
  const caption = project.language === "id"
    ? `Konten ${project.contentType} untuk ${project.productName}, dibuat dari informasi produk yang diberikan. ${creative.ctaStrategy}`
    : `${project.contentType} content for ${project.productName}, based on the supplied product information. ${creative.ctaStrategy}`;
  const cta = project.language === "id" ? "Lihat detail produk dan pilih sesuai kebutuhanmu." : "Explore the product details and decide if it fits your needs.";
  return {
    productName: project.productName,
    productDescription: description,
    caption,
    cta,
    hashtags: ["#affiliate", "#productdiscovery", "#" + project.contentType.toLowerCase()]
  };
}

export function executeGoldenPath(input, env = process.env) {
  const project = createProject(input);
  const creative = deriveCreative(project);
  const storyboard = buildStoryboard(project, creative);
  const video = generateVideoResult(project, storyboard, env);
  const affiliatePackage = buildAffiliatePackage(project, creative);
  return {
    project: { ...project, status: video.generationMode === "live" ? "generated_pending_validation" : "fallback" },
    creative,
    storyboard,
    video,
    affiliatePackage
  };
}
