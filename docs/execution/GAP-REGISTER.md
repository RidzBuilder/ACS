# ACS MEP A–E Gap Register

| ID | Phase | Gap | Severity | Remediation | Status |
|---|---|---|---|---|---|
| GAP-ACS-001 | A/B | Repository had blueprint/docs but no executable runtime surface | BLOCKING | Add minimal executable runtime, package scripts, tests, CI | CLOSED |
| GAP-ACS-002 | B | No explicit repository execution contract | BLOCKING | Add REC defining runtime, golden path, capability and fallback behavior | CLOSED |
| GAP-ACS-003 | B/D | No executable proof for canonical golden path | BLOCKING | Add domain pipeline and acceptance tests | CLOSED |
| GAP-ACS-004 | B/D | Real live video capability, playable artifact, and ACS→provider provenance are not proven | BLOCKING FOR LIVE VIDEO | Configure a real ACS live adapter bridge, invoke the golden path, validate playable artifact, persist provider job identity and provenance, then re-test | OPEN — BRIDGE RUNTIME EVIDENCE PENDING |
| GAP-ACS-005 | B/D | Durable project archive not implemented at baseline | HIGH | Implement file-backed canonical project store and retrieve by project ID without regeneration | CLOSED — RUNTIME EVIDENCE PASS |
| GAP-ACS-006 | E | No Emergent connector/action available in this execution environment | BLOCKING FOR E EXECUTION | Import canonical branch manually in Emergent or provide an available Emergent integration | OPEN |
| GAP-ACS-007 | E | External Emergent build/runtime evidence unavailable | BLOCKING FOR E PASS | Capture import/build/start/test/golden-path evidence from Emergent | OPEN |

## GAP-ACS-004 closure gate

All conditions below are mandatory and must be evidenced from the same ACS execution chain:

1. **ACS invocation** — an ACS runtime request enters the golden path.
2. **Bridge invocation** — ACS calls a configured live adapter endpoint using `acs-video-adapter-v1`.
3. **Real provider job** — the bridge invokes Higgsfield and returns the actual provider job ID.
4. **Real artifact** — the provider produces a real playable video artifact.
5. **Artifact validation** — ACS receives `artifact` + `playable: true`.
6. **Provenance** — ACS result preserves `requestId`, `provider`, `providerJobId`, and bridge/provider provenance.
7. **Persistence** — the completed result is archived without regeneration.
8. **Re-test** — repeat the execution path and verify the same contract.
9. **Re-audit** — only after evidence 1–8 exist may GAP-ACS-004 move to CLOSED.

A direct Higgsfield job created outside the ACS runtime does **not** close GAP-ACS-004.

## Current remediation state

- ACS-side adapter contract: IMPLEMENTED.
- ACS-side provenance preservation: IMPLEMENTED.
- Contract-level adapter test: PASS (synthetic endpoint only; not live evidence).
- Real Higgsfield provider capability: VERIFIED AVAILABLE in the connected environment.
- ACS→Higgsfield bridge endpoint: IMPLEMENTED in ACS as `POST /api/adapters/higgsfield` and backed by the official Higgsfield API.
- Bridge requires server-side `HF_API_KEY_ID` + `HF_API_KEY_SECRET` and Genjutsu reference media; credentials are not stored in source.
- Runtime configuration target: `ACS_VIDEO_GENERATOR_URL=https://<acs-host>/api/adapters/higgsfield`.
- Real provider execution and artifact evidence are still pending until the runtime is deployed with valid API credentials and a real Genjutsu reference video/product image.
- Therefore GAP-ACS-004 remains OPEN.

## Re-test interpretation
GAP-ACS-005 runtime evidence: GitHub Actions run 35482296439 completed successfully. The workflow executed npm test, syntax checks, wrote a project, stopped the server, restarted it, restored the same project ID, verified unchanged updatedAt and byte-equivalent stored result, and explicitly rejected an unexpected live-generation claim. This closes GAP-ACS-005 for the current reference runtime.

The adapter contract test added in this remediation validates request/response shape and provenance preservation only. It must not be represented as real provider evidence.
