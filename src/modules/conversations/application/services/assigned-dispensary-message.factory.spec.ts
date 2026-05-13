import { AssignedDispensaryMessageFactory } from './assigned-dispensary-message.factory';

describe('AssignedDispensaryMessageFactory', () => {
  it('builds assigned dispensary interactive buttons message', () => {
    const factory = new AssignedDispensaryMessageFactory();

    const message = factory.buildAssigned({
      patientFullName: 'DANIEL CASTANO',
      dispensaryName: 'DISPENSARIO SUPLYMEDICAL',
      dispensaryAddress: "CLL 29 CRA 13 FRENTE A MCDONALD'S",
      dispensaryCity: 'SANTA MARTA',
      dispensarySchedule: 'Lunes a viernes 8:00 - 12:00 y 2:00 a 6:00',
    });

    expect(message.type).toBe('interactive_buttons');
    expect(message.body).toContain(
      'Hola DANIEL CASTANO. Tu farmacia asignada es:',
    );
    expect(message.buttons).toEqual([
      { id: 'nav_main_menu', title: 'Menu principal' },
      { id: 'nav_finish', title: 'Finalizar' },
    ]);
  });
});
