# The `@Inject` decorator

The `@Inject()` decorator is a **property and parameter decorator** used to resolve dependencies on a class property or
a constructor parameter. By default TypeDI infers the type of the property or argument and initializes an instance of
the detected type, however, this behavior can be overwritten via specifying a custom constructable type, `Token`, or
named service as the first parameter of the `@Inject()` decorator.

## Property injection

This decorator is **mandatory** on properties where a class instance is desired. (Without the decorator, the property
will stay undefined.) The type of the property is automatically inferred when it is a class, in all other cases the
requested type must be provided.

When an instance is resolved through `Container.get`, property injection finishes after its
constructor returns. This allows circular property dependencies. Use constructor injection
or a factory for dependencies that the constructor itself needs.

```ts
import 'reflect-metadata';
import { Container, Inject, Service } from 'typedi';

@Service()
class InjectedExampleClass {
  print() {
    console.log('I am alive!');
  }
}

@Service()
class ExampleClass {
  @Inject()
  withDecorator: InjectedExampleClass;

  withoutDecorator: InjectedExampleClass;
}

const instance = Container.get(ExampleClass);

/**
 * The `instance` variable is an ExampleClass instance with the `withDecorator`
 * property containing an InjectedExampleClass instance and `withoutDecorator`
 * property being undefined.
 */
console.log(instance);

instance.withDecorator.print();
// prints "I am alive!" (InjectedExampleClass.print function)
console.log(instance.withoutDecorator);
// logs undefined, as this property was not marked with an @Inject decorator
```

## Constructor Injection

Constructor type inference uses `reflect-metadata` and the legacy TypeScript options
`experimentalDecorators` and `emitDecoratorMetadata`. Standard TC39 decorators do not support
constructor parameter decorators; use explicit property identifiers or a service factory instead.

The `@Inject` decorator is not required in constructor injection when a class is marked with the `@Service` decorator.
TypeDI will automatically infer and inject the correct class instances for every constructor argument. However, it can
be used to overwrite the injected type.

```ts
import 'reflect-metadata';
import { Container, Inject, Service } from 'typedi';

@Service()
class InjectedExampleClass {
  print() {
    console.log('I am alive!');
  }
}

@Service()
class ExampleClass {
  constructor(
    @Inject()
    public withDecorator: InjectedExampleClass,
    public withoutDecorator: InjectedExampleClass
  ) {}
}

const instance = Container.get(ExampleClass);

/**
 * The `instance` variable is an ExampleClass instance with both the
 * `withDecorator` and `withoutDecorator` property containing an
 * InjectedExampleClass instance.
 */
console.log(instance);

instance.withDecorator.print();
// prints "I am alive!" (InjectedExampleClass.print function)
instance.withoutDecorator.print();
// prints "I am alive!" (InjectedExampleClass.print function)
```

## Explicitly requesting target type

By default, TypeDI will try to infer the type of property and arguments and inject the proper class instance. When this
is not possible (eg: the property type is an interface) there is three way to overwrite the type of the injected value:

- via `@Inject(() => type)` where `type` is a constructable value (eg: a class definition)
- via `@Inject(myToken)` where `myToken` is an instance of `Token` class
- via `@Inject(serviceName)` where `serviceName` is a string ID

In all three cases the requested dependency must be registered in the container first.

```ts
import 'reflect-metadata';
import { Container, Inject, Service } from 'typedi';

@Service()
class InjectedExampleClass {
  print() {
    console.log('I am alive!');
  }
}

@Service()
class BetterInjectedClass {
  print() {
    console.log('I am a different class!');
  }
}

@Service()
class ExampleClass {
  @Inject()
  inferredPropertyInjection: InjectedExampleClass;

  /**
   * We tell TypeDI that initialize the `BetterInjectedClass` class
   * regardless of what is the inferred type.
   */
  @Inject(() => BetterInjectedClass)
  explicitPropertyInjection: InjectedExampleClass;

  constructor(
    public inferredArgumentInjection: InjectedExampleClass,
    /**
     * We tell TypeDI that initialize the `BetterInjectedClass` class
     * regardless of what is the inferred type.
     */
    @Inject(() => BetterInjectedClass)
    public explicitArgumentInjection: InjectedExampleClass
  ) {}
}

/**
 * The `instance` variable is an ExampleClass instance with both the
 *  - `inferredPropertyInjection` and `inferredArgumentInjection` property
 *    containing an `InjectedExampleClass` instance
 *  - `explicitPropertyInjection` and `explicitArgumentInjection` property
 *    containing a `BetterInjectedClass` instance.
 */
const instance = Container.get(ExampleClass);

instance.inferredPropertyInjection.print();
// prints "I am alive!" (InjectedExampleClass.print function)
instance.explicitPropertyInjection.print();
// prints "I am a different class!" (BetterInjectedClass.print function)
instance.inferredArgumentInjection.print();
// prints "I am alive!" (InjectedExampleClass.print function)
instance.explicitArgumentInjection.print();
// prints "I am a different class!" (BetterInjectedClass.print function)
```

## Instances created with `new`

Enable `resolveNew` to resolve a property lazily when an instance is created outside the container:

```ts
class ManualController {
  @Inject(() => UserService, { resolveNew: true })
  declare userService: UserService;
}

const controller = new ManualController();
// The first read resolves and caches the dependency for this instance.
controller.userService;
```

This example uses legacy decorators. Without `resolveNew`, manually constructed instances do
not receive injected properties. For standard TC39 decorators, use `userService!: UserService`
instead of `declare`; explicit identifiers do not require `reflect-metadata`.

Public fields and auto-accessors resolve lazily. A private TC39 field (`#field`) cannot expose
a getter, so `resolveNew` resolves it during manual construction. Use a private auto-accessor
(`accessor #field`) if lazy resolution is required.

When legacy decorators are used with `useDefineForClassFields: true`, use `declare` on the
injected property, as above. It emits no own field, so the decorator's lazy getter remains
accessible. This works with or without `@Service()` and preserves the original constructor.

An ordinary `userService!: UserService` declaration emits an own field that shadows the getter.
A legacy property decorator cannot intercept this definition; `@Service()` does not change that.
If changing the property declaration is not possible, use `useDefineForClassFields: false`.
Explicit field initializers and assignments take precedence over lazy resolution.
