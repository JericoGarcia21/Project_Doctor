import { ProjectContext, ScanStatistics } from './types';
import { Finding } from '../diagnostics/Finding';

export class ScanResult {
  constructor(
    public readonly context: ProjectContext,
    public readonly findings: Finding[],
    public readonly statistics: ScanStatistics,
    public readonly scanDuration: number
  ) {}

  hasErrors(): boolean {
    return this.findings.some(f => f.severity === 'ERROR' || f.severity === 'CRITICAL');
  }

  hasWarnings(): boolean {
    return this.findings.some(f => f.severity === 'WARNING');
  }

  getErrorCount(): number {
    return this.findings.filter(f => f.severity === 'ERROR' || f.severity === 'CRITICAL').length;
  }

  getWarningCount(): number {
    return this.findings.filter(f => f.severity === 'WARNING').length;
  }

  toJSON(): object {
    return {
      context: this.context,
      findings: this.findings,
      statistics: this.statistics,
      scanDuration: this.scanDuration,
      hasErrors: this.hasErrors(),
      hasWarnings: this.hasWarnings()
    };
  }
}
