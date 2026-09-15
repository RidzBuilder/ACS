# Canonical Data Contracts

## Project
Conceptual fields: id, projectName, productName, productDescription, productImages[], creativeInstruction, contentType, language, createdAt, updatedAt.

## Creative Output
objective; targetAudience when available; angle; hook; strategy; contentPillar; ctaStrategy; sceneIntent[].

## Storyboard
scenes[]; each scene carries enough visual, action/motion and timing intent to guide video generation.

## Video Result
status; artifact/reference; playable representation; generation mode/status; duration/resolution where available; validation status.

## Affiliate Package
productName; productDescription; caption; cta; hashtags[].

## Quality
Validation must be observable and must not claim live generation when only a mock/fallback exists.

## Compatibility
Schema evolution must preserve existing records and must not require regeneration merely to open archived projects.
