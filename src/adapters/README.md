# ACS Live Video Adapter Contract

The ACS runtime invokes a configured live video adapter through `ACS_VIDEO_GENERATOR_URL`.

Request:
- capability: `real_ai_video_generation`
- project: canonical ACS project
- storyboard: canonical ACS storyboard
- provenance.executionOrigin: `acs-runtime`
- provenance.adapter: `heygen`

Required response for a live PASS:
- playable: true
- artifact: real playable video artifact
- provenance.executionOrigin: `acs-runtime`
- provenance.adapter: `heygen`
- provenance.providerVideoId: actual HeyGen video id

The adapter MUST call the real HeyGen capability. Returning a prerecorded/static artifact or a provider id unrelated to the incoming ACS request is non-conformant.

This contract intentionally keeps provider implementation outside the ACS product contract.
