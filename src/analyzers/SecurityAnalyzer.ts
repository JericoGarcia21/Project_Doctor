import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export class SecurityAnalyzer extends BaseAnalyzer {
  readonly id = 'security-analyzer';
  readonly name = 'Security Analyzer';
  readonly description = 'Detects potential security issues and configuration problems';

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.log('Starting security analysis...');

    try {
      // Check for .env file in repository
      const envPath = path.join(context.rootPath, '.env');
      
      try {
        await fs.access(envPath);
        findings.push(createFinding(
          'Environment File Detected',
          '.env file found in project root',
          Severity.WARNING,
          'security',
          {
            filePath: '.env',
            suggestedAction: 'Ensure .env is in .gitignore and not committed to version control'
          }
        ));
      } catch {
        // .env doesn't exist - good
      }

      this.log(`Security analysis complete. Found ${findings.length} issues.`);
    } catch (error) {
      this.log(`Error during security analysis: ${error}`);
    }

    return findings;
  }
}
