# AGENTS.md

## Project overview

This repository contains the official WhatsApp automation system for IPS SISM.

The goal is to replace the current non-official WhatsApp automation with a maintainable, auditable and secure backend based on Meta WhatsApp Cloud API.

The system must support:

- Patient appointment scheduling.
- Appointment consultation.
- Appointment cancellation and rescheduling.
- Appointment reminders.
- Satisfaction surveys.
- Frequently asked questions without AI.
- Medication pickup information.
- Delivery of clinical PDFs such as lab results, clinical history documents and care orders.
- Escalation to a human advisor.
- Full audit trail of patient interactions.

This project handles sensitive health-related data. Prioritize security, traceability, minimal data exposure and maintainability over quick shortcuts.

---

## Recommended stack

Use the following stack unless the user explicitly decides otherwise:

- Runtime: Node.js LTS.
- Language: TypeScript.
- Backend framework: NestJS.
- WhatsApp integration: Meta WhatsApp Cloud API.
- Existing database: MySQL.
- ORM: Prisma.
- Cache/session state: Redis.
- Background jobs: BullMQ with Redis.
- PDF generation: Playwright rendering HTML templates.
- Template engine for PDFs: Handlebars or Nunjucks.
- PDF manipulation: pdf-lib.
- Optional PDF protection or post-processing: qpdf through a controlled worker process.
- Logging: Pino or Winston.
- API validation: DTOs with class-validator/class-transformer or Zod.
- Testing: Jest or Vitest, Supertest, Testcontainers when database integration tests are needed.
- Deployment: Docker, Docker Compose, Nginx or Traefik.

Avoid introducing microservices at the beginning. Use a modular monolith first.

---

## Main architectural decision

Use a modular monolith with Hexagonal Architecture.

Core rule:

```txt
Controllers / Webhooks
        ↓
Application use cases
        ↓
Domain rules
        ↓
Repository ports / service ports
        ↓
Infrastructure adapters
        ↓
MySQL / Redis / WhatsApp Cloud API / PDF engine
```

Do not put business logic directly in controllers, webhook handlers or Prisma services.

---

## Suggested module structure

```txt
src/
  modules/
    whatsapp/
      presentation/
      application/
      domain/
      infrastructure/

    conversations/
      presentation/
      application/
      domain/
      infrastructure/

    patients/
      application/
      domain/
      infrastructure/

    appointments/
      application/
      domain/
      infrastructure/

    documents/
      application/
      domain/
      infrastructure/

    reminders/
      application/
      domain/
      infrastructure/

    surveys/
      application/
      domain/
      infrastructure/

    faq/
      application/
      domain/
      infrastructure/

    human-handoff/
      application/
      domain/
      infrastructure/

    audit/
      application/
      domain/
      infrastructure/
```

Each module must be small, focused and testable.

---

## Critical product rules

### Patient validation

The system must validate patients using:

```txt
document_number + birth_date
```

Use strict validation:

- Document number must be numeric and sanitized.
- Birth date must use a clear expected format, preferably `DD-MM-YYYY` in the WhatsApp flow and ISO date internally.
- Limit failed attempts.
- Do not echo full document numbers back to the patient.
- Mask sensitive identifiers in logs and UI.
- Store sensitive data only when necessary.
- Prefer encryption or hashing for sensitive values in bot-specific tables.

### PDF delivery

PDFs will be sent as WhatsApp document messages, not as links.

Required behavior:

```txt
Patient requests PDF
↓
Validate patient identity
↓
Generate or retrieve PDF
↓
Send PDF as WhatsApp document
↓
Delete temporary local file
↓
Save audit metadata
```

Do not store generated PDFs permanently unless there is a clear legal, operational or product requirement.

Always save document delivery metadata:

- Patient internal id.
- WhatsApp number.
- Document type.
- Message id returned by WhatsApp.
- Delivery status if available.
- Timestamp.
- Hash of the generated or sent file.
- Flow or use case that triggered the delivery.

### Human handoff

When the conversation is transferred to an advisor, the bot must stop responding automatically.

