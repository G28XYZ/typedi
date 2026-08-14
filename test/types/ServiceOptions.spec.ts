import { Container, ServiceOptions } from '../../src';

describe('ServiceOptions type contract', function () {
  it('requires exactly one creation strategy', function () {
    class ExampleService {}

    const byType: ServiceOptions<ExampleService> = { type: ExampleService };
    const byValue: ServiceOptions<number> = { id: 'typed-value', value: 1 };
    const byFactory: ServiceOptions<number> = { id: 'typed-factory', factory: () => 2 };

    expect([byType, byValue, byFactory]).toHaveLength(3);

    if (false) {
      // @ts-expect-error An explicit registration requires a creation strategy.
      Container.set({ id: 'missing-strategy' });

      // @ts-expect-error Creation strategies are mutually exclusive.
      const conflicting: ServiceOptions<number> = { id: 'conflicting', value: 1, factory: () => 2 };
      void conflicting;
    }
  });
});
