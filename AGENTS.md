# ACS — Codex Repository Contract

## Mission
Implement Affiliate AI Content Studio V3 from the canonical blueprint in this repository.

## Authority
Human-defined product intent, behavior, data contracts, quality gates, constraints, and acceptance criteria are authoritative. Codex determines implementation details.

## Rules
- Preserve the semantic contract; do not invent unrelated product behavior.
- Prefer native platform capabilities when they satisfy a capability contract.
- Do not lock the product to a specific AI/video provider unless a requirement explicitly requires it.
- Real AI video generation is the primary video capability. Mock is only an honest fallback when no usable live capability exists.
- Keep provider/framework/API choices implementation-level.
- Do not expose infrastructure choices to normal users.
- Maintain a canonical persisted project/result state.
- Reopening history must not regenerate content.
- Do not fabricate product claims.
- Validate observable acceptance criteria before declaring completion.
- Keep changes scoped; avoid unnecessary rewrites and dependencies.

## Workflow
Inspect → map capability → plan → implement → test → validate → report.
