import { Finding } from './Finding';
import { Severity } from '../core/types';

export class FindingManager {
  private findings: Finding[] = [];

  addFinding(finding: Finding): void {
    this.findings.push(finding);
  }

  addFindings(findings: Finding[]): void {
    this.findings.push(...findings);
  }

  getFindings(): Finding[] {
    return [...this.findings];
  }

  getFindingsBySeverity(severity: Severity): Finding[] {
    return this.findings.filter(f => f.severity === severity);
  }

  getFindingsByCategory(category: string): Finding[] {
    return this.findings.filter(f => f.category === category);
  }

  getErrorCount(): number {
    return this.findings.filter(f => f.severity === Severity.ERROR || f.severity === Severity.CRITICAL).length;
  }

  getWarningCount(): number {
    return this.findings.filter(f => f.severity === Severity.WARNING).length;
  }

  clear(): void {
    this.findings = [];
  }
}
