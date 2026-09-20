# ACS Repository Execution Contract (REC) v1.3

## Purpose
Convert the canonical ACS blueprint into an executable repository contract without changing product semantics.

## Runtime
- Node.js runtime with ES modules.
- Start: `npm start`
- Test: `npm test`
- Syntax check: `npm run check`
- Default HTTP port: 3000.
- Project state is persisted through the file-backed runtime store configured by `ACS_DATA_DIR` / `ACS_DATA_FILE`.

## Golden Path
INPUT PRODUCT → PRODUCT UNDERSTANDING / CREATIVE DIRECTION → STORY / SCENE → STORYBOARD → VIDEO CAPABILITY RESOLUTION → PROVIDER-AGNOSTIC VIDEO ADAPTER CONTRACT → VIDEO RESULT → AFFILIATE PACKAGE → PROJECT STATE.

## Runtime Surfaces
- `GET /health`
- `POST /api/projects`
- `GET /api/projects/:id`

No provider-specific HTTP route is part of the ACS core runtime contract.

## Video Capability Contract
- Required capability remains `real_ai_video_generation`.
- Provider is not part of the product contract.
- The runtime may call a configured implementation through `ACS_VIDEO_GENERATOR_URL`.
- The adapter boundary is `acs-video-adapter-v1`.
- Contract definition lives in `src/video-adapter.js`.
- ACS sends a unique `requestId` in both the request body and `x-acs-request-id` header.
- A successful live adapter response MUST contain: `provider`, `providerJobId`, `requestId`, `generationMode: "live"`, `artifact`, and `playable: true`.
- ACS preserves provider job identity and adapter provenance in the persisted video result.
- Provider/model/API/SDK details belong behind the adapter boundary and are not prescribed by ACS.
- Without a usable live capability, runtime returns explicit `fallback` and `not_live` state.
- Fallback must never be presented as a real generated video artifact.
- Contract tests may validate the adapter boundary, but they do NOT constitute live-provider evidence.

## Adapter-Agnostic Resolution
The implementation sequence is:
1. Discover available platform/native capabilities.
2. Select an implementation that satisfies `real_ai_video_generation`.
3. Invoke it through `acs-video-adapter-v1`.
4. Validate the returned artifact.
5. Persist provider provenance as execution metadata.

A provider-specific adapter may exist as an external or implementation-level plugin, but adding a provider to the ACS core is not required for the product contract.

## Persistence Boundary
The reference runtime uses a file-backed project store for execution testing and restart recovery.

## Security
Secrets must be supplied through environment/runtime secret mechanisms; no credentials belong in source.
