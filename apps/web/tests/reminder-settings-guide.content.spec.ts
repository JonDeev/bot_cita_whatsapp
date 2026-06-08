import { reminderSettingsGuideSections } from '../src/features/reminder-settings-guide/reminder-settings-guide.content';

describe('reminder-settings guide content', () => {
  it('keeps the expected operational sections in order', () => {
    expect(reminderSettingsGuideSections.map((section) => section.id)).toEqual([
      'que-controla-esta-pantalla',
      'estados-operativos-y-modos-de-envio',
      'como-activar-reminders-de-forma-segura',
      'como-usar-pausa-de-emergencia',
      'referencia-de-campos',
      'buenas-practicas-operativas',
      'errores-comunes-y-que-hacer',
      'como-auditar-cambios',
    ]);
  });
});

