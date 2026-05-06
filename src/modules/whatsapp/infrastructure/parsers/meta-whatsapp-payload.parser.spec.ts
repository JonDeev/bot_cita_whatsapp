import { MetaWhatsappPayloadParser } from './meta-whatsapp-payload.parser';

describe('MetaWhatsappPayloadParser', () => {
  it('parses incoming messages, list replies and status updates', () => {
    const parser = new MetaWhatsappPayloadParser();

    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '123' },
                messages: [
                  {
                    id: 'wamid-msg',
                    from: '573001112233',
                    timestamp: '1711111111',
                    type: 'interactive',
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

    const events = parser.parse(payload);

    expect(events).toHaveLength(2);
    expect(events[0].kind).toBe('incoming_message_received');
    expect(events[0]).toMatchObject({
      interactiveReplyId: 'main_menu_request_appointment',
      interactiveReplyTitle: '⚕️ Solicitud de cita',
    });
    expect(events[1].kind).toBe('message_status_changed');
  });

  it('returns empty list for invalid payload', () => {
    const parser = new MetaWhatsappPayloadParser();
    expect(parser.parse(null)).toEqual([]);
  });

  it('parses interactive button replies', () => {
    const parser = new MetaWhatsappPayloadParser();

    const payload = {
      entry: [
        {
          changes: [
            {
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

    const events = parser.parse(payload);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'incoming_message_received',
      interactiveReplyId: 'nav_finish',
      interactiveReplyTitle: 'Finalizar',
    });
  });
});
