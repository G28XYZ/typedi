import 'reflect-metadata';
import { Container, Service } from '../src/index';

@Service()
class ClockService {
  public now(): string {
    return new Date().toISOString();
  }
}

@Service()
class ReportService {
  constructor(private readonly clockService: ClockService) {}

  public printReport(title: string): void {
    console.log(`[${this.clockService.now()}] ${title}`);
  }
}

const reportService = Container.get(ReportService);
reportService.printReport('Basic example is working');
