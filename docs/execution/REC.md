# ACS Repository Execution Contract (REC) v1.2

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
INPUT PRODUCT → PRODUCT UNDERSTANDING / CREATIVE DIRECTION → STORY / SCENE → STORYBOARD → VIDEO CAPABILITY RESOLUTION → LIVE VIDEO ADAPTER → VIDEO RESULT → AFFILIATE PACKAGE → PROJECT STATE.

## Runtime Surfaces
- `GET /health`
- `POST /api/projects`
- `GET /api/projects/:id`
- `POST /api/adapters/higgsfield` — ACS-callable live Higgsfield Genjutsu bridge

## Video Capability Contract
- Required capability remains `real_ai_video_generation`.
- Provider is not part of the product contract.
- A live adapter may be supplied through `ACS_VIDEO_GENERATOR_URL`.
- The adapter contract is `acs-video-adapter-v1`.
- ACS sends a unique `requestId` in both the request body and `x-acs-request-id` header.
- A successful live adapter response MUST contain: `provider`, `providerJobId`, `requestId`, `generationMode: "live"`, `artifact`, and `playable: true`.
- ACS preserves provider job identity and adapter provenance in the persisted video result.
- Without a usable live capability, runtime returns explicit `fallback` and `not_live` state.
- Fallback must never be presented as a real generated video artifact.
- Contract tests may validate the adapter boundary, but they do NOT constitute live-provider evidence.

## Higgsfield Bridge Runtime
- The repository now exposes a real ACS-callable bridge at `POST /api/adapters/higgsfield`.
- The bridge uses the official Higgsfield API at `https://api.higgsfield.ai` and the Genjutsu Motion Transfer model `higgsfiled/genjutsu/motion-transfer/v1.0`.
- Provider credentials are server-side only: `HF_API_KEY_ID` and `HF_API_KEY_SECRET`.
- The bridge requires `referenceVideoUrl` on the project or `ACS_HIGGSFIELD_REFERENCE_VIDEO_URL` plus at least one HTTPS product image.
- Higgsfield generation is asynchronous; the bridge submits the provider request, polls the provider status, and returns the completed video URL with the real Higgsfield request ID as `providerJobId`.
- `ACS_VIDEO_GENERATOR_URL` can point to the deployed ACS bridge route, for example `https://<acs-host>/api/adapters/higgsfield`.
- The bridge must not expose provider credentials to the client or repository.

## Higgsfield Bridge Requirement
For the current live-video closure, the configured adapter endpoint must be a real bridge that:
1. receives the ACS `acs-video-adapter-v1` request;
2. invokes Higgsfield as the actual generation provider;
3. obtains the real provider job identifier;
4. waits for/observes completion;
5. returns a real playable artifact;
6. returns provenance linking the ACS `requestId` to the Higgsfield `providerJobId`.

A direct Higgsfield generation performed outside the ACS execution path does not satisfy this contract.

## Persistence Boundary
The reference runtime uses a file-backed project store for execution testing and restart recovery. Durable project archive evidence is tracked separately in GAP-ACS-005.

## Security
Secrets must be supplied through environment/runtime secret mechanisms; no credentials belong in source.
