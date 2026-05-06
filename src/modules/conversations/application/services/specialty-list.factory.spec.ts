import { SpecialtyListFactory } from './specialty-list.factory';

describe('SpecialtyListFactory', () => {
  it('builds interactive list rows with specialty name only', () => {
    const factory = new SpecialtyListFactory();

    const message = factory.build([
      { code: '890201', name: 'MEDICINA GENERAL', cups: '890201' },
      { code: '890208', name: 'PSICOLOGIA', cups: null },
    ]);

    expect(message.type).toBe('interactive_list');
    expect(message.sections[0]?.title).toBe('Especialidades activas');
    expect(message.sections[0]?.rows).toEqual([
      { id: 'specialty:890201', title: 'MEDICINA GENERAL' },
      { id: 'specialty:890208', title: 'PSICOLOGIA' },
    ]);
  });
});
