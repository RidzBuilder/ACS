# GAP-ACS-004 — HeyGen Provenance Execution Record

## Objective
Close the evidence gap by proving the causal chain:

ACS Runtime → capability resolution → HeyGen adapter → real HeyGen generation → provider video_id → real artifact → ACS validation → persisted result.

## Current execution
- ACS baseline branch: `execution/acs-mep-a-e-20260919`
- GAP execution branch: `execution/acs-gap-004-heygen-provenance-20260920`
- Live provider: HeyGen
- Provider-side video already completed: `5e64972e38f6772f8cae938c1583fb48`
- Provider artifact: MP4
- Provider-side completion is NOT by itself ACS provenance evidence.

## Runtime hardening performed
The ACS domain now propagates provenance into the adapter request and rejects a live artifact as PASS unless:
1. executionOrigin = `acs-runtime`
2. adapter = `heygen`
3. providerVideoId is present
4. artifact exists and is marked playable

## Blocking condition
A true end-to-end PASS still requires an executable HeyGen adapter endpoint that is actually invoked by the ACS runtime. The available HeyGen connector can generate real videos, but this execution environment does not expose that connector as a network endpoint that the Node runtime can call.

Therefore this record MUST NOT be used to close GAP-ACS-004 until the ACS-originated adapter invocation is captured.

## Decision
GAP-ACS-004 remains OPEN pending end-to-end adapter provenance evidence.
