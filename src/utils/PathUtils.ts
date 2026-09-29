import * as path from 'path';

export class PathUtils {
  static normalize(filePath: string): string {
    return path.normalize(filePath);
  }

  static isSubPath(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  static getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  static getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  static isSourceFile(filePath: string): boolean {
    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx', '.php', '.py', '.java', '.cs', 
      '.cpp', '.c', '.go', '.rs', '.rb', '.swift', '.kt'
    ];
    return sourceExtensions.includes(this.getFileExtension(filePath));
  }

  static isConfigFile(fileName: string): boolean {
    const configFiles = [
      'package.json', 'composer.json', 'tsconfig.json', 'webpack.config.js',
      'vite.config.js', 'vite.config.ts', '.env', '.gitignore', 'README.md'
    ];
    return configFiles.includes(path.basename(fileName));
  }
}
