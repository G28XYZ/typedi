import { Constructable } from '../types/constructable.type';
import { StandardClassMemberDecoratorContext } from './decorator-context.util';

const deferredProperties = new WeakMap<object, Array<() => void>>();
const initializingProperties = new WeakSet<object>();
const constructionStack: Constructable<unknown>[] = [];

/** Keep property injection separate from construction so cached instances can close cycles. */
export function constructService(type: Constructable<unknown>, params: unknown[]): unknown {
  constructionStack.push(type);
  try {
    return new type(...params);
  } finally {
    constructionStack.pop();
  }
}

export function initializeDeferredProperties(instance: unknown): void {
  if ((typeof instance !== 'object' || instance === null) && typeof instance !== 'function') return;
  const initializers = deferredProperties.get(instance);
  if (!initializers || initializingProperties.has(instance)) return;
  initializingProperties.add(instance);
  try {
    initializers.forEach(initialize => initialize());
    deferredProperties.delete(instance);
  } finally {
    initializingProperties.delete(instance);
  }
}

function isConstructingService(instance: object): boolean {
  const type = constructionStack[constructionStack.length - 1];
  return type !== undefined && instance instanceof type;
}

function deferProperty(instance: object, initialize: () => void): void {
  const initializers = deferredProperties.get(instance);
  if (initializers) initializers.push(initialize);
  else deferredProperties.set(instance, [initialize]);
}

interface AccessorTarget {
  get(this: object): unknown;
  set(this: object, value: unknown): void;
}

/** Captures a resolver per instance, including the container that constructed it. */
export function createStandardPropertyDecorator(
  target: unknown,
  context: StandardClassMemberDecoratorContext,
  createResolver: (instance: object) => () => unknown,
  resolveNew = false
) {
  const resolvers = new WeakMap<object, () => unknown>();
  const initialized = new WeakSet<object>();
  const accessor = target as AccessorTarget;
  const write = (instance: object, value: unknown): void => {
    if (context.kind === 'accessor') accessor.set.call(instance, value);
    else if (context.access) context.access.set(instance, value);
    else (instance as Record<string | symbol, unknown>)[context.name] = value;
    initialized.add(instance);
  };

  const initialize = function (this: object, initialValue: unknown): unknown {
    const resolve = createResolver(this);
    resolvers.set(this, resolve);
    if (initialValue !== undefined) initialized.add(this);

    if (context.static) {
      initialized.add(this);
      return resolve();
    }

    deferProperty(this, () => write(this, resolve()));
    // A private field cannot expose a lazy getter. Container construction still defers it.
    if (
      resolveNew &&
      context.kind === 'field' &&
      (context.private || !context.addInitializer) &&
      !isConstructingService(this) &&
      initialValue === undefined
    ) {
      initialized.add(this);
      return resolve();
    }
    return initialValue;
  };

  if (context.kind === 'accessor') {
    return {
      init: initialize,
      get(this: object): unknown {
        if (resolveNew && !initialized.has(this)) {
          const resolve = resolvers.get(this);
          if (resolve) write(this, resolve());
        }
        return accessor.get.call(this);
      },
      set(this: object, value: unknown): void {
        write(this, value);
      },
    };
  }

  if (resolveNew && !context.private && !context.static) {
    context.addInitializer?.(function (this: unknown) {
      const instance = this as object;
      let value = (instance as Record<string | symbol, unknown>)[context.name];
      Object.defineProperty(instance, context.name, {
        configurable: true,
        enumerable: true,
        get(): unknown {
          if (!initialized.has(instance)) {
            const resolve = resolvers.get(instance);
            if (resolve) value = resolve();
            initialized.add(instance);
          }
          return value;
        },
        set(nextValue: unknown): void {
          value = nextValue;
          initialized.add(instance);
        },
      });
    });
  }
  return initialize;
}
