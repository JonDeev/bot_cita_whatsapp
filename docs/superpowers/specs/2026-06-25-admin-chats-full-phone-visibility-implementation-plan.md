# Implementation Plan: admin chats full phone visibility

## Context

This plan implements the approved design in:

- `docs/superpowers/specs/2026-06-25-admin-chats-full-phone-visibility-design.md`

Goal:

1. show the full participant phone in `Chats`
2. keep `admin-conversations` unchanged
3. avoid persistence or schema changes

## Scope boundaries

In scope:

1. `admin-chats` shared DTOs
2. `admin-chats` list/detail backend flow
3. `Chats` frontend rendering
4. targeted refactor to remove unnecessary coupling
5. targeted tests for changed behavior

Out of scope:

1. database schema changes
2. message body/payload visibility changes
3. changes to `admin-conversations`
4. changes to other admin modules
5. test execution in this planning step

## Implementation strategy

Use a two-step internal rollout inside the same monorepo change:

1. add the new explicit field `participantPhone`
2. migrate frontend and backend usage to the new field
3. optionally remove `participantPhoneMasked` in the same delivery if the repository is deployed atomically

If deployment coordination between backend and frontend is uncertain, keep the deprecated field for one internal release and remove it in a short follow-up.

## Workstreams

### WS1 - Shared DTO contract

Objective:

Define a semantically correct chats contract.

Files:

1. `packages/shared/src/admin/chats-dto.ts`

Changes:

1. add `participantPhone: string` to `AdminChatListItemDto`
2. add `participantPhone: string` to `AdminChatDetailDto`
3. optionally keep `participantPhoneMasked?: string` temporarily with deprecation note

Exit criteria:

1. chats DTOs describe full phone explicitly
2. no other shared admin DTO is changed

### WS2 - Decouple `admin-chats` from masked conversation response types

Objective:

Reduce architectural coupling and keep mapping responsibility local to `admin-chats`.

Files:

1. `src/modules/admin-chats/application/services/admin-chats-mapper.service.ts`

Changes:

1. stop importing response types from `admin-conversations` masking service
2. map list/detail from raw domain conversation types
3. keep message mapping focused on chat DTO output only

Exit criteria:

1. mapper input types are raw and semantically stable
2. mapper no longer depends on masked list/detail shapes from another module

### WS3 - Backend list/detail use cases

Objective:

Return full phone for chats list and detail without changing other modules.

Files:

1. `src/modules/admin-chats/application/use-cases/list-admin-chats.use-case.ts`
2. `src/modules/admin-chats/application/use-cases/get-admin-chat-detail.use-case.ts`

Changes:

1. remove list/detail dependency on `AdminConversationsMaskingService`
2. fetch raw repository result and map directly to chat DTOs
3. preserve current audit behavior

Exit criteria:

1. list/detail return full phone in chats payload
2. audit metadata remains unchanged

### WS4 - Backend messages use case

Objective:

Keep current role-based masking where it still applies.

Files:

1. `src/modules/admin-chats/application/use-cases/list-admin-chat-messages.use-case.ts`

Changes:

1. no phone-related changes required
2. preserve `AdminConversationsMaskingService` usage for message body/payload policy

Exit criteria:

1. message endpoint behavior remains stable

### WS5 - Frontend chats rendering

Objective:

Render the full phone in all visible chats surfaces.

Files:

1. `apps/web/src/features/chats/chats.types.ts`
2. `apps/web/src/features/chats/ui/chat-list-panel.tsx`
3. `apps/web/src/features/chats/ui/chat-thread-panel.tsx`

Changes:

1. consume `participantPhone`
2. replace rendering of `participantPhoneMasked`
3. keep pagination, selection, and loading behavior unchanged

Exit criteria:

1. sidebar displays full phone
2. thread header displays full phone
3. no UI behavior regression outside phone rendering

### WS6 - Tests

Objective:

Cover the changed contract and preserve module boundaries.

Files to update or add:

1. `src/modules/admin-chats/application/services/admin-chats-mapper.service.spec.ts`
2. `src/modules/admin-chats/application/use-cases/list-admin-chats.use-case.spec.ts`
3. `src/modules/admin-chats/application/use-cases/get-admin-chat-detail.use-case.spec.ts` if missing, create it
4. frontend tests only if this feature already has an established pattern worth extending

Test cases:

1. mapper exposes full `participantPhone`
2. list use case returns full phone without invoking phone masking for list/detail
3. detail use case returns full phone without invoking phone masking for list/detail
4. message use case still preserves current role-based message masking behavior
5. no contract expectation in chats tests still references `participantPhoneMasked` after cleanup

Exit criteria:

1. changed behavior is explicit and regression-resistant

## Execution order

1. Update shared DTOs.
2. Refactor mapper to use raw inputs.
3. Update list use case.
4. Update detail use case.
5. Update frontend rendering.
6. Update tests.
7. Decide whether deprecated compatibility field can be removed in the same delivery.

## Coding standards for the implementation

1. Keep each file focused on one responsibility.
2. Prefer additive refactors over broad rewrites.
3. Avoid boolean flag proliferation for visibility rules.
4. Use explicit field names; do not overload `participantPhoneMasked` with full values.
5. Avoid cross-module type coupling when the modules have diverging semantics.
6. Preserve audit, RBAC, and domain boundaries.
7. Do not introduce utility dumping grounds for simple mapping logic.

## Verification plan

Do not run tests in this planning step.

When implementation begins, verify with the smallest relevant checks first:

1. targeted unit tests for `admin-chats`
2. shared package typecheck or build only if required by current toolchain
3. focused frontend validation for `Chats`

## Definition of done

1. `Chats` shows full phone number in list and detail.
2. `admin-conversations` remains behaviorally unchanged.
3. The code is modular, explicit, and low-coupling.
4. No schema changes or migrations are introduced.
5. Tests for the affected module are updated, even if not executed in this planning step.
