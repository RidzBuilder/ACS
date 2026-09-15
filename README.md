# Affiliate AI Content Studio V3 (ACS)

Blueprint-centric repository for Affiliate AI Content Studio V3.

## Source of truth
- `AGENTS.md` — Codex implementation contract.
- `docs/blueprint/product-spec.md` — product, UX and capability contract.
- `docs/blueprint/architecture.md` — implementation-agnostic architecture boundaries.
- `docs/blueprint/data-contracts.md` — canonical data contracts.
- `docs/blueprint/acceptance.md` — observable acceptance criteria.
- `docs/blueprint/implementation-guidance.md` — implementation guidance.

## Core principle
**Blueprint defines the contract. Implementation chooses the HOW.**

The repository intentionally does not prescribe a specific framework, provider, adapter naming scheme, or folder architecture.

## Video
**REAL AI VIDEO GENERATION** is the primary capability. The implementation must discover and use a genuinely available capability. Mock/demo output is only an honest fallback when live generation is unavailable.

## Scope
Build the V3 product experience and its validated capabilities. Avoid unrelated subscription, payment, analytics, multi-provider UI, or speculative infrastructure.
