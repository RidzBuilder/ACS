# ACS Google Veo Runtime Configuration v1.0

Status: READY FOR CREDENTIAL INJECTION — NO SECRET STORED

## Canonical repository

- Repository: `RidzBuilder/ACS`
- Branch: `execution/acs-mep-a-e-20260919`

## Required secret

Set one server-side environment variable:

`GEMINI_API_KEY`

or:

`GOOGLE_API_KEY`

Do not put the key in GitHub, source files, browser code, or committed environment files.

## Optional implementation configuration

```
GOOGLE_VEO_MODEL=veo-3.1-generate-preview
GOOGLE_VEO_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_VEO_ASPECT_RATIO=9:16
GOOGLE_VEO_DURATION_SECONDS=8
GOOGLE_VEO_RESOLUTION=720p
GOOGLE_VEO_POLL_MS=10000
GOOGLE_VEO_ADAPTER_PORT=3010
```

## Non-generative readiness check

Run the adapter implementation and call:

`GET /health`

Expected with a configured credential:

- HTTP 200
- `ok: true`
- `apiKeyConfigured: true`
- capability = `real_ai_video_generation`
- adapter = `google-veo-adapter-v1`

This does not generate video.

## ACS wiring

Only after the non-generative configuration gate passes may the ACS runtime be pointed at:

`ACS_VIDEO_GENERATOR_URL=http://<adapter-host>:3010/adapter`

This variable is runtime configuration. It is not part of the Core Data Contract.

## Generation gate

`POST /adapter` invokes real Veo generation and is therefore prohibited during configuration/readiness verification. It becomes authorized only at Step 13 after the Account 2 gate and conformance gate are PASS.
