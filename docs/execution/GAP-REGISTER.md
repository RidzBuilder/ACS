# ACS MEP A–E Gap Register

| ID | Phase | Gap | Severity | Remediation | Status |
|---|---|---|---|---|---|
| GAP-ACS-001 | A/B | Repository had blueprint/docs but no executable runtime surface | BLOCKING | Add minimal executable runtime, package scripts, tests, CI | CLOSED |
| GAP-ACS-002 | B | No explicit repository execution contract | BLOCKING | Add REC defining runtime, golden path, capability and fallback behavior | CLOSED |
| GAP-ACS-003 | B/D | No executable proof for canonical golden path | BLOCKING | Add domain pipeline and acceptance tests | CLOSED |
| GAP-ACS-004 | B/D | Video live capability cannot be verified without runtime provider configuration | BLOCKING FOR LIVE VIDEO | Capability resolver + explicit non-live fallback; requires configured live generator for live gate | OPEN |
| GAP-ACS-005 | B/D | Durable project archive not implemented | HIGH | Replace in-memory store with durable persistence while preserving schema/no-regeneration invariant | OPEN |
| GAP-ACS-006 | E | No Emergent connector/action available in this execution environment | BLOCKING FOR E EXECUTION | Prepare import package and perform external import manually/through an available Emergent integration | OPEN |
| GAP-ACS-007 | E | External Emergent build/runtime evidence unavailable | BLOCKING FOR E PASS | Capture import/build/start/test evidence from Emergent | OPEN |
