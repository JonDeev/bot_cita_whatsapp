# Admin Observability Phase F Hardening Checklist

## Objective

Validate security and operability requirements from phase F before release:

1. CSRF behavior in production-like setup
2. admin session cookie flags and `__Host-*` semantics
3. SSE headers and proxy buffering behavior
4. role-based access and masking smoke coverage

## Preconditions

1. Backend running behind reverse proxy (Nginx or Traefik)
2. HTTPS enabled in the proxy endpoint
3. `ADMIN_AUTH_COOKIE_SECURE=true`
4. `ADMIN_AUTH_SESSION_COOKIE_NAME=__Host-sism_admin_session`

## Proxy Configuration

### Nginx reference snippet

Reference file:

1. `ops/proxy/nginx/admin-observability-stream.conf`

```nginx
location /api/admin/stream {
  proxy_pass http://127.0.0.1:3000;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host $host;
  proxy_buffering off;
  proxy_cache off;
  chunked_transfer_encoding off;
}
```

### Traefik reference

Reference file:

1. `ops/proxy/traefik/admin-observability-stream.yml`

1. Keep streaming responses enabled (no response buffering middleware).
2. Do not attach compression middleware to `/api/admin/stream`.

## Verification Steps

### 1) Cookie and login

```bash
curl -ik -X POST https://<host>/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"<admin>","password":"<password>"}'
```

Expected:

1. `Set-Cookie` contains `__Host-sism_admin_session=...`
2. Cookie includes `HttpOnly; Secure; SameSite=Strict; Path=/`
3. Cookie does not include `Domain=`

### 2) CSRF behavior

1. Call `GET /api/admin/auth/csrf` with session cookie.
2. Call `POST /api/admin/auth/logout` without `X-CSRF-Token`.

Expected:

1. `GET /csrf` returns token
2. `POST /logout` without token is denied (`401`)
3. `POST /logout` with valid token succeeds

Optional helper command:

1. `pnpm admin:phase-f:validate <base_url> "<session_cookie>" "<csrf_token>"`

### 3) SSE behavior

```bash
curl -ikN https://<host>/api/admin/stream \
  -H 'Cookie: __Host-sism_admin_session=<session-cookie>'
```

Expected headers:

1. `Content-Type: text/event-stream`
2. `X-Accel-Buffering: no`
3. `Cache-Control: no-cache`
4. `Pragma: no-cache`
5. `Connection: keep-alive`

Expected stream behavior:

1. heartbeat events arrive periodically
2. session revocation closes the stream with `auth.session.revoked`
3. no payload buffering delay from proxy

### 4) Role access smoke

Use e2e smoke suites:

1. `test/admin-auth-smoke.e2e-spec.ts`
2. `test/admin-overview-access.e2e-spec.ts`
3. `test/admin-stream-access.e2e-spec.ts`

Recommended execution commands:

1. local: `pnpm test:e2e:admin-smoke`

## Release Gate

Phase F is complete only if all checks above pass and are recorded using:

1. `docs/operations/admin-observability-phase-f-release-evidence-template.md`
