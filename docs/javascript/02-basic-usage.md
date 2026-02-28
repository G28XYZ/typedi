# Usage without TypeScript

This page describes current JavaScript usage patterns.

## Container-based constructor pattern

In JavaScript you can receive the resolving container as the last constructor argument:

```javascript
const { Container } = require('typedi');

class BeanFactory {
  create() {}
}

class SugarFactory {
  create() {}
}

class WaterFactory {
  create() {}
}

class CoffeeMaker {
  constructor(container) {
    this.beanFactory = container.get(BeanFactory);
    this.sugarFactory = container.get(SugarFactory);
    this.waterFactory = container.get(WaterFactory);
  }

  make() {
    this.beanFactory.create();
    this.sugarFactory.create();
    this.waterFactory.create();
  }
}

Container.set({ id: BeanFactory, type: BeanFactory });
Container.set({ id: SugarFactory, type: SugarFactory });
Container.set({ id: WaterFactory, type: WaterFactory });
Container.set({ id: CoffeeMaker, type: CoffeeMaker });

const coffeeMaker = Container.get(CoffeeMaker);
coffeeMaker.make();
```

## Named services and config values

```javascript
const { Container } = require('typedi');

Container.set({ id: 'authorization-token', value: 'RVT9rVjSVN' });

class UserRepository {
  constructor(container) {
    this.authorizationToken = container.get('authorization-token');
  }
}

Container.set({ id: UserRepository, type: UserRepository });
```

## Overriding dependencies in tests

```javascript
Container.set({ id: 'bean.factory', value: new FakeBeanFactory() });
Container.set({ id: 'sugar.factory', value: new FakeSugarFactory() });
Container.set({ id: 'water.factory', value: new FakeWaterFactory() });
```

## Factory registration

Use `Container.set({ factory })` instead of old function-style `Service(...)` APIs.

```javascript
const { Container } = require('typedi');

Container.set({
  id: 'post.repository',
  factory: function () {
    return {
      getName() {
        return 'hello from post repository';
      },
    };
  },
});

Container.set({
  id: 'post.controller',
  factory: function (container) {
    const repository = container.get('post.repository');
    return {
      name: repository.getName(),
    };
  },
});

const postController = Container.get('post.controller');
console.log(postController.name);
```
