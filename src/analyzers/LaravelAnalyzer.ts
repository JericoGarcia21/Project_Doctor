import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';
import { PHPParser } from '../parsers/PHPParser';

export class LaravelAnalyzer extends BaseAnalyzer {
  readonly id = 'laravel-analyzer';
  readonly name = 'Laravel Analyzer';
  readonly description = 'Analyzes Laravel-specific patterns: middleware, Eloquent models, and relationships';

  private phpParser: PHPParser;

  constructor() {
    super();
    this.phpParser = new PHPParser();
  }

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    if (!context.detectedTechnologies.includes('Laravel')) {
      return findings;
    }

    this.log('Starting Laravel-specific analysis...');

    try {
      const files = await this.enumeratePhpFiles(context.rootPath);

      const middlewareFindings = await this.analyzeMiddleware(context.rootPath, files);
      findings.push(...middlewareFindings);

      const modelFindings = await this.analyzeEloquentModels(context.rootPath, files);
      findings.push(...modelFindings);

      this.log(`Laravel analysis complete. Found ${findings.length} issues.`);
    } catch (error) {
      this.log(`Error during Laravel analysis: ${error}`);
    }

    return findings;
  }

  private async enumeratePhpFiles(rootPath: string): Promise<string[]> {
    const phpFiles: string[] = [];

    const walk = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!this.shouldIgnore(entry.name)) {
              await walk(fullPath);
            }
          } else if (entry.isFile() && entry.name.endsWith('.php')) {
            phpFiles.push(fullPath);
          }
        }
      } catch {
        // Skip directories we can't read
      }
    };

    await walk(rootPath);
    return phpFiles;
  }

  private shouldIgnore(name: string): boolean {
    const ignored = ['node_modules', 'vendor', '.git', 'dist', 'build', 'storage', 'cache'];
    return ignored.includes(name);
  }

  private async analyzeMiddleware(rootPath: string, files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];
    const routeFiles = files.filter(f => {
      const rel = path.relative(rootPath, f).split(path.sep).join('/');
      return /^routes\//i.test(rel);
    });

    for (const file of routeFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const middlewares = this.phpParser.parseLaravelMiddleware(content, file);

        for (const mw of middlewares) {
          if (mw.middleware.length === 0) {
            findings.push(createFinding(
              'Route Without Middleware',
              `Route ${mw.routeMethod} ${mw.routeUri} has no middleware applied`,
              Severity.INFO,
              'laravel-middleware',
              {
                filePath: file,
                line: mw.sourceLine,
                suggestedAction: 'Consider adding appropriate middleware for authentication, validation, or rate limiting'
              }
            ));
          }

          for (const m of mw.middleware) {
            if (m.includes('auth') && mw.routeUri.includes('public')) {
              findings.push(createFinding(
                'Auth Middleware on Public Route',
                `Route ${mw.routeMethod} ${mw.routeUri} uses auth middleware but appears to be a public route`,
                Severity.WARNING,
                'laravel-middleware',
                {
                  filePath: file,
                  line: mw.sourceLine,
                  suggestedAction: 'Verify this route should require authentication'
                }
              ));
            }
          }
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    return findings;
  }

  private async analyzeEloquentModels(rootPath: string, files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];
    const modelFiles = files.filter(f => {
      const rel = path.relative(rootPath, f).split(path.sep).join('/');
      return /^app\/models\//i.test(rel) || /^app\//i.test(rel);
    });

    for (const file of modelFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const models = this.phpParser.parseEloquentModels(content, file);

        for (const model of models) {
          if (!model.tableName) {
            const expectedTable = this.guessTableName(model.className);
            findings.push(createFinding(
              'Missing Table Name',
              `Eloquent model ${model.className} does not explicitly define a table name`,
              Severity.INFO,
              'laravel-eloquent',
              {
                filePath: file,
                line: model.sourceLine,
                suggestedAction: `Consider adding \`protected $table = '${expectedTable}';\` for clarity`
              }
            ));
          }

          if (model.fillable.length === 0 && model.hidden.length === 0) {
            findings.push(createFinding(
              'No Fillable or Hidden Properties',
              `Eloquent model ${model.className} does not define $fillable or $hidden properties`,
              Severity.WARNING,
              'laravel-eloquent',
              {
                filePath: file,
                line: model.sourceLine,
                suggestedAction: 'Define $fillable to prevent mass assignment vulnerabilities'
              }
            ));
          }

          for (const rel of model.relationships) {
            if (!rel.foreignKey && (rel.type === 'hasMany' || rel.type === 'belongsTo')) {
              findings.push(createFinding(
                'Missing Foreign Key in Relationship',
                `${model.className}::${rel.method}() does not specify a foreign key`,
                Severity.INFO,
                'laravel-eloquent',
                {
                  filePath: file,
                  line: rel.sourceLine,
                  suggestedAction: 'Explicitly define foreign keys for better clarity and to avoid convention mismatches'
                }
              ));
            }

            if (rel.type === 'belongsToMany' && !rel.pivotTable) {
              findings.push(createFinding(
                'Missing Pivot Table Name',
                `${model.className}::${rel.method}() does not specify a pivot table name`,
                Severity.INFO,
                'laravel-eloquent',
                {
                  filePath: file,
                  line: rel.sourceLine,
                  suggestedAction: 'Explicitly define the pivot table name to avoid convention issues'
                }
              ));
            }
          }
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    return findings;
  }

  private guessTableName(className: string): string {
    return className
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/_/, 's')
      .replace(/s_s$/, 'ses')
      + 's';
  }
}