Conversation states must include at least:

```txt
BOT_ACTIVE
HUMAN_HANDOFF
CLOSED
EXPIRED
```

When `HUMAN_HANDOFF` is active:

- Continue receiving webhooks.
- Continue saving inbound and outbound messages.
- Do not generate automatic bot responses.
- Allow only advisor messages or explicitly approved system messages.
- The bot can resume only when the advisor closes or releases the conversation.

### No AI in the first version

Do not add generative AI to appointment scheduling, FAQ, document delivery or human handoff unless explicitly requested later.

For FAQ, use deterministic responses from a database or controlled knowledge table.

---

## WhatsApp integration guidelines

Use Meta WhatsApp Cloud API directly.

Recommended interaction components:

- Lists for menus and option selection.
- Buttons for simple confirmation.
- WhatsApp Flows for longer processes such as appointment scheduling, cancellation and rescheduling.
- Templates for outbound reminders, notifications and surveys outside the customer service window.

Do not implement the new official bot with `whatsapp-web.js`, Baileys, Evolution API or browser automation.

The Cloud API webhook must be treated as an external adapter. It should parse the incoming payload and forward a normalized command/event into the application layer.

Example:

```txt
WhatsApp webhook payload
↓
WhatsAppPayloadParser
↓
IncomingMessageReceived event
↓
ConversationOrchestrator
↓
CurrentStateHandler
↓
Use case
```

---

## Conversation engine

Use a State Machine pattern for the bot.

Example states:

```txt
MAIN_MENU
WAITING_DOCUMENT
WAITING_BIRTH_DATE
PATIENT_VALIDATED
SELECTING_SERVICE
SELECTING_APPOINTMENT_TYPE
SELECTING_SPECIALTY
SELECTING_DATE
SELECTING_TIME
CONFIRMING_APPOINTMENT
APPOINTMENT_CREATED
CONSULTING_APPOINTMENTS
CANCELING_APPOINTMENT
RESCHEDULING_APPOINTMENT
REQUESTING_DOCUMENT
SENDING_DOCUMENT
HUMAN_HANDOFF
CLOSED
```

Do not create one giant file with many `if`, `switch` or nested conditions.

Each state must have its own handler:

```txt
state-handlers/
  main-menu.handler.ts
  waiting-document.handler.ts
  waiting-birth-date.handler.ts
  selecting-specialty.handler.ts
  selecting-date.handler.ts
  selecting-time.handler.ts
  confirming-appointment.handler.ts
  human-handoff.handler.ts
```

---

## Design patterns to use

Use these patterns where they fit naturally:

- State Machine: conversation flow control.
- Strategy: different handlers for different message types or states.
- Command: actions such as assign appointment, cancel appointment, send PDF.
- Repository: database access through interfaces.
- Adapter: external systems such as WhatsApp, MySQL legacy schema, PDF engine.
- Factory: creation of outgoing WhatsApp messages.
- Outbox Pattern: reliable outgoing messages and audit consistency.
- Idempotency Key: avoid duplicate appointment creation or duplicate document sending.
- Test Data Builder: readable test data creation.

Avoid overengineering. Use patterns to reduce complexity, not to decorate the code.

---

## Database guidelines

The existing SISM database is MySQL and already contains patients, appointments, doctors, schedules and specialties.

Use Prisma for database access, but keep it behind repositories.

Do not access Prisma directly from controllers or webhook handlers.

For new bot persistence, prefer a separate MySQL database dedicated to the chatbot instead of creating bot tables inside the clinical legacy database. Keep the clinical MySQL database as the source for legacy healthcare data, and use the separate bot MySQL database for conversations, messages, audit, outbox and handoff data.

Preferred approach:

```txt
UseCase
↓
Repository interface
↓
Prisma implementation
↓
MySQL
```

For legacy tables:

- Use Prisma introspection.
- Keep legacy naming mapped carefully.
- Do not rename existing tables or fields without approval.
- Use raw SQL only when the query is too complex or Prisma becomes unclear.
- Keep raw SQL isolated in infrastructure repositories.

