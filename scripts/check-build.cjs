const assert = require('assert').strict;
const { execFileSync } = require('child_process');
const { readFileSync } = require('fs');
const path = require('path');
const vm = require('vm');
const { rollup } = require('rollup');

const root = path.resolve(__dirname, '..');

function checkContainer(api) {
  assert.equal(api.Container.id, 'default');
  assert.equal(api.default, api.Container);
  assert.equal(api.Container.of(), api.Container);
  api.Container.set({ id: 'build-smoke', value: 'ready' });
  assert.equal(api.Container.get('build-smoke'), 'ready');
  const scoped = api.Container.of('build-smoke-scope');
  scoped.set({ id: 'scoped-value', value: 'scoped' });
  assert.equal(scoped.get('scoped-value'), 'scoped');
  assert.equal(scoped.of(), api.Container);

  class Dependency {}
  class Consumer {
    static #privateValue = 'native private';
    static count = 0;
    static dependencyReference = Dependency;

    static describe() {
      return 'native consumer';
    }

    static create() {
      return new this();
    }

    static self() {
      return this;
    }

    static readPrivate() {
      return this.#privateValue;
    }

    static get privateValue() {
      return this.#privateValue;
    }

    static set privateValue(value) {
      this.#privateValue = value;
    }

    static increment() {
      this.count += 1;
    }
  }
  api.Service()(Dependency);
  // No own field is emitted, matching a TypeScript `declare dependency: Dependency` property.
  api.Inject(() => Dependency, { resolveNew: true })(Consumer.prototype, 'dependency');
  const DecoratedConsumer = api.Service()(Consumer);
  assert.equal(DecoratedConsumer, Consumer);
  const manual = new DecoratedConsumer();
  const managed = api.Container.get(DecoratedConsumer);
  const created = DecoratedConsumer.create();
  for (const consumer of [manual, managed, created]) {
    assert.ok(consumer instanceof Consumer);
    assert.ok(consumer instanceof DecoratedConsumer);
    assert.ok(consumer.dependency instanceof Dependency);
    assert.equal(consumer.dependency, api.Container.get(Dependency));
  }
  assert.equal(DecoratedConsumer.self(), DecoratedConsumer);
  assert.equal(DecoratedConsumer.describe(), 'native consumer');
  assert.equal(DecoratedConsumer.readPrivate(), 'native private');
  DecoratedConsumer.privateValue = 'updated private';
  assert.equal(DecoratedConsumer.privateValue, 'updated private');
  assert.equal(Consumer.readPrivate(), 'updated private');
  DecoratedConsumer.count = 3;
  DecoratedConsumer.increment();
  assert.equal(DecoratedConsumer.count, 4);
  assert.equal(Consumer.count, 4);
  assert.equal(DecoratedConsumer.dependencyReference, Dependency);
  class DerivedConsumer extends DecoratedConsumer {}
  const derived = new DerivedConsumer();
  assert.ok(derived instanceof DerivedConsumer);
  assert.ok(derived instanceof Consumer);
  assert.ok(derived.dependency instanceof Dependency);
  assert.equal(DerivedConsumer.self(), DerivedConsumer);
  const createdDerived = DerivedConsumer.create();
  assert.ok(createdDerived instanceof DerivedConsumer);
  assert.ok(createdDerived.dependency instanceof Dependency);
}

async function checkEsm(directory) {
  const bundle = await rollup({
    input: path.join(root, 'build', directory, 'index.js'),
    onwarn(warning, warn) {
      if (warning.code !== 'CIRCULAR_DEPENDENCY' && warning.code !== 'THIS_IS_UNDEFINED') warn(warning);
    },
  });
  try {
    const { output } = await bundle.generate({ format: 'cjs', exports: 'named' });
    const context = { exports: {} };
    vm.runInNewContext(output[0].code, context, { filename: `${directory}.cjs` });
    checkContainer(context.exports);
  } finally {
    await bundle.close();
  }
}

function checkUmd(filename) {
  const filenameAbsolute = path.join(root, 'build', 'bundles', filename);
  checkContainer(require(filenameAbsolute));
  const existingClassTransformer = {};
  const context = { ClassTransformer: existingClassTransformer };
  vm.runInNewContext(readFileSync(filenameAbsolute, 'utf8'), context, { filename });
  assert.equal(context.ClassTransformer, existingClassTransformer);
  checkContainer(context.TypeDI);
}

async function main() {
  const checks = [
    ['CommonJS', () => checkContainer(require(path.join(root, 'build', 'cjs', 'index.js')))],
    ['ESM5', () => checkEsm('esm5')],
    ['ESM2015', () => checkEsm('esm2015')],
    ['UMD and browser global', () => checkUmd('typedi.umd.js')],
    ['minified UMD and browser global', () => checkUmd('typedi.umd.min.js')],
    [
      'direct ContainerInstance import',
      () =>
        execFileSync(
          process.execPath,
          [
            '-r',
            'ts-node/register',
            '-e',
            `const assert = require('assert').strict;
const { ContainerInstance } = require('./src/container-instance.class');
assert.throws(() => new ContainerInstance('default'), /default/);
const direct = new ContainerInstance('direct-import');
direct.set({ id: 'value', value: 'ready' });
assert.equal(direct.get('value'), 'ready');
const { Container } = require('./src');
assert.equal(direct.of(), Container);
assert.equal(Container.of('direct-import'), direct);
assert.throws(() => new ContainerInstance('default'), /default/);`,
          ],
          { cwd: root, stdio: 'pipe' }
        ),
    ],
  ];

  for (const [name, check] of checks) {
    try {
      await check();
      console.log(`PASS ${name}`);
    } catch (error) {
      process.exitCode = 1;
      console.error(`FAIL ${name}: ${error.message}`);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
