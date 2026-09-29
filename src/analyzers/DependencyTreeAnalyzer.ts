import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export interface DependencyNode {
  name: string;
  version: string;
  isDev: boolean;
  isOptional: boolean;
  isPeer: boolean;
}

export interface DependencyTree {
  dependencies: Map<string, DependencyNode>;
  devDependencies: Map<string, DependencyNode>;
  peerDependencies: Map<string, DependencyNode>;
  optionalDependencies: Map<string, DependencyNode>;
}

export class DependencyTreeAnalyzer extends BaseAnalyzer {
  readonly id = 'dependency-tree-analyzer';
  readonly name = 'Dependency Tree Analyzer';
  readonly description = 'Analyzes dependency tree and detects issues';

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.log('Starting dependency tree analysis...');

    try {
      const packageJsonPath = path.join(context.rootPath, 'package.json');
      
      try {
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);
        
        const tree = this.buildDependencyTree(packageJson);
        
        // Check for missing dependencies
        const missingDeps = await this.checkMissingDependencies(context.rootPath, tree);
        findings.push(...missingDeps);
        
        // Check for outdated dependencies
        const outdatedDeps = this.checkOutdatedPatterns(packageJson);
        findings.push(...outdatedDeps);
        
        // Check for duplicate dependencies
        const duplicates = this.checkDuplicateDependencies(tree);
        findings.push(...duplicates);
        
        // Check for dev dependencies in production
        const devInProd = this.checkDevDependenciesInProduction(packageJson);
        findings.push(...devInProd);

      } catch (error) {
        this.log(`No package.json or invalid JSON: ${error}`);
      }

      this.log(`Dependency tree analysis complete. Found ${findings.length} issues.`);
    } catch (error) {
      this.log(`Error during dependency tree analysis: ${error}`);
    }

    return findings;
  }

  private buildDependencyTree(packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    optionalDependencies?: Record<string, string>;
  }): DependencyTree {
    const tree: DependencyTree = {
      dependencies: new Map(),
      devDependencies: new Map(),
      peerDependencies: new Map(),
      optionalDependencies: new Map()
    };

    // Build dependencies map
    if (packageJson.dependencies) {
      for (const [name, version] of Object.entries(packageJson.dependencies)) {
        tree.dependencies.set(name, {
          name,
          version,
          isDev: false,
          isOptional: false,
          isPeer: false
        });
      }
    }

    // Build devDependencies map
    if (packageJson.devDependencies) {
      for (const [name, version] of Object.entries(packageJson.devDependencies)) {
        tree.devDependencies.set(name, {
          name,
          version,
          isDev: true,
          isOptional: false,
          isPeer: false
        });
      }
    }

    // Build peerDependencies map
    if (packageJson.peerDependencies) {
      for (const [name, version] of Object.entries(packageJson.peerDependencies)) {
        tree.peerDependencies.set(name, {
          name,
          version,
          isDev: false,
          isOptional: false,
          isPeer: true
        });
      }
    }

    // Build optionalDependencies map
    if (packageJson.optionalDependencies) {
      for (const [name, version] of Object.entries(packageJson.optionalDependencies)) {
        tree.optionalDependencies.set(name, {
          name,
          version,
          isDev: false,
          isOptional: true,
          isPeer: false
        });
      }
    }

    return tree;
  }

  private async checkMissingDependencies(rootPath: string, tree: DependencyTree): Promise<Finding[]> {
    const findings: Finding[] = [];
    const nodeModulesPath = path.join(rootPath, 'node_modules');

    try {
      await fs.access(nodeModulesPath);
      
      // Check if any dependencies are not installed
      for (const [name] of tree.dependencies) {
        const depPath = path.join(nodeModulesPath, name);
        try {
          await fs.access(depPath);
        } catch {
          findings.push(createFinding(
            'Missing Dependency',
            `Dependency '${name}' is listed in package.json but not installed`,
            Severity.ERROR,
            'dependencies',
            {
              filePath: 'package.json',
              suggestedAction: 'Run npm install to install missing dependencies'
            }
          ));
        }
      }
    } catch {
      // node_modules doesn't exist - major issue
      if (tree.dependencies.size > 0) {
        findings.push(createFinding(
          'node_modules Not Found',
          'node_modules directory does not exist but dependencies are listed',
          Severity.CRITICAL,
          'dependencies',
          {
            filePath: 'package.json',
            suggestedAction: 'Run npm install to install dependencies'
          }
        ));
      }
    }

    return findings;
  }

  private checkOutdatedPatterns(packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }): Finding[] {
    const findings: Finding[] = [];

    const checkDeps = (deps: Record<string, string>) => {
      for (const [name, version] of Object.entries(deps)) {
        // Check for wildcards
        if (version === '*' || version === 'latest') {
          findings.push(createFinding(
            'Unsafe Version Specifier',
            `Dependency '${name}' uses unsafe version specifier '${version}'`,
            Severity.WARNING,
            'dependencies',
            {
              filePath: 'package.json',
              suggestedAction: 'Use specific version ranges instead of wildcards'
            }
          ));
        }

        // Check for very old patterns
        if (version.includes('git://') || version.includes('git+ssh://')) {
          findings.push(createFinding(
            'Git Dependency Detected',
            `Dependency '${name}' is installed from Git repository`,
            Severity.INFO,
            'dependencies',
            {
              filePath: 'package.json',
              suggestedAction: 'Consider using published npm packages for stability'
            }
          ));
        }
      }
    };

    if (packageJson.dependencies) {
      checkDeps(packageJson.dependencies);
    }

    if (packageJson.devDependencies) {
      checkDeps(packageJson.devDependencies);
    }

    return findings;
  }

  private checkDuplicateDependencies(tree: DependencyTree): Finding[] {
    const findings: Finding[] = [];
    const allDeps = new Map<string, string[]>();

    // Collect all dependencies
    tree.dependencies.forEach((_dep, name) => {
      if (!allDeps.has(name)) {
        allDeps.set(name, []);
      }
      allDeps.get(name)!.push('dependencies');
    });

    tree.devDependencies.forEach((_dep, name) => {
      if (!allDeps.has(name)) {
        allDeps.set(name, []);
      }
      allDeps.get(name)!.push('devDependencies');
    });

    // Find duplicates
    allDeps.forEach((locations, name) => {
      if (locations.length > 1) {
        findings.push(createFinding(
          'Duplicate Dependency',
          `Package '${name}' appears in both dependencies and devDependencies`,
          Severity.WARNING,
          'dependencies',
          {
            filePath: 'package.json',
            suggestedAction: 'Move to either dependencies or devDependencies, not both'
          }
        ));
      }
    });

    return findings;
  }

  private checkDevDependenciesInProduction(packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }): Finding[] {
    const findings: Finding[] = [];

    // Common packages that should be in devDependencies
    const devOnlyPackages = [
      'eslint', 'prettier', 'jest', 'vitest', 'mocha', 'chai',
      '@types/', 'typescript', 'webpack', 'vite', 'rollup',
      '@testing-library/', 'cypress', 'playwright'
    ];

    if (packageJson.dependencies) {
      for (const [name] of Object.entries(packageJson.dependencies)) {
        const shouldBeDev = devOnlyPackages.some(pattern => name.includes(pattern));
        
        if (shouldBeDev) {
          findings.push(createFinding(
            'Dev Dependency in Production',
            `Package '${name}' should be in devDependencies, not dependencies`,
            Severity.WARNING,
            'dependencies',
            {
              filePath: 'package.json',
              suggestedAction: 'Move this package to devDependencies'
            }
          ));
        }
      }
    }

    return findings;
  }
}
