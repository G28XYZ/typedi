import { ContainerRegistry } from '../container-registry.class';
import { Token } from '../token.class';
import { CannotInjectValueError } from '../error/cannot-inject-value.error';
import { ServiceIdentifier } from '../types/service-identifier.type';
import { Constructable } from '../types/constructable.type';
import { resolveToTypeWrapper } from '../utils/resolve-to-type-wrapper.util';
import {
  isStandardClassMemberDecoratorContext,
  StandardClassMemberDecoratorContext,
} from '../utils/decorator-context.util';

export interface InjectOptions {
  /**
   * Enables lazy property resolution for instances created with `new`.
   * This option is ignored for constructor parameter injection.
   */
  resolveNew?: boolean;
}

function normalizePropertyName(propertyName: string | symbol | undefined): string {
  if (propertyName === undefined) return 'constructor';
  return propertyName.toString();
}

function getTargetConstructor(target: unknown): Constructable<unknown> {
  if (typeof target === 'function') return target as Constructable<unknown>;
  if (typeof target === 'object' && target !== null && typeof (target as any).constructor === 'function') {
    return (target as any).constructor as Constructable<unknown>;
  }

  return Object as unknown as Constructable<unknown>;
}

function isMissingResolvedIdentifier(identifier: ServiceIdentifier<unknown> | null | undefined): boolean {
  return identifier === undefined || identifier === null || identifier === Object;
}

function isMissingEagerIdentifier(identifier: ServiceIdentifier<unknown> | null | undefined): boolean {
  return identifier === undefined || identifier === Object;
}

function resolveIdentifierFromStandardDecorator(
  typeOrIdentifier: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown> | undefined,
  context: StandardClassMemberDecoratorContext,
  decoratedTarget: unknown
): ServiceIdentifier<unknown> {
  if (typeOrIdentifier !== undefined) {
    const explicitTypeWrapper = resolveToTypeWrapper(
      typeOrIdentifier,
      getTargetConstructor(decoratedTarget) as unknown as Object,
      context.name
    );
    const explicitIdentifier = explicitTypeWrapper?.lazyType();

    if (isMissingResolvedIdentifier(explicitIdentifier)) {
      throw new CannotInjectValueError(getTargetConstructor(decoratedTarget), normalizePropertyName(context.name));
    }

    return explicitIdentifier;
  }

  const reflectMetadataApi = Reflect as { getMetadata?: CallableFunction } | undefined;
  const hasDecoratedTarget =
    (typeof decoratedTarget === 'object' && decoratedTarget !== null) || typeof decoratedTarget === 'function';
  const metadataTarget = context.static
    ? decoratedTarget
    : hasDecoratedTarget
    ? Object.getPrototypeOf(decoratedTarget)
    : undefined;
  const identifier = reflectMetadataApi?.getMetadata?.('design:type', metadataTarget, context.name) as
    | ServiceIdentifier<unknown>
    | undefined;

  if (isMissingResolvedIdentifier(identifier)) {
    throw new CannotInjectValueError(getTargetConstructor(decoratedTarget), normalizePropertyName(context.name));
  }

  return identifier;
}

function createStandardInjectDecorator(
  typeOrIdentifier: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown> | undefined,
  context: StandardClassMemberDecoratorContext
) {
  const resolveInjectedValue = function (this: unknown): unknown {
    const identifier = resolveIdentifierFromStandardDecorator(typeOrIdentifier, context, this);
    return ContainerRegistry.getResolutionContainer().get(identifier);
  };

  if (context.kind === 'accessor') {
    return {
      init(this: unknown): unknown {
        return resolveInjectedValue.call(this);
      },
    };
  }

  return function (this: unknown, _initialValue: unknown): unknown {
    return resolveInjectedValue.call(this);
  };
}

function defineResolveNewPropertyHandler(target: Object, propertyName: string | symbol, resolver: () => unknown): void {
  const storageKey = Symbol(`typedi.inject.value.${propertyName.toString()}`);
  const targetObject = target as Record<string | symbol, unknown>;

  Object.defineProperty(targetObject, propertyName, {
    configurable: true,
    enumerable: true,
    get: function (this: Record<string | symbol, unknown>): unknown {
      if (!Object.prototype.hasOwnProperty.call(this, storageKey)) {
        this[storageKey] = resolver();
      }

      return this[storageKey];
    },
    set: function (this: Record<string | symbol, unknown>, value: unknown): void {
      this[storageKey] = value;
    },
  });
}

function createLegacyInjectDecorator(
  typeOrIdentifier: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown> | undefined,
  target: Object,
  propertyName: string | symbol | undefined,
  options: InjectOptions,
  index?: number
): void {
  const typeWrapper = resolveToTypeWrapper(typeOrIdentifier, target, propertyName, index);

  /** If no type was inferred, or the general Object type was inferred we throw an error. */
  if (typeWrapper === undefined || isMissingEagerIdentifier(typeWrapper.eagerType)) {
    throw new CannotInjectValueError(getTargetConstructor(target), normalizePropertyName(propertyName));
  }

  ContainerRegistry.defaultContainer.registerHandler({
    object: target as Constructable<unknown>,
    propertyName,
    index: index,
    value: containerInstance => {
      const evaluatedLazyType = typeWrapper.lazyType();

      /** If no type was inferred lazily, or the general Object type was inferred we throw an error. */
      if (isMissingResolvedIdentifier(evaluatedLazyType)) {
        throw new CannotInjectValueError(getTargetConstructor(target), normalizePropertyName(propertyName));
      }

      return containerInstance.get<unknown>(evaluatedLazyType);
    },
  });

  if (options.resolveNew === true && typeof index !== 'number' && propertyName !== undefined) {
    defineResolveNewPropertyHandler(target, propertyName, () => {
      const evaluatedLazyType = typeWrapper.lazyType();

      if (isMissingResolvedIdentifier(evaluatedLazyType)) {
        throw new CannotInjectValueError(getTargetConstructor(target), normalizePropertyName(propertyName));
      }

      return ContainerRegistry.getResolutionContainer().get(evaluatedLazyType);
    });
  }
}

/**
 * Injects a service into a class property or constructor parameter.
 */
export function Inject(): Function;
export function Inject(typeFn: (type?: never) => Constructable<unknown>, options?: InjectOptions): Function;
export function Inject(serviceName?: string, options?: InjectOptions): Function;
export function Inject(token: Token<unknown>, options?: InjectOptions): Function;
export function Inject(
  typeOrIdentifier?: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown>,
  options: InjectOptions = {}
) {
  return function (target: unknown, propertyNameOrContext: string | symbol | unknown, index?: number): unknown {
    if (isStandardClassMemberDecoratorContext(propertyNameOrContext)) {
      return createStandardInjectDecorator(typeOrIdentifier, propertyNameOrContext);
    }

    createLegacyInjectDecorator(
      typeOrIdentifier,
      target as Object,
      propertyNameOrContext as string | symbol | undefined,
      options,
      index
    );
  };
}
