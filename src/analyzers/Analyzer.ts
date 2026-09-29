import { ProjectContext } from '../core/types';
import { Finding } from '../diagnostics/Finding';

export interface Analyzer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  analyze(context: ProjectContext): Promise<Finding[]>;
}

export abstract class BaseAnalyzer implements Analyzer {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly description: string;

  abstract analyze(context: ProjectContext): Promise<Finding[]>;

  protected log(message: string): void {
    console.log(`[${this.id}] ${message}`);
  }
}
