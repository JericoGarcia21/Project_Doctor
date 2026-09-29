import * as fs from 'fs/promises';
import * as path from 'path';

export interface FrameworkInfo {
  name: string;
  version?: string;
  confidence: 'high' | 'medium' | 'low';
  indicators: string[];
}

export class FrameworkDetector {
  constructor() {
    // Framework detector initialized
  }

  async detectFrameworks(rootPath: string): Promise<FrameworkInfo[]> {
    const frameworks: FrameworkInfo[] = [];

    // Check package.json for dependencies
    const packageJsonPath = path.join(rootPath, 'package.json');
    let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};

    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      packageJson = JSON.parse(content);
    } catch {
      // No package.json
    }

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    // Detect React
    const reactInfo = await this.detectReact(rootPath, allDeps);
    if (reactInfo) {
      frameworks.push(reactInfo);
    }

    // Detect Vue
    const vueInfo = await this.detectVue(rootPath, allDeps);
    if (vueInfo) {
      frameworks.push(vueInfo);
    }

    // Detect Angular
    const angularInfo = await this.detectAngular(rootPath, allDeps);
    if (angularInfo) {
      frameworks.push(angularInfo);
    }

    // Detect Next.js
    const nextInfo = await this.detectNextJS(rootPath, allDeps);
    if (nextInfo) {
      frameworks.push(nextInfo);
    }

    // Detect Nuxt
    const nuxtInfo = await this.detectNuxt(rootPath, allDeps);
    if (nuxtInfo) {
      frameworks.push(nuxtInfo);
    }

    // Detect Svelte
    const svelteInfo = await this.detectSvelte(rootPath, allDeps);
    if (svelteInfo) {
      frameworks.push(svelteInfo);
    }

    return frameworks;
  }

  private async detectReact(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for React in dependencies
    if (deps['react']) {
      indicators.push('react in dependencies');
      confidence = 'high';

      // Check for JSX/TSX files
      const hasJSXFiles = await this.hasFilesWithExtension(rootPath, ['.jsx', '.tsx']);
      if (hasJSXFiles) {
        indicators.push('JSX/TSX files found');
      }

      // Check for React hooks usage
      const hasHooks = await this.searchForPattern(rootPath, /use(State|Effect|Context|Reducer|Callback|Memo|Ref)/);
      if (hasHooks) {
        indicators.push('React hooks usage detected');
      }

      return {
        name: 'React',
        version: deps['react'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async detectVue(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Vue in dependencies
    if (deps['vue']) {
      indicators.push('vue in dependencies');
      confidence = 'high';

      // Check for .vue files
      const hasVueFiles = await this.hasFilesWithExtension(rootPath, ['.vue']);
      if (hasVueFiles) {
        indicators.push('.vue files found');
      }

      // Check for Composition API
      const hasCompositionAPI = await this.searchForPattern(rootPath, /import\s+{\s*ref,|import\s+{\s*reactive,|import\s+{\s*computed,/);
      if (hasCompositionAPI) {
        indicators.push('Composition API usage detected');
      }

      return {
        name: 'Vue',
        version: deps['vue'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async detectAngular(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Angular in dependencies
    if (deps['@angular/core']) {
      indicators.push('@angular/core in dependencies');
      confidence = 'high';

      // Check for angular.json
      const hasAngularJson = await this.fileExists(path.join(rootPath, 'angular.json'));
      if (hasAngularJson) {
        indicators.push('angular.json found');
      }

      // Check for Angular decorators
      const hasDecorators = await this.searchForPattern(rootPath, /@Component\(|@NgModule\(|@Injectable\(/);
      if (hasDecorators) {
        indicators.push('Angular decorators detected');
      }

      return {
        name: 'Angular',
        version: deps['@angular/core'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async detectNextJS(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Next.js in dependencies
    if (deps['next']) {
      indicators.push('next in dependencies');
      confidence = 'high';

      // Check for pages or app directory
      const hasPagesDir = await this.directoryExists(path.join(rootPath, 'pages'));
      const hasAppDir = await this.directoryExists(path.join(rootPath, 'app'));
      
      if (hasPagesDir) {
        indicators.push('pages/ directory found');
      }
      if (hasAppDir) {
        indicators.push('app/ directory found (App Router)');
      }

      // Check for next.config.js
      const hasNextConfig = await this.fileExists(path.join(rootPath, 'next.config.js')) ||
                           await this.fileExists(path.join(rootPath, 'next.config.mjs'));
      if (hasNextConfig) {
        indicators.push('next.config found');
      }

      return {
        name: 'Next.js',
        version: deps['next'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async detectNuxt(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Nuxt in dependencies
    if (deps['nuxt'] || deps['nuxt3']) {
      indicators.push('nuxt in dependencies');
      confidence = 'high';

      // Check for nuxt.config
      const hasNuxtConfig = await this.fileExists(path.join(rootPath, 'nuxt.config.js')) ||
                           await this.fileExists(path.join(rootPath, 'nuxt.config.ts'));
      if (hasNuxtConfig) {
        indicators.push('nuxt.config found');
      }

      return {
        name: 'Nuxt',
        version: deps['nuxt'] || deps['nuxt3'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async detectSvelte(rootPath: string, deps: Record<string, string>): Promise<FrameworkInfo | null> {
    const indicators: string[] = [];
    let confidence: 'high' | 'medium' | 'low' = 'low';

    // Check for Svelte in dependencies
    if (deps['svelte']) {
      indicators.push('svelte in dependencies');
      confidence = 'high';

      // Check for .svelte files
      const hasSvelteFiles = await this.hasFilesWithExtension(rootPath, ['.svelte']);
      if (hasSvelteFiles) {
        indicators.push('.svelte files found');
      }

      // Check for SvelteKit
      if (deps['@sveltejs/kit']) {
        indicators.push('SvelteKit detected');
      }

      return {
        name: 'Svelte',
        version: deps['svelte'],
        confidence,
        indicators
      };
    }

    return null;
  }

  private async hasFilesWithExtension(rootPath: string, extensions: string[]): Promise<boolean> {
    try {
      const files = await this.scanDirectory(rootPath, 2); // Scan 2 levels deep
      return files.some(file => extensions.some(ext => file.endsWith(ext)));
    } catch {
      return false;
    }
  }

  private async searchForPattern(rootPath: string, pattern: RegExp): Promise<boolean> {
    try {
      const files = await this.scanDirectory(rootPath, 2);
      const sourceFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'));
      
      for (const file of sourceFiles.slice(0, 10)) { // Check first 10 files for performance
        try {
          const content = await fs.readFile(file, 'utf-8');
          if (pattern.test(content)) {
            return true;
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Error scanning
    }
    return false;
  }

  private async scanDirectory(dir: string, maxDepth: number, currentDepth: number = 0): Promise<string[]> {
    if (currentDepth >= maxDepth) {
      return [];
    }

    const files: string[] = [];
    const ignoredDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (ignoredDirs.includes(entry.name)) {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.scanDirectory(fullPath, maxDepth, currentDepth + 1);
          files.push(...subFiles);
        } else {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }

    return files;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(dirPath);
      return stat.isDirectory();
    } catch {
      return false;
    }
  }
}