Recommended bot-specific tables:

```txt
bot_conversations
bot_messages
bot_sessions
bot_handoffs
bot_template_messages
bot_document_deliveries
bot_audit_events
bot_outbox_messages
```

Do not mix bot audit tables randomly with clinical tables.

---

## Logging and audit

All relevant events must be auditable.

Log and audit:

- Incoming WhatsApp messages.
- Outgoing WhatsApp messages.
- Webhook delivery ids.
- Template sends.
- Appointment creation attempts.
- Appointment cancellation attempts.
- Document requests.
- Document deliveries.
- Human handoff state changes.
- Validation failures.
- System errors.

Do not log full sensitive data in plain text.

Mask or protect:

- Document numbers.
- Birth dates.
- Patient names where not needed.
- Clinical document content.
- PDF body content.
- Tokens and secrets.

---

## Security rules

Never commit real credentials.

Use `.env` files locally and secret managers or deployment environment variables in production.

Required environment variables should be documented in `.env.example` without real values.

Example:

```txt
DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE
REDIS_URL=redis://localhost:6379
WHATSAPP_ACCESS_TOKEN=replace_me
WHATSAPP_PHONE_NUMBER_ID=replace_me
WHATSAPP_VERIFY_TOKEN=replace_me
WHATSAPP_BUSINESS_ACCOUNT_ID=replace_me
```

Security requirements:

- Verify WhatsApp webhook signatures when supported by the integration.
- Use HTTPS in production.
- Protect internal endpoints.
- Apply rate limits to public endpoints.
- Validate all incoming payloads.
- Use idempotency for webhook processing.
- Do not trust user text directly.
- Sanitize all document numbers and dates.
- Restrict access to advisor panels by role.
- Keep audit records immutable when possible.

---

## PDF generation guidelines

Preferred method:

```txt
HTML template → Playwright → PDF
```

Use templates for:

- Clinical history documents.
- Lab results.
- Care orders.
- Institutional headers and footers.

Recommended structure:

```txt
src/modules/documents/
  application/
    use-cases/
      generate-clinical-history-pdf.use-case.ts
      send-clinical-document.use-case.ts
  infrastructure/
    pdf/
      templates/
        clinical-history.hbs
        lab-result.hbs
        care-order.hbs
      playwright-pdf.generator.ts
      pdf-lib-document-processor.ts
```

PDF generation should run in a worker when it is heavy or when it blocks the webhook response.

Do not keep temporary PDFs longer than necessary.

---

## Background jobs

Use BullMQ for:

- Appointment reminders.
- Satisfaction surveys.
- Retry of outgoing messages.
- PDF generation when needed.
- Message delivery reconciliation.
- Cleanup of temporary files.

Jobs must be idempotent.

Every job should have:

- Clear name.
- Retry policy.
- Dead-letter or failed-job tracking.
- Correlation id.
- Audit event when relevant.

---

## Coding style

General rules:

- TypeScript strict mode.
- Prefer small files with one clear responsibility.
- Avoid files with hundreds of lines when the logic can be split naturally.
- Use explicit names for use cases, handlers and repositories.
- Avoid magic strings for states, template names and message types.
- Use enums or constant objects for conversation states and WhatsApp message types.
- Keep domain rules independent from NestJS, Prisma and WhatsApp payloads.
- Avoid business logic inside DTOs.
- Avoid business logic inside Prisma models.
- Avoid large utility files that become dumping grounds.

Naming examples:

```txt
assign-appointment.use-case.ts
cancel-appointment.use-case.ts
send-clinical-document.use-case.ts
validate-patient-by-document-and-birth-date.use-case.ts
whatsapp-cloud-api.adapter.ts
conversation-state-machine.service.ts
appointment.repository.ts
prisma-appointment.repository.ts
```

---

## Error handling

Errors must be controlled and user-friendly.

Do not expose internal errors to the patient.

Examples:

```txt
Internal: Prisma connection timeout
Patient: En este momento no podemos consultar la agenda. Intente nuevamente en unos minutos o contacte a un asesor.
```

