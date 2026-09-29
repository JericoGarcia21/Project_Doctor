import * as path from 'path';
import { ProjectContext as IProjectContext } from './types';

export class ProjectContext implements IProjectContext {
  rootPath: string;
  projectName: string;
  detectedTechnologies: string[];
  configFiles: string[];
  hasGit: boolean;
  scanTimestamp: Date;
  sourceDirectories: string[];
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'composer';

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.projectName = path.basename(rootPath);
    this.detectedTechnologies = [];
    this.configFiles = [];
    this.hasGit = false;
    this.scanTimestamp = new Date();
    this.sourceDirectories = [];
  }

  addTechnology(tech: string): void {
    if (!this.detectedTechnologies.includes(tech)) {
      this.detectedTechnologies.push(tech);
    }
  }

  addConfigFile(file: string): void {
    if (!this.configFiles.includes(file)) {
      this.configFiles.push(file);
    }
  }

  addSourceDirectory(dir: string): void {
    if (!this.sourceDirectories.includes(dir)) {
      this.sourceDirectories.push(dir);
    }
  }

  setGitAvailable(available: boolean): void {
    this.hasGit = available;
  }

  setPackageManager(manager: 'npm' | 'yarn' | 'pnpm' | 'composer'): void {
    this.packageManager = manager;
  }
}
