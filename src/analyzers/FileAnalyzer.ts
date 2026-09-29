import * as fs from 'fs/promises';
import * as path from 'path';
import { BaseAnalyzer } from './Analyzer';
import { ProjectContext } from '../core/types';
import { Finding, createFinding } from '../diagnostics/Finding';
import { Severity } from '../core/types';

export class FileAnalyzer extends BaseAnalyzer {
  readonly id = 'file-analyzer';
  readonly name = 'File Analyzer';
  readonly description = 'Analyzes project file structure and detects common issues';

  async analyze(context: ProjectContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    this.log('Starting file analysis...');

    try {
      // Check for large files
      const files = await this.scanDirectory(context.rootPath);
      
      for (const file of files) {
        const stats = await fs.stat(file);
        
        // Flag files larger than 5MB
        if (stats.size > 5 * 1024 * 1024) {
          findings.push(createFinding(
            'Large File Detected',
            `File is ${(stats.size / 1024 / 1024).toFixed(2)}MB which may impact performance`,
            Severity.WARNING,
            'file-size',
            {
              filePath: path.relative(context.rootPath, file),
              suggestedAction: 'Consider splitting this file or moving large data to external resources'
            }
          ));
        }
      }

      this.log(`File analysis complete. Found ${findings.length} issues.`);
    } catch (error) {
      this.log(`Error during file analysis: ${error}`);
    }

    return findings;
  }

  private async scanDirectory(dir: string, files: string[] = []): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (!this.shouldIgnoreDirectory(entry.name)) {
          await this.scanDirectory(fullPath, files);
        }
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private shouldIgnoreDirectory(name: string): boolean {
    const ignored = ['node_modules', 'vendor', '.git', 'dist', 'build', 'coverage', '.vscode', '.idea'];
    return ignored.includes(name);
  }
}
