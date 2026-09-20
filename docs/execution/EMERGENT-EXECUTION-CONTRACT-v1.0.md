# ACS — Emergent Execution Contract v1.0

Status: LOCK CANDIDATE FOR EXTERNAL EXECUTION

## 1. Objective
Execute the canonical ACS repository in Emergent without changing architecture or product semantics.

## 2. Source authority
Architecture → Specification → Contracts → Canonical Repository → REC → Emergent Runtime → Runtime Evidence → Evolution.
Emergent executes the repository; it does not redefine upstream contracts.

## 3. Input
- Repository: RidzBuilder/ACS
- Branch: execution/acs-mep-a-e-20260919
- Runtime: Node.js
- Start: npm start
- Test: npm test
- Syntax: npm run check

## 4. Mandatory sequence
IMPORT → INSPECT → INSTALL → TEST → CHECK → START → HEALTH → GOLDEN PATH → PERSISTENCE/RESTART → EVIDENCE → CONFORMANCE → GATE

No step may be silently skipped.

## 5. Golden path
Use POST /api/projects with the existing domain contract: projectName, productName, productDescription, contentType, language.
Expected behavior: create project → derive creative → storyboard → resolve video capability → explicit fallback when live capability is absent OR live adapter invocation when configured → persist result → retrieve by project ID.

## 6. No-feature-expansion rule
Do not introduce subscription/payment, unrelated analytics, speculative multi-provider UI, new product features, architectural rewrites, provider lock-in, or replacement of canonical data contracts.

## 7. Live-video boundary
Live closure requires one causal chain: ACS request → capability resolution → live adapter → real provider request → real provider job ID → real playable artifact → ACS validation → provenance → persistence → re-test.
Direct provider execution outside ACS does not close GAP-ACS-004.

## 8. Failure handling
Record the exact failure, classify its source, do not silently patch around the contract, do not mark failed gates as PASS, apply minimum remediation, then re-run the affected gate.

## 9. Evidence classes
E-IMPORT, E-BUILD, E-TEST, E-CHECK, E-RUNTIME, E-GOLDEN, E-PERSISTENCE, E-CONFORMANCE.
Every PASS requires corresponding evidence with environment, timestamp, branch/commit where possible, observed result, and deviations.

## 10. Exit states
PASS = all required build/runtime gates pass with evidence.
PASS WITH OPEN PRODUCT GAP = build/runtime valid but independent live-video evidence remains open.
BLOCKED = required external Emergent execution is unavailable.
FAIL = implementation violates the canonical contract.

## 11. Current state
BUILD CONTRACT = READY
ACTUAL EMERGENT EXECUTION = BLOCKED UNTIL EXTERNAL EMERGENT WORKSPACE IS AVAILABLE
NO FEATURE DEVELOPMENT IS AUTHORIZED BY THIS CONTRACT.