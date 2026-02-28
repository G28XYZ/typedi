import { ContainerRegistry } from '../container-registry.class';
import { Token } from '../token.class';
import { CannotInjectValueError } from '../error/cannot-inject-value.error';
import { resolveToTypeWrapper } from '../utils/resolve-to-type-wrapper.util';
import { Constructable } from '../types/constructable.type';
import { ServiceIdentifier } from '../types/service-identifier.type';
import {
  isStandardClassMemberDecoratorContext,
  StandardClassMemberDecoratorContext,
} from '../utils/decorator-context.util';

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

function createStandardInjectManyDecorator(
  typeOrIdentifier: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown> | undefined,
  context: StandardClassMemberDecoratorContext
) {
  const resolveInjectedValues = function (this: unknown): unknown {
    const identifier = resolveIdentifierFromStandardDecorator(typeOrIdentifier, context, this);
    return ContainerRegistry.getResolutionContainer().getMany(identifier);
  };

  if (context.kind === 'accessor') {
    return {
      init(this: unknown): unknown {
        return resolveInjectedValues.call(this);
      },
    };
  }

  return function (this: unknown, _initialValue: unknown): unknown {
    return resolveInjectedValues.call(this);
  };
}

function createLegacyInjectManyDecorator(
  typeOrIdentifier: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown> | undefined,
  target: Object,
  propertyName: string | symbol | undefined,
  index?: number
): void {
  const typeWrapper = resolveToTypeWrapper(typeOrIdentifier, target, propertyName, index);

  /** If no type was inferred, or the general Object type was inferred we throw an error. */
  if (typeWrapper === undefined || isMissingEagerIdentifier(typeWrapper.eagerType)) {
    throw new CannotInjectValueError(getTargetConstructor(target), normalizePropertyName(propertyName));
  }

  ContainerRegistry.defaultContainer.registerHandler({
    object: target as Constructable<unknown>,
    propertyName: propertyName,
    index: index,
    value: containerInstance => {
      const evaluatedLazyType = typeWrapper.lazyType();

      /** If no type was inferred lazily, or the general Object type was inferred we throw an error. */
      if (isMissingResolvedIdentifier(evaluatedLazyType)) {
        throw new CannotInjectValueError(getTargetConstructor(target), normalizePropertyName(propertyName));
      }

      return containerInstance.getMany<unknown>(evaluatedLazyType);
    },
  });
}

/**
 * Injects a list of services into a class property or constructor parameter.
 */
export function InjectMany(): Function;
export function InjectMany(type?: (type?: any) => Function): Function;
export function InjectMany(serviceName?: string): Function;
export function InjectMany(token: Token<any>): Function;
export function InjectMany(
  typeOrIdentifier?: ((type?: never) => Constructable<unknown>) | ServiceIdentifier<unknown>
): Function {
  return function (target: unknown, propertyNameOrContext: string | symbol | unknown, index?: number): unknown {
    if (isStandardClassMemberDecoratorContext(propertyNameOrContext)) {
      return createStandardInjectManyDecorator(typeOrIdentifier, propertyNameOrContext);
    }

    createLegacyInjectManyDecorator(
      typeOrIdentifier,
      target as Object,
      propertyNameOrContext as string | symbol | undefined,
      index
    );
  };
}
