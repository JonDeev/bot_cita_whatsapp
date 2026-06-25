# Implementation Plan: admin chat thread scroll behavior

## Context

This plan implements the approved design in:

- `docs/superpowers/specs/2026-06-25-admin-chat-thread-scroll-behavior-design.md`

Goal:

1. open chats at the most recent message
2. keep the thread pinned to bottom only when the operator is already at the bottom
3. preserve manual upward browsing
4. provide a fast return-to-latest action
5. avoid brittle or spaghetti-style scroll effects

## Scope boundaries

In scope:

1. chats thread data flow in the web app
2. chats thread scroll state and viewport behavior
3. chats thread UI affordance for returning to latest
4. targeted frontend tests for the thread behavior

Out of scope:

1. backend endpoint changes
2. database or Prisma changes
3. changes to non-chat admin modules
4. virtualization rollout unless implementation reveals a hard scaling issue

## Implementation strategy

Use a layered frontend refactor:

1. stabilize message pagination and aggregation first
2. extract viewport behavior into a dedicated hook
3. keep the thread panel mostly presentational
4. add mandatory component tests before or alongside the behavior change

This avoids a fragile solution where DOM scroll logic is scattered across page-level effects and view components.

## Workstreams

### WS1 - Restructure the chat messages data model

Objective:

Replace the current “single active page plus manual merge” approach with a stable paginated thread model.

Files:

1. `apps/web/src/features/chats/chats.hooks.ts`
2. `apps/web/src/pages/chats-page.tsx`

Changes:

1. introduce an infinite-query based hook for chat messages
2. preserve the existing backend contract of `page` and `pageSize`
3. derive visible messages from accumulated pages instead of manual local merging
4. ensure the newest page remains the canonical source for newly arrived messages
5. emit a resolved thread mutation type for every meaningful data transition

Exit criteria:

1. the chat thread can load older pages and still incorporate newly arrived messages correctly
2. no duplicate messages appear when pages are refreshed or prepended
3. the data layer classifies transitions explicitly instead of relying on array-length heuristics

Implementation notes:

1. define a small explicit union such as:
   - `THREAD_RESET`
   - `OLDER_MESSAGES_PREPENDED`
   - `LATEST_MESSAGES_REFRESHED`
   - `LIVE_MESSAGE_APPENDED`
2. reconcile by stable message identity, using `message.id`
3. keep mutation resolution inside the thread data layer, not inside the viewport hook

### WS2 - Add a dedicated viewport controller hook

Objective:

Centralize scroll behavior in one reusable abstraction.

Files:

1. new file in `apps/web/src/features/chats/` or `apps/web/src/features/chats/ui/`

Recommended artifact:

1. `use-chat-thread-viewport.ts`

Responsibilities:

1. expose `containerRef`
2. detect whether the user is near the bottom
3. expose whether the thread is in `FOLLOW_LATEST` or `BROWSING_HISTORY`
4. provide `scrollToLatest`
5. preserve relative position when older messages are prepended
6. expose whether the jump-to-latest CTA should be visible
7. react to explicit thread mutations emitted by WS1

Exit criteria:

1. no DOM scroll logic remains duplicated in page-level components
2. the hook API is explicit and testable
3. the hook never infers semantic thread changes from `messages.length` alone

### WS3 - Update the thread panel component

Objective:

Keep `ChatThreadPanel` focused on rendering while integrating the viewport controller.

Files:

1. `apps/web/src/features/chats/ui/chat-thread-panel.tsx`

Changes:

1. attach the scroll container ref to the message viewport
2. wire the scroll event to the viewport hook
3. render the jump-to-latest CTA only when appropriate
4. preserve the current “load older messages” control
5. keep header and message bubble rendering responsibilities unchanged

Exit criteria:

1. the thread panel stays readable and mostly presentational
2. the CTA is accessible and visually tied to the message viewport

### WS4 - Handle initial load, chat switching, and live updates

Objective:

Define the exact transitions that move or preserve the viewport.

Files:

1. `apps/web/src/pages/chats-page.tsx`
2. viewport hook introduced in WS2

