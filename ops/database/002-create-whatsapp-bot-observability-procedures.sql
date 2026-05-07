-- WhatsApp Bot observability stored procedures.
-- Run this in the `whatsapp_bot` database with a privileged deployment user.
-- These procedures are read-only diagnostics for production operations.

USE `whatsapp_bot`;

DELIMITER $$

DROP PROCEDURE IF EXISTS `sp_bot_webhook_recent_events`$$
CREATE PROCEDURE `sp_bot_webhook_recent_events`(
  IN p_phone VARCHAR(32),
  IN p_limit INT
)
BEGIN
  DECLARE v_limit INT DEFAULT 50;

  IF p_limit IS NOT NULL AND p_limit > 0 AND p_limit <= 500 THEN
    SET v_limit = p_limit;
  END IF;

  SELECT
    e.id,
    e.deduplication_key,
    e.event_kind,
    e.message_type,
    e.participant_phone,
    e.provider_message_id,
    e.processing_status,
    e.rejection_reason,
    e.provider_occurred_at AS provider_occurred_at_utc,
    e.received_at AS received_at_utc,
    TIMESTAMPDIFF(SECOND, e.provider_occurred_at, e.received_at) AS provider_to_receive_seconds,
    CONVERT_TZ(e.provider_occurred_at, '+00:00', '-05:00') AS provider_occurred_at_cot,
    CONVERT_TZ(e.received_at, '+00:00', '-05:00') AS received_at_cot
  FROM bot_webhook_events e
  WHERE p_phone IS NULL OR e.participant_phone = p_phone
  ORDER BY e.id DESC
  LIMIT v_limit;
END$$

DROP PROCEDURE IF EXISTS `sp_bot_webhook_status_summary`$$
CREATE PROCEDURE `sp_bot_webhook_status_summary`(
  IN p_minutes_back INT
)
BEGIN
  DECLARE v_minutes INT DEFAULT 60;

  IF p_minutes_back IS NOT NULL AND p_minutes_back > 0 AND p_minutes_back <= 10080 THEN
    SET v_minutes = p_minutes_back;
  END IF;

  SELECT
    e.processing_status,
    e.event_kind,
    COALESCE(e.message_type, 'UNKNOWN') AS message_type,
    COUNT(*) AS total_events
  FROM bot_webhook_events e
  WHERE e.received_at >= (UTC_TIMESTAMP() - INTERVAL v_minutes MINUTE)
  GROUP BY e.processing_status, e.event_kind, COALESCE(e.message_type, 'UNKNOWN')
  ORDER BY total_events DESC;
END$$

DROP PROCEDURE IF EXISTS `sp_bot_conversation_timeline`$$
CREATE PROCEDURE `sp_bot_conversation_timeline`(
  IN p_phone VARCHAR(32),
  IN p_limit INT
)
BEGIN
  DECLARE v_limit INT DEFAULT 100;
  DECLARE v_conversation_key VARCHAR(191);

  IF p_phone IS NULL OR p_phone = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'p_phone is required';
  END IF;

  IF p_limit IS NOT NULL AND p_limit > 0 AND p_limit <= 1000 THEN
    SET v_limit = p_limit;
  END IF;

  SELECT c.conversation_key
  INTO v_conversation_key
  FROM bot_conversations c
  WHERE c.participant_phone = p_phone
  ORDER BY c.updated_at DESC
  LIMIT 1;

  SELECT
    m.id,
    m.direction,
    m.message_type,
    m.provider_message_id,
    m.content,
    m.occurred_at AS occurred_at_utc,
    m.provider_occurred_at AS provider_occurred_at_utc,
    m.received_at AS received_at_utc,
    m.sent_at AS sent_at_utc,
    CONVERT_TZ(m.occurred_at, '+00:00', '-05:00') AS occurred_at_cot
  FROM bot_messages m
  WHERE m.participant_phone = p_phone
  ORDER BY m.id DESC
  LIMIT v_limit;

  IF v_conversation_key IS NOT NULL THEN
    SELECT
      a.id,
      a.action,
      a.conversation_key,
      a.occurred_at AS occurred_at_utc,
      CONVERT_TZ(a.occurred_at, '+00:00', '-05:00') AS occurred_at_cot,
      a.metadata
    FROM bot_audit_events a
    WHERE a.conversation_key = v_conversation_key
    ORDER BY a.id DESC
    LIMIT v_limit;
  END IF;

  SELECT
    e.id,
    e.event_kind,
    e.message_type,
    e.provider_message_id,
    e.processing_status,
    e.rejection_reason,
    e.provider_occurred_at AS provider_occurred_at_utc,
    e.received_at AS received_at_utc,
    CONVERT_TZ(e.received_at, '+00:00', '-05:00') AS received_at_cot
  FROM bot_webhook_events e
  WHERE e.participant_phone = p_phone
  ORDER BY e.id DESC
  LIMIT v_limit;
END$$

DROP PROCEDURE IF EXISTS `sp_bot_clock_diagnostics`$$
CREATE PROCEDURE `sp_bot_clock_diagnostics`()
BEGIN
  SELECT
    UTC_TIMESTAMP() AS utc_now,
    NOW() AS db_session_now,
    TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), NOW()) AS db_session_utc_offset_hours,
    CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00') AS colombia_now_from_utc;
END$$

DELIMITER ;
