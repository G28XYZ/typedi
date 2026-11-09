import 'reflect-metadata';
import * as TypeDI from '../../src/index';
import type * as TypeScript from 'typescript';

const compiler: typeof TypeScript = require('typescript');

function compile(source: string, legacy = false): any {
  const { outputText, diagnostics } = compiler.transpileModule(source, {
    compilerOptions: {
      module: compiler.ModuleKind.CommonJS,
      target: compiler.ScriptTarget.ES2022,
      experimentalDecorators: legacy,
      emitDecoratorMetadata: legacy,
      useDefineForClassFields: true,
    },
    reportDiagnostics: true,
  });
  expect(diagnostics).toEqual([]);
  const result = {};
  const load = (name: string): unknown => (name === 'typedi' ? TypeDI : require(name));
  new Function('require', 'exports', outputText)(load, result);
  return result;
}

function typecheck(source: string, legacy = false): void {
  const fileName = `${__dirname}/decorator-typecheck.ts`;
  const options = {
    target: compiler.ScriptTarget.ES2022,
    module: compiler.ModuleKind.CommonJS,
    experimentalDecorators: legacy,
    emitDecoratorMetadata: legacy,
    useDefineForClassFields: true,
    strict: true,
    skipLibCheck: true,
    noEmit: true,
    types: [],
  };
  const host = compiler.createCompilerHost(options);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    name === fileName
      ? compiler.createSourceFile(name, source, languageVersion, true)
      : getSourceFile(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = compiler.createProgram([fileName], options, host);
  const diagnostics = compiler.getPreEmitDiagnostics(program);
  expect(diagnostics.map(diagnostic => compiler.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))).toEqual(
    []
  );
}

