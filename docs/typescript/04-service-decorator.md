# `@Service` decorator

`@Service()` registers a class in TypeDI so it can be resolved by `Container.get(...)`.

## Basic usage

```ts
import { Container, Service } from 'typedi';

@Service()
class UserService {}

const userService = Container.get(UserService);
```

## Service options

```ts
@Service({
  id: 'custom.id',
  scope: 'singleton', // 'singleton' | 'container' | 'transient'
  eager: false,
  multiple: false,
})
class ExampleService {}
```

### `id`

Custom identifier (string/token/class).

### `scope`

- `singleton`: one shared instance across all containers
- `container`: one instance per container (default can be configured)
- `transient`: new instance for each resolution

### `factory`

You can create service values via factory function or factory class method:

```ts
@Service({ factory: () => new Car('V8') })
class Car {
  constructor(public engine: string) {}
}

@Service()
class CarFactory {
  create() {
    return new SportsCar();
  }
}

@Service({ factory: [CarFactory, 'create'] })
class SportsCar {}
```

### `multiple`

Allows grouping multiple services under one ID (to consume via `Container.getMany(...)`).
