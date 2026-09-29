import * as fs from 'fs/promises';
import * as path from 'path';
import * as ts from 'typescript';
import { ProjectContext } from './ProjectContext';
import { ScanResult } from './ScanResult';
import { FileInfo, ScanStatistics } from './types';
import { Analyzer } from '../analyzers/Analyzer';
import { FindingManager } from '../diagnostics/FindingManager';
import { FrameworkDetector } from '../detectors/FrameworkDetector';
import { ImportGraph } from '../graph/ImportGraph';
import { ProjectGraph } from '../graph/ProjectGraph';
import { NodeType, RelationType, createEdge, createNode } from '../graph/GraphNode';
import { TypeScriptParser } from '../parsers/TypeScriptParser';
import { ASTParseResult } from '../parsers/ASTParser';
import { PHPControllerAction, PHPParser } from '../parsers/PHPParser';

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
  private phpParser: PHPParser;

  constructor(private analyzers: Analyzer[] = []) {
    this.frameworkDetector = new FrameworkDetector();
    this.tsParser = new TypeScriptParser();
    this.phpParser = new PHPParser();
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

      // Build relationship graph for Phase 3 symbol-to-symbol analysis
      const relationshipGraph = await this.buildRelationshipGraph(context.rootPath, files);
      console.log(`[ProjectScanner] Relationship graph: ${relationshipGraph.getNodeCount()} nodes, ${relationshipGraph.getEdgeCount()} edges`);
      
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
        scanDuration,
        relationshipGraph
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

  private async buildRelationshipGraph(rootPath: string, files: FileInfo[]): Promise<ProjectGraph> {
    const graph = new ProjectGraph();
    const sourceFiles = files.filter(f =>
      f.extension === '.ts' ||
      f.extension === '.tsx' ||
      f.extension === '.js' ||
      f.extension === '.jsx'
    ).slice(0, 100);

    const parsedFiles: { file: FileInfo; result: ASTParseResult }[] = [];
    const filesByPath = new Map<string, ASTParseResult>();
    const symbolsByFile = new Map<string, Map<string, { id: string; type: NodeType; isExported: boolean }>>();
    const exportedSymbols = new Map<string, string>();

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const result = await this.tsParser.parseDetailed(content, file.path);
        parsedFiles.push({ file, result });
        filesByPath.set(path.resolve(file.path), result);
      } catch {
        console.debug(`[ProjectScanner] Skipping relationship analysis for ${file.path}`);
      }
    }

    const addSymbol = (filePath: string, name: string, type: NodeType, isExported: boolean): string => {
      const id = `${filePath}#${name}`;
      graph.addNode(createNode(id, type, name, { filePath }));
      const symbols = symbolsByFile.get(filePath) ?? new Map();
      symbols.set(name, { id, type, isExported });
      symbolsByFile.set(filePath, symbols);
      if (isExported) {
        exportedSymbols.set(`${path.resolve(filePath)}#${name}`, id);
      }
      return id;
    };

    for (const { file, result } of parsedFiles) {
      const fileNodeId = file.path;
      graph.addNode(createNode(fileNodeId, NodeType.FILE, path.basename(file.path), { filePath: file.path }));

      for (const fn of result.functions) {
        addSymbol(file.path, fn.name, NodeType.FUNCTION, fn.isExported);
      }

      for (const cls of result.classes) {
        addSymbol(file.path, cls.name, NodeType.CLASS, cls.isExported);
      }

      for (const iface of result.interfaces) {
        addSymbol(file.path, iface.name, NodeType.CLASS, iface.isExported);
      }
    }

    let pathMappings: Record<string, readonly string[]> = {};
    let pathBase = rootPath;
    try {
      const configPath = path.join(rootPath, 'tsconfig.json');
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      if (!config.error) {
        const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, rootPath, undefined, configPath);
        pathMappings = parsedConfig.options.paths ?? {};
        pathBase = parsedConfig.options.baseUrl ?? rootPath;
      }
    } catch {
      // Path aliases are optional; relative imports still resolve without tsconfig.
    }

    const resolveFile = (basePath: string): string | undefined => {
      const candidates = [
        basePath,
        ...['.ts', '.tsx', '.js', '.jsx'].map(extension => `${basePath}${extension}`),
        ...['.ts', '.tsx', '.js', '.jsx'].map(extension => path.join(basePath, `index${extension}`))
      ];
      return candidates.find(candidate => filesByPath.has(path.resolve(candidate)));
    };

    const resolveModule = (fromFile: string, moduleName: string): string | undefined => {
      if (moduleName.startsWith('.')) {
        return resolveFile(path.resolve(path.dirname(fromFile), moduleName));
      }

      for (const [pattern, targets] of Object.entries(pathMappings)) {
        const wildcard = pattern.indexOf('*');
        const prefix = wildcard < 0 ? pattern : pattern.slice(0, wildcard);
        const suffix = wildcard < 0 ? '' : pattern.slice(wildcard + 1);
        if (!moduleName.startsWith(prefix) || !moduleName.endsWith(suffix)) {
          continue;
        }
        const matched = moduleName.slice(prefix.length, moduleName.length - suffix.length || undefined);
        for (const target of targets) {
          const targetPath = target.replace('*', matched);
          const resolved = resolveFile(path.resolve(pathBase, targetPath));
          if (resolved) {
            return resolved;
          }
        }
      }
      return undefined;
    };

    for (let pass = 0; pass <= parsedFiles.length; pass++) {
      let changed = false;
      for (const { file, result } of parsedFiles) {
        for (const exported of result.exports) {
          if (exported.exportType === 're-export' && exported.exportedNames.includes('*')) {
            const targetFile = exported.exportedFrom && resolveModule(file.path, exported.exportedFrom);
            if (!targetFile) {
              continue;
            }
            const targetPrefix = `${path.resolve(targetFile)}#`;
            for (const [key, symbolId] of exportedSymbols) {
              if (!key.startsWith(targetPrefix)) {
                continue;
              }
              const exportedName = key.slice(targetPrefix.length);
              const currentKey = `${path.resolve(file.path)}#${exportedName}`;
              if (!exportedSymbols.has(currentKey)) {
                exportedSymbols.set(currentKey, symbolId);
                changed = true;
              }
            }
            continue;
          }

          for (const binding of exported.bindings) {
            const targetFile = exported.exportedFrom && resolveModule(file.path, exported.exportedFrom);
            const target = targetFile
              ? exportedSymbols.get(`${path.resolve(targetFile)}#${binding.localName}`)
              : symbolsByFile.get(file.path)?.get(binding.localName)?.id;
            if (target) {
              const key = `${path.resolve(file.path)}#${binding.exportedName}`;
              if (exportedSymbols.get(key) !== target) {
                exportedSymbols.set(key, target);
                changed = true;
              }
            }
          }
        }
      }
      if (!changed) {
        break;
      }
    }

    for (const { file, result } of parsedFiles) {
      const fileNodeId = file.path;
      for (const imported of result.imports) {
        const importedFile = resolveModule(file.path, imported.moduleName);
        if (importedFile) {
          graph.addEdge(createEdge(fileNodeId, importedFile, RelationType.IMPORTS, {
            importType: imported.importType,
            importedNames: imported.importedNames,
            sourceLine: imported.sourceLine
          }));
        } else if (!imported.moduleName.startsWith('.')) {
          const dependencyNodeId = `external:${imported.moduleName}`;
          graph.addNode(createNode(dependencyNodeId, NodeType.FILE, imported.moduleName, { filePath: imported.moduleName }));
          graph.addEdge(createEdge(fileNodeId, dependencyNodeId, RelationType.IMPORTS, {
            importType: imported.importType,
            importedNames: imported.importedNames,
            sourceLine: imported.sourceLine
          }));
        }
      }

      const resolveTarget = (name: string): string | undefined => {
        const localTarget = symbolsByFile.get(file.path)?.get(name);
        if (localTarget) {
          return localTarget.id;
        }

        for (const imported of result.imports) {
          const binding = imported.bindings.find(item => item.localName === name);
          if (!binding) {
            continue;
          }

          const targetFile = resolveModule(file.path, imported.moduleName);
          if (targetFile) {
            return exportedSymbols.get(`${path.resolve(targetFile)}#${binding.importedName}`);
          }
        }
        return undefined;
      };

      for (const relationship of result.relationships) {
        const source = symbolsByFile.get(file.path)?.get(relationship.source);
        const targetId = resolveTarget(relationship.target);
        if (!source || !targetId) {
          continue;
        }

        let relationType: RelationType;
        switch (relationship.type) {
          case 'calls':
            relationType = RelationType.CALLS;
            break;
          case 'callback':
            relationType = RelationType.CALLBACK;
            break;
          case 'handles':
            relationType = RelationType.HANDLES;
            break;
          case 'decorates':
            relationType = RelationType.DECORATES;
            break;
          case 'uses':
            relationType = RelationType.USES;
            break;
          case 'extends':
            relationType = RelationType.EXTENDS;
            break;
          case 'implements':
            relationType = RelationType.IMPLEMENTS;
            break;
        }
        graph.addEdge(createEdge(source.id, targetId, relationType, {
          sourceLine: relationship.sourceLine,
          relationshipType: relationship.type
        }));
      }
    }

    await this.addLaravelRouteRelationships(rootPath, files, graph);
    return graph;
  }

  private async addLaravelRouteRelationships(rootPath: string, files: FileInfo[], graph: ProjectGraph): Promise<void> {
    const controllerFiles = files.filter(file => {
      if (file.extension !== '.php') {
        return false;
      }
      const relativePath = path.relative(rootPath, file.path).split(path.sep).join('/').toLowerCase();
      return relativePath.startsWith('app/http/controllers/');
    });
    const routeFiles = files.filter(file => {
      if (file.extension !== '.php') {
        return false;
      }
      const relativePath = path.relative(rootPath, file.path).split(path.sep).join('/');
      return /^routes\/(web|api)\.php$/i.test(relativePath);
    });

    const controllers = new Map<string, { filePath: string; actions: PHPControllerAction[] }>();
    for (const file of controllerFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        for (const action of this.phpParser.parseControllerActions(content, file.path)) {
          const controller = controllers.get(action.controller) ?? { filePath: file.path, actions: [] };
          controller.actions.push(action);
          controllers.set(action.controller, controller);
        }
      } catch {
        console.debug(`[ProjectScanner] Skipping controller analysis for ${file.path}`);
      }
    }

    for (const [className, controller] of controllers) {
      const controllerId = `php-controller:${className}`;
      graph.addNode(createNode(controllerId, NodeType.CONTROLLER, className.split('\\').pop() ?? className, {
        filePath: controller.filePath,
        metadata: { className, actions: controller.actions.map(action => action.action) }
      }));
      for (const action of controller.actions) {
        graph.addNode(createNode(`${controllerId}#action:${action.action}`, NodeType.FUNCTION, action.action, {
          filePath: controller.filePath,
          metadata: { controller: className, parameters: action.parameters, sourceLine: action.sourceLine }
        }));
      }
    }

    for (const file of routeFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const routes = this.phpParser.parseLaravelRoutes(content, file.path);
        graph.addNode(createNode(file.path, NodeType.FILE, path.basename(file.path), { filePath: file.path }));

        for (const route of routes) {
          const routeId = `${file.path}#route:${route.method}:${route.uri}:${route.sourceLine}`;
          graph.addNode(createNode(routeId, NodeType.API_ROUTE, `${route.method} ${route.uri}`, {
            filePath: file.path,
            metadata: { method: route.method, uri: route.uri, sourceLine: route.sourceLine }
          }));

          if (route.controller) {
            const controllerId = `php-controller:${route.controller}`;
            graph.addNode(createNode(controllerId, NodeType.CONTROLLER, route.controller.split('\\').pop() ?? route.controller, {
              metadata: { className: route.controller }
            }));
            graph.addEdge(createEdge(routeId, controllerId, RelationType.MAPS_TO, {
              action: route.action,
              sourceLine: route.sourceLine
            }));

            if (route.action && controllers.get(route.controller)?.actions.some(action => action.action === route.action)) {
              const actionId = `${controllerId}#action:${route.action}`;
              graph.addEdge(createEdge(routeId, actionId, RelationType.HANDLES, {
                action: route.action,
                sourceLine: route.sourceLine
              }));
            }
          }
        }
      } catch (error) {
        console.debug(`[ProjectScanner] Skipping Laravel route analysis for ${file.path}`);
      }
    }
  }
}