describe('Real standard decorator compilation', () => {
  beforeEach(() => TypeDI.Container.reset({ strategy: 'resetServices' }));

  it('typechecks standard field, accessor and private decorators with TypeScript 5', () => {
    typecheck(`
      import { Container, Inject, InjectMany, Service } from '../../src/index';
      @Service() class Dependency {}
      @Service() class Consumer {
        @Inject(() => Dependency) field!: Dependency;
        @Inject(() => Dependency) accessor accessorValue!: Dependency;
        @Inject(() => Dependency) #privateField!: Dependency;
        @InjectMany('group') accessor #privateAccessor!: Dependency[];
      }
      Container.get(Consumer);
    `);
  });

  it('resolves standard fields, accessors and private fields in scoped containers', () => {
    const { Consumer, Dependency } = compile(`
      import { Inject, Service } from 'typedi';
      @Service({ scope: 'container' }) export class Dependency {}
      @Service({ scope: 'container' }) export class Consumer {
        @Inject(() => Dependency) field!: Dependency;
        @Inject(() => Dependency) accessor accessorValue!: Dependency;
        @Inject(() => Dependency) #privateField!: Dependency;
        @Inject(() => Dependency) accessor #privateAccessor!: Dependency;
        readPrivate() { return [this.#privateField, this.#privateAccessor]; }
      }
    `);
    const root: any = TypeDI.Container.get(Consumer);
    const child: any = TypeDI.Container.of(Symbol('standard-scope')).get(Consumer);
    expect(root.field).toBeInstanceOf(Dependency);
    expect(root.accessorValue).toBe(root.field);
    expect(root.readPrivate()).toEqual([root.field, root.field]);
    expect(child.accessorValue).toBe(child.field);
    expect(child.readPrivate()).toEqual([child.field, child.field]);
    expect(child.field).not.toBe(root.field);
  });

  it.each(['field', 'accessor', 'private'])('resolves circular %s dependencies after caching instances', kind => {
    const declaration = kind === 'accessor' ? 'accessor dependency' : kind === 'private' ? '#dependency' : 'dependency';
    const read = kind === 'private' ? 'this.#dependency' : 'this.dependency';
    const { A, B } = compile(`
      import { Inject, Service } from 'typedi';
      @Service({ scope: 'container' }) export class A {
        @Inject(() => B) ${declaration}!: B;
        read() { return ${read}; }
      }
      @Service({ scope: 'container' }) export class B {
        @Inject(() => A) ${declaration}!: A;
        read() { return ${read}; }
      }
    `);
    const container = TypeDI.Container.of(Symbol('standard-cycle'));
    const a: any = container.get(A);
    expect(a.read()).toBe(container.get(B));
    expect(a.read().read()).toBe(a);
  });

  it('keeps manually constructed fields and accessors unchanged without resolveNew', () => {
    const { Consumer } = compile(`
      import { Inject } from 'typedi';
      export class Consumer {
        @Inject('missing') field: unknown;
        @Inject('missing') accessor accessorValue = 'initial';
        @Inject('missing') #privateField: unknown;
        readPrivate() { return this.#privateField; }
      }
    `);
    const instance = new Consumer();
    expect(instance.field).toBeUndefined();
    expect(instance.accessorValue).toBe('initial');
    expect(instance.readPrivate()).toBeUndefined();
  });

  it('lazily resolves manual public fields and public or private accessors when enabled', () => {
    const { Consumer } = compile(`
      import { Inject } from 'typedi';
      export class Consumer {
        @Inject('manual-dependency', { resolveNew: true }) field: unknown;
        @Inject('manual-dependency', { resolveNew: true }) accessor accessorValue: unknown;
        @Inject('manual-dependency', { resolveNew: true }) accessor #privateAccessor: unknown;
        readPrivate() { return this.#privateAccessor; }
      }
    `);
    const instance = new Consumer();
    const value = {};
    TypeDI.Container.set('manual-dependency', value);
    expect(instance.field).toBe(value);
    expect(instance.accessorValue).toBe(value);
    expect(instance.readPrivate()).toBe(value);
    TypeDI.Container.set('manual-dependency', {});
    expect(instance.field).toBe(value);
    expect(instance.accessorValue).toBe(value);
  });

  it('resolves private fields for manual new when enabled and defers them for container cycles', () => {
    const { A, B, Manual } = compile(`
      import { Inject, Service } from 'typedi';
      @Service() export class A {
        @Inject(() => B, { resolveNew: true }) #dependency!: B;
        read() { return this.#dependency; }
      }
      @Service() export class B {
        @Inject(() => A, { resolveNew: true }) #dependency!: A;
        read() { return this.#dependency; }
      }
      export class Manual {
        @Inject(() => A, { resolveNew: true }) #dependency!: A;
        read() { return this.#dependency; }
      }
    `);
    const a: any = TypeDI.Container.get(A);
    expect(a.read()).toBe(TypeDI.Container.get(B));
    expect(a.read().read()).toBe(a);
    expect(new Manual().read()).toBe(a);
  });

  it('preserves manual initial values and assignments with resolveNew', () => {
    const { Consumer } = compile(`
      import { Inject } from 'typedi';
      export class Consumer {
        @Inject('missing', { resolveNew: true }) field: unknown = false;
        @Inject('missing', { resolveNew: true }) accessor accessorValue: unknown = null;
        @Inject('missing', { resolveNew: true }) assigned: unknown;
      }
    `);
    const instance = new Consumer();
    instance.assigned = 0;
    expect(instance.field).toBe(false);
    expect(instance.accessorValue).toBeNull();
    expect(instance.assigned).toBe(0);
  });

  it('retains the construction container for lazy manual dependencies', () => {
    const { Consumer, Dependency } = compile(`
      import { Inject, Service } from 'typedi';
      @Service({ scope: 'container' }) export class Dependency {}
      class Manual {
        @Inject(() => Dependency, { resolveNew: true }) dependency!: Dependency;
      }
      @Service({ scope: 'container' }) export class Consumer {
        manual = new Manual();
      }
    `);
    const child = TypeDI.Container.of(Symbol('lazy-manual-scope'));
    const instance: any = child.get(Consumer);
    expect(instance.manual.dependency).toBe(child.get(Dependency));
    expect(instance.manual.dependency).not.toBe(TypeDI.Container.get(Dependency));
  });

  it('resolves InjectMany circular dependencies through real field and accessor decorators', () => {
    const { Consumer, Plugin } = compile(`
      import { Inject, InjectMany, Service } from 'typedi';
      @Service() export class Consumer {
        @InjectMany('plugins') field: unknown[];
        @InjectMany('plugins') accessor accessorValue: unknown[];
      }
      @Service({ id: 'plugins', multiple: true }) export class Plugin {
        @Inject(() => Consumer) consumer!: Consumer;
      }
    `);
    const instance: any = TypeDI.Container.get(Consumer);
    expect(instance.field).toHaveLength(1);
    expect(instance.field[0]).toBeInstanceOf(Plugin);
    expect(instance.field[0].consumer).toBe(instance);
    expect(instance.accessorValue).toEqual(instance.field);
  });

  it('retries deferred injection when a factory returns the same instance after a failure', () => {
    const { instance } = compile(`
      import { Inject } from 'typedi';
      class Consumer { @Inject('late-dependency') dependency: unknown; }
      export const instance = new Consumer();
    `);
    TypeDI.Container.set({ id: 'repeated-factory', factory: () => instance });
    expect(() => TypeDI.Container.get('repeated-factory')).toThrow(TypeDI.ServiceNotFoundError);
    const dependency = {};
    TypeDI.Container.set('late-dependency', dependency);
    expect(TypeDI.Container.get('repeated-factory')).toBe(instance);
    expect(instance.dependency).toBe(dependency);
  });
});

