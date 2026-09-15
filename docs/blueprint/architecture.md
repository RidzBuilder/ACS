# Architecture Blueprint

## Semantic Layers
1. Product Input
2. Product Understanding
3. Creative Planning
4. Story / Scene Planning
5. Storyboard
6. Motion Generation
7. Quality Validation
8. Final Result
9. Affiliate Package
10. Project Archive

The implementation may combine or split internal services differently if semantic behavior and outputs remain intact.

## Capability-Driven Boundary
Human owns: product intent, UX outcomes, behavior, data contracts, quality, constraints, governance, acceptance criteria.

Implementation owns: framework, component structure, internal orchestration, provider selection, API wiring, storage mechanics, optimization.

## Video Capability Resolution
Required capability: REAL AI VIDEO GENERATION.
Resolution sequence: Requirement → native capability discovery → best suitable implementation → generation → artifact validation.

A provider-specific mechanism may be used internally, but the product contract must remain provider-agnostic.

## Data Integrity
Use one canonical project/result state. Product input, creative output, video result, affiliate package, blueprint/storyboard information and generation metadata must remain coherent. History reads the canonical persisted state.

## Persistence
Persist completed project/result data sufficiently to restore the complete result. Existing completed results, where present, must remain compatible.

## No-Regeneration Invariant
Read-only actions and session/navigation events must never trigger AI regeneration for an already completed project.

## Security
Secrets must remain server-side using secure mechanisms available in the implementation environment. Never expose credentials in client code or repository source.
