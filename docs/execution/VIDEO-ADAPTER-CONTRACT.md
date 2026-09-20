# ACS Video Adapter Contract v1

## Purpose
Define the provider-neutral boundary used by ACS to satisfy the `real_ai_video_generation` capability.

## Core rule
ACS specifies **what capability is required**, not which provider supplies it.

The following are implementation choices and MUST remain behind the adapter boundary:
- provider name and model;
- provider SDK/API;
- provider authentication;
- provider endpoint;
- provider-specific request schema;
- polling/webhook mechanics;
- provider-specific media preparation.

## Request

```json
{
  "contract": "acs-video-adapter-v1",
  "requestId": "<unique ACS request id>",
  "capability": "real_ai_video_generation",
  "project": {},
  "storyboard": {}
}
```

## Required response for live generation

```json
{
  "provider": "<implementation provider>",
  "providerJobId": "<real provider job id>",
  "requestId": "<same ACS request id>",
  "generationMode": "live",
  "artifact": "<playable artifact reference>",
  "playable": true,
  "provenance": {}
}
```

## Invariants
1. `requestId` must correlate the ACS request to the adapter result.
2. `generationMode=live` must not be asserted for mocks or synthetic artifacts.
3. `playable=true` requires a real artifact suitable for the declared video result.
4. Provider identity is provenance metadata, not a product-level dependency.
5. An adapter may be implemented by Emergent, an external service, a native platform capability, or another runtime mechanism.
6. ACS must remain executable when no live adapter is available by returning an explicit fallback state.
7. A direct provider job outside ACS does not constitute ACS live-generation evidence.

## Evidence model

The same contract supports multiple implementations:

```text
ACS
  ↓
real_ai_video_generation
  ↓
acs-video-adapter-v1
  ├── HeyGen plugin
  ├── Higgsfield plugin
  ├── Veo/native platform plugin
  └── Emergent-native implementation
```

The branch intentionally does not select one of these as the architectural default.
