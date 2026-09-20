export const VIDEO_CAPABILITY = "real_ai_video_generation";
export const VIDEO_ADAPTER_CONTRACT = "acs-video-adapter-v1";

export function buildVideoAdapterRequest({requestId, project, storyboard, creative, capabilityProfile = {}}) {
  return {
    contract: VIDEO_ADAPTER_CONTRACT,
    requestId,
    projectId: project.id,
    storyboardId: storyboard.id,
    capability: VIDEO_CAPABILITY,
    requestedOutput: {
      durationSeconds: project.targetDurationSeconds ?? null,
      aspectRatio: project.aspectRatio ?? "9:16",
      resolution: project.resolution ?? "capability_default"
    },
    capabilityProfile,
    project,
    creative,
    storyboard
  };
}

export function validateVideoAdapterPayload(payload, expectedRequestId) {
  if (!payload || typeof payload !== "object") return {ok:false,error:"Adapter response is not an object"};
  if (payload.contract && payload.contract !== VIDEO_ADAPTER_CONTRACT) return {ok:false,error:"Adapter contract mismatch"};
  if (payload.capability && payload.capability !== VIDEO_CAPABILITY) return {ok:false,error:"Adapter capability mismatch"};
  if (payload.requestId !== expectedRequestId) return {ok:false,error:"Adapter request identity mismatch"};
  if (!payload.provider || !payload.providerJobId) return {ok:false,error:"Adapter did not return provider and job identity"};
  if (!payload.artifact || payload.playable !== true) return {ok:false,error:"Adapter did not return a playable artifact"};
  if (payload.generationMode !== "live") return {ok:false,error:"Adapter did not explicitly attest live generation"};
  return {ok:true};
}

export function normalizeVideoResult(payload, requestContext) {
  const validation = validateVideoAdapterPayload(payload, requestContext.requestId);
  if (!validation.ok) return {
    status: "invalid_live_artifact",
    generationMode: "live",
    capability: VIDEO_CAPABILITY,
    adapterContract: VIDEO_ADAPTER_CONTRACT,
    requestId: requestContext.requestId,
    projectId: requestContext.projectId,
    storyboardId: requestContext.storyboardId,
    provider: payload?.provider ?? null,
    providerJobId: payload?.providerJobId ?? null,
    artifact: payload?.artifact ?? null,
    validation: {status:"failed", reason:validation.error, checkedAt:new Date().toISOString()},
    provenance: payload?.provenance ?? null
  };

  const evidence = payload.provenance?.liveEvidence === true;
  return {
    status: evidence ? "ready" : "unverified",
    generationMode: "live",
    capability: VIDEO_CAPABILITY,
    adapterContract: VIDEO_ADAPTER_CONTRACT,
    requestId: requestContext.requestId,
    projectId: requestContext.projectId,
    storyboardId: requestContext.storyboardId,
    provider: payload.provider,
    providerJobId: payload.providerJobId,
    artifact: payload.artifact,
    playable: payload.playable,
    validation: {
      status: evidence ? "passed" : "unverified",
      reason: evidence ? "Adapter returned playable artifact with live evidence." : "Playable artifact lacks live execution evidence.",
      checkedAt: new Date().toISOString()
    },
    provenance: payload.provenance ?? {liveEvidence:false}
  };
}