describe('Legacy resolveNew with standard class field definitions', () => {
  beforeEach(() => TypeDI.Container.reset({ strategy: 'resetServices' }));

  it('typechecks decorated declare fields with legacy decorators and emitted metadata', () => {
    typecheck(
      `
      import { Inject, Service } from '../../src/index';
      @Service() class Dependency {}
      class Plain {
        @Inject(() => Dependency, { resolveNew: true }) declare dependency: Dependency;
      }
      @Service() class Registered extends Plain {
        @Inject(undefined, { resolveNew: true }) declare inferred: Dependency;
      }
      new Plain().dependency;
      new Registered().inferred;
    `,
      true
    );
  });

  it('lazily injects declare fields on plain classes, Service classes and subclasses', () => {
    const { Base, Child, Dependency } = compile(
      `
      import { Inject, Service } from 'typedi';
      @Service() export class Dependency {}
      export class Base {
        static label = 'base';
        @Inject(() => Dependency, { resolveNew: true }) declare dependency: Dependency;
      }
      @Service() export class Child extends Base {
        @Inject(undefined, { resolveNew: true }) declare childDependency: Dependency;
      }
    `,
      true
    );
    const base = new Base();
    const child = new Child();
    expect(base.dependency).toBeInstanceOf(Dependency);
    expect(child.dependency).toBe(base.dependency);
    expect(child.childDependency).toBe(base.dependency);
    expect(child).toBeInstanceOf(Base);
    expect(Base.name).toBe('Base');
    expect(Child.label).toBe('base');
  });

  it('preserves explicit property values and constructor metadata on services', () => {
    const { Consumer, Dependency } = compile(
      `
      import { Inject, Service } from 'typedi';
      @Service() export class Dependency {}
      @Service() export class Consumer {
        @Inject(() => Dependency, { resolveNew: true }) dependency: unknown = 'assigned';
        constructor(public argument: Dependency) {}
      }
    `,
      true
    );
    expect(new Consumer().dependency).toBe('assigned');
    const managed: any = TypeDI.Container.get(Consumer);
    expect(managed.argument).toBeInstanceOf(Dependency);
    expect(managed.dependency).toBeInstanceOf(Dependency);
  });

  it('preserves constructor exceptions', () => {
    const { Consumer } = compile(
      `
      import { Inject, Service } from 'typedi';
      @Service() export class Consumer {
        @Inject('unused', { resolveNew: true }) dependency: unknown;
        constructor() { throw new Error('constructor failed'); }
      }
    `,
      true
    );
    expect(() => new Consumer()).toThrow('constructor failed');
  });

  it('inherits explicit constructor injection through service classes', () => {
    const { Child, value } = compile(
      `
      import { Container, Inject, Service } from 'typedi';
      export const value = {};
      Container.set('inherited-argument', value);
      @Service() class Base {
        @Inject('inherited-argument', { resolveNew: true }) declare property: unknown;
        constructor(@Inject('inherited-argument') public argument: unknown) {}
      }
      @Service() export class Child extends Base {}
    `,
      true
    );
    const instance: any = TypeDI.Container.get(Child);
    expect(instance.argument).toBe(value);
    expect(instance.property).toBe(value);
  });

  it('preserves static private methods, accessors, constructor identity and static factories', () => {
    const { Consumer, Child } = compile(
      `
      import { Container, Inject, Service } from 'typedi';
      Container.set('static-dependency', 'injected');
      @Service() export class Consumer {
        static #state = 'ready';
        static read() { return this.#state; }
        static get state() { return this.#state; }
        static set state(value: string) { this.#state = value; }
        static create() { return new this(); }
        static self() { return this; }
        @Inject('static-dependency', { resolveNew: true }) declare dependency: unknown;
      }
      export class Child extends Consumer {}
    `,
      true
    );
    expect(Consumer.read()).toBe('ready');
    expect(Consumer.state).toBe('ready');
    Consumer.state = 'changed';
    expect(Consumer.read()).toBe('changed');
    expect(() => Child.read()).toThrow(TypeError);
    expect(() => Child.state).toThrow(TypeError);
    expect(Consumer.self()).toBe(Consumer);
    expect(Child.self()).toBe(Child);
    const instance = Consumer.create();
    expect(instance).toBeInstanceOf(Consumer);
    expect(instance.dependency).toBe('injected');
    expect(Child.create()).toBeInstanceOf(Child);
  });

  it('keeps mutable static state consistent for direct and inherited calls', () => {
    const { Consumer, Child, DecoratedChild, Dependency } = compile(
      `
      import { Inject, Service } from 'typedi';
      export class Dependency {}
      @Service() export class Consumer {
        static count = 0;
        static dependencyType = Dependency;
        static increment() { return ++this.count; }
        @Inject('unused', { resolveNew: true }) declare dependency: unknown;
      }
      export class Child extends Consumer {}
      @Service() export class DecoratedChild extends Consumer {
        static ownIncrement() { return ++this.count; }
      }
    `,
      true
    );
    expect(Consumer.increment()).toBe(1);
    expect(Consumer.count).toBe(1);
    Consumer.count = 10;
    expect(Consumer.increment()).toBe(11);
    expect(Child.increment()).toBe(12);
    expect(Child.count).toBe(12);
    expect(Consumer.count).toBe(11);
    expect(DecoratedChild.increment()).toBe(12);
    expect(DecoratedChild.ownIncrement()).toBe(13);
    expect(DecoratedChild.count).toBe(13);
    DecoratedChild.count = 20;
    expect(DecoratedChild.increment()).toBe(21);
    expect(DecoratedChild.ownIncrement()).toBe(22);
    expect(Consumer.count).toBe(11);
    expect(Consumer.increment).toBe(Consumer.increment);
    expect(Consumer.dependencyType).toBe(Dependency);
    expect(new Consumer.dependencyType()).toBeInstanceOf(Dependency);
  });
});
