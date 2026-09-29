import * as fs from 'fs/promises';
import * as path from 'path';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export class PackageJsonValidator {
  async validate(projectPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // Validate required fields
      findings.push(...this.validateRequiredFields(packageJson));

      // Validate scripts
      findings.push(...this.validateScripts(packageJson));

      // Validate dependencies
      findings.push(...this.validateDependencies(packageJson));

      // Validate version format
      findings.push(...this.validateVersion(packageJson));

      // Validate repository
      findings.push(...this.validateRepository(packageJson));

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        findings.push(createFinding(
          'Missing package.json',
          'No package.json found in project root',
          Severity.ERROR,
          'configuration',
          {
            filePath: 'package.json',
            suggestedAction: 'Create a package.json file with npm init'
          }
        ));
      } else {
        findings.push(createFinding(
          'package.json Parse Error',
          `Failed to parse package.json: ${(error as Error).message}`,
          Severity.ERROR,
          'configuration',
          {
            filePath: 'package.json',
            suggestedAction: 'Fix JSON syntax errors'
          }
        ));
      }
    }

    return findings;
  }

  private validateRequiredFields(packageJson: Record<string, any>): Finding[] {
    const findings: Finding[] = [];

    // Check name
    if (!packageJson.name) {
      findings.push(createFinding(
        'package.json: Missing Name',
        'Package name is not defined',
        Severity.WARNING,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add "name" field to package.json'
        }
      ));
    } else if (!/^[a-z0-9-._~]+$/.test(packageJson.name)) {
      findings.push(createFinding(
        'package.json: Invalid Name',
        'Package name contains invalid characters',
        Severity.WARNING,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Use lowercase letters, numbers, hyphens, and underscores only'
        }
      ));
    }

    // Check version
    if (!packageJson.version) {
      findings.push(createFinding(
        'package.json: Missing Version',
        'Package version is not defined',
        Severity.WARNING,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add "version" field (e.g., "1.0.0")'
        }
      ));
    }

    // Check description
    if (!packageJson.description) {
      findings.push(createFinding(
        'package.json: Missing Description',
        'Package description is not defined',
        Severity.INFO,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add "description" field to describe your project'
        }
      ));
    }

    return findings;
  }

  private validateScripts(packageJson: Record<string, any>): Finding[] {
    const findings: Finding[] = [];

    if (!packageJson.scripts) {
      findings.push(createFinding(
        'package.json: No Scripts',
        'No npm scripts defined',
        Severity.INFO,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add scripts for common tasks (test, build, dev)'
        }
      ));
      return findings;
    }

    const scripts = packageJson.scripts;

    // Check for common scripts
    const recommendedScripts = ['test', 'build', 'start'];
    const missingScripts = recommendedScripts.filter(script => !scripts[script]);

    if (missingScripts.length > 0) {
      findings.push(createFinding(
        'package.json: Missing Common Scripts',
        `Missing recommended scripts: ${missingScripts.join(', ')}`,
        Severity.INFO,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Consider adding these common scripts'
        }
      ));
    }

    // Check for potentially dangerous scripts
    for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
      if (typeof scriptCommand === 'string') {
        // Check for rm -rf in scripts
        if (scriptCommand.includes('rm -rf') || scriptCommand.includes('rimraf')) {
          findings.push(createFinding(
            `package.json: Dangerous Script (${scriptName})`,
            `Script "${scriptName}" contains potentially dangerous file deletion`,
            Severity.WARNING,
            'configuration',
            {
              filePath: 'package.json',
              suggestedAction: 'Review the script to ensure it only deletes intended files'
            }
          ));
        }

        // Check for scripts that install packages
        if (scriptCommand.includes('npm install') || scriptCommand.includes('yarn add')) {
          findings.push(createFinding(
            `package.json: Script Installs Packages (${scriptName})`,
            `Script "${scriptName}" installs packages, which may be unexpected`,
            Severity.INFO,
            'configuration',
            {
              filePath: 'package.json',
              suggestedAction: 'Ensure package installations are intentional'
            }
          ));
        }
      }
    }

    return findings;
  }

  private validateDependencies(packageJson: Record<string, any>): Finding[] {
    const findings: Finding[] = [];

    // Check if dependencies exist
    const hasDeps = packageJson.dependencies && Object.keys(packageJson.dependencies).length > 0;
    const hasDevDeps = packageJson.devDependencies && Object.keys(packageJson.devDependencies).length > 0;

    if (!hasDeps && !hasDevDeps) {
      findings.push(createFinding(
        'package.json: No Dependencies',
        'No dependencies or devDependencies defined',
        Severity.INFO,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add dependencies if your project needs external packages'
        }
      ));
    }

    return findings;
  }

  private validateVersion(packageJson: Record<string, any>): Finding[] {
    const findings: Finding[] = [];

    if (packageJson.version) {
      // Check semantic versioning format
      const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
      if (!semverRegex.test(packageJson.version)) {
        findings.push(createFinding(
          'package.json: Invalid Version Format',
          `Version "${packageJson.version}" does not follow semantic versioning`,
          Severity.WARNING,
          'configuration',
          {
            filePath: 'package.json',
            suggestedAction: 'Use semantic versioning format (e.g., "1.0.0")'
          }
        ));
      }
    }

    return findings;
  }

  private validateRepository(packageJson: Record<string, any>): Finding[] {
    const findings: Finding[] = [];

    if (!packageJson.repository) {
      findings.push(createFinding(
        'package.json: No Repository',
        'Repository information is not defined',
        Severity.INFO,
        'configuration',
        {
          filePath: 'package.json',
          suggestedAction: 'Add repository URL for better discoverability'
        }
      ));
    }

    return findings;
  }

  /**
   * Get recommended package.json structure
   */
  getRecommendedStructure(): Record<string, any> {
    return {
      name: 'my-project',
      version: '1.0.0',
      description: 'Project description',
      main: 'index.js',
      scripts: {
        test: 'vitest run',
        build: 'tsc',
        dev: 'tsc --watch',
        start: 'node dist/index.js'
      },
      keywords: [],
      author: '',
      license: 'MIT',
      dependencies: {},
      devDependencies: {}
    };
  }
}
