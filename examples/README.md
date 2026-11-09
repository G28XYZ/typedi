# Examples

Примеры в этой папке запускаются через `ts-node`, поэтому их можно запускать локально или в песочнице терминала без предварительной сборки пакета.

## Подготовка

```bash
npm ci
```

## Запуск одного примера

```bash
npm run example:basic
npm run example:scoped
npm run example:resolve-new
npm run example:tc39
```

## Запуск всех примеров

```bash
npm run example:all
```

Пример `resolve-new` использует legacy-декораторы и `declare` для внедряемого свойства.
В конфигурации примеров включён `useDefineForClassFields`, поэтому пример проверяет,
что собственное поле не затеняет ленивый getter.

## Пример TC39

`example:tc39` показывает использование стандартного API декораторов TC39 (`value, context`) для `@Service` и `@Inject`.

Команда использует TypeScript 5 и конфигурацию `tsconfig.tc39.json`.
В ней выключены `experimentalDecorators` и `emitDecoratorMetadata`.
Зависимости указываются явно, поэтому `reflect-metadata` для этого примера не нужен.
