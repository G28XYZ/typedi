# Container API

## Common methods

### `Container.get(id)`

Resolves a class, token, or string identifier.

```ts
const service = Container.get(MyService);
const config = Container.get('app.config');
const tokenValue = Container.get(MyToken);
```

### `Container.set(...)`

Preferred registration format is object-based:

```ts
Container.set({ id: MyService, type: MyService });
Container.set({ id: 'app.config', value: { env: 'prod' } });
Container.set({ id: MyToken, value: 'secret' });
```

Legacy overload is still accepted for migration:

```ts
Container.set('app.config', { env: 'prod' });
Container.set(MyToken, 'secret');
```

### `Container.getMany(id)`

Use with services registered using `multiple: true`.

```ts
const handlers = Container.getMany(MY_HANDLER_TOKEN);
```

### `Container.has(id)`

Checks whether a service is registered.

### `Container.remove(id | id[])`

Removes one or more service registrations.

### `Container.reset({ strategy })`

Resets current container instance.

- `resetValue`: drop instantiated values, keep registrations
- `resetServices`: drop both values and registrations

## Scoped containers

Create/request a scoped container:

```ts
const requestContainer = Container.of('request-123');
const controller = requestContainer.get(RequestController);
```

Reset a scoped container while keeping its identifier registered:

```ts
requestContainer.reset({ strategy: 'resetValue' });
```

Dispose request/session containers when their lifecycle ends. Disposal releases their services and removes the identifier
from the registry so it can be reused:

```ts
await requestContainer.dispose();
```

## Default scope configuration

Default scope for registrations without explicit `scope` can be configured globally:

```ts
Container.setDefaultScope('singleton');
// or
Container.setDefaultScope('container');

const scope = Container.getDefaultScope();
```
