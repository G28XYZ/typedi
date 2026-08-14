import 'reflect-metadata';
import { Container, Inject, Service, ServiceNotFoundError } from '../src';

describe('Container regressions', function () {
  beforeEach(() => Container.reset({ strategy: 'resetServices' }));

  it('keeps one instance per service in a scoped circular graph', async function () {
    let classAInstances = 0;
    let classBInstances = 0;

    @Service({ scope: 'container' })
    class ClassA {
      @Inject(() => ClassB)
      classB: unknown;

      constructor() {
        classAInstances += 1;
      }
    }

    @Service({ scope: 'container' })
    class ClassB {
      @Inject(() => ClassA)
      classA: unknown;

      constructor() {
        classBInstances += 1;
      }
    }

    const scopedContainer = Container.of('regression-circular-scope');

    try {
      const classA = scopedContainer.get(ClassA);
      const classB = classA.classB as ClassB;

      expect(classAInstances).toBe(1);
      expect(classBInstances).toBe(1);
      expect(classB.classA).toBe(classA);
      expect(scopedContainer.get(ClassB)).toBe(classB);
    } finally {
      await scopedContainer.dispose();
    }
  });

  it('retries property injection after a dependency becomes available', function () {
    @Service({ scope: 'container' })
    class Consumer {
      @Inject('late-dependency')
      dependency?: number;
    }

    expect(() => Container.get(Consumer)).toThrow(ServiceNotFoundError);

    Container.set('late-dependency', 42);

    expect(Container.get(Consumer).dependency).toBe(42);
  });

  it('allows a disposed scoped container identifier to be reused', async function () {
    const firstContainer = Container.of('regression-disposed-scope');
    await firstContainer.dispose();

    const secondContainer = Container.of('regression-disposed-scope');

    try {
      expect(secondContainer).not.toBe(firstContainer);
      expect(() => secondContainer.set('value', 1)).not.toThrow();
    } finally {
      await secondContainer.dispose();
    }
  });

  it('resolves container-scoped multi-services inside a scoped container', async function () {
    @Service({ id: 'scoped-multi-services', multiple: true, scope: 'container' })
    class FirstService {}

    @Service({ id: 'scoped-multi-services', multiple: true, scope: 'container' })
    class SecondService {}

    const scopedContainer = Container.of('regression-multi-scope');

    try {
      const firstResolution = scopedContainer.getMany('scoped-multi-services');
      const secondResolution = scopedContainer.getMany('scoped-multi-services');

      expect(firstResolution).toHaveLength(2);
      expect(firstResolution[0]).toBeInstanceOf(FirstService);
      expect(firstResolution[1]).toBeInstanceOf(SecondService);
      expect(secondResolution[0]).toBe(firstResolution[0]);
      expect(secondResolution[1]).toBe(firstResolution[1]);
    } finally {
      await scopedContainer.dispose();
    }
  });

  it('removes every service from a multi-service registration', function () {
    Container.set({ id: 'removable-multi-services', value: 1, multiple: true });
    Container.set({ id: 'removable-multi-services', value: 2, multiple: true });

    expect(Container.getMany('removable-multi-services')).toEqual([1, 2]);

    Container.remove('removable-multi-services');

    expect(Container.has('removable-multi-services')).toBe(false);
    expect(() => Container.getMany('removable-multi-services')).toThrow(ServiceNotFoundError);
  });
});
