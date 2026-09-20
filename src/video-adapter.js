export const VIDEO_CAPABILITY = "real_ai_video_generation";
export const VIDEO_ADAPTER_CONTRACT = "acs-video-adapter-v1";

/**
 * Provider-neutral boundary.
 * Providers, SDKs, API URLs, authentication and model names belong behind this boundary.
 */
export function buildVideoAdapterRequest({requestId, project, storyboard}) {
  return {
    contract: VIDEO_ADAPTER_CONTRACT,
    requestId,
    capability: VIDEO_CAPABILITY,
    project,
    storyboard
  };
}

export function validateVideoAdapterPayload(payload) {
  if (!payload?.artifact || !payload?.playable) {
    return {ok:false,error:"Adapter did not return a playable artifact"};
  }
  if (payload.generationMode !== "live") {
    return {ok:false,error:"Adapter did not explicitly attest live generation"};
  }
  if (!payload.provider || !payload.providerJobId || !payload.requestId) {
    return {ok:false,error:"Adapter did not return complete provider provenance"};
  }
  return {ok:true};
}
