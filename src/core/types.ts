export enum Severity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

export interface ProjectContext {
  rootPath: string;
  projectName: string;
  detectedTechnologies: string[];
  configFiles: string[];
  hasGit: boolean;
  scanTimestamp: Date;
  sourceDirectories: string[];
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'composer';
}

export interface ScanStatistics {
  totalFiles: number;
  problemCount: number;
  warningCount: number;
  technologies: string[];
}

export interface FileInfo {
  path: string;
  relativePath: string;
  extension: string;
  size: number;
}
