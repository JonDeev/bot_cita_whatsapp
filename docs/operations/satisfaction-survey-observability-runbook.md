# Satisfaction Survey Observability Runbook

## Objective

Operate and monitor post-appointment satisfaction surveys in production using the internal metrics endpoint:

- detect dispatch problems early
- detect survey participation drops
- detect invalid/blocked contacts trend
- support fast incident triage by 30-minute window

Timezone for all operational checks in this runbook: `America/Bogota`.

## Internal endpoint

- Route: `GET /internal/surveys/metrics`
- Header: `x-internal-token: <INTERNAL_SURVEYS_METRICS_TOKEN>` (required when token is configured)
- Query params:
  - `date` (`YYYY-MM-DD`) optional, defaults to current Bogota day
  - `windowStart` (`HH:MM`) optional
  - `windowEnd` (`HH:MM`) optional
  - `windowStart` and `windowEnd` must be sent together

Examples:

```bash
curl -H "x-internal-token: ${INTERNAL_SURVEYS_METRICS_TOKEN}" \
  "http://localhost:3000/internal/surveys/metrics?date=2026-05-11"
```

```bash
curl -H "x-internal-token: ${INTERNAL_SURVEYS_METRICS_TOKEN}" \
  "http://localhost:3000/internal/surveys/metrics?date=2026-05-11&windowStart=07:00&windowEnd=07:30"
```

## Metric definitions

Per 30-minute window:

- `eligible`: unique agendas eligible to survey in that window
- `sent`: survey dispatches that reached sent state or later state (`SENT`, `STARTED`, `COMPLETED`, `DECLINED`, `EXPIRED`, `BLOCKED_CONTACT`)
- `failed`: dispatches failed at sending stage
- `completed`: completed surveys
- `declined`: explicit patient decline
- `blocked`: contact blocked/suppressed from survey flow
- `sendRate = sent / eligible`
- `completionRate = completed / sent`

Totals section is the aggregate for all returned windows.

## Suggested SLO and thresholds

Initial baseline (adjust after 2-4 weeks of real production data):

- Dispatch reliability SLO: `sendRate >= 0.90` daily
- Participation SLO: `completionRate >= 0.35` daily

Alert thresholds:

- Warning:
  - window `sendRate < 0.85`
  - window `failed >= 3`
  - daily `completionRate < 0.30`
- Critical:
  - 2 consecutive windows with `sendRate < 0.70`
  - 2 consecutive windows with `failed >= 5`
  - zero `sent` while `eligible > 0` in 2 consecutive windows

## Operational checks by time

Recommended review points Monday-Friday:

1. 08:05 - first 2 windows (`07:00-07:30`, `07:30-08:00`)
2. 12:05 - midday behavior
3. 17:10 - end of schedule close

At each check:

1. Call endpoint by date.
2. Verify windows are present and ordered.
3. Compare `sendRate` and `failed` against thresholds.
4. Track daily totals trend.

## Triage playbooks

### Incident A: high failures or low sendRate

Symptoms:

- window `sendRate` below threshold
- `failed` increases

Actions:

1. Confirm scheduler lock is healthy and running once per 30 minutes.
2. Inspect recent audit events:
   - `survey.dispatch.flow_template.attempted`
   - `survey.dispatch.flow_template.failed`
3. Validate WhatsApp template status in Meta Manager.
4. Verify Cloud API credentials and expiration of access token.
5. Check if failures are concentrated in one phone pattern or all traffic.
6. If needed, temporarily pause outbound surveys (`SURVEYS_HALF_HOURLY_DISPATCH_ENABLED=false`) until fix.

### Incident B: completionRate drops but sendRate normal

Symptoms:

- `sendRate` healthy
- `completionRate` drops sharply

Actions:

1. Verify published Flow version is the expected one.
2. Check webhook flow submissions are arriving.
3. Inspect audit events:
   - `survey.flow.submission.unmatched_token`
   - `survey.flow.submission.ignored_without_answers`
4. Check if drop is isolated by hour window (possible UX/time-of-day effect).
5. If recent Flow copy changed, rollback to last working copy.

### Incident C: blocked grows unexpectedly

Symptoms:

- `blocked` spikes in one day or window

Actions:

1. Review `survey.phone_suppressed` audit events.
2. Validate option mapping for decision `3` (`No conozco a la persona`) in Flow payload.
3. Sample suppressed contacts and confirm no mapping bug.
4. If bug found, disable suppression branch and hotfix mapping.

### Incident D: eligible exists but no windows returned

Symptoms:

- expected attended appointments exist
- endpoint returns empty windows

Actions:

1. Validate requested `date` and timezone assumption.
2. Confirm dispatch job ran and created `bot_survey_dispatch` records.
3. Verify scheduler process is up.
4. Confirm feature flag: `SURVEYS_HALF_HOURLY_DISPATCH_ENABLED=true`.

## Minimum dashboard panels

Create at least these charts:

1. `eligible` by window (bar)
2. `sent` and `failed` by window (stacked bar)
3. `sendRate` by window (line)
4. `completionRate` by window (line)
5. daily totals (`eligible`, `sent`, `completed`, `declined`, `blocked`) (single stat)

## Security and access notes

1. Keep `INTERNAL_SURVEYS_METRICS_TOKEN` only in secret manager.
2. Restrict endpoint path to private network/gateway allowlist.
3. Do not expose this endpoint in public API docs.
4. Rotate token on incident or personnel change.

## Change management

Before changing thresholds:

1. document reason
2. record before/after value
3. capture date of change
4. review impact after 7 days

This prevents alert fatigue and preserves metric comparability over time.
