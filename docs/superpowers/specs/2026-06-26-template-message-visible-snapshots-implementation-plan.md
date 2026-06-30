# Implementation Plan: template message visible snapshots

## Context

This plan implements the approved design in:

- `docs/superpowers/specs/2026-06-26-template-message-visible-snapshots-design.md`

Goal:

1. persist the real visible text of outbound template messages
2. keep patient-facing WhatsApp behavior unchanged
3. preserve existing admin UI contracts by continuing to use `body` as visible content
4. avoid regressions in non-template message flows and unrelated admin modules

## Scope boundaries

In scope:

1. outbound `template` message persistence in `bot_messages`
2. the three active template families:
   - `recordatorio_cita_24h`
   - `verificacion_telefono_paciente`
   - `satisfaction_survey_flow`
3. a centralized backend template snapshot builder
4. additive payload enrichment for template observability
5. targeted tests for snapshot generation and persistence

Out of scope:

1. changing the actual message sent to Meta
2. redesigning admin chat or conversation pages
3. mandatory historical backfill
4. introducing a new persistence table in phase 1
5. expanding RBAC policy beyond current body/payload masking behavior

## Implementation strategy

Use a low-risk persistence-first rollout:

1. keep the shared/admin UI contract centered on `body`
2. replace `template:<name>` with the rendered visible text for new template messages
3. enrich `payload` with immutable template snapshot metadata
4. leave existing UI rendering paths unchanged unless a small fallback improvement is needed

Why this strategy:

1. smallest blast radius
2. preserves current DTOs and UI assumptions
3. improves observability immediately for newly sent templates
4. avoids coupling admin rendering to a brand-new contract

## Workstreams

### WS1 - Define template snapshot domain contract

Objective:

Create an explicit internal contract for visible template snapshots so the system does not depend on ad hoc string assembly inside multiple use cases.

Files to add or update:

1. a dedicated domain/application type for template snapshots under `src/modules/whatsapp` or a small shared outbound location

Recommended shape:

1. `templateName`
2. `templateLanguageCode`
3. `visibleBody`
4. `visibleButtons`
5. `bodyTextParameters`
6. `snapshotVersion`
7. `renderedHash`
8. optional template-specific metadata such as flow CTA, button index, and dispatch correlation ids

Rules:

1. keep it framework-agnostic
2. no Prisma or NestJS concerns in the type
3. no frontend-oriented fields that are not actually needed by persistence

Exit criteria:

1. all template senders can depend on one consistent snapshot contract

### WS2 - Build a centralized template snapshot service

Objective:

Generate visible template content in one backend service instead of scattering the logic across reminders and surveys.

Files to add:

1. a focused service under the outbound WhatsApp application layer or a sibling shared template module

Responsibilities:

1. receive `templateName` plus visible parameters
2. generate `visibleBody`
3. generate optional `visibleButtons`
4. compute `snapshotVersion`
5. compute `renderedHash`

Rules:

1. no network calls
2. no direct DB access
3. small explicit per-template renderers
4. no generic string-template engine unless clearly justified

Recommended structure:

1. one registry/coordinator service
2. small renderer strategy per template
3. stable fallback behavior for unknown templates

Exit criteria:

1. the service supports the three current templates
2. the service is testable in isolation

### WS3 - Extend outbound template persistence inputs

Objective:

Allow template outbound persistence to store both visible and technical snapshot data without changing text/interactive flows.

Files to update:

1. `src/modules/conversations/domain/ports/conversation-message.repository.ts`
2. `src/modules/conversations/infrastructure/persistence/mysql/prisma-bot-conversation-message.repository.ts`

Changes:

1. extend outbound save input with optional template snapshot fields
2. keep text and interactive callers unchanged
3. when snapshot is present:
   - persist `body = visibleBody`
   - merge only technical snapshot metadata into `payload`
4. when snapshot is absent:
   - preserve existing behavior

Rules:

1. do not move rendering logic into the repository
2. keep repository branching minimal and message-type-specific
3. preserve current upsert behavior by `whatsappMessageId`
4. do not duplicate the full visible body inside `payload`

Exit criteria:

1. repository supports template snapshots additively
2. text and interactive persistence behavior remains unchanged

### WS4 - Update reminder template flows

Objective:

Persist visible snapshots for reminder-related template sends.

Files to update:

1. `src/modules/reminders/application/services/appointment-reminder-template-delivery.service.ts`
2. any supporting reminder-specific snapshot inputs if needed

Changes:

1. build template snapshot before calling `saveOutbound`
2. pass snapshot to the message repository
3. keep current Meta send payload unchanged

Coverage:

1. `recordatorio_cita_24h`
2. `verificacion_telefono_paciente` when sent from reminders

Exit criteria:

1. newly sent reminder templates persist visible text in `body`
2. payload contains technical snapshot metadata

### WS5 - Update survey template flows

Objective:

Persist visible snapshots for survey-related template sends.

Files to update:

1. `src/modules/surveys/application/use-cases/send-satisfaction-survey-phone-verification.use-case.ts`
2. `src/modules/surveys/application/use-cases/send-satisfaction-survey-flow-invitation.use-case.ts`

Changes:

1. build template snapshot before `saveOutbound`
2. pass visible snapshot to persistence
3. keep transport-level template send unchanged

Coverage:

1. `verificacion_telefono_paciente` when sent from surveys
2. `satisfaction_survey_flow`

Exit criteria:

1. survey template messages persist visible text in `body`
2. flow CTA/button metadata is captured in payload where relevant
3. `flowToken` is not copied into `bot_messages.payload`

