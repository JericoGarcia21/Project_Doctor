import { describe, it, expect } from 'vitest';
import { ScanResult } from '../../src/core/ScanResult';
import { ProjectContext } from '../../src/core/ProjectContext';
import { createFinding } from '../../src/diagnostics/Finding';
import { Severity } from '../../src/core/types';

describe('ScanResult', () => {
  it('should detect errors correctly', () => {
    const context = new ProjectContext('/test/project');
    const findings = [
      createFinding('Test Error', 'Error description', Severity.ERROR, 'test'),
      createFinding('Test Warning', 'Warning description', Severity.WARNING, 'test')
    ];
    
    const scanResult = new ScanResult(context, findings, {
      totalFiles: 10,
      problemCount: 1,
      warningCount: 1,
      technologies: []
    }, 1000);
    
    expect(scanResult.hasErrors()).toBe(true);
    expect(scanResult.getErrorCount()).toBe(1);
  });

  it('should detect warnings correctly', () => {
    const context = new ProjectContext('/test/project');
    const findings = [
      createFinding('Test Warning', 'Warning description', Severity.WARNING, 'test')
    ];
    
    const scanResult = new ScanResult(context, findings, {
      totalFiles: 10,
      problemCount: 0,
      warningCount: 1,
      technologies: []
    }, 1000);
    
    expect(scanResult.hasWarnings()).toBe(true);
    expect(scanResult.getWarningCount()).toBe(1);
    expect(scanResult.hasErrors()).toBe(false);
  });

  it('should serialize to JSON correctly', () => {
    const context = new ProjectContext('/test/project');
    const findings = [];
    
    const scanResult = new ScanResult(context, findings, {
      totalFiles: 10,
      problemCount: 0,
      warningCount: 0,
      technologies: ['TypeScript']
    }, 1000);
    
    const json = scanResult.toJSON();
    
    expect(json).toHaveProperty('context');
    expect(json).toHaveProperty('findings');
    expect(json).toHaveProperty('statistics');
    expect(json).toHaveProperty('scanDuration');
  });
});
