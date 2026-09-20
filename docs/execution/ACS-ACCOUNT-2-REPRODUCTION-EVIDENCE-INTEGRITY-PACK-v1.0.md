# ACS Account 2 Reproduction & Evidence Integrity Pack v1.1

Status: LOCK CANDIDATE — FORENSIC UPDATE
Source repository: RidzBuilder/ACS
Baseline branch: execution/acs-mep-a-e-20260919

## Purpose
Transfer verified Account 1 implementation knowledge and evidence into Account 2 for reproduction and evidence-integrity verification. This pack is not authorization to redesign ACS or add features.

## Locked invariants
- No new branch for this readiness gate.
- No research ulang.
- No architecture redesign.
- Capability > Provider.
- Blueprint > Implementation.
- Semantic Contract > Technical Architecture.
- Core capability: real_ai_video_generation.
- Provider-neutral boundary: acs-video-adapter-v1.
- Provider-specific implementations remain behind the adapter boundary.
- Emergent is an execution environment, not architecture source of truth.
- Honest fallback remains mandatory.
- Direct provider jobs outside ACS do not close GAP-ACS-004.
- No credit-consuming experimentation for discovery already established in Account 1.
- No generation solely to diagnose the new credit/fallback observation.

## Account 1 verified evidence
### EVID-01 — Live video
A real live video artifact was generated for the Golden Project. Verified observation: approximately 15 seconds. This is evidence of a working live-duration observation, not proof of arbitrary duration.

### EVID-02 — Playback
The generated video is playable in ACS.

### EVID-03 — Download
The generated video is now downloadable from the project. UX verification confirmed successful download.
Open delivery finding: downloaded artifact is currently .webm. Required delivery target for cross-platform sharing: MP4.

### EVID-04 — Semantic propagation
Account 1 audit and UX verification indicate Product Intelligence / Creative Context now propagates into Caption and CTA without video regeneration. Caption and CTA are treated as PASS and are a regression baseline for Account 2.

### EVID-05 — JSON export
Emergent audit verified complete canonical export (acs-project-export-v1) and a 3.8 MB Azarine export without truncation. JSON remains a preserved/internal artifact capability, not the primary UX output for current ACS.

### EVID-06 — Independent audit
Emergent reported independent verification: 20/20 checks passed, with zero generation credits consumed for the output-integrity audit and no provider, adapter, or locked-core architecture changes.

## EVID-07 — New forensic observation
Account 1 UX observation:
1. Project #1 produced a live video.
2. Subsequent newly created projects produced fallback with the message:
   `No live video was claimed — Insufficient universal media credits`
3. The same fallback behavior was subsequently observed after creating a new project in a new account.

## Forensic comparison result
- Project #1 LIVE is a verified observation.
- Project #2 FALLBACK and new-account project FALLBACK are verified observations.
- The exact phrase “Insufficient universal media credits” is not present in the canonical ACS repository code search results.
- Canonical `src/domain.js` uses a different fallback reason: “No usable live video generator configured.”
- Therefore the origin and scope of the universal-media-credit decision are not established from the canonical ACS repository alone.

## GAP-ACS-008
**Live Capability / Universal Media Credit Resolution Ambiguity**

Status: **OPEN — BLOCKING FOR ACCOUNT 2 REPRODUCTION UNTIL DECISION POINT IS IDENTIFIED**

Classification: execution/integration evidence gap, not ACS Core architecture failure.

## Required no-generation verification
Before Account 2 readiness may be marked PASS:
- Compare persisted Project #1 live metadata against Project #2 fallback metadata.
- Inspect runtime/environment capability-resolution inputs.
- Trace where the observed universal-media-credit message is produced.
- Determine whether the check is account-, project-, environment-, entitlement-, adapter-, or provider-scoped.
- Verify `ACS_VIDEO_GENERATOR_URL` or equivalent live capability configuration in the relevant execution environment.
- Do not trigger additional AI video generation solely for diagnosis.

If remaining verification requires generation-credit spend, stop and classify BLOCKED pending explicit authorization.

## Existing open findings
### OPEN-01 — MP4 delivery
Verify whether the existing downloadable artifact path can produce/convert/expose the existing video as MP4 without AI regeneration. Do not spend generation credits. If conversion requires generation or material credit use, stop and request authorization.

### OPEN-02 — Duration capability discovery
Do not assume a 12-second maximum. Account 1 provides a verified approximately 15-second observation. Account 2 must inspect runtime/provider capability and determine supported durations empirically and non-generatively where possible. Candidate validation targets: 30s, 60s, 120s, 180s. These are validation targets, not pre-claimed capabilities.

## Account 2 gate
The Account 2 gate has only two outcomes:
PASS or BLOCKED.

PASS requires:
1. Exact repository/branch import integrity.
2. Evidence Pack and execution contracts readable and preserved.
3. No contradiction with locked ACS architecture.
4. Reproducibility path is identifiable.
5. Open findings have a concrete non-generative verification/remediation path.
6. Credit budget remains protected.
7. GAP-ACS-008 has been causally identified or otherwise resolved sufficiently for controlled reproduction.

BLOCKED if any blocker prevents controlled reproduction without architectural drift or unnecessary credit use.

## Post-gate execution
If PASS:
IMPORT -> INSPECT -> INSTALL/BUILD -> TEST -> CHECK -> START -> HEALTH -> GOLDEN PATH -> DURATION CAPABILITY DISCOVERY -> OUTPUT/CONFORMANCE.

If BLOCKED:
Document the exact blocker, classify it, perform only the minimum authorized non-generative verification/remediation, then re-run the affected gate.

## Credit policy for Account 2
Starting balance target: ~110 credits.
Build/test ceiling target: ~60 credits.
Publishing reserve: 50 credits.
The 60-credit value is a ceiling/budget constraint, not a spending target. Do not deliberately consume unused budget.

## Deferred capability
Long-video support (e.g. 60–180s) remains an open capability-validation subject. If the available adapter/provider supports only shorter segments, a future compiler/segment orchestration path may be evaluated:
requested duration -> segmentation -> continuity/state -> segment generation -> assembly.
This is not authorized for implementation in the readiness gate unless required and separately approved.

## Evidence handling
Evidence in this pack documents Account 1 observations plus the new forensic observation. Account 2 must independently verify reproducibility; PASS must not be inherited automatically from Account 1.