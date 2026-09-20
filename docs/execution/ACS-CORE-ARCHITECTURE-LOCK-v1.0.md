# ACS Core Architecture Lock v1.0

Status: **LOCKED**
Date: 2026-09-20
Branch: `execution/acs-mep-a-e-20260919`

## Locked architectural invariants

1. **Capability over provider** — ACS Core requires `real_ai_video_generation`; it does not require HeyGen, Higgsfield, Veo, or another named provider.
2. **Provider-neutral adapter boundary** — `acs-video-adapter-v1` is the sole contract between ACS Core and a live video implementation.
3. **Provider is implementation metadata** — provider name, model, SDK, API, credentials, polling/webhook mechanics and provider-specific schemas remain behind the adapter boundary.
4. **Emergent is an execution environment** — Emergent may select and implement any available capability that conforms to the contract; it does not redefine ACS architecture.
5. **Honest fallback** — when no live capability is available, ACS returns explicit fallback/not-live state.
6. **Live evidence remains separate** — architecture conformance does not constitute real-provider evidence. GAP-ACS-004 remains open until a real ACS causal chain produces a playable artifact and complete provenance.
7. **No provider-specific core route** — provider adapters must not be exposed as required ACS Core HTTP surfaces.
8. **No feature expansion** — provider integration is evidence/implementation work, not permission to add unrelated product behavior.

## Conformance evidence

- Adapter contract introduced in `src/video-adapter.js`.
- Domain uses the generic contract.
- Provider-specific Higgsfield route/adapter removed from Core.
- Acceptance suite reconstructed from the branch passed: **5/5**.
- Syntax checks passed for domain, server and generic adapter.
- Contract test uses a synthetic provider-neutral implementation and explicitly records `liveEvidence: false`.
- No HeyGen/Higgsfield/Veo implementation is selected as the architectural default.

## Gate

**ACS CORE ARCHITECTURE = LOCKED**

Next gate: **Emergent Build Readiness / Capability Discovery**.

The next gate may select a provider or native capability only as an implementation choice, and only after inspecting what the Emergent environment actually provides.
