# Implementation Plan: admin chats observability module

## Context

This plan implements the approved design in:

- `docs/superpowers/specs/2026-05-28-admin-chats-observability-design.md`

It adds a new `Chats` module for operational readability while preserving `Conversations` as technical traceability.

## Scope boundaries

In scope:

1. New read-only backend module `admin-chats`.
2. New frontend page `/admin/chats`.
3. Two-panel chat UI (list + thread).
4. SSE-driven refresh integration.
5. Role-based masking consistent with existing admin modules.

Out of scope:

1. Sending messages from panel.
2. Handoff actions from chat UI.
3. Replacing existing `/admin/conversations` flow.

## Workstreams

### WS1 - Shared contracts for chats

Objective:

Define frontend/backend shared DTOs for chat list and chat messages.

Deliverables:

1. `packages/shared/src/admin/chats-dto.ts`
2. Export in `packages/shared/src/index.ts`

Exit criteria:

1. DTOs compile and are consumed by API/controller/frontend.

### WS2 - Backend module `admin-chats`

Objective:

Expose read-only chat-oriented endpoints.

Deliverables:

1. `src/modules/admin-chats/`
2. `GET /api/admin/chats`
3. `GET /api/admin/chats/:id`
4. `GET /api/admin/chats/:id/messages`

Rules:

1. Reuse repositories/services from admin-conversations where possible.
2. Keep controller thin.
3. Add role-based masking service (`ADMIN` vs `SUPERVISOR`).

Exit criteria:

1. Endpoints return UI-oriented payloads without technical leakage for `SUPERVISOR`.

### WS3 - Audit and authorization

Objective:

Ensure secure access and traceability.

Deliverables:

1. `AdminSessionGuard` + `AdminRolesGuard` on all chat routes.
2. Audit events:
   - `admin.chat.viewed`
   - `admin.chat.messages_viewed`

Exit criteria:

1. `401/403` behavior matches current admin standards.

### WS4 - Frontend data layer

Objective:

Create feature layer for chats.

Deliverables:

1. `apps/web/src/features/chats/chats.api.ts`
2. `apps/web/src/features/chats/chats.hooks.ts`
3. `apps/web/src/features/chats/chats.types.ts`

Exit criteria:

1. Stable query keys and typed responses.

### WS5 - Frontend chats page

Objective:

Implement two-panel UI with chat semantics.

Deliverables:

1. `apps/web/src/pages/chats-page.tsx`
2. UI components:
   - list panel
   - thread panel
   - message bubble
3. Sidebar nav item `Chats`.

Rules:

1. Keep files small and focused.
2. Inbound messages left, outbound right.
3. Preserve responsive behavior (desktop + mobile fallback).

Exit criteria:

1. User can select a chat and read conversation naturally.

### WS6 - SSE integration

Objective:

Refresh chats views on live operational events.

Deliverables:

1. `useAdminStream` query invalidation for chats query keys.

Exit criteria:

1. New messages/failures are reflected without manual reload.

### WS7 - Tests and verification

Objective:

Cover critical behavior with small, modular tests.

Deliverables:

1. Unit tests for parser/masking.
2. Integration tests for endpoint access and masking.
3. Frontend component tests for bubble alignment (if current stack already supports it).

Exit criteria:

1. No regression on existing conversations module.
2. Chat module passes targeted validation commands.

## Suggested execution order

1. WS1 shared contracts
2. WS2 backend endpoints
3. WS3 auth/audit
4. WS4 frontend data layer
5. WS5 frontend page and components
6. WS6 SSE refresh
7. WS7 tests and validation

## Risks and controls

Risk 1: Confusing overlap between `Chats` and `Conversations`  
Control:

1. Keep naming explicit in sidebar and page descriptions.
2. Do not remove/alter technical fields from `Conversations`.

Risk 2: Payload leakage to `SUPERVISOR`  
Control:

1. Centralized masking service.
2. Contract tests by role.

Risk 3: UI complexity growth  
Control:

1. Feature-folder structure.
2. Small components per responsibility.

## Definition of done

1. `/admin/chats` is available and stable.
2. Two-panel chat UX is understandable and operational.
3. RBAC/masking/audit are compliant.
4. `Conversations` remains untouched behaviorally.
5. SSE refresh works for chats data.
