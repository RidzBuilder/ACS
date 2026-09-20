# ACS Output Integrity Audit + Minimal Remediation

Date: 2026-09-20  
Scope: existing implementation only  
Credit-consuming generation: none  
Architecture: unchanged (`real_ai_video_generation` → `acs-video-adapter-v1`)

## 1. Executive Result

| Audit | Before remediation | Final |
|---|---|---|
| AUDIT-01 — Video artifact downloadability | PARTIAL | PASS |
| AUDIT-02 — Product intelligence → Caption / CTA | FAIL | PASS |
| AUDIT-03 — Complete JSON export integrity | PARTIAL | PASS |

The three symptoms did not have one shared root cause. AUDIT-01 was an artifact-exposure/UI contract omission. AUDIT-02 was semantic-state reduction plus a downstream consumer that ignored creative context. AUDIT-03 had no byte-level JSON truncation; it exported a rehydrated UI result without an explicit canonical export contract or related persistence metadata, and inherited the semantic omissions from AUDIT-02.

## 2. AUDIT-01 — Video Downloadability

### Evidence
- Existing artifact: `f28fb089-c1a1-4d1f-8d14-e9d74ebd0229.webm`.
- Project: `d8c5c6a5-06ba-48e8-a496-9f4499efe231`.
- Artifact was stored locally, associated with the correct project, restored after restart, served as `video/webm`, and supported byte ranges.
- Before remediation the result UI contained a player and JSON button but zero video-download controls.
- `?download=1` returned no `Content-Disposition` before remediation.

### Failure boundary
`persisted video.artifact` → `resultTemplate`: playback consumed the artifact, but the UI exposed no download action and static delivery had no attachment response mode.

### Root cause
The implementation treated a playable URL as sufficient output exposure. Download semantics were never mapped into the result UI or static artifact response.

### Minimal remediation
- Reused the existing durable artifact; no regeneration.
- Added an attachment mode to the existing static artifact route using `download=1` and a sanitized filename.
- Added one `download-video-button` linked to the existing persisted artifact.

### Verification
- Browser download completed as `acs-timeout-recovery-evidence.webm`.
- Downloaded bytes exactly matched the stored artifact.
- SHA-256: `b141a0be51671be2225641d74b9ed24a5f8cfdd0ef50da541966a8722d06ea3d`.
- MIME `video/webm`, valid WebM magic `1a45dfa3`, attachment header, HTTP 206 range support, and restart/restore all passed.

## 3. AUDIT-02 — Product Intelligence Semantic Propagation

### Source state
The existing Azarine project already contained rich source semantics in `productDescription` and `creativeInstruction`: exact identity, category, Bakuchiol/Peptide and other ingredients, visible claims, packaging facts, creator persona, tone, hook, buyer intent, CTA dialogue, platform, scenes, and negative constraints.

### Pre-remediation transformation chain
`createProject` retained only broad project fields and raw text. `deriveCreative` replaced detailed direction with content-type templates. `buildStoryboard` used generic scenes. `buildAffiliatePackage(project, creative)` did not consume `creative` and generated Caption/CTA from only product name, content type, platform, and language.

Confirmed pattern before remediation:

`PRODUCT NAME + CONTENT TYPE + PLATFORM → GENERIC TEMPLATE → GENERIC CAPTION + GENERIC CTA`

### Semantic trace

| Source field | Transformation | Destination | Present? | Preserved? | Original loss point | Root cause |
|---|---|---|---|---|---|---|
| Product identity | `Name:` / supplied name normalization | `productIntelligence.canonicalProductName`, package name/caption | Yes | Yes | `createProject` previously kept only broad name | No product-understanding state |
| Product category | Category normalization | intelligence, creative angle, caption/export | Yes | Yes | Discarded after raw input | Missing field mapping |
| Verified attributes | Visible-claim normalization | intelligence/export; safe detail fallback | Yes | Yes | Raw prompt only | Missing semantic state |
| Ingredients | Key-ingredient/description normalization | intelligence and caption | Yes | Yes | Raw prompt not consumed | Affiliate generator ignored product context |
| Visible claims | Claim normalization | intelligence/export | Yes | Yes | Raw prompt only | Missing field mapping |
| Creative direction | Structured extraction from supplied instruction | creative context/package | Yes | Yes | `deriveCreative` replaced it with generic templates | Generic template override |
| Content type | Direct project field | creative/storyboard/caption | Yes | Yes | Not lost | Existing mapping retained |
| Content angle | Video-type/explicit angle normalization | creative angle and caption | Yes | Yes | Not passed to package | Incomplete function consumption |
| Hook | First intended dialogue/explicit hook | intelligence, future creative/storyboard, caption | Yes | Yes | Replaced by generic hook | Generic creative derivation |
| Buyer intent | CTA dialogue/explicit field normalization | audience context and CTA | Yes | Yes | Not represented | Missing semantic state |
| Platform/context | Direct project field | objective and caption | Yes | Yes | Not lost | Existing mapping retained |
| CTA strategy | Intended CTA dialogue | intelligence, future creative, final CTA | Yes | Yes | Replaced by static CTA | Affiliate generator ignored creative context |
| Scene intent | Existing storyboard scene | caption context | Yes | Yes | Not consumed by package | Incomplete function parameters |
| Creator persona/tone | Prompt section normalization | intelligence, future creative, caption tone | Yes | Yes | Raw prompt only | Missing field mapping |
| Packaging information | Prompt section normalization | intelligence/export | Yes | Yes | Raw prompt only | Missing semantic state |
| Negative constraints | Prompt section normalization | intelligence/export, excluded from public caption | Yes | Yes | Raw prompt only | No normalized safety context |