Changes:

1. reset thread state when `selectedChatId` changes
2. auto-scroll to latest on first successful load of a chat
3. auto-scroll on new message arrival only if the user is already pinned to bottom
4. keep the current position when the user is browsing older history
5. map query refresh results to the correct explicit mutation type before touching viewport behavior

Exit criteria:

1. changing chats always lands at latest
2. incoming messages never yank the viewport away from a user reading old content

### WS5 - Preserve scroll position when loading older messages

Objective:

Prevent visible jumps during prepend operations.

Files:

1. viewport hook introduced in WS2
2. `apps/web/src/pages/chats-page.tsx`

Changes:

1. capture the container `scrollHeight` and `scrollTop` before older messages are inserted
2. after render, restore relative offset based on new `scrollHeight`
3. ensure the behavior works even when multiple pages are loaded progressively

Exit criteria:

1. the operator keeps reading the same area of the conversation after loading older messages

### WS6 - Add tests for the chat thread behavior

Objective:

Protect the new UX behavior against regression.

Files to add or update:

1. frontend test files for the chats feature
2. supporting test configuration for `apps/web`

Approved decision:

1. `apps/web` will gain component-test tooling.
2. Recommended stack:
   - `vitest`
   - `@testing-library/react`
   - `@testing-library/user-event`
   - `jsdom`
3. The tooling must be scoped to `apps/web` and must not replace or alter backend Jest usage.
4. Manual browser validation remains useful, but it is not an acceptable substitute for automated coverage in this feature.

Recommended test cases:

1. opens a chat at the latest message
2. switches chats and lands at the latest message
3. does not auto-scroll on a new message while the operator is reading older content
4. auto-scrolls on a new message while already pinned to bottom
5. shows and hides the jump-to-latest CTA at the correct times
6. preserves viewport position when older messages are loaded
7. classifies `THREAD_RESET` correctly on chat switch
8. classifies `OLDER_MESSAGES_PREPENDED` correctly when loading history
9. classifies `LATEST_MESSAGES_REFRESHED` without forcing auto-scroll while browsing history
10. classifies `LIVE_MESSAGE_APPENDED` and auto-follows only when pinned to bottom

Exit criteria:

1. the intended scroll contract is automated, not only manually verified

## Execution order

1. Introduce the new message aggregation model.
2. Create the viewport hook.
3. Integrate the hook into `ChatThreadPanel`.
4. Wire chat switch and incoming message transitions.
5. Implement prepend position preservation.
6. Add component tests in `apps/web`.
7. Run targeted typecheck and the smallest relevant validation command available for the web app.

## Coding standards for the implementation

1. Keep viewport logic out of message bubble components.
2. Use explicit names such as `isPinnedToBottom`, `showJumpToLatest`, and `scrollToLatest`.
3. Avoid boolean combinations that hide behavior behind unclear conditions.
4. Prefer one state machine-like source of truth for scroll mode instead of multiple unrelated flags.
5. Use `useLayoutEffect` only where viewport synchronization truly requires pre-paint work.
6. Prefer additive, focused refactors over broad rewrites.
7. Do not change backend contracts unless implementation proves a real frontend-only solution is insufficient.
8. Keep semantic thread mutation resolution and DOM viewport effects in separate units.

## Verification plan

When implementation begins, verify in this order:

1. `pnpm run typecheck:web`
2. targeted frontend component tests for the chats thread
3. manual validation in the `Chats` screen with these scenarios:
   - open chat
   - change chat
   - scroll upward manually
   - receive new message while at bottom
   - receive new message while browsing history
   - load older messages

## Definition of done

1. The right-side thread opens at the most recent message.
2. The thread stays pinned to bottom only when the operator is already at bottom.
3. Manual browsing upward is respected.
4. A clear jump-to-latest affordance is available when the operator is away from the bottom.
5. Loading older messages preserves visual context.
6. The implementation remains modular and understandable, without mixing transport, data, viewport, and rendering concerns.
7. Thread mutation types are explicit, deterministic, and covered by automated tests.
