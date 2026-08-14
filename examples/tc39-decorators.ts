import { Container, Inject, InjectMany, Service } from '../src/index';

// In TS5+ standard decorators mode (TC39), this is the regular usage style.
@Service()
class LoggerService {
  public log(message: string): void {
    console.log(`[logger] ${message}`);
  }
}

@Service()
class Controller {
  @Inject(() => LoggerService)
  public logger!: LoggerService;

  public run(): void {
    this.logger.log('TC39 standard usage with Container.get(...)');
  }
}

class ManualController {
  @Inject(() => LoggerService, { resolveNew: true })
  public logger!: LoggerService;

  public run(): void {
    this.logger.log('TC39 standard usage with new + resolveNew');
  }
}

@Service({ id: 'tc39.plugins', multiple: true })
class FirstPlugin {}

@Service({ id: 'tc39.plugins', multiple: true })
class SecondPlugin {}

@Service()
class PluginHost {
  @InjectMany('tc39.plugins')
  public plugins!: unknown[];
}

Container.get(Controller).run();
new ManualController().run();
console.log(`[plugins] resolved ${Container.get(PluginHost).plugins.length} TC39 services`);
