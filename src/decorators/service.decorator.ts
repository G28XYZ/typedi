import { ContainerRegistry } from '../container-registry.class';
import { ServiceMetadata } from '../interfaces/service-metadata.interface';
import { ServiceOptions } from '../interfaces/service-options.interface';
import { EMPTY_VALUE } from '../empty.const';
import { Constructable } from '../types/constructable.type';
import { Token } from '../token.class';
import { isStandardClassDecoratorContext } from '../utils/decorator-context.util';

function registerServiceInDefaultContainer<T>(
  targetConstructor: Constructable<T> | null,
  options: ServiceOptions<T>
): void {
  const serviceMetadata: ServiceMetadata<T> = {
    id: (options.id || targetConstructor) as ServiceMetadata<T>['id'],
    type: targetConstructor,
    factory: (options as any).factory || undefined,
    multiple: options.multiple || false,
    eager: options.eager || false,
    scope: options.scope || ContainerRegistry.getDefaultServiceScope(),
    referencedBy: new Map().set(ContainerRegistry.defaultContainer.id, ContainerRegistry.defaultContainer),
    value: EMPTY_VALUE,
  };

  ContainerRegistry.defaultContainer.set(serviceMetadata);
}

/**
 * Marks class as a service that can be injected using Container.
 */
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function Service<T = unknown>(): Function;
export function Service<T = unknown>(serviceName: string): Function;
export function Service<T = unknown>(token: Token<T>): Function;
export function Service<T = unknown>(options: ServiceOptions<T>): Function;
export function Service<T>(optionsOrId: ServiceOptions<T> | string | Token<T> = {}): Function {
  const options: ServiceOptions<T> =
    typeof optionsOrId === 'string' || optionsOrId instanceof Token
      ? ({ id: optionsOrId } as ServiceOptions<T>)
      : optionsOrId;

  return (targetConstructor: Function, decoratorContext?: unknown) => {
    if (isStandardClassDecoratorContext(decoratorContext) && typeof decoratorContext.addInitializer === 'function') {
      decoratorContext.addInitializer(function (this: unknown) {
        const initializedConstructor = (
          typeof this === 'function' ? this : targetConstructor
        ) as Constructable<T> | null;
        registerServiceInDefaultContainer(initializedConstructor, options);
      });
      return targetConstructor;
    }

    const typedConstructor = (targetConstructor as unknown as Constructable<T>) || null;
    registerServiceInDefaultContainer(typedConstructor, options);
    return targetConstructor;
  };
}
