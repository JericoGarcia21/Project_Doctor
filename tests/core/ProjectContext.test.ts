import { describe, it, expect } from 'vitest';
import { ProjectContext } from '../../src/core/ProjectContext';

describe('ProjectContext', () => {
  it('should initialize with root path', () => {
    const context = new ProjectContext('/test/project');
    
    expect(context.rootPath).toBe('/test/project');
    expect(context.projectName).toBe('project');
    expect(context.detectedTechnologies).toEqual([]);
    expect(context.configFiles).toEqual([]);
    expect(context.hasGit).toBe(false);
  });

  it('should add technologies without duplicates', () => {
    const context = new ProjectContext('/test/project');
    
    context.addTechnology('TypeScript');
    context.addTechnology('Node.js');
    context.addTechnology('TypeScript'); // Duplicate
    
    expect(context.detectedTechnologies).toEqual(['TypeScript', 'Node.js']);
  });

  it('should add config files', () => {
    const context = new ProjectContext('/test/project');
    
    context.addConfigFile('package.json');
    context.addConfigFile('tsconfig.json');
    
    expect(context.configFiles).toEqual(['package.json', 'tsconfig.json']);
  });

  it('should set Git availability', () => {
    const context = new ProjectContext('/test/project');
    
    expect(context.hasGit).toBe(false);
    
    context.setGitAvailable(true);
    
    expect(context.hasGit).toBe(true);
  });

  it('should set package manager', () => {
    const context = new ProjectContext('/test/project');
    
    context.setPackageManager('npm');
    
    expect(context.packageManager).toBe('npm');
  });

  it('should add source directories', () => {
    const context = new ProjectContext('/test/project');
    
    context.addSourceDirectory('src');
    context.addSourceDirectory('lib');
    
    expect(context.sourceDirectories).toEqual(['src', 'lib']);
  });
});
