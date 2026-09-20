# ACS MEP A–E Gap Register

| ID | Phase | Gap | Severity | Remediation | Status |
|---|---|---|---|---|---|
| GAP-ACS-001 | A/B | Repository had blueprint/docs but no executable runtime surface | BLOCKING | Add minimal executable runtime, package scripts, tests, CI | CLOSED |
| GAP-ACS-002 | B | No explicit repository execution contract | BLOCKING | Add REC defining runtime, golden path, capability and fallback behavior | CLOSED |
| GAP-ACS-003 | B/D | No executable proof for canonical golden path | BLOCKING | Add domain pipeline and acceptance tests | CLOSED |
| GAP-ACS-004 | B/D | Real live video capability, playable artifact, and ACS→provider provenance are not proven | BLOCKING FOR LIVE VIDEO | Execute any conforming live adapter through the provider-agnostic ACS contract, validate artifact/provenance, persist, re-test and re-audit | OPEN — LIVE ADAPTER EVIDENCE PENDING |
| GAP-ACS-005 | B/D | Durable project archive not implemented at baseline | HIGH | Implement file-backed canonical project store and retrieve by project ID without regeneration | CLOSED — RUNTIME EVIDENCE PASS |
| GAP-ACS-006 | E | No Emergent connector/action available in this execution environment | BLOCKING FOR E EXECUTION | Import canonical branch manually in Emergent or provide an available Emergent integration | OPEN |
| GAP-ACS-007 | E | External Emergent build/runtime evidence unavailable | BLOCKING FOR E PASS | Capture import/build/start/test/golden-path evidence from Emergent | OPEN |
| GAP-ACS-008 | Account 2 Forensic Re-evaluation | Live capability / universal media credit resolution ambiguity | BLOCKING FOR ACCOUNT 2 REPRODUCTION | Identify the causal source of LIVE vs FALLBACK and the origin/scope of the “Insufficient universal media credits” decision using non-generative evidence; classify account/project/environment/entitlement/adapter/provider scope; do not spend generation credits for diagnosis | OPEN — DECISION POINT UNRESOLVED |

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

## Account 2 Forensic Re-evaluation

### New observation
- Project #1 produced one observed live video.
- Subsequent newly created projects returned fallback with the message: `No live video was claimed — Insufficient universal media credits`.
- The same fallback behavior was observed after creating a new project in a new account.

### Repository evidence
- GitHub code search in `RidzBuilder/ACS` returned no occurrence of “Insufficient universal media credits”, “universal media credits”, or related credit/fallback search terms.
- The canonical `src/domain.js` fallback reason is “No usable live video generator configured.”, which is distinct from the observed message.

### Current classification
This finding is an execution/integration evidence ambiguity, not an ACS Core architecture failure. The causal decision point is not yet identified.

### Required non-generative verification
- Compare Project #1 live persisted metadata against Project #2 fallback metadata.
- Inspect runtime/environment capability-resolution inputs.
- Trace where the observed universal-media-credit message is generated.
- Determine whether the decision is account-, project-, environment-, entitlement-, adapter-, or provider-scoped.
- Verify whether `ACS_VIDEO_GENERATOR_URL` or an equivalent live capability is present and usable in the execution environment.
- Do not trigger additional video generation solely for diagnosis.

### Account 2 gate impact
Account 2 Reproduction & Evidence Integrity Readiness Gate remains **HOLD / BLOCKED PENDING DECISION-POINT IDENTIFICATION** until the ambiguity is causally resolved sufficiently for controlled reproduction.

A PASS may only be recorded when the gate requirements are independently evidenced in Account 2.