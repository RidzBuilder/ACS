# Implementation Guidance

## Principle
BLUEPRINT DEFINES THE CONTRACT. IMPLEMENTATION CHOOSES THE HOW.

Before coding:
1. Inspect native capabilities.
2. Map each required capability to the simplest reliable implementation.
3. Identify gaps and honest fallbacks.
4. Avoid importing architecture solely because another platform used it.

## Video
Do not build provider-selection UI. Do not make a provider name the product requirement. Attempt real generation using a genuinely usable native capability. Validate the actual returned artifact. If unavailable, keep an explicit honest fallback state.

## Content Semantics
Creative instruction is a control signal, not text to copy into captions. Caption generation must receive product, content type, platform/context when available, audience when available, creative direction and language.

## Repository Behavior
Prefer small, coherent changes. Avoid speculative abstractions, unrelated features, and unnecessary migrations.

## Definition of Done
Satisfy the product blueprint, data contracts, observable acceptance criteria, and no-regeneration invariant, with no fabricated capability claims.
