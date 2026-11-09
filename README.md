# TypeDI

TypeDI — это библиотека [внедрения зависимостей](https://en.wikipedia.org/wiki/Dependency_injection) для TypeScript и JavaScript. С её помощью можно строить структурированные и удобные для тестирования приложения в Node.js и браузере.

Основные возможности:

- инъекция через свойства
- инъекция через конструктор
- singleton и transient сервисы
- поддержка нескольких DI-контейнеров
- поддержка legacy-декораторов TypeScript и стандартных декораторов TC39

## Installation

> Примечание: эта инструкция ориентирована на TypeScript.

Установите зависимости:

```bash
npm install typedi reflect-metadata
```

Для legacy-декораторов с автоматическим определением типов импортируйте `reflect-metadata`
в **самой первой строке** приложения:

```ts
import 'reflect-metadata';

// Остальные импорты и инициализация
// идут после reflect-metadata
```

Для legacy-декораторов добавьте в `tsconfig.json` (в `compilerOptions`):

```json
"emitDecoratorMetadata": true,
"experimentalDecorators": true,
```

## Поддержка декораторов

TypeDI поддерживает два режима:

1. Legacy-декораторы TypeScript (`experimentalDecorators` + `emitDecoratorMetadata`).
2. Стандартные декораторы TC39 (TypeScript 5+).

Что важно в режиме TC39:

- `@Service()` работает как class decorator.
- `@Inject` / `@InjectMany` работают для `field` / `accessor`.
- Для объектов, созданных вручную через `new`, используйте `@Inject(..., { resolveNew: true })`.
- Parameter decorators конструктора в стандарте TC39 не поддерживаются.

При явном указании зависимостей на свойствах (`@Inject(() => MyService)` или `@Inject(token)`)
в режиме TC39 пакет `reflect-metadata` не требуется.

В legacy-режиме с `useDefineForClassFields: true` для `resolveNew` объявляйте внедряемые свойства
через `declare dependency: Dependency`. Такое объявление не создаёт собственное поле, которое
затеняет getter декоратора. Обычное `dependency!: Dependency` в этом сочетании не поддерживается;
другой вариант — `useDefineForClassFields: false`. Это ограничение legacy-декораторов свойств,
и `@Service()` его не снимает.

## Basic Usage

```ts
import { Container, Service } from 'typedi';

@Service()
class ExampleInjectedService {
  printMessage() {
    console.log('I am alive!');
  }
}

@Service()
class ExampleService {
  constructor(
    // Так как ExampleInjectedService помечен @Service(),
    // TypeDI автоматически внедрит его, когда вы запросите ExampleService из контейнера.
    public injectedService: ExampleInjectedService
  ) {}
}

const serviceInstance = Container.get(ExampleService);
// Получаем экземпляр ExampleService из TypeDI

serviceInstance.injectedService.printMessage();
// Выведет "I am alive!"
```

## Examples

Готовые примеры для запуска находятся в папке `./examples`.

```bash
npm run example:basic
npm run example:scoped
npm run example:resolve-new
npm run example:tc39
```

## Documentation

Подробная документация доступна:

- в папке `./docs` репозитория
