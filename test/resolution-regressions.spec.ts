import 'reflect-metadata';
import { Container, ContainerInstance, Inject, ServiceNotFoundError, Token } from '../src/index';

describe('Container resolution regressions', () => {
  const containers: ContainerInstance[] = [];

  function scopedContainer(): ContainerInstance {
    const container = Container.of(Symbol());
    containers.push(container);
    return container;
  }

  beforeEach(() => {
    Container.reset({ strategy: 'resetServices' });
    Container.setDefaultScope('singleton');
  });

  afterEach(() => {
    containers.splice(0).forEach(container => container.reset({ strategy: 'resetServices' }));
    Container.reset({ strategy: 'resetServices' });
  });

  it('resolves a singleton in the default container even when a request container asks first', () => {
    const context = new Token<string>('context');
    const shared = new Token<{ context: string; container: ContainerInstance }>('shared');
    Container.set({ id: context, value: 'default', scope: 'container' });
    Container.set({
      id: shared,
      scope: 'singleton',
      factory: (container: ContainerInstance) => ({ context: container.get(context), container }),
    });
    const request = scopedContainer();
    request.set({ id: context, value: 'request', scope: 'container' });

    const instance = request.get(shared);

    expect(instance.context).toBe('default');
    expect(instance.container).toBe(Container);
    expect(Container.get(shared)).toBe(instance);
    expect(scopedContainer().get(shared)).toBe(instance);
  });

  it('creates a fresh inherited transient on every resolution', () => {
    class Transient {}
    Container.set({ id: Transient, type: Transient, scope: 'transient' });
    const request = scopedContainer();

    const first = request.get(Transient);

    expect(request.get(Transient)).not.toBe(first);
    expect(request.get(Transient)).not.toBe(first);
    expect(Container.get(Transient)).not.toBe(first);
  });

  it('preserves service identity across circular properties in a child container', () => {
    class First {
      second: Second;
    }
    class Second {
      first: First;
    }
    Inject(() => Second)(First.prototype, 'second');
    Inject(() => First)(Second.prototype, 'first');
    Container.set({ id: First, type: First, scope: 'container' });
    Container.set({ id: Second, type: Second, scope: 'container' });
    const request = scopedContainer();

    const first = request.get(First);

    expect(first.second.first).toBe(first);
    expect(request.get(First)).toBe(first);
    expect(request.get(Second)).toBe(first.second);
    expect(Container.get(First)).not.toBe(first);
  });

  it.each(['container', 'transient'] as const)('inherits multiple services with %s scope', scope => {
    class Handler {}
    const handlers = new Token<Handler>('handlers');
    Container.set({ id: handlers, type: Handler, multiple: true, scope });
    Container.set({ id: handlers, type: Handler, multiple: true, scope });
    const request = scopedContainer();

    const first = request.getMany(handlers);
    const second = request.getMany(handlers);

    expect(first).toHaveLength(2);
    expect(first[0]).not.toBe(first[1]);
    expect(first[0]).not.toBe(Container.getMany(handlers)[0]);
    expect(first[0]).not.toBe(scopedContainer().getMany(handlers)[0]);
    if (scope === 'container') {
      expect(second[0]).toBe(first[0]);
    } else {
      expect(second[0]).not.toBe(first[0]);
    }
  });

  it('keeps a locally registered multiple group in preference to the inherited group', () => {
    const handlers = new Token<string>('handlers');
    Container.set({ id: handlers, value: 'default', multiple: true, scope: 'container' });
    const request = scopedContainer();
    request.set({ id: handlers, value: 'request', multiple: true, scope: 'container' });

    expect(request.getMany(handlers)).toEqual(['request']);
    expect(Container.getMany(handlers)).toEqual(['default']);
  });

  it('removes an inherited mixed-scope group without disposing services owned by the default container', () => {
    class Resource {
      dispose = jest.fn();
    }
    const resources = new Token<Resource>('resources');
    const supplied = new Resource();
    Container.set({ id: resources, type: Resource, multiple: true, scope: 'singleton' });
    Container.set({ id: resources, type: Resource, multiple: true, scope: 'container' });
    Container.set({ id: resources, value: supplied, multiple: true, scope: 'container' });
    const rootResources = Container.getMany(resources);
    const request = scopedContainer();
    const requestResources = request.getMany(resources);

    expect(requestResources[0]).toBe(rootResources[0]);
    expect(requestResources[1]).not.toBe(rootResources[1]);
    expect(requestResources[2]).toBe(supplied);
    request.remove(resources);

    expect(request.has(resources)).toBe(false);
    expect(requestResources[1].dispose).toHaveBeenCalledTimes(1);
    rootResources.forEach(resource => expect(resource.dispose).not.toHaveBeenCalled());
    expect(Container.getMany(resources)).toEqual(rootResources);
    expect(request.getMany(resources)[1]).not.toBe(requestResources[1]);
  });

  it('removes every registration in a multiple group and disposes each instance once', () => {
    const disposed: string[] = [];
    class Handler {
      dispose(): void {
        disposed.push('class');
      }
    }
    const handlers = new Token<Handler>('handlers');
    Container.set({ id: handlers, type: Handler, multiple: true });
    Container.set({
      id: handlers,
      value: { dispose: () => disposed.push('value') },
      multiple: true,
    });
    expect(Container.getMany(handlers)).toHaveLength(2);

    Container.remove(handlers);

    expect(Container.has(handlers)).toBe(false);
    expect(() => Container.getMany(handlers)).toThrow(ServiceNotFoundError);
    expect(disposed).toEqual(['class', 'value']);
    Container.reset({ strategy: 'resetServices' });
    expect(disposed).toHaveLength(2);
  });

  it.each(['default', 'scoped'])('retries failed property injection in the %s container', location => {
    const dependency = new Token<string>('dependency');
    let constructed = 0;
    class Consumer {
      dependency: string;

      constructor() {
        constructed += 1;
      }
    }
    Inject(dependency)(Consumer.prototype, 'dependency');
    Container.set({ id: Consumer, type: Consumer, scope: 'container' });
    const container = location === 'default' ? Container : scopedContainer();

    expect(() => container.get(Consumer)).toThrow(ServiceNotFoundError);
    expect(() => container.get(Consumer)).toThrow(ServiceNotFoundError);
    container.set({ id: dependency, value: 'ready', scope: 'container' });

    const consumer = container.get(Consumer);
    expect(consumer.dependency).toBe('ready');
    expect(container.get(Consumer)).toBe(consumer);
    expect(constructed).toBe(3);
  });

  it.each([null, undefined])('resets and removes factories that return %s', value => {
    const container = scopedContainer();
    const result = new Token<unknown>('nullable');
    const factory = jest.fn(() => value);
    container.set({ id: result, factory, scope: 'container' });

    try {
      expect(container.get(result)).toBe(value);
      expect(() => container.reset({ strategy: 'resetValue' })).not.toThrow();
      expect(container.get(result)).toBe(value);
      expect(factory).toHaveBeenCalledTimes(2);
      expect(() => container.remove(result)).not.toThrow();
      expect(container.has(result)).toBe(false);
    } finally {
      container.set({ id: result, value: 'cleanup', scope: 'container' });
    }
  });

  it.each(['default', 'scoped'])('preserves missing factory dependency errors in the %s container', location => {
    class Dependency {}
    class Factory {
      constructor(private dependency: Dependency) {}

      create(): { dependency: Dependency } {
        return { dependency: this.dependency };
      }
    }
    Reflect.defineMetadata('design:paramtypes', [Dependency], Factory);
    const product = new Token<{ dependency: Dependency }>('product');
    Container.set({ id: Factory, type: Factory, scope: 'container' });
    Container.set({ id: product, factory: [Factory, 'create'], scope: 'container' });
    const container = location === 'default' ? Container : scopedContainer();

    expect(() => container.get(product)).toThrow(ServiceNotFoundError);
    expect(() => container.get(product)).toThrow(ServiceNotFoundError);
    Container.set({ id: Dependency, type: Dependency, scope: 'container' });

    expect(container.get(product).dependency).toBe(container.get(Dependency));
  });

  it('still constructs an unregistered factory class directly', () => {
    class Factory {
      create(): string {
        return 'product';
      }
    }
    const product = new Token<string>('product');
    Container.set({ id: product, factory: [Factory, 'create'], scope: 'container' });

    expect(scopedContainer().get(product)).toBe('product');
  });

  it('preserves inherited provided values and leaves their disposal to the owning container', () => {
    const dispose = jest.fn();
    const resource = { dispose };
    const groupedResource = { dispose: jest.fn() };
    const single = new Token<typeof resource>('single');
    const group = new Token<typeof resource>('group');
    Container.set({ id: single, value: resource, scope: 'container' });
    Container.set({ id: group, value: groupedResource, scope: 'container', multiple: true });
    const request = scopedContainer();

    expect(request.get(single)).toBe(resource);
    expect(request.getMany(group)).toEqual([groupedResource]);
    request.reset({ strategy: 'resetServices' });
    expect(dispose).not.toHaveBeenCalled();
    expect(groupedResource.dispose).not.toHaveBeenCalled();
    expect(Container.get(single)).toBe(resource);
    Container.reset({ strategy: 'resetServices' });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(groupedResource.dispose).toHaveBeenCalledTimes(1);
  });

  it('preserves supplied values on resetValue and disposes them when registrations are removed', () => {
    const container = scopedContainer();
    const dispose = jest.fn();
    const resource = { dispose };
    const token = new Token<typeof resource>('resource');
    container.set({ id: token, value: resource, scope: 'container' });

    container.reset({ strategy: 'resetValue' });
    expect(dispose).not.toHaveBeenCalled();
    expect(container.get(token)).toBe(resource);
    container.reset({ strategy: 'resetServices' });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(container.has(token)).toBe(false);
  });

  it.each(['default', 'scoped'])('rolls back a failed circular graph in the %s container', location => {
    const dependency = new Token<string>('dependency');
    class Existing {}
    class First {
      existing: Existing;
      second: Second;
      dependency: string;
    }
    let secondConstructions = 0;
    class Second {
      first: First;

      constructor() {
        secondConstructions += 1;
      }
    }
    Inject(() => Existing)(First.prototype, 'existing');
    Inject(() => Second)(First.prototype, 'second');
    Inject(dependency)(First.prototype, 'dependency');
    Inject(() => First)(Second.prototype, 'first');
    Container.set({ id: Existing, type: Existing, scope: 'container' });
    Container.set({ id: First, type: First, scope: 'container' });
    Container.set({ id: Second, type: Second, scope: 'container' });
    const container = location === 'default' ? Container : scopedContainer();
    const existing = container.get(Existing);

    expect(() => container.get(First)).toThrow(ServiceNotFoundError);
    expect(container.get(Existing)).toBe(existing);
    container.set({ id: dependency, value: 'ready', scope: 'container' });
    const first = container.get(First);

    expect(first.second.first).toBe(first);
    expect(first.second.first.dependency).toBe('ready');
    expect(first.existing).toBe(existing);
    expect(container.get(Second)).toBe(first.second);
    expect(secondConstructions).toBe(2);
  });
});