### Minimal remediation
- Added deterministic normalization of existing supplied semantics into `project.productIntelligence`.
- Made `deriveCreative`, new storyboards, and `buildAffiliatePackage` consume that state.
- Added a versioned, non-video migration for existing persisted results. It updates semantic state/package only; existing video, provider job, storyboard ID, artifact, and `regenerationCount` remain unchanged.

### Existing Azarine evidence
- Caption now preserves exact product identity, Bakuchiol, Peptide, natural/conversational UGC angle, authentic creator approach, TikTok context, and scene focus.
- CTA remains the supplied recommendation-style intent: `Kalau kamu lagi cari serum buat perawatan anti-aging, boleh cek yang ini.`
- Existing provider job remains `01a0be89-4214-7680-81a5-8ac49b021a77`; storyboard remains `d8e99a45-8e8d-480d-a8cc-36a88520395f`; regeneration count remains `1`.

## 4. AUDIT-03 — JSON Export Integrity

### Canonical state vs downloaded state before remediation
- The current small-project browser file was valid JSON.
- Canonical project and downloaded file had identical root/path sets: project, creative, storyboard, video, affiliatePackage, execution, ownerId.
- No byte/path truncation was reproduced; the only canonical/API difference was the expected rehydration flag `execution.restored`.
- The actual defect was contract completeness: the frontend serialized `state.currentResult`, not an explicit canonical export. Related generation-job persistence metadata was outside that object, and product intelligence/provenance were not explicit export sections.

### Exact boundary
`canonical project + related generation job` → `GET project rehydrated view` → `state.currentResult` → `JSON.stringify`.

`JSON.stringify` and Blob construction did not truncate data. The wrong source projection was exported, and the pre-existing semantic state was incomplete.

### Minimal remediation
- Added authenticated `GET /api/projects/:id/export` with contract `acs-project-export-v1`.
- Export includes the complete canonical result plus explicit root `productIntelligence`, root `provenance`, and `exportMetadata.persistence` with stored project ID, owner, stored timestamp, and generation-job metadata.
- Frontend now fetches this contract and revokes the Blob URL after a safe delay instead of immediately.

### Verification
- UI-downloaded JSON is valid and contains all required root sections.
- Existing Azarine export returned 3,807,758 bytes as valid JSON with 4 product images, the full 5,331-character creative instruction, intelligence, caption, CTA, artifact, provider job, timestamps, and regeneration metadata.
- No response-size, serialization, browser Blob, or persistence truncation occurred.

## 5. Cross-Audit

**Shared root cause: NO.**

- AUDIT-01 was independent: artifact exposure/download response semantics were missing.
- AUDIT-02 was a semantic transformation/consumer failure.
- AUDIT-03 was an export projection/contract failure, although its perceived incompleteness was amplified by AUDIT-02's upstream semantic loss.
- Persistence itself retained raw product description/instruction and artifact references; different output paths consumed different subsets of that state.

## 6. Test Plan and Results

1. Read-only restore and artifact association checks.
2. HEAD/full/range artifact checks and byte/hash identity.
3. Browser video and JSON download checks.
4. Field-level Azarine semantic assertions.
5. Two-product caption/CTA differentiation unit test.
6. Migration invariants for video, storyboard, provenance, and regeneration count.
7. Canonical export schema and 3.8 MB large-project integrity test.
8. Tenant-isolation regression: demo user remains blocked; existing owner session can read/export.
9. Provider-neutral core contract checks.

Final independent results: 8/8 Node tests, 9/9 focused integrity tests, and 3/3 tenant-isolation tests passed. No generation endpoints were called.

## 7. Remediation Plan

Completed minimal remediation only:
1. Expose existing artifact as an attachment and add download control.
2. Normalize/persist existing product intelligence and consume it downstream.
3. Migrate stored semantic/package output without regenerating video.
4. Define and consume a complete canonical JSON export contract.

## 8. Files / Components Changed

- `src/domain.js` — semantic normalization, propagation, and versioned migration.
- `src/server.js` — migration, attachment headers, canonical export endpoint.
- `frontend/public/templates.js` — existing artifact download control.
- `frontend/public/app.js` — canonical JSON export download.
- `test/acceptance.test.js` — non-generative semantic and migration tests.
- `backend/tests/test_audit_readonly_integrity.py` — read-only integrated audit tests.
- `backend/tests/test_tenant_isolation_readonly.py` — ownership regression.

## 9. Files / Components Not Changed

- `src/video-adapter.js`.
- `backend/server.py` provider implementation.
- Video provider, model, credentials, queue, and artifact generation path.
- Locked capability identity and adapter boundary.
- Existing video artifacts and provider jobs.
- Authentication/tenant authorization rules.

## 10. Credit Impact

- Current audit cost: **0 video-generation credits**.
- Remediation verification used only existing artifacts, persisted projects, pure unit tests, and read-only API/browser operations.
- Required additional generation cost: **none**.

## 11. Final Gate

**PASS**