import * as fs from 'fs/promises';
import * as path from 'path';
import { ProjectContext } from './ProjectContext';
import { ScanResult } from './ScanResult';
import { FileInfo, ScanStatistics } from './types';
import { Analyzer } from '../analyzers/Analyzer';
import { FindingManager } from '../diagnostics/FindingManager';
import { FrameworkDetector } from '../detectors/FrameworkDetector';
import { ImportGraph } from '../graph/ImportGraph';
import { TypeScriptParser } from '../parsers/TypeScriptParser';

export class ProjectScanner {
  private readonly ignoredDirectories = [
    'node_modules',
    'vendor',
    '.git',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    'out',
    '.cache',
    '.vscode',
    '.idea'
  ];

  private readonly configFiles = [
    'package.json',
    'composer.json',
    'tsconfig.json',
    'vite.config.ts',
    'vite.config.js',
    'webpack.config.js',
    'next.config.js',
    'nuxt.config.js',
    'angular.json',
    'artisan',
    '.env',
    '.gitignore',
    'README.md'
  ];

  private frameworkDetector: FrameworkDetector;
  private tsParser: TypeScriptParser;

  constructor(private analyzers: Analyzer[] = []) {
    this.frameworkDetector = new FrameworkDetector();
    this.tsParser = new TypeScriptParser();
  }

  async scan(rootPath: string): Promise<ScanResult> {
    const startTime = Date.now();
    console.log(`[ProjectScanner] Starting scan of: ${rootPath}`);

    const context = new ProjectContext(rootPath);
    const findingManager = new FindingManager();

    try {
      // Discover project structure
      await this.discoverProjectStructure(context);

      // Detect technologies
      await this.detectTechnologies(context);

      // Detect frameworks (Phase 2)
      await this.detectFrameworks(context);

      // Enumerate files
      const files = await this.enumerateFiles(context.rootPath);
      
      // Build import graph for TypeScript/JavaScript files (Phase 2)
      const importGraph = await this.buildImportGraph(context.rootPath, files);
      console.log(`[ProjectScanner] Import graph: ${importGraph.getStatistics().totalFiles} files, ${importGraph.getStatistics().totalImports} imports`);
      
      // Run analyzers
      for (const analyzer of this.analyzers) {
        console.log(`[ProjectScanner] Running analyzer: ${analyzer.name}`);
        const findings = await analyzer.analyze(context);
        findingManager.addFindings(findings);
      }

      // Build statistics
      const statistics: ScanStatistics = {
        totalFiles: files.length,
        problemCount: findingManager.getErrorCount(),
        warningCount: findingManager.getWarningCount(),
        technologies: context.detectedTechnologies
      };

      const scanDuration = Date.now() - startTime;
      console.log(`[ProjectScanner] Scan complete in ${scanDuration}ms`);

      return new ScanResult(
        context,
        findingManager.getFindings(),
        statistics,
        scanDuration
      );
    } catch (error) {
      console.error(`[ProjectScanner] Error during scan:`, error);
      throw error;
    }
  }

