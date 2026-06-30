import { TemplateMessageSnapshotService } from './template-message-snapshot.service';

describe('TemplateMessageSnapshotService', () => {
  let service: TemplateMessageSnapshotService;

  beforeEach(() => {
    service = new TemplateMessageSnapshotService();
  });

  it('builds a deterministic appointment reminder snapshot with normalized parameters', () => {
    const input = {
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      bodyTextParameters: [
        '  MARIA PEREZ\u200B  ',
        ' MEDICINA GENERAL ',
        ' PRESENCIAL ',
        ' 2099-04-01 ',
        ' 13:00 ',
        ' SANTA MARTA ',
        ' CALLE 15 ',
        ' DR. JUAN MARTINEZ ',
      ],
    } as const;

    const firstSnapshot = service.buildAppointmentReminderSnapshot(input);
    const secondSnapshot = service.buildAppointmentReminderSnapshot(input);

    expect(firstSnapshot).toEqual(secondSnapshot);
    expect(firstSnapshot.bodyTextParameters).toEqual([
      'MARIA PEREZ',
      'MEDICINA GENERAL',
      'PRESENCIAL',
      '2099-04-01',
      '13:00',
      'SANTA MARTA',
      'CALLE 15',
      'DR. JUAN MARTINEZ',
    ]);
    expect(firstSnapshot.visibleBody).toBe(
      'Hola MARIA PEREZ. Te recordamos tu cita en IPS SISM:\n\n' +
        '🩺 Tipo de cita: MEDICINA GENERAL\n' +
        '⚕️ Modalidad: PRESENCIAL\n' +
        '📅 Fecha: 2099-04-01\n' +
        '⏰ Hora: 13:00\n' +
        '🌆 Ciudad: SANTA MARTA\n' +
        '🧭 Dirección: CALLE 15\n' +
        '👨‍⚕️ Profesional: DR. JUAN MARTINEZ\n\n' +
        '❗ Recuerda llegar 15 minutos antes para activar tu cita y evitar retrasos en tu atención.',
    );
    expect(firstSnapshot.flowMetadata).toBeUndefined();
  });

  it('builds a phone verification snapshot with trimmed buttons and fallback patient name', () => {
    const snapshot = service.buildSurveyPhoneVerificationSnapshot({
      templateName: 'verificacion_telefono_paciente',
      languageCode: 'es_CO',
      bodyTextParameters: ['   '],
      visibleButtons: [
        { index: ' 0 ', title: ' Confirmar ' },
        { index: ' 1 ', title: ' No lo reconozco ' },
      ],
      buttonPayloads: [
        { index: ' 0 ', payload: ' ssv_confirm:abc ' },
        { index: ' 1 ', payload: ' ssv_reject:def ' },
      ],
    });

    expect(snapshot.visibleBody).toBe(
      '👋 Hola Paciente. Somos IPS SISM.\n\n' +
        'Confirma si este numero celular te pertenece o si estas autorizado(a) para recibir recordatorios de citas, encuestas de satisfaccion y notificaciones importantes sobre servicios de salud de este paciente.\n\n' +
        'Por proteccion de tus datos, no enviaremos informacion de citas hasta confirmar este contacto.\n\n' +
        'Selecciona una opcion:',
    );
    expect(snapshot.visibleButtons).toEqual([
      { index: '0', title: 'Confirmar' },
      { index: '1', title: 'No lo reconozco' },
    ]);
    expect(snapshot.buttonPayloads).toEqual([
      { index: '0', payload: 'ssv_confirm:abc' },
      { index: '1', payload: 'ssv_reject:def' },
    ]);
    expect(snapshot.bodyTextParameters).toEqual(['']);
  });

  it('builds a survey flow invitation snapshot with flow metadata', () => {
    const snapshot = service.buildSurveyFlowInvitationSnapshot({
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['JUAN PEREZ', 'MEDICINA GENERAL', '07:20 AM'],
      buttonIndex: ' 0 ',
      dispatchId: ' 501 ',
      surveyDateIso: ' 2026-05-10 ',
    });

    expect(snapshot.visibleBody).toBe(
      'Hola *JUAN PEREZ*! Tu opinion es muy valiosa para nosotros y queremos mejorar para ti. Como 🏥 *IPS SISM* nos gustaria conocer tu experiencia en la atencion de tu cita de 🩺 *MEDICINA GENERAL* a las *07:20 AM*.\n\n' +
        'Selecciona el boton para responder la breve encuesta.',
    );
    expect(snapshot.flowMetadata).toEqual({
      buttonIndex: '0',
      ctaLabel: 'Responder encuesta',
      dispatchId: '501',
      surveyDateIso: '2026-05-10',
    });
  });

  it('changes the rendered hash when the visible reminder content changes', () => {
    const baseSnapshot = service.buildAppointmentReminderSnapshot({
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      bodyTextParameters: [
        'MARIA PEREZ',
        'MEDICINA GENERAL',
        'PRESENCIAL',
        '2099-04-01',
        '13:00',
        'SANTA MARTA',
        'CALLE 15',
        'DR. JUAN MARTINEZ',
      ],
    });
    const changedSnapshot = service.buildAppointmentReminderSnapshot({
      templateName: 'recordatorio_cita_24h',
      languageCode: 'es_CO',
      bodyTextParameters: [
        'MARIA PEREZ',
        'MEDICINA GENERAL',
        'VIRTUAL',
        '2099-04-01',
        '13:00',
        'SANTA MARTA',
        'CALLE 15',
        'DR. JUAN MARTINEZ',
      ],
    });

    expect(changedSnapshot.visibleBody).not.toBe(baseSnapshot.visibleBody);
    expect(changedSnapshot.renderedHash).not.toBe(baseSnapshot.renderedHash);
  });

  it('keeps the rendered hash stable when only technical metadata changes', () => {
    const firstVerificationSnapshot =
      service.buildSurveyPhoneVerificationSnapshot({
        templateName: 'verificacion_telefono_paciente',
        languageCode: 'es_CO',
        bodyTextParameters: ['JUAN PEREZ'],
        visibleButtons: [
          { index: '0', title: 'Confirmar' },
          { index: '1', title: 'No lo reconozco' },
        ],
        buttonPayloads: [
          { index: '0', payload: 'verification:confirm:dispatch-1' },
          { index: '1', payload: 'verification:reject:dispatch-1' },
        ],
      });
    const secondVerificationSnapshot =
      service.buildSurveyPhoneVerificationSnapshot({
        templateName: 'verificacion_telefono_paciente',
        languageCode: 'es_CO',
        bodyTextParameters: ['JUAN PEREZ'],
        visibleButtons: [
          { index: '0', title: 'Confirmar' },
          { index: '1', title: 'No lo reconozco' },
        ],
        buttonPayloads: [
          { index: '0', payload: 'verification:confirm:dispatch-2' },
          { index: '1', payload: 'verification:reject:dispatch-2' },
        ],
      });

    expect(firstVerificationSnapshot.visibleBody).toBe(
      secondVerificationSnapshot.visibleBody,
    );
    expect(firstVerificationSnapshot.renderedHash).toBe(
      secondVerificationSnapshot.renderedHash,
    );

    const firstFlowSnapshot = service.buildSurveyFlowInvitationSnapshot({
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['JUAN PEREZ', 'MEDICINA GENERAL', '07:20 AM'],
      buttonIndex: '0',
      dispatchId: '501',
      surveyDateIso: '2026-05-10',
    });
    const secondFlowSnapshot = service.buildSurveyFlowInvitationSnapshot({
      templateName: 'satisfaction_survey_flow',
      languageCode: 'es_CO',
      bodyTextParameters: ['JUAN PEREZ', 'MEDICINA GENERAL', '07:20 AM'],
      buttonIndex: '0',
      dispatchId: '999',
      surveyDateIso: '2026-05-11',
    });

    expect(firstFlowSnapshot.visibleBody).toBe(secondFlowSnapshot.visibleBody);
    expect(firstFlowSnapshot.renderedHash).toBe(
      secondFlowSnapshot.renderedHash,
    );
  });
});
