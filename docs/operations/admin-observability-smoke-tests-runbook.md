# Admin Observability Smoke Tests Runbook

## Objective

Run only the critical admin panel smoke tests quickly and consistently.

These tests validate:

1. admin auth core flow
2. overview role/session access control
3. SSE stream access control and headers

## Included test files

1. `test/admin-auth-smoke.e2e-spec.ts`
2. `test/admin-overview-access.e2e-spec.ts`
3. `test/admin-stream-access.e2e-spec.ts`

## Commands

Local smoke run:

```bash
pnpm test:e2e:admin-smoke
```

## When to run

1. before merging admin-auth changes
2. before merging admin-overview changes
3. before merging dashboard-stream changes
4. before release cut

## Failure triage hints

1. `401` regressions: validate `AdminSessionGuard` behavior and session bootstrap in tests
2. `403` regressions: validate route decorators (`@AdminRoles`) and `AdminRolesGuard`
3. SSE header regressions: validate stream controller headers and reverse proxy config