  private async discoverProjectStructure(context: ProjectContext): Promise<void> {
    // Check for config files
    for (const configFile of this.configFiles) {
      const filePath = path.join(context.rootPath, configFile);
      try {
        await fs.access(filePath);
        context.addConfigFile(configFile);
      } catch {
        // File doesn't exist
      }
    }

    // Detect source directories
    const commonSrcDirs = ['src', 'app', 'lib', 'source'];
    for (const dir of commonSrcDirs) {
      const dirPath = path.join(context.rootPath, dir);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.isDirectory()) {
          context.addSourceDirectory(dir);
        }
      } catch {
        // Directory doesn't exist
      }
    }
  }

  private async detectTechnologies(context: ProjectContext): Promise<void> {
    // Node.js / JavaScript
    if (context.configFiles.includes('package.json')) {
      context.addTechnology('Node.js');
      
      // Detect package manager
      try {
        const lockFiles = [
          { file: 'package-lock.json', manager: 'npm' as const },
          { file: 'yarn.lock', manager: 'yarn' as const },
          { file: 'pnpm-lock.yaml', manager: 'pnpm' as const }
        ];

        for (const { file, manager } of lockFiles) {
          try {
            await fs.access(path.join(context.rootPath, file));
            context.setPackageManager(manager);
            break;
          } catch {
            // Lock file doesn't exist
          }
        }
      } catch {
        // Error checking lock files
      }
    }

    // TypeScript
    if (context.configFiles.includes('tsconfig.json')) {
      context.addTechnology('TypeScript');
    }

    // Vite
    if (context.configFiles.some(f => f.startsWith('vite.config'))) {
      context.addTechnology('Vite');
    }

    // Laravel / PHP
    if (context.configFiles.includes('composer.json') || context.configFiles.includes('artisan')) {
      context.addTechnology('PHP');
      if (context.configFiles.includes('artisan')) {
        context.addTechnology('Laravel');
        context.setPackageManager('composer');
      }
    } else {
      // Detect PHP by file extension
      const hasPhpFiles = await this.hasFilesWithExtension(context.rootPath, ['.php']);
      if (hasPhpFiles) {
        context.addTechnology('PHP');
      }
    }

    // Detect JavaScript/HTML/CSS by file extensions if not already detected
    if (!context.detectedTechnologies.includes('Node.js')) {
      const hasJsFiles = await this.hasFilesWithExtension(context.rootPath, ['.js']);
      if (hasJsFiles) {
        context.addTechnology('JavaScript');
      }
    }

    const hasHtmlFiles = await this.hasFilesWithExtension(context.rootPath, ['.html']);
    if (hasHtmlFiles) {
      context.addTechnology('HTML');
    }

    const hasCssFiles = await this.hasFilesWithExtension(context.rootPath, ['.css']);
    if (hasCssFiles) {
      context.addTechnology('CSS');
    }

    // Git
    try {
      await fs.access(path.join(context.rootPath, '.git'));
      context.setGitAvailable(true);
    } catch {
      context.setGitAvailable(false);
    }
  }

  private async hasFilesWithExtension(rootPath: string, extensions: string[]): Promise<boolean> {
    try {
      const files = await this.quickScanForExtensions(rootPath, extensions, 2);
      return files.length > 0;
    } catch {
      return false;
    }
  }

  private async quickScanForExtensions(dir: string, extensions: string[], maxDepth: number, currentDepth: number = 0): Promise<string[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        // Ignore common directories
        if (this.shouldIgnoreDirectory(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.quickScanForExtensions(fullPath, extensions, maxDepth, currentDepth + 1);
          files.push(...subFiles);
          
          // Early exit if we found files
          if (files.length > 0) {
            return files;
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (extensions.includes(ext)) {
            files.push(fullPath);
            return files; // Found one, that's enough
          }
        }
      }
    } catch {
      // Error reading directory
    }

    return files;
  }

  private async enumerateFiles(dir: string, files: FileInfo[] = []): Promise<FileInfo[]> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!this.shouldIgnoreDirectory(entry.name)) {
            await this.enumerateFiles(fullPath, files);
          }
        } else if (entry.isFile()) {
          const stats = await fs.stat(fullPath);
          files.push({
            path: fullPath,
            relativePath: path.relative(dir, fullPath),
            extension: path.extname(entry.name),
            size: stats.size
          });
        }
      }
    } catch (error) {
      console.error(`Error enumerating files in ${dir}:`, error);
    }

    return files;
  }

  private shouldIgnoreDirectory(name: string): boolean {
    return this.ignoredDirectories.includes(name);
  }

  private async detectFrameworks(context: ProjectContext): Promise<void> {
    try {
      const frameworks = await this.frameworkDetector.detectFrameworks(context.rootPath);
      
      for (const framework of frameworks) {
        context.addTechnology(framework.name);
        console.log(`[ProjectScanner] Detected ${framework.name} (confidence: ${framework.confidence})`);
      }
    } catch (error) {
      console.error(`[ProjectScanner] Error detecting frameworks:`, error);
    }
  }

  private async buildImportGraph(rootPath: string, files: FileInfo[]): Promise<ImportGraph> {
    const importGraph = new ImportGraph(rootPath);
    
    // Filter TypeScript/JavaScript files
    const sourceFiles = files.filter(f => 
      f.extension === '.ts' || 
      f.extension === '.tsx' || 
      f.extension === '.js' || 
      f.extension === '.jsx'
    );

    // Parse first 100 files for performance (can be increased later)
    const filesToParse = sourceFiles.slice(0, 100);
    
    for (const file of filesToParse) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const parseResult = await this.tsParser.parse(content, file.path);
        
        // Add node to graph
        importGraph.addNode(file.path, parseResult.imports, parseResult.exports);
        
        // Add edges for imports
        for (const importPath of parseResult.imports) {
          const resolved = importGraph.resolveImportPath(file.path, importPath);
          if (resolved) {
            importGraph.addEdge(file.path, resolved, 'named', []);
          }
        }
      } catch (error) {
        // Skip files that can't be parsed
      }
    }

    // Detect circular dependencies
    const cycles = importGraph.detectCircularDependencies();
    if (cycles.length > 0) {
      console.log(`[ProjectScanner] Found ${cycles.length} circular dependencies`);
    }

    return importGraph;
  }
}
