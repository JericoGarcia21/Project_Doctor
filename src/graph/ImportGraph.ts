import Graph from 'graphology';
import * as path from 'path';

export interface ImportNode {
  filePath: string;
  relativePath: string;
  imports: string[];
  exports: string[];
  isExternal: boolean; // node_modules
  hasCircularDependency: boolean;
}

export interface ImportEdge {
  from: string;
  to: string;
  importType: 'default' | 'named' | 'namespace' | 'side-effect';
  importedNames: string[];
}

export class ImportGraph {
  private graph: Graph;
  private rootPath: string;
  private nodeMap: Map<string, ImportNode>;

  constructor(rootPath: string) {
    this.graph = new Graph({ type: 'directed' });
    this.rootPath = rootPath;
    this.nodeMap = new Map();
  }

  /**
   * Add a file node to the import graph
   */
  addNode(filePath: string, imports: string[], exports: string[]): void {
    const relativePath = path.relative(this.rootPath, filePath);
    const isExternal = this.isExternalModule(imports[0]);

    const node: ImportNode = {
      filePath,
      relativePath,
      imports,
      exports,
      isExternal,
      hasCircularDependency: false
    };

    this.nodeMap.set(filePath, node);
    
    if (!this.graph.hasNode(filePath)) {
      this.graph.addNode(filePath, node);
    } else {
      this.graph.setNodeAttribute(filePath, 'imports', imports);
      this.graph.setNodeAttribute(filePath, 'exports', exports);
    }
  }

  /**
   * Add an import edge between two files
   */
  addEdge(fromFile: string, toFile: string, importType: string, importedNames: string[]): void {
    // Ensure both nodes exist
    if (!this.graph.hasNode(fromFile)) {
      this.addNode(fromFile, [], []);
    }
    if (!this.graph.hasNode(toFile)) {
      this.addNode(toFile, [], []);
    }
    
    if (!this.graph.hasEdge(fromFile, toFile)) {
      this.graph.addDirectedEdge(fromFile, toFile, {
        from: fromFile,
        to: toFile,
        importType,
        importedNames
      });
    }
  }

  /**
   * Resolve import path to actual file path
   */
  resolveImportPath(fromFile: string, importPath: string): string | null {
    // External module (node_modules)
    if (this.isExternalModule(importPath)) {
      return null;
    }

    const fromDir = path.dirname(fromFile);
    
    // Relative import
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      const resolved = path.resolve(fromDir, importPath);
      
      // Try with extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of extensions) {
        const fullPath = resolved + ext;
        if (this.graph.hasNode(fullPath)) {
          return fullPath;
        }
      }
      
      return resolved;
    }

    // Absolute path or path alias
    // TODO: Handle tsconfig paths
    return null;
  }

  /**
   * Check if import is from node_modules
   */
  private isExternalModule(importPath: string): boolean {
    if (!importPath) {
      return false;
    }
    // External if doesn't start with . or /
    return !importPath.startsWith('.') && !importPath.startsWith('/');
  }

  /**
   * Detect circular dependencies
   */
  detectCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      try {
        const neighbors = this.graph.outNeighbors(node);
        
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            dfs(neighbor, [...path]);
          } else if (recursionStack.has(neighbor)) {
            // Found a cycle
            const cycleStart = path.indexOf(neighbor);
            const cycle = path.slice(cycleStart);
            cycle.push(neighbor); // Complete the cycle
            cycles.push(cycle);
            
            // Mark all nodes in cycle
            cycle.forEach(n => {
              const node = this.nodeMap.get(n);
              if (node) {
                node.hasCircularDependency = true;
              }
            });
          }
        }
      } catch (error) {
        // Node might not have neighbors
      }

      recursionStack.delete(node);
    };

    // Check all nodes
    for (const node of this.graph.nodes()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  /**
   * Get all dependencies of a file (direct and transitive)
   */
  getDependencies(filePath: string, includeTransitive: boolean = false): string[] {
    if (!this.graph.hasNode(filePath)) {
      return [];
    }

    if (!includeTransitive) {
      return this.graph.outNeighbors(filePath);
    }

    // BFS to get all transitive dependencies
    const dependencies = new Set<string>();
    const queue: string[] = [filePath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);

      try {
        const neighbors = this.graph.outNeighbors(current);
        neighbors.forEach(neighbor => {
          if (neighbor !== filePath) {
            dependencies.add(neighbor);
            queue.push(neighbor);
          }
        });
      } catch (error) {
        // Node might not have neighbors
      }
    }

    return Array.from(dependencies);
  }

  /**
   * Get all dependents of a file (files that import this file)
   */
  getDependents(filePath: string, includeTransitive: boolean = false): string[] {
    if (!this.graph.hasNode(filePath)) {
      return [];
    }

    if (!includeTransitive) {
      return this.graph.inNeighbors(filePath);
    }

    // BFS to get all transitive dependents
    const dependents = new Set<string>();
    const queue: string[] = [filePath];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (visited.has(current)) {
        continue;
      }
      
      visited.add(current);

      try {
        const neighbors = this.graph.inNeighbors(current);
        neighbors.forEach(neighbor => {
          if (neighbor !== filePath) {
            dependents.add(neighbor);
            queue.push(neighbor);
          }
        });
      } catch (error) {
        // Node might not have neighbors
      }
    }

    return Array.from(dependents);
  }

  /**
   * Get import statistics
   */
  getStatistics(): {
    totalFiles: number;
    totalImports: number;
    externalModules: number;
    circularDependencies: number;
    averageImportsPerFile: number;
  } {
    const totalFiles = this.graph.order;
    const totalImports = this.graph.size;
    
    let externalModules = 0;
    let circularDeps = 0;

    this.nodeMap.forEach(node => {
      if (node.isExternal) {
        externalModules++;
      }
      if (node.hasCircularDependency) {
        circularDeps++;
      }
    });

    return {
      totalFiles,
      totalImports,
      externalModules,
      circularDependencies: circularDeps,
      averageImportsPerFile: totalFiles > 0 ? totalImports / totalFiles : 0
    };
  }

  /**
   * Get the graph for visualization or export
   */
  getGraph(): Graph {
    return this.graph;
  }

  /**
   * Get a specific node
   */
  getNode(filePath: string): ImportNode | undefined {
    return this.nodeMap.get(filePath);
  }

  /**
   * Get all nodes
   */
  getAllNodes(): ImportNode[] {
    return Array.from(this.nodeMap.values());
  }

  /**
   * Export graph as JSON
   */
  export(): object {
    return {
      nodes: Array.from(this.nodeMap.entries()).map(([path, node]) => ({
        path,
        ...node
      })),
      edges: this.graph.edges().map(edge => this.graph.getEdgeAttributes(edge)),
      statistics: this.getStatistics()
    };
  }

  /**
   * Clear the graph
   */
  clear(): void {
    this.graph.clear();
    this.nodeMap.clear();
  }
}
