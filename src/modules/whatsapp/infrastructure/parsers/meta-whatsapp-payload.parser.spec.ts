import { MetaWhatsappPayloadParser } from './meta-whatsapp-payload.parser';

describe('MetaWhatsappPayloadParser', () => {
  it('parses incoming messages, list replies and status updates', () => {
    const parser = new MetaWhatsappPayloadParser();
    const receivedAt = '2026-05-07T12:44:15.000Z';

    const payload = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    id: 'wamid-msg',
                    from: '573001112233',
                    timestamp: '1711111111',
                    type: 'interactive',
                    context: {
                      id: 'wamid-outbound',
                    },
                    interactive: {
                      list_reply: {
                        id: 'main_menu_request_appointment',
                        title: '⚕️ Solicitud de cita',
                      },
                    },
                  },
                ],
                statuses: [
                  {
                    id: 'wamid-status',
                    recipient_id: '573001112233',
                    status: 'delivered',
                    timestamp: '1711111112',
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = parser.parse(payload, receivedAt);

    expect(events).toHaveLength(2);
    expect(events[0].kind).toBe('incoming_message_received');
    expect(events[0]).toMatchObject({
      receivedAt,
      contextMessageId: 'wamid-outbound',
      interactiveReplyId: 'main_menu_request_appointment',
      interactiveReplyTitle: '⚕️ Solicitud de cita',
    });
    expect(events[1].kind).toBe('message_status_changed');
  });

  it('returns empty list for invalid payload', () => {
    const parser = new MetaWhatsappPayloadParser();
    expect(parser.parse(null, '2026-05-07T12:44:15.000Z')).toEqual([]);
  });

  it('parses interactive button replies', () => {
    const parser = new MetaWhatsappPayloadParser();

    const payload = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    id: 'wamid-btn',
                    from: '573001112233',
                    timestamp: '1711111115',
                    type: 'interactive',
                    interactive: {
                      button_reply: {
                        id: 'nav_finish',
                        title: 'Finalizar',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const events = parser.parse(payload, '2026-05-07T12:44:15.000Z');

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'incoming_message_received',
      interactiveReplyId: 'nav_finish',
      interactiveReplyTitle: 'Finalizar',
    });
  });

  it('ignores changes from unsupported fields', () => {
    const parser = new MetaWhatsappPayloadParser();

    const payload = {
      entry: [
        {
          changes: [
            {
              field: 'message_template_status_update',
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    id: 'wamid-msg',
                    from: '573001112233',
                    timestamp: '1711111111',
                    type: 'text',
                    text: {
                      body: 'hola',
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    expect(parser.parse(payload, '2026-05-07T12:44:15.000Z')).toEqual([]);
  });
});