For failed patient validation:

- Do not reveal whether the document exists.
- Do not reveal extra patient data.
- Limit attempts.
- After repeated failures, offer human handoff.

---

## Testing instructions

Tests must be modular and focused.

Do not create one huge test file for the entire app.

Recommended structure:

```txt
src/modules/appointments/
  application/
    use-cases/
      assign-appointment.use-case.spec.ts
      cancel-appointment.use-case.spec.ts

src/modules/conversations/
  application/
    state-handlers/
      waiting-document.handler.spec.ts
      waiting-birth-date.handler.spec.ts
      selecting-specialty.handler.spec.ts
      human-handoff.handler.spec.ts

test/e2e/
  whatsapp-appointment-flow.e2e-spec.ts
  whatsapp-cancel-appointment-flow.e2e-spec.ts
  whatsapp-document-delivery-flow.e2e-spec.ts
  whatsapp-human-handoff.e2e-spec.ts
```

Use these testing patterns:

- Arrange, Act, Assert.
- Given, When, Then naming for flow tests.
- Test Data Builder for patients, appointments and WhatsApp payloads.
- Mock Adapter for WhatsApp Cloud API.
- In-memory fake repositories for unit tests.
- Testcontainers for integration tests with MySQL and Redis when needed.
- Contract tests for WhatsApp webhook payload normalization.

A test file should normally focus on one use case, one handler or one end-to-end flow.

---

## Suggested commands

Adjust these commands to the actual repository scripts.

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:studio
```

Before finishing a coding task, run the smallest relevant check first.

Examples:

```bash
pnpm test -- assign-appointment
pnpm test -- waiting-document.handler
pnpm lint
pnpm build
```

If a task changes database access, run Prisma generation and relevant tests.

---

## Development workflow for agents

When modifying the project:

1. Read this `AGENTS.md` first.
2. Identify the affected module.
3. Make the smallest safe change.
4. Avoid broad rewrites unless explicitly requested.
5. Keep architecture boundaries intact.
6. Add or update tests for changed behavior.
7. Run relevant checks.
8. Explain what changed and what was not changed.

Do not silently introduce:

- AI dependencies.
- Unofficial WhatsApp libraries.
- New databases.
- New queues.
- New frameworks.
- Breaking schema changes.
- Hardcoded credentials.

---

## Human advisor panel rules

If an advisor panel is implemented:

- Advisors must authenticate.
- Advisors must see only conversations they are allowed to handle.
- The panel must show the current conversation status.
- The panel must make it clear when the bot is paused.
- Advisors must be able to close or release a conversation.
- All advisor messages must be stored in `bot_messages`.
- All state changes must be stored in `bot_audit_events`.

---

## WhatsApp coexistence note

If official WhatsApp coexistence is enabled for the number, treat it as an operational transition feature, not as the system core.

The backend remains the source of truth for:

- Conversation state.
- Bot pause/resume.
- Audit trail.
- Document delivery tracking.
- Appointment actions.

If an advisor responds manually from the phone or business app, the system must avoid sending automatic bot replies for that conversation when human attention is active.

---

## What not to do

Do not:

- Build the new official solution on top of `whatsapp-web.js`.
- Create one giant webhook handler with all logic.
- Put appointment logic inside WhatsApp adapter code.
- Send automatic bot messages during human handoff.
- Store credentials in the repository.
- Store generated PDFs permanently without a clear requirement.
- Log complete document numbers or clinical content in plain text.
- Add AI unless explicitly requested.
- Skip audit logs for document delivery.
- Create huge test files that mix unrelated flows.

---

## Definition of done

A change is complete only when:

- The code is modular and follows the boundaries in this file.
- Sensitive data exposure has been reviewed.
- Audit events are created for important actions.
- Relevant unit or flow tests are added or updated.
- The smallest relevant test command passes.
- The code does not introduce unofficial WhatsApp automation.
- The bot correctly stops when the conversation enters human handoff.
- PDF delivery, if touched, records metadata and cleans temporary files.
