# ACS MEP A–E Gap Register

| ID | Phase | Gap | Severity | Remediation | Status |
|---|---|---|---|---|---|
| GAP-ACS-001 | A/B | Repository had blueprint/docs but no executable runtime surface | BLOCKING | Add minimal executable runtime, package scripts, tests, CI | CLOSED |
| GAP-ACS-002 | B | No explicit repository execution contract | BLOCKING | Add REC defining runtime, golden path, capability and fallback behavior | CLOSED |
| GAP-ACS-003 | B/D | No executable proof for canonical golden path | BLOCKING | Add domain pipeline and acceptance tests | CLOSED |
| GAP-ACS-004 | B/D | Real live video capability, playable artifact, and ACS→provider provenance were not proven | BLOCKING FOR LIVE VIDEO | Execute a conforming live adapter through the provider-agnostic ACS contract, validate artifact/provenance, persist, re-test and re-audit | CLOSED — ACS JOB `c2ac8f38-439a-47a3-836b-354b49cc9f4b`, PROVIDER JOB `01a0be69-c850-7670-bc0d-4510c85cc94f`, PLAYABLE WEBM VERIFIED 2026-09-20 |
| GAP-ACS-005 | B/D | Durable project archive not implemented at baseline | HIGH | Implement file-backed canonical project store and retrieve by project ID without regeneration | CLOSED — RUNTIME EVIDENCE PASS |
| GAP-ACS-006 | E | No Emergent connector/action available in the prior execution environment | BLOCKING FOR E EXECUTION | Execute the canonical branch in an Emergent workspace | CLOSED — EXECUTED IN EMERGENT 2026-09-20 |
| GAP-ACS-007 | E | External Emergent build/runtime evidence unavailable in the prior audit | BLOCKING FOR E PASS | Capture import/build/start/test/golden-path evidence from Emergent | CLOSED — EVIDENCE CAPTURED 2026-09-20 |

## Adapter-Agnostic Architecture Re-Audit

### Findings
- Core capability remains `real_ai_video_generation`.
- Core runtime resolves a generic `ACS_VIDEO_GENERATOR_URL`, not a named provider.
- The previous execution branch contained a provider-specific Higgsfield bridge and provider-specific runtime route.
- That bridge/route was implementation-specific and unnecessarily coupled the reference branch to one provider.
- The canonical blueprint explicitly states that provider selection belongs to implementation while the product contract remains provider-agnostic.
- `AGENTS.md` also states: do not lock the product to a specific AI/video provider.

### Remediation executed
1. Introduced `src/video-adapter.js` as the provider-neutral adapter boundary.
2. Moved adapter request construction and response validation into the generic contract layer.
3. Removed the provider-specific Higgsfield runtime route from `src/server.js`.
4. Removed the provider-specific Higgsfield adapter from the ACS core branch.
5. Converted contract tests to use a synthetic provider-neutral adapter response.
6. Updated REC and gap semantics so live evidence can be supplied by any conforming adapter.
7. Preserved provider identity only as runtime provenance metadata after adapter execution.

### Architectural rule
**ACS core defines capability and adapter contract. Provider adapters are plug-ins/implementation choices.**

HeyGen, Higgsfield, Veo, or another platform may be used later as evidence adapters, but none is the architectural default.

## GAP-ACS-004 closure gate

All conditions below are mandatory and must be evidenced from the same ACS execution chain:

1. **ACS invocation** — an ACS runtime request enters the golden path.
2. **Adapter invocation** — ACS calls a configured implementation using `acs-video-adapter-v1`.
3. **Real provider job** — the selected adapter invokes an actual provider capability and returns the real provider job identity.
4. **Real artifact** — the provider produces a real playable video artifact.
5. **Artifact validation** — ACS receives `artifact` + `playable: true`.
6. **Provenance** — ACS result preserves `requestId`, provider identity, provider job identity and adapter provenance.
7. **Persistence** — the completed result is archived without regeneration.
8. **Re-test** — repeat the execution path and verify the same contract.
9. **Re-audit** — only after evidence 1–8 exist may GAP-ACS-004 move to CLOSED.

A direct provider job created outside the ACS execution path does not close GAP-ACS-004.
