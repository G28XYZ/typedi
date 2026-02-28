import 'reflect-metadata';
import { Container, Inject, Service } from '../src/index';

@Service({ id: 'greeting.service' })
class GreetingService {
  public greet(name: string): string {
    return `Hello, ${name}!`;
  }
}

class ManualController {
  @Inject('greeting.service', { resolveNew: true })
  public greetingService!: GreetingService;

  public run(name: string): void {
    console.log(`resolveNew=true -> ${this.greetingService.greet(name)}`);
  }
}

class LegacyManualController {
  @Inject('greeting.service')
  public greetingService?: GreetingService;
}

@Service()
class ContainerController {
  @Inject('greeting.service')
  public greetingService!: GreetingService;
}

const manualController = new ManualController();
manualController.run('Sandbox User');

const legacyManualController = new LegacyManualController();
console.log(`resolveNew not set -> ${String(legacyManualController.greetingService)}`);

const containerController = Container.get(ContainerController);

console.log(`Container.get(...) -> ${containerController.greetingService.greet('Container User')}`);
