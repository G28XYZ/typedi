import 'reflect-metadata';
import { Service } from '../../src/decorators/service.decorator';
import { Inject } from '../../src/decorators/inject.decorator';
import { InjectMany } from '../../src/decorators/inject-many.decorator';
import { Container } from '../../src/index';

type StandardClassDecoratorContextLike = {
  kind: 'class';
  name?: string;
  addInitializer(initializer: (this: unknown) => void): void;
};

type StandardClassMemberDecoratorContextLike = {
  kind: 'field' | 'accessor';
  name: string | symbol;
  static?: boolean;
  private?: boolean;
};

function applyStandardClassDecorator<T extends Function>(target: T, decoratorFactory: () => Function): T {
  const initializers: Array<(this: unknown) => void> = [];
  const decorator = decoratorFactory();
  const context: StandardClassDecoratorContextLike = {
    kind: 'class',
    name: target.name,
    addInitializer(initializer: (this: unknown) => void): void {
      initializers.push(initializer);
    },
  };

  const decoratedTarget = (decorator(target, context) as T) || target;
  initializers.forEach(initializer => initializer.call(decoratedTarget));
  return decoratedTarget;
}

function createStandardFieldInitializer(
  decoratorFactory: () => Function,
  propertyName: string
): (this: unknown, value: unknown) => unknown {
  const decorator = decoratorFactory();
  const context: StandardClassMemberDecoratorContextLike = {
    kind: 'field',
    name: propertyName,
    static: false,
    private: false,
  };
  const initializer = decorator(undefined, context) as ((this: unknown, value: unknown) => unknown) | undefined;

  if (!initializer) {
    throw new Error(`Expected field initializer for "${propertyName}"`);
  }

  return initializer;
}

describe('Standard Decorators Compatibility', function () {
  beforeEach(() => Container.reset({ strategy: 'resetValue' }));

  it('should register service using standard class decorator context', function () {
    class StandardDecoratedService {}

    const DecoratedService = applyStandardClassDecorator(StandardDecoratedService, () => Service());
    const resolved = Container.get(DecoratedService);

    expect(resolved).toBeInstanceOf(DecoratedService);
  });

  it('should resolve Inject with standard field decorator in scoped containers', function () {
    @Service()
    class Engine {}

    const fieldInitializer = createStandardFieldInitializer(() => Inject(() => Engine), 'engine');

    @Service()
    class Car {
      public engine = fieldInitializer.call(this, undefined) as Engine;
    }

    const defaultCar = Container.get(Car);
    const scopedContainer = Container.of('standard-inject-scope');
    const scopedCar = scopedContainer.get(Car);

    expect(defaultCar.engine).toBeInstanceOf(Engine);
    expect(scopedCar.engine).toBeInstanceOf(Engine);
    expect(defaultCar.engine).not.toBe(scopedCar.engine);
  });

  it('should resolve Inject with resolveNew option for manually created instance', function () {
    @Service()
    class Engine {}

    const fieldInitializer = createStandardFieldInitializer(() => Inject(() => Engine, { resolveNew: true }), 'engine');

    class Car {
      public engine = fieldInitializer.call(this, undefined) as Engine;
    }

    expect(new Car().engine).toBeInstanceOf(Engine);
  });

  it('should resolve InjectMany with standard field decorator', function () {
    interface CarModel {
      name: string;
    }

    @Service({ id: 'standard-cars', multiple: true })
    class Bmw implements CarModel {
      name = 'BMW';
    }

    @Service({ id: 'standard-cars', multiple: true })
    class Mercedes implements CarModel {
      name = 'Mercedes';
    }

    @Service({ id: 'standard-cars', multiple: true })
    class Toyota implements CarModel {
      name = 'Toyota';
    }

    const fieldInitializer = createStandardFieldInitializer(() => InjectMany('standard-cars'), 'cars');

    @Service()
    class CarFactory {
      public cars = fieldInitializer.call(this, undefined) as CarModel[];
    }

    const names = Container.get(CarFactory).cars.map(car => car.name);

    expect(names).toContain('BMW');
    expect(names).toContain('Mercedes');
    expect(names).toContain('Toyota');
  });

  it('should infer reflected type for standard field decorator when metadata exists', function () {
    @Service()
    class DashboardService {}

    const fieldInitializer = createStandardFieldInitializer(() => Inject(), 'dashboardService');

    @Service()
    class DashboardController {
      public dashboardService = fieldInitializer.call(this, undefined) as DashboardService;
    }

    Reflect.defineMetadata('design:type', DashboardService, DashboardController.prototype, 'dashboardService');

    expect(Container.get(DashboardController).dashboardService).toBeInstanceOf(DashboardService);
  });
});
