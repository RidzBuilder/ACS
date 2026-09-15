# Affiliate AI Content Studio V3 — Product Blueprint

## Product Intent
An AI-powered affiliate content workspace where a user supplies product information and references, and the system produces creative direction, story/scene structure, real motion video, and a coherent affiliate content package.

## Core Journey
INPUT PRODUCT → PRODUCT UNDERSTANDING → CREATIVE DIRECTION → STORY/SCENE → STORYBOARD → REAL AI VIDEO → QUALITY VALIDATION → FINAL VIDEO + AFFILIATE PACKAGE → PROJECT ARCHIVE

## Inputs
Project Name; Product Name; Product Description; product reference images; optional Creative Instruction; Content Type: UGC, Unboxing, Reviewer.

## User Experience
Normal users see a simple workflow and must not need to understand models, providers, adapters, prompts, APIs, runtimes, or orchestration internals.

Authenticated workspace: Home / Create Content / History / Support / Settings. Navigation must be persistent and genuinely collapsible/expandable.

## Creative Output
The system may derive objective, audience, angle, hook, strategy, content pillar, CTA strategy, scene intent, storyboard and motion direction. Content type and available platform/context should influence creative behavior.

## Video Capability
Primary requirement: actual playable AI-generated motion video. It must be product-aware, reference-aware where supported, content-type-aware, creative-instruction-aware, and storyboard/scene-intent-aware. Static slides, slideshow, text-only animation, voiceover-only output, or fake video are not acceptable as the real-video result.

The implementation must discover and use the best genuinely available native video capability. Provider choice is not part of the product contract.

## Affiliate Package
Canonical fields: Product Name, Product Description, Caption, CTA, Hashtags.

Semantic chain: Product → Description → Creative Context → Caption → CTA → Hashtags.

Product Description must be meaningful and not merely echo the name. Linguistic enrichment is allowed; unsupported facts are not.

Caption must be product-aware, content-type-aware, platform-aware where known, audience-aware where known, creative-instruction-aware, language-aware and natural.

CTA must continue naturally from product, audience, caption, platform and buyer intent.

Hashtags must consider product, category, verified attributes, buyer intent, platform and affiliate context. Safe typo normalization may be applied to hashtags without altering Product Name.

## Language
English and Bahasa Indonesia. Language preference is persistent and is a generation context, not merely UI translation. User-facing generated content must follow the selected language.

## Archive
History is a Project Archive / Content Library. A completed project must restore stored results without regeneration after navigation, refresh, logout/login, or reopening.

## Governance
Do not fabricate material, capacity, durability, compatibility, warranty, certification, performance, or features not supported by input/evidence.
