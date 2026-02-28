import { Container, Inject, Service } from '../src/index';

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

Container.get(Controller).run();
new ManualController().run();
