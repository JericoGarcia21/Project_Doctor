import * as fs from 'fs/promises';
import * as path from 'path';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export interface TSConfigIssue {
  property: string;
  issue: string;
  severity: Severity;
  suggestion: string;
}

export class TSConfigValidator {
  async validate(projectPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const tsconfigPath = path.join(projectPath, 'tsconfig.json');

    try {
      const content = await fs.readFile(tsconfigPath, 'utf-8');
      
      // Remove comments (simple approach)
      const cleanContent = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      const tsconfig = JSON.parse(cleanContent);

      // Validate compiler options
      if (tsconfig.compilerOptions) {
        const issues = this.validateCompilerOptions(tsconfig.compilerOptions);
        findings.push(...issues.map(issue => 
          createFinding(
            `TSConfig: ${issue.property}`,
            issue.issue,
            issue.severity,
            'configuration',
            {
              filePath: 'tsconfig.json',
              suggestedAction: issue.suggestion
            }
          )
        ));
      } else {
        findings.push(createFinding(
          'TSConfig: Missing Compiler Options',
          'tsconfig.json does not have compilerOptions defined',
          Severity.WARNING,
          'configuration',
          {
            filePath: 'tsconfig.json',
            suggestedAction: 'Add compilerOptions to tsconfig.json'
          }
        ));
      }

      // Check for include/exclude
      if (!tsconfig.include && !tsconfig.files) {
        findings.push(createFinding(
          'TSConfig: No Include Pattern',
          'tsconfig.json should specify include or files',
          Severity.WARNING,
          'configuration',
          {
            filePath: 'tsconfig.json',
            suggestedAction: 'Add "include": ["src/**/*"] to specify which files to compile'
          }
        ));
      }

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        findings.push(createFinding(
          'TSConfig: Parse Error',
          `Failed to parse tsconfig.json: ${(error as Error).message}`,
          Severity.ERROR,
          'configuration',
          {
            filePath: 'tsconfig.json',
            suggestedAction: 'Fix JSON syntax errors in tsconfig.json'
          }
        ));
      }
    }

    return findings;
  }

  private validateCompilerOptions(options: Record<string, any>): TSConfigIssue[] {
    const issues: TSConfigIssue[] = [];

    // Check strict mode
    if (!options.strict) {
      issues.push({
        property: 'strict',
        issue: 'TypeScript strict mode is disabled',
        severity: Severity.WARNING,
        suggestion: 'Enable "strict": true for better type safety'
      });
    }

    // Check target
    if (!options.target) {
      issues.push({
        property: 'target',
        issue: 'No compilation target specified',
        severity: Severity.WARNING,
        suggestion: 'Set "target" to "ES2020" or higher'
      });
    } else {
      const target = options.target.toLowerCase();
      if (target === 'es3' || target === 'es5') {
        issues.push({
          property: 'target',
          issue: `Compilation target ${options.target} is very old`,
          severity: Severity.INFO,
          suggestion: 'Consider upgrading to ES2020 or ESNext'
        });
      }
    }

    // Check module
    if (!options.module) {
      issues.push({
        property: 'module',
        issue: 'No module system specified',
        severity: Severity.WARNING,
        suggestion: 'Set "module" to "ESNext" or "CommonJS"'
      });
    }

    // Check esModuleInterop
    if (options.module === 'commonjs' && !options.esModuleInterop) {
      issues.push({
        property: 'esModuleInterop',
        issue: 'esModuleInterop is disabled with CommonJS modules',
        severity: Severity.INFO,
        suggestion: 'Enable "esModuleInterop": true for better ES module compatibility'
      });
    }

    // Check skipLibCheck
    if (!options.skipLibCheck) {
      issues.push({
        property: 'skipLibCheck',
        issue: 'skipLibCheck is disabled, may slow down compilation',
        severity: Severity.INFO,
        suggestion: 'Consider enabling "skipLibCheck": true for faster builds'
      });
    }

    // Check outDir
    if (!options.outDir) {
      issues.push({
        property: 'outDir',
        issue: 'No output directory specified',
        severity: Severity.INFO,
        suggestion: 'Set "outDir" to specify where compiled files should go (e.g., "dist")'
      });
    }

    // Check sourceMap
    if (!options.sourceMap && !options.inlineSourceMap) {
      issues.push({
        property: 'sourceMap',
        issue: 'Source maps are disabled',
        severity: Severity.INFO,
        suggestion: 'Enable "sourceMap": true for better debugging'
      });
    }

    // Check declaration
    if (!options.declaration && options.outDir) {
      issues.push({
        property: 'declaration',
        issue: 'Type declarations are not being generated',
        severity: Severity.INFO,
        suggestion: 'Enable "declaration": true to generate .d.ts files'
      });
    }

    // Check noImplicitAny
    if (!options.strict && !options.noImplicitAny) {
      issues.push({
        property: 'noImplicitAny',
        issue: 'Implicit any types are allowed',
        severity: Severity.WARNING,
        suggestion: 'Enable "noImplicitAny": true or enable strict mode'
      });
    }

    // Check resolveJsonModule for projects with JSON imports
    if (!options.resolveJsonModule) {
      issues.push({
        property: 'resolveJsonModule',
        issue: 'JSON module imports are disabled',
        severity: Severity.INFO,
        suggestion: 'Enable "resolveJsonModule": true if you import JSON files'
      });
    }

    return issues;
  }

  /**
   * Get recommended tsconfig.json settings
   */
  getRecommendedSettings(): Record<string, any> {
    return {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        lib: ['ES2020'],
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        moduleResolution: 'node',
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        sourceMap: true,
        declaration: true,
        outDir: './dist'
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'build']
    };
  }
}
