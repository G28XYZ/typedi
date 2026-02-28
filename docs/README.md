# Legacy Documentation and Migration Notes

> This page is kept as a compatibility entry point for older links.
> For actively maintained documentation, use the pages under `docs/typescript/*` and `docs/javascript/*`.

## Quick Migration Summary

### `Container.set`

Preferred format:

```ts
Container.set({ id: myToken, value: myValue });
Container.set({ id: 'my-config', value: config });
Container.set({ id: MyService, type: MyService });
```

Legacy compatibility format is still accepted for migration:

```ts
Container.set(myToken, myValue);
Container.set('my-config', config);
Container.set(MyService, myServiceInstance);
```

### Service scope options

Use `scope` instead of old `global` / `transient` flags:

```ts
@Service({ scope: 'singleton' })
class GlobalService {}

@Service({ scope: 'transient' })
class NewInstanceEveryTime {}
```

### Scoped containers and reset

Reset is called on the container instance you want to reset:

```ts
const requestContainer = Container.of('request-1');
const controller = requestContainer.get(QuestionController);

requestContainer.reset({ strategy: 'resetValue' });
// or requestContainer.reset({ strategy: 'resetServices' });
```

### Function-style `Service(...)` API

The old function-style API is not supported:

```ts
// old (unsupported)
// const PostRepository = Service(() => ({ ... }))
```

Use a factory service registration instead:

```ts
Container.set({
  id: 'post.repository',
  factory: () => ({
    getName() {
      return 'hello from post repository';
    },
  }),
});

const repo = Container.get<{ getName(): string }>('post.repository');
```

## Notes

- Constructor injection and property injection (`@Inject`) are unchanged.
- `@InjectMany` is still available for grouped service registrations (`multiple: true`).
- For TC39 decorators support and `resolveNew`, see root `README.md` and examples.
