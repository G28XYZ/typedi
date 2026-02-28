# Using Scoped Containers

Scoped containers are useful for request/session-specific state.

## Basic pattern

```ts
import { Container, Service } from 'typedi';

@Service({ scope: 'container' })
class RequestState {
  public readonly id = Math.random().toString(36).slice(2, 10);
}

const requestA = Container.of('request-a');
const requestB = Container.of('request-b');

const a1 = requestA.get(RequestState);
const a2 = requestA.get(RequestState);
const b1 = requestB.get(RequestState);

console.log(a1 === a2); // true (same scope)
console.log(a1 === b1); // false (different scopes)
```

## Singleton vs scoped behavior

```ts
@Service({ scope: 'singleton' })
class SharedCache {}

@Service({ scope: 'container' })
class RequestCache {}
```

- `SharedCache` is shared across all containers.
- `RequestCache` is isolated per container.

## Resetting a scoped container

```ts
const requestContainer = Container.of('request-a');
requestContainer.reset({ strategy: 'resetValue' });
```
