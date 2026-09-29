import * as fs from 'fs/promises';
import * as path from 'path';

export interface LockFileDependency {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, string>;
  devDependency: boolean;
}

export interface LockFileInfo {
  type: 'npm' | 'yarn' | 'pnpm' | 'unknown';
  lockfileVersion?: string;
  dependencies: Map<string, LockFileDependency>;
  totalDependencies: number;
  directDependencies: number;
  transitiveDependencies: number;
}

export class LockFileParser {
  /**
   * Parse lock files from a project directory
   */
  async parseLockFile(projectPath: string): Promise<LockFileInfo | null> {
    // Try package-lock.json (npm)
    const npmLock = path.join(projectPath, 'package-lock.json');
    try {
      await fs.access(npmLock);
      return await this.parseNpmLock(npmLock);
    } catch {
      // Not found
    }

    // Try yarn.lock
    const yarnLock = path.join(projectPath, 'yarn.lock');
    try {
      await fs.access(yarnLock);
      return await this.parseYarnLock(yarnLock);
    } catch {
      // Not found
    }

    // Try pnpm-lock.yaml
    const pnpmLock = path.join(projectPath, 'pnpm-lock.yaml');
    try {
      await fs.access(pnpmLock);
      return await this.parsePnpmLock(pnpmLock);
    } catch {
      // Not found
    }

    return null;
  }

