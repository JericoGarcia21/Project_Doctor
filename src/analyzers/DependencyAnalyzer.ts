import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export class DependencyAnalyzer extends BaseAnalyzer {
  readonly id = 'dependency-analyzer';
  readonly name = 'Dependency Analyzer';
  readonly description = 'Analyzes project dependencies and package configurations';

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.log('Starting dependency analysis...');

    try {
      // Check for package.json
      const packageJsonPath = path.join(context.rootPath, 'package.json');
      
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        
        // Check if dependencies exist
        const hasDeps = packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;
        const hasDevDeps = packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0;
        
        if (!hasDeps && !hasDevDeps) {
          findings.push(createFinding(
            'No Dependencies Found',
            'package.json exists but contains no dependencies',
            Severity.INFO,
            'dependencies',
            {
              filePath: 'package.json',
              suggestedAction: 'Verify if this is intentional'
            }
          ));
        }
      } catch {
        // package.json doesn't exist - not an error for all projects
      }

      this.log(`Dependency analysis complete. Found ${findings.length} issues.`);
    } catch (error) {
      this.log(`Error during dependency analysis: ${error}`);
    }

    return findings;
  }
}
