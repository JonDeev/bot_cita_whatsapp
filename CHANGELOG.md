# Changelog

## 2026-06-30

### Improvements

- Admin chats and conversation detail views now show the visible text that patients actually received for supported outbound WhatsApp templates instead of only showing `template:<name>`.
- This applies to the current appointment reminder, phone verification, and satisfaction survey flow templates.
- Template observability now keeps the visible message in `body` and preserves technical template metadata separately for internal inspection.
- The template snapshot contract was tightened so observability stores only approved non-sensitive flow metadata.

### Notes

- Patient-facing WhatsApp flows and message delivery behavior were not changed.
- Technical details remain available in the admin panel according to the user's role.

## 2026-06-25

### Improvements

- The contact update flow now treats a valid email that matches the one already stored in the database as a successful verification instead of an error.
- When the email is unchanged, the bot does not try to write the same email again, but it does mark `correo_verificado_en`.
- This behavior applies both to the standalone `Actualizar contacto` flow and to the shared contact update subflow.
- The admin chat thread now keeps scroll behavior stable while messages load and the thread updates, which improves navigation in long conversations.
- Admin chat views now show the full phone number so support staff can identify conversations without losing context.

### Notes

- The user experience stays almost the same, but the repeated-email case no longer looks like a bug or blocks the conversation.
- No other conversation flows were changed.
