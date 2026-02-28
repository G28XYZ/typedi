import 'reflect-metadata';
import { Container, Service } from '../src/index';

@Service({ scope: 'container' })
class RequestState {
  public readonly id = Math.random().toString(36).slice(2, 10);
}

function inspectScope(scopeId: string): RequestState {
  const scopedContainer = Container.of(scopeId);
  const first = scopedContainer.get(RequestState);
  const second = scopedContainer.get(RequestState);

  console.log(`[${scopeId}] same instance inside scope: ${first === second}; state.id=${first.id}`);
  return first;
}

const requestAState = inspectScope('request-a');
const requestBState = inspectScope('request-b');

const defaultFirst = Container.get(RequestState);
const defaultSecond = Container.get(RequestState);

console.log(`[default] same instance inside scope: ${defaultFirst === defaultSecond}; state.id=${defaultFirst.id}`);
console.log(`[cross-scope] request-a and request-b share instance: ${requestAState === requestBState}`);
