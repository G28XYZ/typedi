export interface StandardDecoratorContext {
  kind: string;
  name?: string | symbol;
  static?: boolean;
  private?: boolean;
  addInitializer?: (initializer: (this: unknown) => void) => void;
}

export interface StandardClassDecoratorContext extends StandardDecoratorContext {
  kind: 'class';
  name?: string;
}

export interface StandardClassMemberDecoratorContext extends StandardDecoratorContext {
  kind: 'field' | 'accessor';
  name: string | symbol;
  access?: {
    get?: (instance: object) => unknown;
    set: (instance: object, value: unknown) => void;
  };
}

export function isStandardDecoratorContext(value: unknown): value is StandardDecoratorContext {
  return typeof value === 'object' && value !== null && typeof (value as StandardDecoratorContext).kind === 'string';
}

export function isStandardClassDecoratorContext(value: unknown): value is StandardClassDecoratorContext {
  return isStandardDecoratorContext(value) && value.kind === 'class';
}

export function isStandardClassMemberDecoratorContext(value: unknown): value is StandardClassMemberDecoratorContext {
  return isStandardDecoratorContext(value) && (value.kind === 'field' || value.kind === 'accessor');
}
