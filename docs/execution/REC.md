# ACS Repository Execution Contract (REC) v1.0

## Purpose
Convert the canonical ACS blueprint into an executable repository contract without changing product semantics.

## Runtime
- Node.js runtime with ES modules.
- Start: `npm start`
- Test: `npm test`
- Syntax check: `npm run check`
- Default HTTP port: 3000.

## Golden Path
INPUT PRODUCT → PRODUCT UNDERSTANDING / CREATIVE DIRECTION → STORY / SCENE → STORYBOARD → VIDEO CAPABILITY RESOLUTION → VIDEO RESULT → AFFILIATE PACKAGE → PROJECT STATE.

## Runtime Surfaces
- `GET /health`
- `POST /api/projects`
- `GET /api/projects/:id`

## Video Capability Contract
- Required capability remains `real_ai_video_generation`.
- Provider is not part of the product contract.
- A live adapter may be supplied through `ACS_VIDEO_GENERATOR_URL`.
- Without a usable live capability, runtime returns explicit `fallback` and `not_live` state.
- Fallback must never be presented as a real generated video artifact.

## Persistence Boundary
The reference runtime currently uses in-memory project state for execution testing. Durable persistence is a remaining gap before production/contest-grade completion.

## Security
Secrets must be supplied through environment/runtime secret mechanisms; no credentials belong in source.
