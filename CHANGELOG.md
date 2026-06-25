# Changelog

## 2026-06-25

### Improvements

- The contact update flow now treats a valid email that matches the one already stored in the database as a successful verification instead of an error.
- When the email is unchanged, the bot does not try to write the same email again, but it does mark `correo_verificado_en`.
- This behavior applies both to the standalone `Actualizar contacto` flow and to the shared contact update subflow.

### Notes

- The user experience stays almost the same, but the repeated-email case no longer looks like a bug or blocks the conversation.
- No other conversation flows were changed.