### WS6 - Preserve admin UI compatibility

Objective:

Verify whether the existing `Chats` and `Conversations` UI can benefit from the persistence change without contract changes.

Files to inspect and only update if required:

1. `apps/web/src/features/chats/ui/chat-message-bubble.tsx`
2. `apps/web/src/pages/conversation-detail-page.tsx`
3. `src/modules/admin-conversations/infrastructure/persistence/mysql/prisma-bot-admin-conversations.repository.ts`

Expected outcome:

1. no functional UI change should be required because both screens already render `body`

Optional narrow cleanup:

1. improve fallback handling only if templates still hit a poor display path in some edge case

Exit criteria:

1. no new UI contract is needed in phase 1

### WS7 - Tests

Objective:

Protect the new behavior with focused tests and prevent regressions across message types.

Recommended tests:

1. unit tests for the centralized snapshot service
2. unit tests per template renderer:
   - reminder body
   - verification body
   - survey flow body
3. repository tests ensuring template snapshots persist:
   - visible text into `body`
   - technical snapshot into `payload`
4. use case/service tests for:
   - reminder delivery persistence
   - survey verification persistence
   - survey flow invitation persistence
5. regression tests for text and interactive messages proving unchanged behavior
6. admin read-model tests only if current suite already covers display-body resolution

Exit criteria:

1. snapshot generation is deterministic
2. template persistence is explicit
3. non-template persistence remains stable

## Suggested execution order

1. WS1 snapshot contract
2. WS2 centralized snapshot service
3. WS3 repository input and persistence extension
4. WS4 reminder integration
5. WS5 survey integration
6. WS6 compatibility verification for admin UI
7. WS7 tests

## Template-specific implementation notes

### `recordatorio_cita_24h`

Implementation notes:

1. reuse the same visible values already prepared for template send parameters
2. keep formatting explicit and stable
3. do not recalculate business data inside the renderer beyond display formatting

### `verificacion_telefono_paciente`

Implementation notes:

1. support both reminders and surveys as callers
2. share one renderer if visible copy is the same
3. keep visible button labels in payload snapshot

### `satisfaction_survey_flow`

Implementation notes:

1. render the visible body text in `body`
2. keep CTA/button metadata in payload
3. do not attempt a full WhatsApp visual clone in phase 1
4. do not persist `flowToken` in `bot_messages.payload`
5. if correlation is needed, reuse non-sensitive dispatch identifiers already persisted by the surveys module

## Copy governance requirements

These requirements are mandatory for implementation, not optional process notes.

1. each supported template must have an explicit renderer strategy in code
2. each renderer must have fixtures or assertions tied to the approved visible copy
3. copy changes in Meta for a supported template must be deployed together with:
   - renderer update
   - fixture update
   - `snapshotVersion` bump
4. no generic fallback renderer should silently approximate a known template's text
5. unknown templates may use a safe degraded snapshot strategy, but that fallback must be explicit and test-covered

## Risks and controls

Risk 1: template rendering logic drifts from approved copy  
Control:

1. centralized renderer strategies
2. fixture-based tests per template
3. version field in snapshot metadata

Risk 2: repository change affects non-template messages  
Control:

1. optional snapshot field only
2. explicit branching by presence of snapshot
3. regression tests for text and interactive persistence

Risk 3: flow metadata leaks more than current policy should allow  
Control:

1. keep only non-sensitive technical metadata under payload
2. never copy `flowToken` into `bot_messages.payload`
3. rely on current admin role-based payload visibility
4. do not introduce broader exposure in shared DTOs

Risk 4: historical inconsistency remains visible in older messages  
Control:

1. accept this explicitly as legacy behavior
2. document optional best-effort backfill as a separate follow-up

Risk 5: payload duplicates visible content and increases PII exposure  
Control:

1. keep full visible text only in `body`
2. keep `payload` limited to technical metadata, labels, versioning, and hash
3. do not repeat `visibleBody` in `payload`

Risk 6: per-template string assembly becomes hard to maintain or drifts from Meta  
Control:

1. one renderer strategy per template or template family
2. no large conditional block with all templates in one file
3. snapshot versioning for future copy evolution
4. mandatory copy-governance checks in tests and review

## Optional phase 2 follow-up

Not part of this implementation, but enabled by the design:

1. render visible buttons/CTA in admin chat bubbles from payload
2. add small UI badges for `templateName`
3. introduce selective historical backfill for recent messages only
4. add operational tooling to inspect snapshot version adoption

## Verification plan

Do not execute tests in this documentation step.

When implementation starts, validate with the smallest relevant checks first:

1. targeted unit tests for the snapshot service
2. targeted tests for reminder and survey senders
3. targeted repository tests for outbound template persistence
4. focused UI smoke validation for `Chats` and `Conversations`

## Definition of done

1. New outbound template messages persist visible patient-facing text in `bot_messages.body`.
2. New outbound template messages persist technical snapshot metadata in `bot_messages.payload` without duplicating the full visible body.
3. `recordatorio_cita_24h`, `verificacion_telefono_paciente`, and `satisfaction_survey_flow` are all covered.
4. Existing patient-facing WhatsApp behavior remains unchanged.
5. Existing non-template message persistence remains unchanged.
6. `flowToken` and equivalent sensitive operational tokens are not copied into `bot_messages.payload`.
7. `Chats` and `Conversations` show real template text for new messages without a new UI contract.
8. The implementation remains modular, low-coupling, and testable.
