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

## Пример TC39

`example:tc39` показывает использование стандартного API декораторов TC39 (`value, context`) для `@Service` и `@Inject`.
