# ACS Google Veo Adapter Contract v1.0

Status: IMPLEMENTATION-LAYER CONTRACT — NOT CORE ARCHITECTURE

## Scope

This document defines a Google Veo implementation behind the locked ACS provider-neutral boundary.

Core remains unchanged:

- capability: `real_ai_video_generation`
- adapter boundary: `acs-video-adapter-v1`
- provider identity, API endpoint, credential, model, polling and media transport remain implementation/runtime concerns.

## Official capability mapping

Google documents Veo 3.1 as programmatically accessible through the Gemini API. Current documented generation units are 4, 6 or 8 seconds; 9:16 and 16:9 are supported; image-to-video and video extension are supported. Veo extension can add 7 seconds up to 20 times, with documented input/output constraints.

ACS therefore maps:

`real_ai_video_generation`
→ `acs-video-adapter-v1`
→ `google-veo-adapter-v1`
→ Gemini API / Veo 3.1

No Google provider field is added to the ACS Core Data Contract.

## Runtime configuration

Secrets MUST NOT be committed.

Supported runtime configuration:

- `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- `GOOGLE_VEO_MODEL` (default: `veo-3.1-generate-preview`)
- `GOOGLE_VEO_BASE_URL` (default: `https://generativelanguage.googleapis.com/v1beta`)
- `GOOGLE_VEO_ASPECT_RATIO` (default: `9:16`)
- `GOOGLE_VEO_DURATION_SECONDS` (default: `8`)
- `GOOGLE_VEO_RESOLUTION` (default: `720p`)
- `GOOGLE_VEO_POLL_MS` (default: `10000`)
- `GOOGLE_VEO_ADAPTER_PORT` (default: `3010`)

Google's current API-key guidance recommends environment variables and prohibits committing API keys to source control.

## Execution boundary

The implementation server exposes:

- `GET /health` — non-generative configuration/credential-presence check.
- `POST /adapter` — generation endpoint. This endpoint is generation-capable and MUST NOT be invoked during readiness/credential verification.

The adapter returns the canonical provider-neutral fields:

- `contract`
- `requestId`
- `capability`
- `provider`
- `providerJobId`
- `generationMode`
- `artifact`
- `playable`
- `provenance`

## Evidence classification

- Adapter code/configuration = implementation evidence.
- Contract tests = conformance evidence, not live-provider evidence.
- `GET /health` with configured credential presence = configuration evidence, not live-provider evidence.
- A real ACS → adapter → Google → playable artifact chain is required for GAP-ACS-004 closure.

## No automatic generation

Adding this adapter does not authorize real generation. Real E2E execution remains a separate gated step.
