# Affiliate AI Content Studio V3 — Product Record

## Original Problem Statement
Build, run, validate, and demonstrate the existing ACS architecture as a full-stack AI Agent application in Emergent. Preserve the locked provider-agnostic ACS Core, canonical capability `real_ai_video_generation`, adapter boundary `acs-video-adapter-v1`, complete product-to-storyboard-to-video-to-affiliate-package workflow, honest fallback semantics, provenance, persistence, history restoration without regeneration, and evidence-based final gating. Do not add unrelated product features or claim real video without a genuine ACS causal chain and playable artifact.

## Architecture Decisions
- Preserved Node.js ACS Core and the canonical provider-neutral video adapter contract.
- Added a static browser studio served by the Node runtime and a managed FastAPI bridge/plugin layer expected by the environment.
- Kept provider/model/API/auth/polling details isolated in the backend implementation plugin.
- Used file-backed canonical state for users, sessions, generation jobs, projects, outputs, and no-regeneration restoration.
- Added async application-level generation jobs so long media work does not block browser requests.
- Resolved long-running video through immediate adapter admission, durable provider-job state, resumable polling, and browser-compatible artifact normalization.

## Implemented
- Registration, login, logout, persistent session, and per-user project access.
- Responsive collapsible workspace navigation: Home, Create Content, History, Support, Settings.
- Product references, consistency, platform, preset/custom preset, UGC/Unboxing/Reviewer, language, requested duration, and Prompt Master controls.
- Product-aware creative direction, three-scene storyboard, motion intent, and five-field affiliate package.
- Capability discovery/status, strict adapter identity, validation, provenance fields, and explicit non-live fallback.
- Verified real AI video generation with durable VP9/Opus playback, byte-range delivery, and complete ACS provenance.
- Persistent archive, restore without regeneration, copy/download, delete, and language settings.
- Public health, automated acceptance/regression tests, visual checks, and final evidence report.

## Prioritized Backlog
### P0
- No open P0 product gap.

### P1
- Add adapter-level tests for completed-with-error status and transient result retrieval.
- Add a restart/resume regression around an active adapter job without resubmission.

### P2
- Add richer product-reference previews and archive filters while preserving current scope and contracts.

## Next Tasks
1. Add scheduled cleanup/retention controls for persisted source and playback artifacts.
2. Add UI progress stages from adapter job state while preserving provider-neutral language.
3. Expand read-only regression coverage for restart/resume during an active adapter job.