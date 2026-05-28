# Admin Observability Phase F Release Evidence Template

## Release metadata

1. Environment: `<staging|production>`
2. Date: `<YYYY-MM-DD>`
3. Owner: `<name>`
4. Commit SHA: `<sha>`

## Validation summary

| Check | Status | Evidence |
| --- | --- | --- |
| Cookie flags (`__Host-*`, `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`, no `Domain`) | ☐ Pass / ☐ Fail | `<link or note>` |
| CSRF issuance and rejection without header | ☐ Pass / ☐ Fail | `<link or note>` |
| SSE headers and proxy behavior (`Content-Type`, `X-Accel-Buffering`, `Cache-Control`, `Pragma`, `Connection`) | ☐ Pass / ☐ Fail | `<link or note>` |
| SSE stream closes on revoked session | ☐ Pass / ☐ Fail | `<link or note>` |
| Role-based access control (`401`, `403`, allowed roles) | ☐ Pass / ☐ Fail | `<link or note>` |
| Role-based masking (`SUPERVISOR` restricted technical fields) | ☐ Pass / ☐ Fail | `<link or note>` |
| Admin smoke e2e suite (`pnpm test:e2e:admin-smoke`) | ☐ Pass / ☐ Fail | `<run note>` |

## Notes and exceptions

Document any temporary exception, risk acceptance, or follow-up action.