  /**
   * Parse npm's package-lock.json
   */
  private async parseNpmLock(lockFilePath: string): Promise<LockFileInfo> {
    const content = await fs.readFile(lockFilePath, 'utf-8');
    const lockData = JSON.parse(content);

    const dependencies = new Map<string, LockFileDependency>();
    let directCount = 0;
    let transitiveCount = 0;

    // Parse lockfileVersion 1 (flat structure)
    if (lockData.dependencies) {
      for (const [name, info] of Object.entries(lockData.dependencies as Record<string, any>)) {
        dependencies.set(name, {
          name,
          version: info.version,
          resolved: info.resolved,
          integrity: info.integrity,
          dependencies: info.dependencies,
          devDependency: info.dev || false
        });

        if (info.dev) {
          directCount++;
        } else {
          transitiveCount++;
        }
      }
    }

    // Parse lockfileVersion 2+ (packages structure)
    if (lockData.packages) {
      for (const [pkgPath, info] of Object.entries(lockData.packages as Record<string, any>)) {
        // Skip root package
        if (pkgPath === '') continue;

        // Extract package name from path (node_modules/package-name)
        const name = pkgPath.replace(/^node_modules\//, '');

        dependencies.set(name, {
          name,
          version: info.version,
          resolved: info.resolved,
          integrity: info.integrity,
          dependencies: info.dependencies,
          devDependency: info.dev || false
        });

        // Count direct vs transitive (simplified)
        const depth = (pkgPath.match(/node_modules/g) || []).length;
        if (depth === 1) {
          directCount++;
        } else {
          transitiveCount++;
        }
      }
    }

    return {
      type: 'npm',
      lockfileVersion: lockData.lockfileVersion?.toString(),
      dependencies,
      totalDependencies: dependencies.size,
      directDependencies: directCount,
      transitiveDependencies: transitiveCount
    };
  }

  /**
   * Parse yarn's yarn.lock
   */
  private async parseYarnLock(lockFilePath: string): Promise<LockFileInfo> {
    const content = await fs.readFile(lockFilePath, 'utf-8');
    const dependencies = new Map<string, LockFileDependency>();

    // Simple yarn.lock parser
    const lines = content.split('\n');
    let currentPackage: string | null = null;
    let currentVersion = '';
    let directCount = 0;

    for (const line of lines) {
      // Package declaration: "package-name@^1.0.0":
      if (line.match(/^"?[^"\s]+@[^"]+":?\s*$/)) {
        const match = line.match(/^"?([^"@]+)@/);
        if (match) {
          currentPackage = match[1];
        }
      }
      // Version line:   version "1.0.0"
      else if (line.trim().startsWith('version') && currentPackage) {
        const versionMatch = line.match(/version\s+"([^"]+)"/);
        if (versionMatch) {
          currentVersion = versionMatch[1];
          
          if (!dependencies.has(currentPackage)) {
            dependencies.set(currentPackage, {
              name: currentPackage,
              version: currentVersion,
              devDependency: false
            });
            directCount++;
          }
        }
        currentPackage = null;
      }
    }

    return {
      type: 'yarn',
      dependencies,
      totalDependencies: dependencies.size,
      directDependencies: directCount,
      transitiveDependencies: dependencies.size - directCount
    };
  }

  /**
   * Parse pnpm's pnpm-lock.yaml
   */
  private async parsePnpmLock(lockFilePath: string): Promise<LockFileInfo> {
    const content = await fs.readFile(lockFilePath, 'utf-8');
    const dependencies = new Map<string, LockFileDependency>();

    // Simple YAML parser for pnpm-lock.yaml
    const lines = content.split('\n');
    let inPackages = false;
    let currentPackage = '';
    let directCount = 0;

    for (const line of lines) {
      if (line.trim() === 'packages:') {
        inPackages = true;
        continue;
      }

      if (inPackages) {
        // Package entry: /package-name/1.0.0:
        const pkgMatch = line.match(/^\s+\/([^/]+)\/([^:]+):/);
        if (pkgMatch) {
          currentPackage = pkgMatch[1];
          const version = pkgMatch[2];

          if (!dependencies.has(currentPackage)) {
            dependencies.set(currentPackage, {
              name: currentPackage,
              version,
              devDependency: false
            });
            directCount++;
          }
        }
      }
    }

    return {
      type: 'pnpm',
      dependencies,
      totalDependencies: dependencies.size,
      directDependencies: directCount,
      transitiveDependencies: dependencies.size - directCount
    };
  }

  /**
   * Get dependency information by name
   */
  getDependency(lockInfo: LockFileInfo, name: string): LockFileDependency | undefined {
    return lockInfo.dependencies.get(name);
  }

  /**
   * Check if a dependency is installed with a specific version
   */
  isDependencyInstalled(lockInfo: LockFileInfo, name: string, version?: string): boolean {
    const dep = lockInfo.dependencies.get(name);
    if (!dep) return false;
    if (!version) return true;
    return dep.version === version || dep.version.includes(version);
  }

  /**
   * Get all installed versions of a dependency
   */
  getDependencyVersions(lockInfo: LockFileInfo, name: string): string[] {
    const versions: string[] = [];
    lockInfo.dependencies.forEach((dep) => {
      if (dep.name === name) {
        versions.push(dep.version);
      }
    });
    return versions;
  }

  /**
   * Find duplicate dependencies (same package, different versions)
   */
  findDuplicateDependencies(lockInfo: LockFileInfo): Map<string, string[]> {
    const versionMap = new Map<string, Set<string>>();

    lockInfo.dependencies.forEach((dep) => {
      if (!versionMap.has(dep.name)) {
        versionMap.set(dep.name, new Set());
      }
      versionMap.get(dep.name)!.add(dep.version);
    });

    const duplicates = new Map<string, string[]>();
    versionMap.forEach((versions, name) => {
      if (versions.size > 1) {
        duplicates.set(name, Array.from(versions));
      }
    });

    return duplicates;
  }

  /**
   * Get statistics about the lock file
   */
  getStatistics(lockInfo: LockFileInfo): {
    type: string;
    total: number;
    direct: number;
    transitive: number;
    duplicates: number;
  } {
    const duplicates = this.findDuplicateDependencies(lockInfo);

    return {
      type: lockInfo.type,
      total: lockInfo.totalDependencies,
      direct: lockInfo.directDependencies,
      transitive: lockInfo.transitiveDependencies,
      duplicates: duplicates.size
    };
  }
}
