import { Constructable } from '../types/constructable.type';
import { ContainerScope } from '../types/container-scope.type';
import { ServiceIdentifier } from '../types/service-identifier.type';
import { ServiceMetadata } from './service-metadata.interface';

/**
 * Options shared by every explicit container registration.
 */
type CommonServiceOptions<T> = {
  id: ServiceIdentifier<T>;
  multiple?: boolean;
  eager?: boolean;
  scope?: ContainerScope;
};

/** Exactly one creation strategy must be supplied to Container.set. */
export type ServiceOptions<T = unknown> =
  | (CommonServiceOptions<T> & {
      value: T;
      type?: never;
      factory?: never;
    })
  | (CommonServiceOptions<T> & {
      factory: NonNullable<ServiceMetadata<T>['factory']>;
      value?: never;
      type?: never;
    })
  | (Omit<CommonServiceOptions<T>, 'id'> & {
      id?: ServiceIdentifier<T>;
      type: Constructable<T>;
      value?: never;
      factory?: never;
    });

/** @Service receives the decorated class as its type, so only an optional factory is configurable. */
export type ServiceDecoratorOptions<T = unknown> = Partial<CommonServiceOptions<T>> & {
  factory?: NonNullable<ServiceMetadata<T>['factory']>;
};
