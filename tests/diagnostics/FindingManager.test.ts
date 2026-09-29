import { describe, it, expect, beforeEach } from 'vitest';
import { FindingManager } from '../../src/diagnostics/FindingManager';
import { createFinding } from '../../src/diagnostics/Finding';
import { Severity } from '../../src/core/types';

describe('FindingManager', () => {
  let manager: FindingManager;

  beforeEach(() => {
    manager = new FindingManager();
  });

  it('should add findings', () => {
    const finding = createFinding('Test', 'Description', Severity.INFO, 'test');
    
    manager.addFinding(finding);
    
    expect(manager.getFindings()).toHaveLength(1);
    expect(manager.getFindings()[0]).toEqual(finding);
  });

  it('should add multiple findings', () => {
    const findings = [
      createFinding('Test 1', 'Description 1', Severity.INFO, 'test'),
      createFinding('Test 2', 'Description 2', Severity.WARNING, 'test')
    ];
    
    manager.addFindings(findings);
    
    expect(manager.getFindings()).toHaveLength(2);
  });

  it('should filter findings by severity', () => {
    manager.addFindings([
      createFinding('Error', 'Error desc', Severity.ERROR, 'test'),
      createFinding('Warning', 'Warning desc', Severity.WARNING, 'test'),
      createFinding('Info', 'Info desc', Severity.INFO, 'test')
    ]);
    
    const errors = manager.getFindingsBySeverity(Severity.ERROR);
    const warnings = manager.getFindingsBySeverity(Severity.WARNING);
    
    expect(errors).toHaveLength(1);
    expect(warnings).toHaveLength(1);
  });

  it('should filter findings by category', () => {
    manager.addFindings([
      createFinding('Test 1', 'Desc', Severity.INFO, 'security'),
      createFinding('Test 2', 'Desc', Severity.INFO, 'dependencies'),
      createFinding('Test 3', 'Desc', Severity.INFO, 'security')
    ]);
    
    const securityFindings = manager.getFindingsByCategory('security');
    
    expect(securityFindings).toHaveLength(2);
  });

  it('should count errors and warnings', () => {
    manager.addFindings([
      createFinding('Error 1', 'Desc', Severity.ERROR, 'test'),
      createFinding('Error 2', 'Desc', Severity.CRITICAL, 'test'),
      createFinding('Warning', 'Desc', Severity.WARNING, 'test'),
      createFinding('Info', 'Desc', Severity.INFO, 'test')
    ]);
    
    expect(manager.getErrorCount()).toBe(2);
    expect(manager.getWarningCount()).toBe(1);
  });

  it('should clear findings', () => {
    manager.addFinding(createFinding('Test', 'Desc', Severity.INFO, 'test'));
    
    expect(manager.getFindings()).toHaveLength(1);
    
    manager.clear();
    
    expect(manager.getFindings()).toHaveLength(0);
  });
});
